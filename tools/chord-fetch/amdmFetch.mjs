/**
 * Shared AmDm search + ChordPro parse (dev-proxy + Vercel serverless).
 */
import * as cheerio from 'cheerio';
import { preHtmlChordSignal, validateAmdmChordLines } from './amdmChordValidate.mjs';
import { plainChordSheetToChordPro } from './chordLayout.mjs';
import { lookupParsedChord, rememberParsedChord } from './parsedChordStore.mjs';

export const AMDM_FETCH_UA = 'RecoTune-chord-fetch/1.0 (on-demand; single song per request)';

const MAX_URLS_PER_SEARCH = 6;
/** Open at most this many tab pages per fetch (across all search queries). */
const MAX_TAB_ATTEMPTS = 4;
/** Stop trying more search phrases once a candidate scores at least this. */
const STRONG_CANDIDATE_SCORE = 95;
/** Cap search phrases tried per fetch (speed). */
const MAX_SEARCH_QUERIES = 5;
const MIN_PRE_CHORD_DIVS = 3;
const AMDM_DEV_LOG = process.env.RECO_CHORD_FETCH_DEBUG === '1';

/** Compilation / cover / parody URL segments — penalize vs the original artist page. */
export const COVER_PATH_RE =
  /peredelannye_pesni_parodii|pesni_iz_kino_i_multfilmov|detskie_pesni|novogodnie_pesni/i;
/** Cover / karaoke / parody markers in the result title text. */
export const COVER_TEXT_RE =
  /(кавер|cover|пародия|parodi|караоке|karaoke|\bминус\b|\bminus\b|обработк|ремикс|remix|\bby\b)/i;

/** Normalized artist tokens accepted on the tab page (e.g. Кино ↔ Цой). */
const ARTIST_PAGE_ALIASES = {
  кино: ['кино', 'цой', 'tsoi', 'coy', 'viktor', 'victor'],
};

const CYR_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const EN_TO_RU = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>?';
const RU_TO_EN = 'йцукенгшщзхъфывапролджэячсмитьбюЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ';

/** Extra AmDm search phrases when the band has a common alias on tab sites. */
const ARTIST_SEARCH_ALIASES = {
  кино: ['цой', 'виктор цой', 'viktor tsoi'],
};

function slugify(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9а-я]+/gi, '_')
    .replace(/^_+|_+$/g, '');
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

