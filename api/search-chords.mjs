/**
 * Vercel Node serverless: POST { q } → AmDm + UG search hits (no tab body).
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

function applyCors(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
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
    res.status(200).json({ ok: true, hint: 'POST JSON { q: "artist or song" }' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Используйте POST' });
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
    const { handleChordSearchRequest } = await import('../tools/chord-fetch/chordSearch.mjs');
    const { status, payload } = await handleChordSearchRequest(body);
    res.status(status).json(payload);
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Internal error' });
  }
}
