/**
 * Live catalog search: AmDm + Ultimate Guitar (dev-proxy POST /search).
 */
import * as cheerio from 'cheerio';
import {
  AMDM_FETCH_UA,
  buildAmdmSearchQueries,
} from './amdmFetch.mjs';
import { searchUgByQuery } from './ugFetch.mjs';

const MAX_PER_PROVIDER = 16;
const AMDM_SEARCH_ATTEMPTS = 3;

function normalizeMatch(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9а-я]+/g, '')
    .trim();
}

function scoreAgainstQuery(query, artist, title) {
  const q = normalizeMatch(query);
  const a = normalizeMatch(artist);
  const t = normalizeMatch(title);
  let score = 0;
  if (!q) return 0;
  if (t === q) score += 90;
  else if (t.includes(q) || q.includes(t)) score += 50;
  if (a === q) score += 70;
  else if (a.includes(q) || q.includes(a)) score += 40;
  if (a && t && `${a}${t}`.includes(q)) score += 25;
  return score;
}

function slugToLabel(slug) {
  return decodeURIComponent(String(slug ?? ''))
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmdmSongUrl(href) {
  const m = String(href).match(/akkordi\/([^/]+)\/(\d+)\/([^/?#]+)/i);
  if (!m) return null;
  return {
    artistSlug: m[1],
    titleSlug: m[3],
    url: href.split('?')[0].replace(/\/+$/, ''),
  };
}

async function fetchAmdmSearchHtml(q) {
  const searchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(q)}`;
  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': AMDM_FETCH_UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) return { html: '', searchUrl, ok: false };
  return { html: await res.text(), searchUrl, ok: true };
}

function parseAmdmSearchHtml(html, query) {
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();

  $('a[href*="/akkordi/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const full = href.startsWith('http') ? href : `https://amdm.ru${href.startsWith('/') ? '' : '/'}${href}`;
    const parsed = parseAmdmSongUrl(full);
    if (!parsed || seen.has(parsed.url)) return;
    seen.add(parsed.url);
    const linkText = $(el).text().replace(/\s+/g, ' ').trim();
    let artist = slugToLabel(parsed.artistSlug);
    let title = slugToLabel(parsed.titleSlug);
    if (linkText.includes(' — ')) {
      const [a, t] = linkText.split(' — ').map(s => s.trim());
      if (a) artist = a;
      if (t) title = t;
    } else if (linkText && linkText.length >= 2 && linkText.length < 120) {
      title = linkText;
    }
    const score = scoreAgainstQuery(query, artist, title) + 10;
    if (score < 8) return;
    rows.push({
      provider: 'amdm',
      artist,
      title,
      sourceUrl: parsed.url,
      score,
    });
  });

  const songRe = /https:\/\/amdm\.ru\/akkordi\/[^/\s"'<>]+\/\d+\/[^/\s"'<>]+\/?/gi;
  for (const m of html.matchAll(songRe)) {
    const url = m[0].split('?')[0].replace(/\/+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    const parsed = parseAmdmSongUrl(url);
    if (!parsed) continue;
    const artist = slugToLabel(parsed.artistSlug);
    const title = slugToLabel(parsed.titleSlug);
    const score = scoreAgainstQuery(query, artist, title);
    if (score < 8) continue;
    rows.push({ provider: 'amdm', artist, title, sourceUrl: url, score });
  }

  rows.sort((a, b) => b.score - a.score);
  return rows;
}

/** Search amdm.ru HTML index for a free-text query. */
export async function searchAmdmByQuery(query) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];

  const phrases = buildAmdmSearchQueries('', q).slice(0, AMDM_SEARCH_ATTEMPTS);
  const merged = [];
  const seen = new Set();

  for (const phrase of phrases) {
    let html;
    try {
      const fetched = await fetchAmdmSearchHtml(phrase);
      if (!fetched.ok) continue;
      html = fetched.html;
    } catch {
      continue;
    }
    for (const row of parseAmdmSearchHtml(html, q)) {
      const key = `${normalizeMatch(row.artist)}|${normalizeMatch(row.title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
      if (merged.length >= MAX_PER_PROVIDER) break;
    }
    if (merged.length >= MAX_PER_PROVIDER) break;
  }

  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, MAX_PER_PROVIDER);
}

function dedupeRemoteResults(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${normalizeMatch(row.artist)}|${normalizeMatch(row.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * POST body: { q, providers?: ['amdm','ultimate_guitar'], limit?: number }
 * Response: { results: [{ provider, artist, title, score, sourceUrl? }] }
 */
export async function handleChordSearchRequest(body) {
  const q = String(body.q ?? body.query ?? '').trim();
  if (q.length < 2) {
    return { status: 400, payload: { error: 'Нужен q длиной ≥ 2 символов' } };
  }

  const limit = Math.min(Math.max(Number(body.limit) || 24, 1), 40);
  const want = new Set(
    (Array.isArray(body.providers) ? body.providers : ['amdm', 'ultimate_guitar']).map(p =>
      String(p).trim(),
    ),
  );

  const tasks = [];
  if (want.has('amdm')) {
    tasks.push(
      searchAmdmByQuery(q).then(rows =>
        rows.map(r => ({ ...r, provider: 'amdm' })),
      ),
    );
  }
  if (want.has('ultimate_guitar') || want.has('ug')) {
    tasks.push(searchUgByQuery(q));
  }

  const chunks = await Promise.all(tasks);
  const merged = dedupeRemoteResults(chunks.flat());
  merged.sort((a, b) => b.score - a.score);

  return {
    status: 200,
    payload: { results: merged.slice(0, limit), query: q },
  };
}
