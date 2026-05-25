#!/usr/bin/env node
/**
 * Smoke-test chord fetch endpoint (dev-proxy or Vercel).
 * Usage:
 *   node tools/chord-fetch/test-endpoint.mjs
 *   node tools/chord-fetch/test-endpoint.mjs https://your-app.vercel.app/api/fetch-chords
 */
import { handleChordFetchRequest } from './amdmFetch.mjs';

const url =
  process.argv[2]?.trim() ||
  process.env.CHORD_FETCH_URL?.trim() ||
  'http://127.0.0.1:8787/fetch';

const body = { provider: 'amdm', artist: 'Radiohead', title: 'Creep' };

if (url.startsWith('http')) {
  console.log('POST', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log('HTTP', res.status, text.slice(0, 200));
  if (res.ok) {
    try {
      const payload = JSON.parse(text);
      const cp = payload.chordPro ?? '';
      const bodyLines = cp
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^\{/.test(l));
      const first = bodyLines[0] ?? '';
      if (/^</.test(first) || /class=|href=|onclick=/i.test(first.slice(0, 120))) {
        console.error('FAIL: HTML/UI junk at start:', first.slice(0, 120));
        process.exit(1);
      }
    } catch {
      /* non-JSON */
    }
  }
  process.exit(res.ok ? 0 : 1);
}

const { status, payload } = await handleChordFetchRequest(body);
console.log('local', status, payload.error || (payload.chordPro?.slice(0, 120) ?? ''));
if (status === 200 && payload.chordPro) {
  const bodyLines = payload.chordPro
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\{/.test(l));
  const first = bodyLines[0] ?? '';
  if (/^</.test(first) || /class=|href=|onclick=|javascript:/i.test(first.slice(0, 120))) {
    console.error('FAIL: HTML/UI junk at start:', first.slice(0, 120));
    process.exit(1);
  }
}
process.exit(status === 200 ? 0 : 1);
