/**
 * Ultimate Guitar: search in Node, tab body via vendored ultimate-api (Flask GET /tab).
 */
import * as cheerio from 'cheerio';
import { buildChordPro } from './amdmFetch.mjs';
import { validateAmdmChordLines } from './amdmChordValidate.mjs';
import { plainChordSheetToChordPro } from './chordLayout.mjs';
import { fetchUltimateApiTab, getUltimateApiBase, tabPayloadToLines } from './ultimateApiClient.mjs';

export const UG_FETCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MAX_SEARCH_RESULTS = 12;
const MAX_TAB_ATTEMPTS = 3;
/** UG search.php type=300 is Chords (not tab/bass/ukulele). */
const UG_SEARCH_CHORDS = 300;

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

function ugVotes(row) {
  const n = Number(row.votes ?? row.rating_count ?? row.hitstotal ?? row.hits ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function ugRating(row) {
  const n = Number(row.rating ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isUgChordsType(row) {
  const raw = row.type ?? row.type_name ?? '';
  if (raw === UG_SEARCH_CHORDS || raw === String(UG_SEARCH_CHORDS)) return true;
  const type = String(raw).toLowerCase();
  if (!type) return false;
  if (/ukulele|bass|drum|power|official|video/.test(type)) return false;
  if (/\bpro\b/.test(type) && !type.includes('chord')) return false;
  return type.includes('chord');
}

function isUgChordsUrl(url) {
  const u = String(url ?? '').toLowerCase();
  if (!u) return false;
  if (/ukulele|bass-tab|drum-tab|power-tab|guitar-pro/.test(u)) return false;
  return u.includes('-chords-') || u.includes('/chords/') || u.includes('type=300');
}

/** Identity first, then rating × popularity — one winner per song. */
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
  else if (wantA && gotA) score -= 120;
  if (!isUgChordsType(row)) score -= 80;
  else score += 20;
  const rating = ugRating(row);
  const votes = ugVotes(row);
  score += rating * 8;
  score += Math.min(Math.log10(1 + votes) * 12, 40);
  return score;
}

function namesAlign(want, got) {
  if (!want || !got) return false;
  if (want === got) return true;
  if (want.length >= 5 && got.length >= 5 && (want.includes(got) || got.includes(want))) return true;
  return false;
}

function compositionKey(row) {
  const a = normalizeMatch(row.artist_name ?? row.artist ?? '');
  const t = normalizeMatch(row.song_name ?? row.title ?? row.name ?? '');
  return `${a}|${t}`;
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
  if (a && t) add(`${t} ${a}`);
  if (!a && t) add(t);
  return out;
}

async function searchUgCandidates(artist, title) {
  const queries = buildUgSearchQueries(artist, title);
  const rows = [];
  for (const q of queries) {
    const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&type=${UG_SEARCH_CHORDS}&value=${encodeURIComponent(q)}`;
    let text;
    try {
      const { res, text: body } = await fetchHtml(searchUrl);
      if (res.status === 403 && !parseJsStore(body)) {
        return { blocked: true, rows: [], searchUrl };
      }
      if (!res.ok && res.status !== 403) continue;
      text = body;
    } catch {
      continue;
    }
    const store = parseJsStore(text);
    if (!store) {
      if (isCloudflareHtml(text)) {
        return { blocked: true, rows: [], searchUrl };
      }
      continue;
    }
    rows.push(...collectUgSearchRows(store));
    if (rows.length >= 40) break;
  }
  const scored = rows
    .map(row => ({ row, score: scoreUgResult(row, artist, title), url: tabUrlFromRow(row) }))
    .filter(x => {
      if (!x.url || !isUgChordsType(x.row) || !isUgChordsUrl(x.url) || x.score < 100) return false;
      const wantA = normalizeMatch(artist);
      const wantT = normalizeMatch(title);
      const gotA = normalizeMatch(x.row.artist_name ?? x.row.artist ?? '');
      const gotT = normalizeMatch(x.row.song_name ?? x.row.title ?? x.row.name ?? '');
      if (wantT && !namesAlign(wantT, gotT)) return false;
      if (wantA && !namesAlign(wantA, gotA)) return false;
      return true;
    });
  const bestBySong = new Map();
  for (const item of scored) {
    const key = compositionKey(item.row);
    const prev = bestBySong.get(key);
    if (!prev || item.score > prev.score) bestBySong.set(key, item);
  }
  const uniq = [...bestBySong.values()].sort((a, b) => b.score - a.score);
  return { blocked: false, rows: uniq.slice(0, MAX_SEARCH_RESULTS), searchUrl: null };
}

function scoreUgAgainstQuery(query, artist, title) {
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

/** Free-text UG search for library autocomplete (no tab body). */
export async function searchUgByQuery(query) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];

  const search = await searchUgCandidates('', q);
  if (search.blocked || !search.rows.length) return [];

  return search.rows
    .map(({ row, url }) => {
      const artist = String(row.artist_name ?? row.artist ?? '').trim();
      const title = String(row.song_name ?? row.title ?? row.name ?? '').trim();
      if (!title) return null;
      return {
        provider: 'ultimate_guitar',
        artist: artist || 'Unknown',
        title,
        sourceUrl: url,
        score: scoreUgAgainstQuery(q, artist, title) + scoreUgResult(row, '', q) * 0.35,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_SEARCH_RESULTS);
}

function wikiContentToLines(raw) {
  let text = decodeHtml(String(raw ?? ''));
  text = text.replace(/\[(?:ch|tab)\]([^\[]+?)\[\/(?:ch|tab)\]/gi, '[$1]');
  text = text.replace(/<\/?[^>]+>/g, '');
  return text
    .split('\n')
    .map(l => l.replace(/\r/g, '').trimEnd())
    .filter(l => l.trim());
}

async function fetchUgTabViaNode(url) {
  let res;
  let text;
  try {
    ({ res, text } = await fetchHtml(url));
  } catch (e) {
    return { ok: false, code: 'network', error: e?.message ?? 'network' };
  }
  const store = parseJsStore(text);
  if (!store) {
    if (res.status === 403 || isCloudflareHtml(text)) {
      return { ok: false, code: 'blocked', error: 'Ultimate Guitar blocked the request (Cloudflare).' };
    }
    return { ok: false, code: 'no_tab', error: 'js-store not found on tab page' };
  }
  const data = store?.store?.page?.data ?? {};
  const tabView = data.tab_view ?? {};
  const wiki = tabView?.wiki_tab?.content ?? tabView?.wikiTab?.content;
  const raw = wiki || tabView?.tab?.content;
  const content_lines = wikiContentToLines(raw);
  if (content_lines.length < 2) {
    return { ok: false, code: 'no_tab', error: 'Tab content too short' };
  }
  const tabMeta = data.tab ?? {};
  return {
    ok: true,
    tab: {
      title: String(tabView.song_name ?? tabView.song?.name ?? tabMeta.song_name ?? '').trim(),
      artist_name: String(tabView.artist_name ?? tabView.artist?.name ?? tabMeta.artist_name ?? '').trim(),
      content_lines,
    },
  };
}

function parseUltimateApiTabPayload(tab, expectedArtist, expectedTitle, sourceUrl) {
  const rawLines = tabPayloadToLines(tab);
  if (!rawLines.length) {
    return { ok: false, code: 'no_tab', error: 'ultimate-api: нет строк таба.' };
  }

  // ultimate-api gives chord rows positioned by spaces above lyrics; the shared
  // converter aligns them into inline [chord] markers (same path as AmDm).
  const lines = plainChordSheetToChordPro(rawLines.join('\n'));

  const validation = validateAmdmChordLines(lines);
  if (!validation.ok) {
    return { ok: false, code: validation.code, error: validation.message };
  }

  const songName = String(tab.title ?? expectedTitle).trim();
  const artistName = String(tab.artist_name ?? tab.artist ?? expectedArtist).trim();

  const chordPro = buildChordPro({
    title: songName || expectedTitle,
    artist: artistName || expectedArtist,
    lines,
    note: 'Ultimate Guitar (ultimate-api)',
  });

  return {
    ok: true,
    chordPro,
    title: songName || expectedTitle,
    artist: artistName || expectedArtist,
    sourceUrl,
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

  const apiBase = getUltimateApiBase();

  for (const { url, score } of search.rows.slice(0, MAX_TAB_ATTEMPTS)) {
    if (score < 20) continue;

    let api = await fetchUgTabViaNode(url);
    if (!api.ok && (api.code === 'blocked' || api.code === 'network' || api.code === 'no_tab')) {
      api = await fetchUltimateApiTab(url);
    }
    if (!api.ok) {
      lastFail = { error: api.error, code: api.code, sourceUrl: url };
      continue;
    }

    const parsed = parseUltimateApiTabPayload(api.tab, artist, title, url);
    if (parsed.ok) {
      return {
        chordPro: parsed.chordPro,
        sourceUrl: parsed.sourceUrl ?? url,
        title: parsed.title,
        artist: parsed.artist,
      };
    }
    lastFail = { error: parsed.error, code: parsed.code, sourceUrl: url };
  }

  if (lastFail.code === 'ultimate_api_down') {
    return {
      stub: true,
      chordPro: null,
      error: `${lastFail.error} (${apiBase})`,
      code: lastFail.code,
      sourceUrl: lastFail.sourceUrl,
    };
  }

  return {
    stub: true,
    chordPro: null,
    error: lastFail.error,
    code: lastFail.code,
    sourceUrl: lastFail.sourceUrl,
  };
}
