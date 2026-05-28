/**
 * Ultimate Guitar search + ChordPro parse (dev-proxy only; not in APK).
 */
import * as cheerio from 'cheerio';
import { buildChordPro } from './amdmFetch.mjs';
import { validateAmdmChordLines } from './amdmChordValidate.mjs';

export const UG_FETCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MAX_SEARCH_RESULTS = 12;
const MAX_TAB_ATTEMPTS = 4;

function decodeHtml(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeMatch(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9а-я]+/g, '')
    .trim();
}

function isCloudflareHtml(html) {
  return /Just a moment|cf-browser-verification|challenge-platform/i.test(html);
}

function parseJsStore(html) {
  const $ = cheerio.load(html);
  const raw =
    $('.js-store').attr('data-content') ??
    $('[data-content]').filter((_, el) => {
      const dc = $(el).attr('data-content') ?? '';
      return dc.includes('"store"') && dc.includes('"page"');
    }).first().attr('data-content');
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(decodeHtml(raw));
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UG_FETCH_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  const text = await res.text();
  return { res, text };
}

/** `[ch]Am[/ch]` → `[Am]`; strip tab markers. */
export function ugWikiContentToLines(raw) {
  if (!raw?.trim()) return [];
  let text = decodeHtml(raw);
  text = text.replace(/\[(?:ch|tab)\]([^\[]+?)\[\/(?:ch|tab)\]/gi, '[$1]');
  text = text.replace(/<\/?[^>]+>/g, '');
  return text
    .split('\n')
    .map(l => l.replace(/\r/g, '').trimEnd())
    .filter(l => l.trim());
}

function scoreUgResult(row, artist, title) {
  const wantA = normalizeMatch(artist);
  const wantT = normalizeMatch(title);
  const gotA = normalizeMatch(row.artist_name ?? row.artist ?? '');
  const gotT = normalizeMatch(row.song_name ?? row.title ?? row.name ?? '');
  let score = 0;
  if (wantT && gotT === wantT) score += 80;
  else if (wantT && (gotT.includes(wantT) || wantT.includes(gotT))) score += 45;
  if (wantA && gotA === wantA) score += 50;
  else if (wantA && (gotA.includes(wantA) || wantA.includes(gotA))) score += 30;
  const type = String(row.type ?? row.type_name ?? '').toLowerCase();
  if (type.includes('chord')) score += 25;
  if (row.rating) score += Math.min(Number(row.rating) * 2, 10);
  return score;
}

function collectUgSearchRows(storeJson) {
  const data = storeJson?.store?.page?.data ?? {};
  const buckets = [];
  if (Array.isArray(data.results)) buckets.push(...data.results);
  if (Array.isArray(data.tabs)) buckets.push(...data.tabs);
  const nested = data.search?.results ?? data.search_results;
  if (Array.isArray(nested)) buckets.push(...nested);
  return buckets;
}

function tabUrlFromRow(row) {
  const url =
    row.tab_url ??
    row.url ??
    row.link ??
    (row.id ? `https://tabs.ultimate-guitar.com/tab/${row.id}` : null);
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http')) return url.split('?')[0];
  if (url.startsWith('/')) return `https://www.ultimate-guitar.com${url}`;
  return null;
}

function buildUgSearchQueries(artist, title) {
  const a = String(artist ?? '').trim();
  const t = String(title ?? '').trim();
  const out = [];
  const add = q => {
    const s = q.replace(/\s+/g, ' ').trim();
    if (s.length >= 2 && !out.includes(s)) out.push(s);
  };
  if (a && t) add(`${a} ${t}`);
  if (t) add(t);
  if (a && t) add(`${t} ${a}`);
  return out;
}

async function searchUgCandidates(artist, title) {
  const queries = buildUgSearchQueries(artist, title);
  const rows = [];
  for (const q of queries) {
    const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`;
    let text;
    try {
      const { res, text: body } = await fetchHtml(searchUrl);
      if (res.status === 403 || isCloudflareHtml(body)) {
        return { blocked: true, rows: [], searchUrl };
      }
      if (!res.ok) continue;
      text = body;
    } catch {
      continue;
    }
    if (isCloudflareHtml(text)) {
      return { blocked: true, rows: [], searchUrl };
    }
    const store = parseJsStore(text);
    if (!store) continue;
    rows.push(...collectUgSearchRows(store));
    if (rows.length >= MAX_SEARCH_RESULTS) break;
  }
  const scored = rows
    .map(row => ({ row, score: scoreUgResult(row, artist, title), url: tabUrlFromRow(row) }))
    .filter(x => x.url)
    .sort((a, b) => b.score - a.score);
  const uniq = [];
  const seen = new Set();
  for (const item of scored) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    uniq.push(item);
    if (uniq.length >= MAX_SEARCH_RESULTS) break;
  }
  return { blocked: false, rows: uniq, searchUrl: null };
}

function parseTabPage(html, expectedArtist, expectedTitle) {
  if (isCloudflareHtml(html)) {
    return { ok: false, code: 'blocked', error: 'Ultimate Guitar заблокировал запрос (Cloudflare).' };
  }
  const store = parseJsStore(html);
  const tabView = store?.store?.page?.data?.tab_view;
  const wiki = tabView?.wiki_tab?.content ?? tabView?.wikiTab?.content;
  const rawContent = wiki ?? tabView?.tab?.content;
  if (!rawContent?.trim()) {
    return { ok: false, code: 'no_tab', error: 'На странице UG нет текста таба.' };
  }

  const lines = ugWikiContentToLines(rawContent);
  const validation = validateAmdmChordLines(lines);
  if (!validation.ok) {
    return { ok: false, code: validation.code, error: validation.message };
  }

  const songName =
    tabView?.song_name ?? tabView?.song?.name ?? store?.store?.page?.data?.tab?.song_name ?? expectedTitle;
  const artistName =
    tabView?.artist_name ?? tabView?.artist?.name ?? store?.store?.page?.data?.tab?.artist_name ?? expectedArtist;

  const chordPro = buildChordPro({
    title: String(songName ?? expectedTitle).trim(),
    artist: String(artistName ?? expectedArtist).trim(),
    lines,
    note: 'Ultimate Guitar',
  });

  return {
    ok: true,
    chordPro,
    title: String(songName ?? expectedTitle).trim(),
    artist: String(artistName ?? expectedArtist).trim(),
  };
}

/**
 * @returns {Promise<{ chordPro: string, sourceUrl: string, title: string, artist: string } | { stub: true, error: string, code?: string, sourceUrl?: string }>}
 */
export async function fetchUgChordPro(artist, title) {
  const search = await searchUgCandidates(artist, title);
  if (search.blocked) {
    return {
      stub: true,
      error: 'Ultimate Guitar недоступен с этого IP (Cloudflare).',
      code: 'blocked',
      sourceUrl: search.searchUrl ?? 'https://www.ultimate-guitar.com/',
    };
  }

  if (!search.rows.length) {
    return {
      stub: true,
      error: 'Таб не найден на Ultimate Guitar.',
      code: 'not_found',
    };
  }

  let lastFail = { error: 'Таб не найден на Ultimate Guitar.', code: 'not_found', sourceUrl: undefined };

  for (const { url, score } of search.rows.slice(0, MAX_TAB_ATTEMPTS)) {
    if (score < 20) continue;
    let html;
    try {
      const { res, text } = await fetchHtml(url);
      if (!res.ok) {
        lastFail = { error: `Страница таба: HTTP ${res.status}`, code: 'http', sourceUrl: url };
        continue;
      }
      html = text;
    } catch (e) {
      lastFail = {
        error: `Не удалось открыть таб (${e?.message ?? 'network'})`,
        code: 'network',
        sourceUrl: url,
      };
      continue;
    }

    const parsed = parseTabPage(html, artist, title);
    if (parsed.ok) {
      return {
        chordPro: parsed.chordPro,
        sourceUrl: url,
        title: parsed.title,
        artist: parsed.artist,
      };
    }
    lastFail = { error: parsed.error, code: parsed.code, sourceUrl: url };
  }

  return {
    stub: true,
    chordPro: null,
    error: lastFail.error,
    code: lastFail.code,
    sourceUrl: lastFail.sourceUrl,
  };
}
