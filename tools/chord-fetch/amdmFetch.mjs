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
    if (!chunk) continue;
    const prefix = chordBuf.map((c) => `[${c}]`).join('');
    chordBuf = [];
    lines.push(`${prefix}${chunk}`);
  }
  if (chordBuf.length) {
    lines.push(chordBuf.map((c) => `[${c}]`).join(''));
  }
  return lines.filter(Boolean);
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

/** Fetch one song from amdm.ru → ChordPro text. */
export async function fetchAmdmChordPro(artist, title) {
  const searchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(`${artist} ${title}`.trim())}`;

  let searchHtml;
  try {
    const { res, text } = await fetchText(searchUrl);
    if (!res.ok) {
      return stubChordPro(artist, title, `Поиск: HTTP ${res.status}`, searchUrl);
    }
    searchHtml = text;
  } catch (e) {
    return stubChordPro(
      artist,
      title,
      `Нет связи с amdm.ru (${e?.message ?? 'network'})`,
      searchUrl,
    );
  }

  const songUrl = pickAmdmSongUrl(searchHtml, artist, title);
  if (!songUrl) {
    return stubChordPro(artist, title, 'На странице поиска нет ссылок на табы', searchUrl);
  }

  let songHtml;
  try {
    const { res, text } = await fetchText(songUrl);
    if (!res.ok) {
      return stubChordPro(artist, title, `Страница таба: HTTP ${res.status}`, songUrl);
    }
    songHtml = text;
  } catch (e) {
    return stubChordPro(
      artist,
      title,
      `Не удалось открыть таб (${e?.message ?? 'network'})`,
      songUrl,
    );
  }

  const $ = cheerio.load(songHtml);
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const preHtml = $('pre').first().html()?.trim();
  if (!preHtml) {
    return stubChordPro(
      artist,
      title,
      'На странице нет блока с аккордами (возможна защита)',
      songUrl,
    );
  }

  const lines = amdmPreHtmlToChordProLines(preHtml);
  if (lines.length < 2) {
    return stubChordPro(
      artist,
      title,
      'Парсер нашёл слишком мало строк — проверьте исполнителя',
      songUrl,
    );
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

  return { chordPro, sourceUrl: songUrl, title: parsedTitle, artist: parsedArtist };
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
  return { status: 200, payload: result };
}
