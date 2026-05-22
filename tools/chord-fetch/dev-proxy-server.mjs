#!/usr/bin/env node
/**
 * Local dev proxy for RecoTune on-demand chord fetch.
 * POST http://<PC-IP>:8787/fetch  { "provider": "amdm"|"ultimate_guitar", "artist", "title" }
 */

import http from 'node:http';
import { handleChordFetchRequest } from './amdmFetch.mjs';

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
      hint: 'POST /fetch with { provider, artist, title }',
      port: PORT,
    });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/fetch') {
    json(res, 404, { error: 'Используйте POST /fetch' });
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
  console.log(`RecoTune chord-fetch dev proxy: http://0.0.0.0:${PORT}/fetch`);
  console.log('Приложение подставит этот URL в Expo Go (тот же Wi‑Fi, что Metro).');
});
