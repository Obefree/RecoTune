#!/usr/bin/env node
/**
 * Local dev proxy for RecoTune on-demand chord fetch.
 * POST http://<PC-IP>:8787/fetch  { "provider": "amdm"|"ultimate_guitar", "artist", "title" }
 */

import http from 'node:http';
import { handleChordFetchRequest } from './amdmFetch.mjs';
import { handleChordSearchRequest } from './chordSearch.mjs';
import { parsedStoreStats } from './parsedChordStore.mjs';

/** Bump when parser/proxy behavior changes — compare with GET /health in app settings. */
export const CHORD_FETCH_PROXY_VERSION = '2026-08-17-parsed-db';

const PORT = Number(process.env.CHORD_FETCH_PORT || 8787);

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  });
  res.end(payload);
}

function text(res, status, body, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    ...extra,
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    json(res, 200, {
      ok: true,
      version: CHORD_FETCH_PROXY_VERSION,
      hint: 'POST /fetch { provider: amdm|ultimate_guitar|github, artist, title } · POST /search { q }',
      port: PORT,
      ultimateApi: process.env.ULTIMATE_API_URL ?? 'http://127.0.0.1:5000',
      parsed: parsedStoreStats(),
    });
    return;
  }

  if (req.method !== 'POST' || (req.url !== '/fetch' && req.url !== '/search')) {
    json(res, 404, { error: 'Используйте POST /fetch или POST /search' });
    return;
  }

  let body = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    json(res, 400, { error: 'Тело запроса должно быть JSON' });
    return;
  }

  try {
    if (req.url === '/search') {
      const { status, payload } = await handleChordSearchRequest(body);
      json(res, status, payload);
      return;
    }
    const { status, payload } = await handleChordFetchRequest(body);
    if (payload.chordPro && !payload.error) {
      const accept = req.headers.accept ?? '';
      if (!accept.includes('application/json')) {
        text(res, status, payload.chordPro, { 'X-Source-Url': payload.sourceUrl ?? '' });
        return;
      }
    }
    json(res, status, payload);
  } catch (e) {
    json(res, 500, { error: e?.message ?? 'Internal error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RecoTune chord-fetch dev proxy: http://0.0.0.0:${PORT}/fetch (${CHORD_FETCH_PROXY_VERSION})`);
  console.log('Приложение подставит этот URL в Expo Go (тот же Wi‑Fi, что Metro).');
  console.log('После git pull перезапустите прокси — иначе телефон получит старый парсер.');
});