function translitRuToLat(s) {
  return s
    .toLowerCase()
    .split('')
    .map(ch => CYR_TO_LAT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function swapKeyboardLayout(input, mapFrom, mapTo) {
  let out = '';
  for (const ch of input) {
    const i = mapFrom.indexOf(ch);
    out += i >= 0 ? mapTo[i] : ch;
  }
  return out;
}

function decodeHtml(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function artistSlugVariants(artist) {
  const base = slugify(artist);
  const lat = translitRuToLat(artist).replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
  return [...new Set([base, lat].filter(Boolean))];
}

function scoreAmdmLink(href, artist, title, linkText = '') {
  const path = href.toLowerCase();
  const artistSlugs = artistSlugVariants(artist);
  const titleSlugs = [
    slugify(title),
    translitRuToLat(title).replace(/\s+/g, '_').replace(/^_+|_+$/g, ''),
  ].filter(Boolean);
  let score = 0;
  for (const a of artistSlugs) {
    if (a && path.includes(`/akkordi/${a}/`)) score += 60;
    if (a && path.includes(`/${a}/`)) score += 15;
  }
  for (const t of titleSlugs) {
    if (t && path.includes(t)) score += 35;
  }
  // Reward when the result title text echoes the requested artist (original, not cover).
  const wantA = normalizeMatch(artist);
  const gotText = normalizeMatch(linkText);
  if (wantA && gotText && (gotText.includes(wantA) || wantA.includes(gotText))) score += 20;
  // Penalize compilations, parodies, covers and karaoke versions.
  if (COVER_PATH_RE.test(path)) score -= 80;
  if (linkText && COVER_TEXT_RE.test(linkText)) score -= 70;
  return score;
}

/** Drop AmDm nav/UI fragments that sometimes appear before the tab block. */
function isAmdmUiGarbageLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^</.test(t)) return true;
  if (/^(?:div|span|button|script|style|a|href|class|onclick)\b/i.test(t)) return true;
  if (/class="|onclick=|javascript:|href=|data-v-|v-if=/i.test(t)) return true;
  if (/^(?:сохранить|войти|регистрация|подбор|аккорды|табы|главная|поиск|меню)\b/i.test(t)) return true;
  if (/amdm\.ru|logo|navbar|breadcrumb|cookie/i.test(t)) return true;
  return false;
}

function scoreAmdmPreHtml(html) {
  let score = 0;
  const chordDivs = preHtmlChordSignal(html);
  if (/podbor__chord/i.test(html)) score += 120;
  if (/data-chord=/i.test(html)) score += 80;
  score += Math.min(chordDivs * 8, 80);
  if (chordDivs < MIN_PRE_CHORD_DIVS) score -= 40;
  if (/<button|<nav|navbar|header-menu|breadcrumb/i.test(html)) score -= 60;
  if (html.length > 400) score += 15;
  else if (html.length < 80) score -= 30;
  return score;
}

/** Pick the `<pre>` that contains the chord/lyrics podbor, not site chrome. */
function pickAmdmPreHtml($) {
  const candidates = [];
  $('pre').each((_, el) => {
    const html = $(el).html()?.trim();
    if (html) candidates.push({ html, score: scoreAmdmPreHtml(html) });
  });
  if (!candidates.length) {
    const fallback = $('.podbor pre, .podbor__text pre, #chords pre').first().html()?.trim();
    if (fallback) candidates.push({ html: fallback, score: scoreAmdmPreHtml(fallback) });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.html ?? null;
}

/**
 * AmDm `<pre>` keeps a chord row above each lyric line, positioned by spaces.
 * Reconstruct that column-accurate plain text (chord divs → their data-chord,
 * all other tags stripped) so the shared converter can align [chord] markers.
 */
function amdmPreHtmlToPlainText(html) {
  let s = html.replace(/<div[^>]*class="podbor__chord"[^>]*>[\s\S]*?<\/div>/gi, block => {
    const m = block.match(/data-chord="([^"]*)"/i);
    const chord = (m ? m[1] : block.replace(/<[^>]+>/g, '')).trim();
    return chord;
  });
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  return decodeHtml(s);
}

function amdmPreHtmlToChordProLines(html) {
  const plain = amdmPreHtmlToPlainText(html);
  const lines = plainChordSheetToChordPro(plain);
  // Keep blank spacers; drop only non-empty nav/UI leftovers.
  return lines.filter(line => !line.trim() || !isAmdmUiGarbageLine(line));
}

export function buildChordPro({ title, artist, lines, sourceUrl, note }) {
  const header = [
    `{title: ${title}}`,
    `{artist: ${artist}}`,
    note ? `{comment: ${note}}` : null,
  ].filter(Boolean);
  return `${header.join('\n')}\n${lines.join('\n')}`;
}

function parseOgTitle(ogTitle) {
  if (!ogTitle?.trim()) return null;
  // Split on a spaced dash only, so "Би-2 - Кукушка" → ["Би-2", "Кукушка"].
  let dash = ogTitle.split(/\s+[-–—]\s+/);
  if (dash.length < 2) dash = ogTitle.split(/\s*[-–—]\s*/);
  if (dash.length < 2) return null;
  const artist = dash[0].replace(/\s*\(аккорды.*$/i, '').trim();
  const title = dash
    .slice(1)
    .join(' - ')
    .replace(/\s*\(аккорды.*$/i, '')
    .trim();
  if (!artist || !title) return null;
  return { artist, title };
}

function scorePageTitleMatch(parsed, expectedArtist, expectedTitle) {
  if (!parsed) return { total: 0, titleScore: 0, artistScore: 0 };
  const ea = normalizeMatch(expectedArtist);
  const et = normalizeMatch(expectedTitle);
  const pa = normalizeMatch(parsed.artist);
  const pt = normalizeMatch(parsed.title);
  let titleScore = 0;
  let artistScore = 0;
  if (et && pt) {
    if (et === pt) titleScore = 80;
    else if (pt.includes(et) || et.includes(pt)) titleScore = 55;
    else if (et.length >= 4 && pt.startsWith(et.slice(0, 4))) titleScore = 25;
  }
  if (ea && pa) {
    if (ea === pa) artistScore = 50;
    else if (pa.includes(ea) || ea.includes(pa)) artistScore = 35;
    else {
      const aliases = ARTIST_PAGE_ALIASES[ea];
      if (aliases?.some(a => pa.includes(a) || a.includes(pa))) artistScore = 40;
    }
  }
  const eaLat = translitRuToLat(expectedArtist).replace(/\s+/g, '');
  const paLat = translitRuToLat(parsed.artist).replace(/\s+/g, '');
  if (eaLat.length >= 2 && paLat.length >= 2 && (paLat === eaLat || paLat.includes(eaLat))) {
    artistScore = Math.max(artistScore, 40);
  }
  const etLat = translitRuToLat(expectedTitle);
  const ptLat = translitRuToLat(parsed.title);
  if (etLat && ptLat && etLat.length >= 3 && (ptLat === etLat || ptLat.includes(etLat))) {
    titleScore += 15;
  }
  return { total: titleScore + artistScore, titleScore, artistScore };
}

function pageMatchesRequest(match, expectedArtist, expectedTitle) {
  if (match.titleScore < 35) return false;
  const ea = expectedArtist.trim();
  if (!ea || /^unknown$/i.test(ea)) return match.titleScore >= 55;
  if (match.artistScore >= 25) return true;
  return match.titleScore >= 65 && match.artistScore >= 12;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': AMDM_FETCH_UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  return { res, text: await res.text() };
}

/**
 * Real AmDm search hits live in `table.items` only — the rest of the page is a
 * "latest tabs" sidebar that used to leak in as bogus candidates. Restricting to
 * that table is the main fix for false matches / wrong-artist results.
 */
function collectAmdmSongCandidates(searchHtml, artist, title) {
  const $ = cheerio.load(searchHtml);
  const seen = new Set();
  const rows = [];
  $('table.items a[href*="/akkordi/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const full = href.startsWith('http')
      ? href
      : `https://amdm.ru${href.startsWith('/') ? '' : '/'}${href}`;
    // Require a song path (/akkordi/<artist>/<id>/<slug>), skip artist-only links.
    if (!/\/akkordi\/[^/]+\/\d+\/[^/?#]+/.test(full)) return;
    const url = full.split('?')[0].replace(/\/+$/, '');
    if (seen.has(url)) return;
    seen.add(url);
    const linkText = $(el).text().replace(/\s+/g, ' ').trim();
    rows.push({ url, linkText, score: scoreAmdmLink(url, artist, title, linkText) });
  });
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, MAX_URLS_PER_SEARCH);
}

function firstTitleWord(title) {
  const m = String(title ?? '')
    .trim()
    .match(/^[\p{L}\p{N}]+/u);
  return m?.[0] ?? '';
}

/** Search query variants for AmDm (artist/title order, title-only, translit, layout). */
export function buildAmdmSearchQueries(artist, title) {
  const a = String(artist ?? '').trim();
  const t = String(title ?? '').trim();
  const shortT = firstTitleWord(t);
  const out = [];
  const add = (q) => {
    const s = q.replace(/\s+/g, ' ').trim();
    if (s.length >= 2 && !out.includes(s)) out.push(s);
  };
  const addTitleAliases = (titleText) => {
    if (!titleText) return;
    add(titleText);
    const latT = translitRuToLat(titleText);
    if (latT && latT !== titleText.toLowerCase()) add(latT);
    if (/[a-z]/i.test(titleText) && !/[а-яё]/i.test(titleText)) {
      add(swapKeyboardLayout(titleText, EN_TO_RU, RU_TO_EN));
    }
    if (/[а-яё]/i.test(titleText)) {
      add(swapKeyboardLayout(titleText, RU_TO_EN, EN_TO_RU));
    }
  };
  if (a && t) {
    add(`${a} ${t}`);
    add(`${t} ${a}`);
    const latA = translitRuToLat(a);
    const latT = translitRuToLat(t);
    if (latA && latT) add(`${latA} ${latT}`);
    if (shortT.length >= 3 && shortT !== t) {
      add(`${a} ${shortT}`);
      add(shortT);
    }
  }
  if (t) {
    addTitleAliases(t);
    if (shortT.length >= 3 && shortT !== t) addTitleAliases(shortT);
  }
  if (a) {
    add(a);
    const latA = translitRuToLat(a);
    if (latA && latA !== a.toLowerCase()) add(latA);
    const aliases = ARTIST_SEARCH_ALIASES[normalizeMatch(a)];
    if (aliases && t) {
      for (const alias of aliases) {
        add(`${alias} ${t}`);
        add(`${t} ${alias}`);
        if (shortT.length >= 3 && shortT !== t) {
          add(`${alias} ${shortT}`);
          add(`${shortT} ${alias}`);
        }
      }
    }
  }
  return out;
}

/**
 * @returns {Promise<
 *   | { ok: true, chordPro: string, sourceUrl: string, title: string, artist: string }
 *   | { ok: false, error: string, code?: string, sourceUrl?: string }
 * >}
 */
async function fetchAmdmFromSongUrl(songUrl, expectedArtist, expectedTitle) {
  let songHtml;
  try {
    const { res, text } = await fetchText(songUrl);
    if (!res.ok) {
      return {
        ok: false,
        code: 'http',
        error: `Страница таба: HTTP ${res.status}`,
        sourceUrl: songUrl,
      };
    }
    songHtml = text;
  } catch (e) {
    return {
      ok: false,
      code: 'network',
      error: `Не удалось открыть таб (${e?.message ?? 'network'})`,
      sourceUrl: songUrl,
    };
  }

  const $ = cheerio.load(songHtml);
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const parsedOg = parseOgTitle(ogTitle);
  const pageMatch = scorePageTitleMatch(parsedOg, expectedArtist, expectedTitle);

  const preHtml = pickAmdmPreHtml($);
  if (!preHtml) {
    return {
      ok: false,
      code: 'no_block',
      error: 'На странице нет блока с аккордами',
      sourceUrl: songUrl,
    };
  }

  if (preHtmlChordSignal(preHtml) < MIN_PRE_CHORD_DIVS) {
    return {
      ok: false,
      code: 'no_block',
      error: 'Блок подбора слишком короткий — возможно не полный таб',
      sourceUrl: songUrl,
    };
  }

  const lines = amdmPreHtmlToChordProLines(preHtml);
  const validation = validateAmdmChordLines(lines);
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      error: validation.message,
      sourceUrl: songUrl,
    };
  }

  if (
    parsedOg &&
    expectedTitle.trim() &&
    !pageMatchesRequest(pageMatch, expectedArtist, expectedTitle)
  ) {
    return {
      ok: false,
      code: 'title_mismatch',
      error: `На AmDm другой исполнитель: ${parsedOg.artist} — ${parsedOg.title}`,
      sourceUrl: songUrl,
    };
  }

  let parsedArtist = expectedArtist;
  let parsedTitle = expectedTitle;
  if (parsedOg) {
    parsedArtist = parsedOg.artist || expectedArtist;
    parsedTitle = parsedOg.title || expectedTitle;
  }

  const chordPro = buildChordPro({
    title: parsedTitle,
    artist: parsedArtist,
    lines,
    sourceUrl: songUrl,
  });

  return {
    ok: true,
    chordPro,
    sourceUrl: songUrl,
    title: parsedTitle,
    artist: parsedArtist,
  };
}

/**
 * Fetch one song from amdm.ru → ChordPro text.
 * Gathers candidates from `table.items` across a few search phrases, then opens
 * only the best few tab pages (fast) and validates artist/title + chord block.
 */
export async function fetchAmdmChordPro(artist, title) {
  const queries = buildAmdmSearchQueries(artist, title).slice(0, MAX_SEARCH_QUERIES);
  const candidateMap = new Map(); // url -> { url, score, linkText }
  let lastSearchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(`${artist} ${title}`.trim())}`;
  let networkFail = null;

  for (const q of queries) {
    const searchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(q)}`;
    lastSearchUrl = searchUrl;
    let searchHtml;
    try {
      const { res, text } = await fetchText(searchUrl);
      if (!res.ok) {
        networkFail = { code: 'search_http', error: `Поиск AmDm: HTTP ${res.status}`, sourceUrl: searchUrl };
        continue;
      }
      searchHtml = text;
    } catch (e) {
      networkFail = { code: 'network', error: `Нет связи с amdm.ru (${e?.message ?? 'network'})`, sourceUrl: searchUrl };
      continue;
    }

    for (const cand of collectAmdmSongCandidates(searchHtml, artist, title)) {
      const prev = candidateMap.get(cand.url);
      if (!prev || cand.score > prev.score) candidateMap.set(cand.url, cand);
    }

    const best = [...candidateMap.values()].sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= STRONG_CANDIDATE_SCORE) break;
  }

  const candidates = [...candidateMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_TAB_ATTEMPTS);

  if (!candidates.length) {
    if (networkFail) {
      return { stub: true, chordPro: null, sourceUrl: networkFail.sourceUrl ?? lastSearchUrl, error: networkFail.error, code: networkFail.code };
    }
    return {
      stub: true,
      chordPro: null,
      sourceUrl: lastSearchUrl,
      error: `На AmDm нет подбора для «${artist} — ${title}». Проверьте написание.`,
      code: 'not_found',
    };
  }

  if (AMDM_DEV_LOG) {
    console.error('[amdm] candidates', candidates.map(c => `${c.score}\t${c.url}`).join('\n'));
  }

  let lastFail = { error: 'Таб не найден на AmDm', code: 'not_found', sourceUrl: candidates[0].url };
  for (const cand of candidates) {
    const picked = await fetchAmdmFromSongUrl(cand.url, artist, title);
    if (picked.ok) {
      return {
        chordPro: picked.chordPro,
        sourceUrl: picked.sourceUrl,
        title: picked.title,
        artist: picked.artist,
      };
    }
    lastFail = picked;
  }

  let error = lastFail.error ?? 'Таб не найден на AmDm';
  if (lastFail.code === 'title_mismatch') {
    error = `На AmDm нет подбора для «${artist} — ${title}» (найдены другие исполнители). Проверьте написание.`;
  }

  return {
    stub: true,
    chordPro: null,
    sourceUrl: lastFail.sourceUrl ?? lastSearchUrl,
    error,
    code: lastFail.code,
  };
}

