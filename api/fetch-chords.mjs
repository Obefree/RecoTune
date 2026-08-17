/**
 * Vercel Node serverless: POST { artist, title, provider?: 'amdm' } → ChordPro JSON.
 * Use res.status/json (Node). Returning Web Response leaves the lambda hanging.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

/** @type {Map<string, { n: number, t: number }>} */
const rateByIp = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 40;

function applyCors(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf) return xf.split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real;
  return req.socket?.remoteAddress ?? 'unknown';
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

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const { parsedStoreStats } = await import('../tools/chord-fetch/parsedChordStore.mjs');
      res.status(200).json({
        ok: true,
        hint: 'POST JSON { artist, title, provider?: "amdm" }',
        parsed: parsedStoreStats(),
      });
    } catch (e) {
      res.status(200).json({
        ok: true,
        hint: 'POST JSON { artist, title, provider?: "amdm" }',
        parsed: { error: e?.message },
      });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Используйте POST' });
    return;
  }

  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    res.status(429).json({ error: 'Слишком много запросов. Повторите позже.' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {
    res.status(400).json({ error: 'Тело запроса должно быть JSON' });
    return;
  }

  try {
    const { handleChordFetchRequest } = await import('../tools/chord-fetch/amdmFetch.mjs');
    const { status, payload } = await handleChordFetchRequest(body);
    if (payload.chordPro && !payload.error) {
      const accept = String(req.headers.accept ?? '');
      if (!accept.includes('application/json')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (payload.sourceUrl) res.setHeader('X-Source-Url', payload.sourceUrl);
        res.status(status).send(payload.chordPro);
        return;
      }
    }
    if (payload.sourceUrl) res.setHeader('X-Source-Url', payload.sourceUrl);
    res.status(status).json(payload);
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Internal error' });
  }
}
