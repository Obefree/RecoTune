/**
 * Shared AmDm search + ChordPro parse (dev-proxy + Vercel serverless).
 */
import * as cheerio from 'cheerio';

export const AMDM_FETCH_UA = 'RecoTune-chord-fetch/1.0 (on-demand; single song per request)';

function slugify(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9а-я]+/gi, '_')
    .replace(/^_+|_+$/g, '');
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
  if (/podbor__chord/i.test(html)) score += 120;
  if (/data-chord=/i.test(html)) score += 80;
  const chordDivs = (html.match(/podbor__chord/gi) || []).length;
  score += Math.min(chordDivs * 8, 80);
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

function stubChordPro(artist, title, reason, sourceUrl) {
  const lines = [
    '[Am]Тестовая заглушка',
    `[C]${reason}`,
    '[G]Проверьте сеть или откройте сайт в браузере',
  ];
  return {
    chordPro: buildChordPro({
      title,
      artist,
      lines,
      sourceUrl,
      note: 'stub — сайт недоступен или таб не найден',
    }),
    sourceUrl,
    stub: true,
  };
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': AMDM_FETCH_UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  return { res, text: await res.text() };
}

function pickAmdmSongUrl(searchHtml, artist, title) {
  const songRe = /https:\/\/amdm\.ru\/akkordi\/[^/\s"'<>]+\/\d+\/[^/\s"'<>]+\/?/gi;
  const links = [...searchHtml.matchAll(songRe)].map((m) =>
    m[0].split('?')[0].replace(/\/+$/, ''),
  );
  const uniq = [...new Set(links)];
  if (!uniq.length) return null;
  return uniq.sort((a, b) => scoreAmdmLink(b, artist, title) - scoreAmdmLink(a, artist, title))[0];
}

/** Search query variants for AmDm (artist/title order, title-only, artist-only). */
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
  }
  if (t) add(t);
  if (a) add(a);
  return out;
}

async function fetchAmdmFromSearchHtml(searchHtml, artist, title, searchUrl) {
  const songUrl = pickAmdmSongUrl(searchHtml, artist, title);
  if (!songUrl) {
    return { ok: false, stub: stubChordPro(artist, title, 'На странице поиска нет ссылок на табы', searchUrl) };
  }

  let songHtml;
  try {
    const { res, text } = await fetchText(songUrl);
    if (!res.ok) {
      return {
        ok: false,
        stub: stubChordPro(artist, title, `Страница таба: HTTP ${res.status}`, songUrl),
      };
    }
    songHtml = text;
  } catch (e) {
    return {
      ok: false,
      stub: stubChordPro(
        artist,
        title,
        `Не удалось открыть таб (${e?.message ?? 'network'})`,
        songUrl,
      ),
    };
  }

  const $ = cheerio.load(songHtml);
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const preHtml = pickAmdmPreHtml($);
  if (!preHtml) {
    return {
      ok: false,
      stub: stubChordPro(
        artist,
        title,
        'На странице нет блока с аккордами (возможна защита)',
        songUrl,
      ),
    };
  }

  const lines = amdmPreHtmlToChordProLines(preHtml);
  if (lines.length < 2) {
    return {
      ok: false,
      stub: stubChordPro(
        artist,
        title,
        'Парсер нашёл слишком мало строк — проверьте исполнителя',
        songUrl,
      ),
    };
  }

  let parsedArtist = artist;
  let parsedTitle = title;
  if (ogTitle) {
    const dash = ogTitle.split(/\s*[-–—]\s*/);
    if (dash.length >= 2) {
      parsedArtist = dash[0].replace(/\s*\(аккорды.*$/i, '').trim() || artist;
      parsedTitle = dash.slice(1).join(' - ').replace(/\s*\(аккорды.*$/i, '').trim() || title;
    }
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

/** Fetch one song from amdm.ru → ChordPro text (tries several search queries). */
export async function fetchAmdmChordPro(artist, title) {
  const queries = buildAmdmSearchQueries(artist, title);
  let lastStub = null;
  let lastSearchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(`${artist} ${title}`.trim())}`;

  for (const q of queries) {
    const searchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(q)}`;
    lastSearchUrl = searchUrl;
    let searchHtml;
    try {
      const { res, text } = await fetchText(searchUrl);
      if (!res.ok) {
        lastStub = stubChordPro(artist, title, `Поиск: HTTP ${res.status}`, searchUrl);
        continue;
      }
      searchHtml = text;
    } catch (e) {
      lastStub = stubChordPro(
        artist,
        title,
        `Нет связи с amdm.ru (${e?.message ?? 'network'})`,
        searchUrl,
      );
      continue;
    }

    const picked = await fetchAmdmFromSearchHtml(searchHtml, artist, title, searchUrl);
    if (picked.ok) {
      return {
        chordPro: picked.chordPro,
        sourceUrl: picked.sourceUrl,
        title: picked.title,
        artist: picked.artist,
      };
    }
    lastStub = picked.stub ?? lastStub;
  }

  return (
    lastStub ??
    stubChordPro(artist, title, 'Таб не найден на AmDm — проверьте название', lastSearchUrl)
  );
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
  if (result.stub) {
    const reason =
      result.chordPro?.match(/\{comment:\s*([^}]+)\}/i)?.[1]?.trim() ??
      'Таб не найден на AmDm';
    return { status: 404, payload: { error: reason, stub: true, sourceUrl: result.sourceUrl } };
  }
  if (!result.chordPro?.trim()) {
    return { status: 404, payload: { error: 'Пустой ответ AmDm' } };
  }
  return { status: 200, payload: result };
}
