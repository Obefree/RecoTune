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
  process.exit(res.ok ? 0 : 1);
}

const { status, payload } = await handleChordFetchRequest(body);
console.log('local', status, payload.error || (payload.chordPro?.slice(0, 120) ?? ''));
process.exit(status === 200 ? 0 : 1);
