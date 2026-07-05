/**
 * Ingest REAL verified ChordPro tabs from pesni.ru (public API, no key, 60 req/min)
 * → assets/archive/pesni-chordpro.json (offline bundle imported into the library).
 *
 * Only songs whose chord-above-lyric text passes the SAME verification as the app
 * (pesniRuTextToVerifiedLyrics → isVerifiedChordProLyrics) are kept — no stubs,
 * no progression-only, no fake tabs. Songs without line-by-line chords are skipped.
 *
 *   node tools/ingest-pesni-chordpro.mjs --target=300 --per-artist=8
 *   node tools/ingest-pesni-chordpro.mjs --resume
 *   node tools/ingest-pesni-chordpro.mjs --target=40 --limit-artists=12   # smoke
 *
 * Re-run with a higher --target to expand the offline chord DB.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  pesniRuTextToVerifiedLyrics,
  extractBracketChords,
} from './lib/chordNormalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'assets/archive/pesni-chordpro.json');
const CHECKPOINT_PATH = join(ROOT, 'tools/.pesni-ingest-checkpoint.json');
const ARTISTS_PATH = join(ROOT, 'data/seed-artists-mb.json');

const API_BASE = 'https://pesni.ru/api/v1';
const RATE_MS = 1200;
const BUNDLE_VERSION = 1;
const MAX_LYRIC_CHARS = 8000;

const COVER_RE =
  /(переделанн|пароди|песни-переделк|караоке|karaoke|\bминус\b|\bcover\b|кавер|\bby\b|\(мотив|ремикс|remix|минусовк)/i;

/** Titles that are raw guitar-pro / ASCII tab-file dumps, not chord-over-lyric sheets. */
const TAB_DUMP_TITLE_RE = /\((tab|chords?|guitar\s*pro|ver\.?\s*\d)\)|\.tab\b|guitar\s*pro/i;
/** Usenet / OLGA tab-archive headers that leak into pesni.ru foreign imports. */
const DUMP_HEADER_RE = /^\s*(Date|From|Subject|Newsgroups|To|Reply-To|Message-ID)\s*:/mi;

function parseArgs(argv) {
  const o = {
    target: 300,
    limitArtists: 0,
    perArtist: 8,
    resume: false,
    dryRun: false,
    searchLimit: 25,
  };
  for (const a of argv) {
    let m;
    if (a === '--resume') o.resume = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if ((m = a.match(/^--target=(\d+)$/))) o.target = Number(m[1]);
    else if ((m = a.match(/^--limit-artists=(\d+)$/))) o.limitArtists = Number(m[1]);
    else if ((m = a.match(/^--per-artist=(\d+)$/))) o.perArtist = Number(m[1]);
    else if ((m = a.match(/^--search-limit=(\d+)$/))) o.searchLimit = Number(m[1]);
  }
  return o;
}

function normText(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (res.status === 429) {
    const retry = Number(res.headers.get('Retry-After') || 5);
    console.log(`  · rate-limited, waiting ${retry}s`);
    await sleep((retry + 1) * 1000);
    return apiGet(path);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

async function searchArtists(query, limit) {
  const params = new URLSearchParams({ q: query, type: 'artists', limit: String(limit) });
  const data = await apiGet(`/search?${params}`);
  return data.artists ?? [];
}

/** Best-matching pesni.ru artist for a seed name (avoids substring false hits). */
function pickArtist(artists, wantName) {
  const want = normText(wantName);
  const wantTokens = want.split(' ').filter(Boolean);
  let best = null;
  for (const a of artists) {
    const got = normText(a.name);
    if (!got) continue;
    const gotTokens = new Set(got.split(' ').filter(Boolean));
    let score = 0;
    if (got === want) score = 100;
    else if (got.startsWith(want + ' ')) score = 90; // "кино" → "кино виктор цой"
    else if (got.split(' ').includes(want)) score = 82; // want is a whole word ("цой")
    else if (wantTokens.length >= 2 && wantTokens.every(t => gotTokens.has(t)))
      score = 85; // reversed order: "Владимир Высоцкий" → "Высоцкий Владимир"
    else if (got.includes(want)) score = 60 - Math.min(got.length - want.length, 40);
    else if (want.includes(got)) score = 45 - Math.min(want.length - got.length, 30);
    if (score > 0 && (!best || score > best.score)) best = { slug: a.slug, name: a.name, score };
  }
  return best;
}

/** /artists/{slug} returns the artist with their full `tracks` array. */
async function getArtistTracks(slug) {
  const data = await apiGet(`/artists/${encodeURIComponent(slug)}`);
  return data.tracks ?? [];
}

async function getTrack(slug) {
  return apiGet(`/tracks/${encodeURIComponent(slug)}`);
}

function isCover(track) {
  return COVER_RE.test(track?.artist?.name ?? '') || COVER_RE.test(track?.name ?? '');
}

function difficultyFor(chords) {
  const n = chords.length;
  return n <= 3 ? 1 : n <= 5 ? 2 : 3;
}

/** Reject email/OLGA dumps and require enough real chord-over-lyric lines. */
function isQualityTab(lyrics) {
  if (DUMP_HEADER_RE.test(lyrics.slice(0, 400))) return false;
  const lines = lyrics.split('\n').map(l => l.trim()).filter(Boolean);
  let chordLines = 0;
  let lyricLines = 0;
  for (const l of lines) {
    if (/\[[A-H][^\]]*\]/.test(l)) chordLines++;
    const prose = l.replace(/\[[^\]]+\]/g, ' ');
    if (/[a-zA-Zа-яА-ЯёЁ]{2,}/.test(prose)) lyricLines++;
  }
  return chordLines >= 4 && lyricLines >= 4;
}

