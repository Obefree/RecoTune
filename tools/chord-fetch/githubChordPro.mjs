/**
 * Fetch one public ChordPro sheet from GitHub (code search + raw file).
 * Optional GITHUB_TOKEN / GH_TOKEN raises rate limits; without it search may 401.
 *
 * Why a sibling of ugFetch/amdmFetch: GitHub is a different HTTP API, not HTML scrape.
 */
import { isChordToken, plainChordSheetToChordPro } from './chordLayout.mjs';

const UA = 'RecoTune-chord-fetch';
const EXT_QUERY =
  '(extension:cho OR extension:chopro OR extension:chordpro OR extension:pro OR extension:crd)';

function githubHeaders() {
  const token = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': UA,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { headers, hasToken: Boolean(token) };
}

function stub(error, extra = {}) {
  return { stub: true, chordPro: null, error, ...extra };
}

function countChordMarkers(text) {
  const re = /\[[^\]]+\]/g;
  let n = 0;
  let m;
  while ((m = re.exec(text))) {
    if (isChordToken(m[0])) n++;
  }
  return n;
}

function looksLikeChordPro(text) {
  if (!text || text.length < 40) return false;
  const markers = countChordMarkers(text);
  const directives = /\{(?:title|t|artist|subtitle):/i.test(text);
  return markers >= 4 || (directives && markers >= 2);
}

function toChordPro(raw, artist, title) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '').trim();
  if (!text) return null;
  if (looksLikeChordPro(text) && countChordMarkers(text) >= 2) {
    const hasTitle = /\{(?:title|t):/i.test(text);
    const head = hasTitle ? '' : `{title: ${title}}\n{artist: ${artist}}\n`;
    return `${head}${text}`.trim();
  }
  const lines = plainChordSheetToChordPro(text);
  const body = lines.join('\n').trim();
  if (!looksLikeChordPro(body)) return null;
  return `{title: ${title}}\n{artist: ${artist}}\n${body}`;
}

function scoreItem(item, artist, title) {
  const path = String(item.path ?? '').toLowerCase();
  const name = String(item.name ?? '').toLowerCase();
  const repo = String(item.repository?.full_name ?? '').toLowerCase();
  const a = artist.toLowerCase();
  const t = title.toLowerCase();
  let score = 0;
  if (t && (path.includes(t) || name.includes(t))) score += 50;
  if (a && (path.includes(a) || name.includes(a) || repo.includes(a))) score += 30;
  if (/\.(cho|chopro|chordpro|pro)$/i.test(path)) score += 15;
  if (/chordpro|songbook|chords/i.test(repo)) score += 8;
  return score;
}

async function fetchRaw(fullName, filePath) {
  const url = `https://raw.githubusercontent.com/${fullName}/HEAD/${filePath}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const text = await res.text();
  if (text.length > 400_000) return null;
  return { text, url };
}

async function searchCode(query, headers) {
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=8`;
  const res = await fetch(url, { headers });
  if (res.status === 401 || res.status === 403) {
    const err = new Error(res.status === 401 ? 'github-auth' : 'github-rate');
    err.status = res.status;
    throw err;
  }
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchGithubChordPro(artist, title) {
  const a = String(artist ?? '').trim();
  const t = String(title ?? '').trim();
  if (!a || !t) return stub('Нужны исполнитель и название');

  const { headers, hasToken } = githubHeaders();
  const queries = [
    `"${t}" "${a}" ${EXT_QUERY}`,
    `"${t}" ${EXT_QUERY}`,
  ];

  let items = [];
  try {
    for (const q of queries) {
      items = await searchCode(q, headers);
      if (items.length) break;
    }
  } catch (e) {
    if (e.status === 401) {
      return stub(
        hasToken
          ? 'GitHub отклонил токен.'
          : 'GitHub code search нужен GITHUB_TOKEN на прокси (ПК).',
        { code: 'auth' },
      );
    }
    if (e.status === 403) {
      return stub('GitHub rate limit. Подождите или задайте GITHUB_TOKEN.', { code: 'blocked' });
    }
    return stub(e.message || 'Поиск GitHub не удался');
  }

  const ranked = [...items].sort((x, y) => scoreItem(y, a, t) - scoreItem(x, a, t));
  for (const item of ranked.slice(0, 6)) {
    const fullName = item.repository?.full_name;
    const filePath = item.path;
    if (!fullName || !filePath) continue;
    try {
      const raw = await fetchRaw(fullName, filePath);
      if (!raw?.text) continue;
      const chordPro = toChordPro(raw.text, a, t);
      if (!chordPro) continue;
      return {
        chordPro,
        sourceUrl: raw.url,
        title: t,
        artist: a,
      };
    } catch {
      /* next candidate */
    }
  }

  return stub('В открытых репозиториях GitHub нет ChordPro для этой песни.');
}
