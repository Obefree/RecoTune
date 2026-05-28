#!/usr/bin/env node
/**
 * Smoke-test chord fetch (dev-proxy or Vercel, or local handleChordFetchRequest).
 * Usage:
 *   node tools/chord-fetch/test-endpoint.mjs
 *   node tools/chord-fetch/test-endpoint.mjs https://your-app.vercel.app/api/fetch-chords
 */
import { handleChordFetchRequest } from './amdmFetch.mjs';
import { validateAmdmChordLines } from './amdmChordValidate.mjs';

const SMOKE_CASES = [
  { artist: 'Radiohead', title: 'Creep' },
  { artist: 'Земфира', title: 'Искала' },
  { artist: 'Кино', title: 'Группа крови', optional: true },
];

const url =
  process.argv[2]?.trim() ||
  process.env.CHORD_FETCH_URL?.trim() ||
  'http://127.0.0.1:8787/fetch';

function checkBody(chordPro) {
  const bodyLines = chordPro
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\{/.test(l));
  const first = bodyLines[0] ?? '';
  if (/^</.test(first) || /class=|href=|onclick=|javascript:/i.test(first.slice(0, 120))) {
    console.error('FAIL: HTML/UI junk at start:', first.slice(0, 120));
    return false;
  }
  const v = validateAmdmChordLines(bodyLines);
  if (!v.ok) {
    console.error('FAIL: validation', v.code, v.message);
    return false;
  }
  return true;
}

async function runOne(body) {
  const label = `${body.artist} — ${body.title}`;
  if (url.startsWith('http')) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(label, 'HTTP', res.status, text.slice(0, 100));
    if (!res.ok) return false;
    try {
      const payload = JSON.parse(text);
      return checkBody(payload.chordPro ?? '');
    } catch {
      return false;
    }
  }
  const { status, payload } = await handleChordFetchRequest(body);
  console.log(label, 'local', status, payload.error || `${(payload.chordPro ?? '').split('\n').length} lines`);
  if (status !== 200 || !payload.chordPro) return false;
  return checkBody(payload.chordPro);
}

let ok = true;
for (const c of SMOKE_CASES) {
  const pass = await runOne({ provider: 'amdm', artist: c.artist, title: c.title });
  if (!pass && !c.optional) ok = false;
  if (!pass && c.optional) {
    console.warn('(optional skip)', c.artist, c.title);
  }
}
process.exit(ok ? 0 : 1);