const hasCyrillic = s => /[а-яё]/i.test(s ?? '');

/** Collapsed key so "Bob dylans dream" == "Bob dylan s dream". */
function dupeKey(artist, title) {
  return `${normText(artist).replace(/\s+/g, '')}\u0000${normText(title).replace(/\s+/g, '')}`;
}

function loadArtists() {
  const raw = JSON.parse(readFileSync(ARTISTS_PATH, 'utf8'));
  const seen = new Set();
  const out = [];
  for (const a of raw) {
    const key = normText(a);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(a);
    }
  }
  // Russian artists first: pesni.ru has the cleanest, highest-hit chord-over-lyric
  // data for them, and they are the primary use case.
  return out.sort((a, b) => Number(hasCyrillic(b)) - Number(hasCyrillic(a)));
}

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveCheckpoint(cp) {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp), 'utf8');
}

function writeBundle(songs) {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  const bundle = {
    version: BUNDLE_VERSION,
    generatedAt: new Date().toISOString(),
    source: 'pesni.ru',
    count: songs.length,
    songs,
  };
  writeFileSync(OUT_PATH, JSON.stringify(bundle, null, 0), 'utf8');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const allArtists = loadArtists();
  const artists = opts.limitArtists > 0 ? allArtists.slice(0, opts.limitArtists) : allArtists;

  let cp = opts.resume ? loadCheckpoint() : null;
  if (!cp) {
    cp = { artistIndex: 0, songs: [], seenSlugs: [], seenKeys: [], doneArtists: [] };
  }
  const seenSlugs = new Set(cp.seenSlugs);
  const seenKeys = new Set(cp.seenKeys);
  const doneArtists = new Set(cp.doneArtists ?? []);
  const songs = cp.songs;

  console.log(
    `pesni.ru ingest — target ${opts.target}, ${artists.length} artists, per-artist ${opts.perArtist}` +
      (opts.resume ? ` (resume @ artist ${cp.artistIndex}, ${songs.length} songs)` : ''),
  );

  let fetches = 0;
  for (let ai = cp.artistIndex; ai < artists.length; ai++) {
    if (songs.length >= opts.target) break;
    const artist = artists[ai];
    cp.artistIndex = ai;

    let resolved;
    try {
      resolved = pickArtist(await searchArtists(artist, opts.searchLimit), artist);
      fetches++;
    } catch (e) {
      console.log(`! artist "${artist}": ${e.message}`);
      await sleep(RATE_MS);
      continue;
    }
    await sleep(RATE_MS);

    if (!resolved || doneArtists.has(resolved.slug)) {
      console.log(`[${ai + 1}/${artists.length}] ${artist}: ${resolved ? 'dup artist' : 'not found'}`);
      continue;
    }
    doneArtists.add(resolved.slug);

    let tracks;
    try {
      tracks = await getArtistTracks(resolved.slug);
      fetches++;
    } catch (e) {
      console.log(`! tracks "${resolved.name}": ${e.message}`);
      await sleep(RATE_MS);
      continue;
    }
    await sleep(RATE_MS);

    const candidates = tracks
      .filter(t => t?.slug && !seenSlugs.has(t.slug))
      .filter(t => !isCover({ artist: { name: resolved.name }, name: t?.name }))
      .filter(t => !TAB_DUMP_TITLE_RE.test(t?.name ?? ''));

    let addedForArtist = 0;
    let kept = 0;
    for (const t of candidates) {
      if (addedForArtist >= opts.perArtist || songs.length >= opts.target) break;
      seenSlugs.add(t.slug);
      addedForArtist++;
      let detail;
      try {
        detail = await getTrack(t.slug);
        fetches++;
      } catch (e) {
        console.log(`  ! track ${t.slug}: ${e.message}`);
        await sleep(RATE_MS);
        continue;
      }
      await sleep(RATE_MS);

      const lyrics = pesniRuTextToVerifiedLyrics(detail.text ?? '');
      if (!lyrics || !isQualityTab(lyrics)) continue;
      const key = dupeKey(detail.artist?.name ?? artist, detail.name);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const chords = extractBracketChords(lyrics);
      if (chords.length < 2) continue;

      songs.push({
        id: `pesni_ru_${t.slug}`,
        title: (detail.name ?? '').trim(),
        artist: (detail.artist?.name ?? artist).trim(),
        chords: chords.join(' '),
        key: chords[0],
        difficulty: difficultyFor(chords),
        genre: 'Разное',
        lyrics: lyrics.slice(0, MAX_LYRIC_CHARS),
      });
      kept++;
    }

    cp.songs = songs;
    cp.seenSlugs = [...seenSlugs];
    cp.seenKeys = [...seenKeys];
    cp.doneArtists = [...doneArtists];
    if (!opts.dryRun) saveCheckpoint(cp);
    console.log(
      `[${ai + 1}/${artists.length}] ${resolved.name}: +${kept} verified (total ${songs.length}/${opts.target})`,
    );
  }

  if (opts.dryRun) {
    console.log(`DRY RUN — ${songs.length} verified tabs (not written).`);
    return;
  }

  writeBundle(songs);
  console.log(`\nWrote ${songs.length} verified ChordPro tabs → ${OUT_PATH}`);
  console.log(`API fetches this run: ${fetches}`);
  if (songs.length >= opts.target) {
    console.log('Target reached. Delete tools/.pesni-ingest-checkpoint.json to start fresh.');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
