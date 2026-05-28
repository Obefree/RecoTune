/**
 * Shared AmDm search + ChordPro parse (dev-proxy + Vercel serverless).
 */
import * as cheerio from 'cheerio';
import { preHtmlChordSignal, validateAmdmChordLines } from './amdmChordValidate.mjs';

export const AMDM_FETCH_UA = 'RecoTune-chord-fetch/1.0 (on-demand; single song per request)';

const MAX_URLS_PER_SEARCH = 8;
const MIN_PRE_CHORD_DIVS = 3;

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

function scoreAmdmLink(href, artist, title) {
  const path = href.toLowerCase();
  const a = slugify(artist);
  const t = slugify(title);
  let score = 0;
  if (a && path.includes(`/akkordi/${a}/`)) score += 60;
  if (t && path.includes(t)) score += 35;
  if (a && path.includes(`/${a}/`)) score += 15;
  if (a === 'kino' && path.includes('/akkordi/kino/')) score += 45;
  if (a === 'kino' && path.includes('/leningrad/')) score -= 35;
  if (path.includes('peredelannye')) score -= 25;
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

function amdmPreHtmlToChordProLines(html) {
  const lines = [];
  let chordBuf = [];
  const re =
    /<div class="podbor__chord" data-chord="([^"]+)">[\s\S]*?<\/div>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) {
      chordBuf.push(m[1].trim());
      continue;
    }
    const chunk = decodeHtml(m[2]).replace(/\s+/g, ' ').trim();
    if (!chunk || isAmdmUiGarbageLine(chunk)) continue;
    const prefix = chordBuf.map((c) => `[${c}]`).join('');
    chordBuf = [];
    lines.push(`${prefix}${chunk}`);
  }
  if (chordBuf.length) {
    lines.push(chordBuf.map((c) => `[${c}]`).join(''));
  }
  return lines.filter((line) => line.trim() && !isAmdmUiGarbageLine(line));
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
  const dash = ogTitle.split(/\s*[-–—]\s*/);
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
  }
  const etLat = translitRuToLat(expectedTitle);
  const ptLat = translitRuToLat(parsed.title);
  if (etLat && ptLat && etLat.length >= 3 && (ptLat === etLat || ptLat.includes(etLat))) {
    titleScore += 15;
  }
  return { total: titleScore + artistScore, titleScore, artistScore };
}

function pageMatchesRequest(match, expectedArtist, expectedTitle) {
  if (match.titleScore < 40) return false;
  const ea = expectedArtist.trim();
  if (!ea || /^unknown$/i.test(ea)) return match.titleScore >= 55;
  if (match.artistScore >= 25) return true;
  return match.titleScore >= 70 && match.artistScore >= 15;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': AMDM_FETCH_UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  return { res, text: await res.text() };
}

function collectAmdmSongUrls(searchHtml, artist, title) {
  const songRe = /https:\/\/amdm\.ru\/akkordi\/[^/\s"'<>]+\/\d+\/[^/\s"'<>]+\/?/gi;
  const links = [...searchHtml.matchAll(songRe)].map((m) =>
    m[0].split('?')[0].replace(/\/+$/, ''),
  );
  const uniq = [...new Set(links)];
  return uniq
    .map((url) => ({ url, score: scoreAmdmLink(url, artist, title) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_URLS_PER_SEARCH);
}

/** Search query variants for AmDm (artist/title order, title-only, translit, layout). */
export function buildAmdmSearchQueries(artist, title) {
  const a = String(artist ?? '').trim();
  const t = String(title ?? '').trim();
  const out = [];
  const add = (q) => {
    const s = q.replace(/\s+/g, ' ').trim();
    if (s.length >= 2 && !out.includes(s)) out.push(s);
  };
  if (a && t) {
    add(`${a} ${t}`);
    add(`${t} ${a}`);
    const latA = translitRuToLat(a);
    const latT = translitRuToLat(t);
    if (latA && latT) add(`${latA} ${latT}`);
  }
  if (t) {
    add(t);
    const latT = translitRuToLat(t);
    if (latT && latT !== t.toLowerCase()) add(latT);
    if (/[a-z]/i.test(t) && !/[а-яё]/i.test(t)) {
      add(swapKeyboardLayout(t, EN_TO_RU, RU_TO_EN));
    }
    if (/[а-яё]/i.test(t)) {
      add(swapKeyboardLayout(t, RU_TO_EN, EN_TO_RU));
    }
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

async function fetchAmdmFromSearchHtml(searchHtml, artist, title) {
  const candidates = collectAmdmSongUrls(searchHtml, artist, title);
  if (!candidates.length) {
    return { ok: false, code: 'not_found', error: 'На AmDm не найдено ссылок на подбор' };
  }

  let lastFail = { error: 'Таб не найден на AmDm', code: 'not_found', sourceUrl: candidates[0]?.url };

  for (const { url } of candidates) {
    const picked = await fetchAmdmFromSongUrl(url, artist, title);
    if (picked.ok) return picked;
    lastFail = picked;
    if (picked.code === 'title_mismatch') continue;
    if (picked.code === 'progression_only' || picked.code === 'no_lyrics' || picked.code === 'too_short') {
      continue;
    }
  }

  return lastFail;
}

/** Fetch one song from amdm.ru → ChordPro text (tries several search queries + result URLs). */
export async function fetchAmdmChordPro(artist, title) {
  const queries = buildAmdmSearchQueries(artist, title);
  let lastFail = {
    ok: false,
    error: 'Таб не найден на AmDm — проверьте исполнителя и название',
    code: 'not_found',
  };
  let lastSearchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(`${artist} ${title}`.trim())}`;

  for (const q of queries) {
    const searchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(q)}`;
    lastSearchUrl = searchUrl;
    let searchHtml;
    try {
      const { res, text } = await fetchText(searchUrl);
      if (!res.ok) {
        lastFail = {
          ok: false,
          code: 'search_http',
          error: `Поиск AmDm: HTTP ${res.status}`,
          sourceUrl: searchUrl,
        };
        continue;
      }
      searchHtml = text;
    } catch (e) {
      lastFail = {
        ok: false,
        code: 'network',
        error: `Нет связи с amdm.ru (${e?.message ?? 'network'})`,
        sourceUrl: searchUrl,
      };
      continue;
    }

    const picked = await fetchAmdmFromSearchHtml(searchHtml, artist, title);
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

  if (provider === 'ultimate_guitar') {
    return {
      status: 501,
      payload: { error: 'Этот источник пока недоступен. Используйте provider amdm.' },
    };
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
  return { status: 200, payload: result };
}
