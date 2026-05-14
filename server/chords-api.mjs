#!/usr/bin/env node
/**
 * Лёгкий API каталога аккордов. Данные — JSON на диске (не в git).
 *
 *   CHORDS_DATA_FILE=./data/songs.json   — путь к файлу { "songs": [ SongEntry, ... ] }
 *   PORT=8787
 *   CHORDS_API_TOKEN=secret             — если задан, нужен заголовок Authorization: Bearer …
 *   CORS_ALLOW_ORIGIN=*                 — по умолчанию *
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DATA_FILE = path.resolve(process.env.CHORDS_DATA_FILE || path.join(__dirname, 'data', 'songs.json'));
const API_TOKEN = (process.env.CHORDS_API_TOKEN || '').trim();
const CORS_ORIGIN = (process.env.CORS_ALLOW_ORIGIN || '*').trim();

function loadDb() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const j = JSON.parse(raw);
  if (!j || !Array.isArray(j.songs)) throw new Error('JSON must be { "songs": [ ... ] }');
  return j.songs;
}

let songsCache = null;
function getSongs() {
  if (songsCache) return songsCache;
  songsCache = loadDb();
  return songsCache;
}

function reloadSongs() {
  songsCache = null;
  return getSongs();
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
  });
  res.end(text);
}

function checkAuth(req) {
  if (!API_TOKEN) return true;
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m && m[1] === API_TOKEN;
}

function stripLyricsForCatalog(list) {
  return list.map(s => {
    const { lyrics: _l, ...rest } = s;
    const hasLyrics = typeof s.lyrics === 'string' && s.lyrics.trim().length > 0;
    return { ...rest, hasLyrics };
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  const url = new URL(req.url || '/', `http://127.0.0.1`);
  const p = url.pathname.replace(/\/$/, '') || '/';

  try {
    if (p === '/health') {
      return sendJson(res, 200, { ok: true, dataFile: DATA_FILE });
    }

    if (p === '/api/v1/catalog') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'unauthorized' });
      let list;
      try {
        list = getSongs();
      } catch (e) {
        return sendJson(res, 500, { error: 'load_failed', message: String(e?.message || e) });
      }
      return sendJson(res, 200, { songs: stripLyricsForCatalog(list) });
    }

    const mSong = p.match(/^\/api\/v1\/songs\/([^/]+)$/);
    if (mSong && req.method === 'GET') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'unauthorized' });
      const id = decodeURIComponent(mSong[1]);
      let list;
      try {
        list = getSongs();
      } catch (e) {
        return sendJson(res, 500, { error: 'load_failed', message: String(e?.message || e) });
      }
      const song = list.find(s => s.id === id);
      if (!song) return sendJson(res, 404, { error: 'not_found', id });
      return sendJson(res, 200, { song });
    }

    if (p === '/api/v1/reload' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'unauthorized' });
      try {
        reloadSongs();
        return sendJson(res, 200, { ok: true, count: getSongs().length });
      } catch (e) {
        return sendJson(res, 500, { error: String(e?.message || e) });
      }
    }

    return sendText(res, 404, 'Not found');
  } catch (e) {
    return sendJson(res, 500, { error: String(e?.message || e) });
  }
});

if (!fs.existsSync(DATA_FILE)) {
  console.error(`[chords-api] Нет файла данных: ${DATA_FILE}`);
  console.error('  Скопируйте шаблон: cp server/data/songs.example.json server/data/songs.json');
  process.exit(1);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[chords-api] http://0.0.0.0:${PORT}`);
  console.log(`[chords-api] data: ${DATA_FILE}`);
  console.log(`[chords-api] auth: ${API_TOKEN ? 'Bearer token required' : 'disabled'}`);
});
