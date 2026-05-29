/**
 * Vercel serverless: POST { q } → AmDm + UG search hits (no tab body).
 */
import { handleChordSearchRequest } from '../tools/chord-fetch/chordSearch.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, hint: 'POST JSON { q: "artist or song" }' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } },
    );
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Используйте POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Тело запроса должно быть JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const { status, payload } = await handleChordSearchRequest(body);
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