export async function handleChordFetchRequest(body) {
  const provider = String(body.provider ?? 'amdm').trim();
  const artist = String(body.artist ?? '').trim();
  const title = String(body.title ?? '').trim();

  if (!artist || !title) {
    return { status: 400, payload: { error: 'Нужны поля artist и title' } };
  }

  const cached = lookupParsedChord(artist, title);
  if (cached?.chordPro) {
    return {
      status: 200,
      payload: {
        chordPro: cached.chordPro,
        sourceUrl: cached.sourceUrl || 'parsed-store',
        artist: cached.artist,
        title: cached.title,
        fromStore: true,
      },
    };
  }

  if (provider === 'github') {
    const { fetchGithubChordPro } = await import('./githubChordPro.mjs');
    const result = await fetchGithubChordPro(artist, title);
    if (result.stub || !result.chordPro?.trim()) {
      return {
        status: result.code === 'blocked' ? 503 : 404,
        payload: {
          error: result.error ?? 'Таб не найден на GitHub',
          code: result.code,
          stub: true,
          sourceUrl: result.sourceUrl,
        },
      };
    }
    rememberParsedChord({ ...result, artist: result.artist || artist, title: result.title || title, provider: 'github' });
    return { status: 200, payload: result };
  }

  if (provider === 'ultimate_guitar') {
    const { fetchUgChordPro } = await import('./ugFetch.mjs');
    const result = await fetchUgChordPro(artist, title);
    if (result.stub || !result.chordPro?.trim()) {
      return {
        status: result.code === 'blocked' ? 503 : 404,
        payload: {
          error: result.error ?? 'Таб не найден на Ultimate Guitar',
          code: result.code,
          stub: true,
          sourceUrl: result.sourceUrl,
        },
      };
    }
    rememberParsedChord({ ...result, artist: result.artist || artist, title: result.title || title, provider: 'ultimate_guitar' });
    return { status: 200, payload: result };
  }

  if (provider !== 'amdm') {
    return { status: 400, payload: { error: `Неизвестный provider: ${provider}` } };
  }

  const result = await fetchAmdmChordPro(artist, title);
  if (result.stub || !result.chordPro?.trim()) {
    return {
      status: 404,
      payload: {
        error: result.error ?? 'Таб не найден на AmDm',
        code: result.code,
        stub: true,
        sourceUrl: result.sourceUrl,
      },
    };
  }
  rememberParsedChord({ ...result, artist: result.artist || artist, title: result.title || title, provider: 'amdm' });
  return { status: 200, payload: result };
}
