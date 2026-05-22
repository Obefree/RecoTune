/**
 * Vercel serverless: POST { artist, title, provider?: 'amdm' } → ChordPro JSON or plain text.
 * Deploy this repo to your own Vercel project; set EXPO_PUBLIC_CHORD_FETCH_URL in the app.
 */
import { handleChordFetchRequest } from '../tools/chord-fetch/amdmFetch.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

/** @type {Map<string, { n: number, t: number }>} */
const rateByIp = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 40;

function clientIp(req) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function rateLimit(ip) {
  const now = Date.now();
  const row = rateByIp.get(ip);
  if (!row || now - row.t > RATE_WINDOW_MS) {
    rateByIp.set(ip, { n: 1, t: now });
    return true;
  }
  if (row.n >= RATE_MAX) return false;
  row.n += 1;
  return true;
}

function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS,
      ...extraHeaders,
    },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method === 'GET') {
    return jsonResponse(200, {
      ok: true,
      hint: 'POST JSON { artist, title, provider?: "amdm" }',
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Используйте POST' });
  }

  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return jsonResponse(429, { error: 'Слишком много запросов. Повторите позже.' });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Тело запроса должно быть JSON' });
  }

  try {
    const { status, payload } = await handleChordFetchRequest(body);
    if (payload.chordPro && !payload.error) {
      const accept = req.headers.get('accept') ?? '';
      if (!accept.includes('application/json')) {
        return new Response(payload.chordPro, {
          status,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Source-Url': payload.sourceUrl ?? '',
            ...CORS,
          },
        });
      }
    }
    return jsonResponse(status, payload, payload.sourceUrl ? { 'X-Source-Url': payload.sourceUrl } : {});
  } catch (e) {
    return jsonResponse(500, { error: e?.message ?? 'Internal error' });
  }
}
