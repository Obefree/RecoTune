#!/usr/bin/env node
/**
 * Smoke-test stem-separate dev proxy.
 *   node tools/stem-separate/test-endpoint.mjs
 *   node tools/stem-separate/test-endpoint.mjs --separate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = (process.argv.find(a => a.startsWith('http')) || process.env.STEM_SEPARATE_URL || 'http://127.0.0.1:8788').replace(/\/+$/, '');
const withSeparate = process.argv.includes('--separate');

function writeMinimalWav(filePath, durationSec = 0.25, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.2;
    buf.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

async function main() {
  const healthRes = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
  const health = await healthRes.json();
  console.log('GET /health', healthRes.status, health);

  if (!healthRes.ok) {
    process.exit(1);
  }

  if (!withSeparate) {
    if (!health.demucs) {
      console.warn('WARN: demucs=false — health OK, separation skipped (pass --separate after pip install)');
    }
    process.exit(0);
  }

  if (!health.demucs) {
    console.error('FAIL: demucs not installed — install per README, then re-run with --separate');
    process.exit(1);
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const wavPath = path.join(here, '.test-tone.wav');
  writeMinimalWav(wavPath);
  const audioBase64 = fs.readFileSync(wavPath).toString('base64');
  fs.unlinkSync(wavPath);

  console.log('POST /separate (minimal WAV, mode=minus) — may take 1–3 min on first Demucs run…');
  const sepRes = await fetch(`${base}/separate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mode: 'minus', filename: 'test.wav' }),
    signal: AbortSignal.timeout(900_000),
  });
  const sep = await sepRes.json();
  console.log('POST /separate', sepRes.status, sep.error || `stems: ${(sep.stems ?? []).map(s => s.id).join(', ')}`);
  process.exit(sepRes.ok && (sep.stems?.length ?? 0) > 0 ? 0 : 1);
}

main().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
