/**
 * Rebuild the phone catalog from pesni + overlay archives.
 *
 * Runtime must NOT require the monolith JSON (that freezes the Chords tab).
 * This writes:
 *   assets/catalog/index.json          — artists + songs, no lyrics
 *   assets/catalog/lyrics/<shard>.json — ChordPro bodies, loaded on song pick
 *   src/catalog/lyricsShardLoaders.ts  — lazy require() map
 *
 *   node tools/build-offline-catalog.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { isVerifiedChordProLyrics } from './lib/chordNormalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PESNI_PATH = join(ROOT, 'assets/archive/pesni-chordpro.json');
const OVERLAY_PATH = join(ROOT, 'assets/archive/proxy-parsed-chords.json');
const OUT_DIR = join(ROOT, 'assets/catalog');
const LYRICS_DIR = join(OUT_DIR, 'lyrics');
const INDEX_PATH = join(OUT_DIR, 'index.json');
const LOADERS_PATH = join(ROOT, 'src/catalog/lyricsShardLoaders.ts');

const SHARD_COUNT = 16;
const CATALOG_VERSION = 1;

function canonicalizeArtist(raw) {
  let name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  name = name.replace(/\s*[(\[]\s*(?:feat\.?|ft\.?|featuring)\b[^)\]]*[)\]]\s*$/i, '').trim();
  name = name.replace(/\s*\([^)]{1,50}\)\s*$/g, '').trim();
  name = name.replace(/\s*\[[^\]]{1,50}\]\s*$/g, '').trim();
  return name || 'Неизвестный';
}

function normalizeKey(artist, title) {
  return `${canonicalizeArtist(artist)} ${title}`
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function overlaySongId(artist, title, provider) {
  const key = normalizeKey(artist, title)
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const src = String(provider ?? 'store').replace(/[^a-z0-9]+/gi, '').slice(0, 12) || 'store';
  return `parsed_${src}_${key || 'song'}`;
}

function shardForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  }
  return String(h % SHARD_COUNT).padStart(2, '0');
}

function extractChords(lyrics, fallback = '') {
  if (fallback?.trim()) return fallback.trim().split(/\s+/).filter(Boolean).slice(0, 12).join(' ');
  const seen = [];
  const set = new Set();
  const re = /\[([A-H][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-H][#b]?)?)\]/gi;
  for (const m of lyrics.matchAll(re)) {
    const chord = m[1];
    if (set.has(chord)) continue;
    set.add(chord);
    seen.push(chord);
    if (seen.length >= 12) break;
  }
  return seen.join(' ');
}

function difficultyFromChords(chords, fallback = 2) {
  if (fallback === 1 || fallback === 2 || fallback === 3) return fallback;
  const n = chords.split(/\s+/).filter(Boolean).length;
  if (n <= 3) return 1;
  if (n <= 5) return 2;
  return 3;
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

const pesni = readJson(PESNI_PATH);
const overlay = readJson(OVERLAY_PATH);
const pesniSongs = Array.isArray(pesni?.songs) ? pesni.songs : [];
const overlaySongs = Array.isArray(overlay?.songs) ? overlay.songs : [];

const seen = new Set();
const kept = [];
let skippedUnverified = 0;
let skippedDup = 0;

function tryKeep(song) {
  const lyrics = String(song.lyrics ?? '').trim();
  if (!lyrics || !isVerifiedChordProLyrics(lyrics)) {
    skippedUnverified += 1;
    return;
  }
  const artist = canonicalizeArtist(song.artist);
  const title = String(song.title ?? '').trim();
  if (!artist || !title) {
    skippedUnverified += 1;
    return;
  }
  const key = normalizeKey(artist, title);
  if (seen.has(key)) {
    skippedDup += 1;
    return;
  }
  seen.add(key);
  const chords = extractChords(lyrics, song.chords);
  kept.push({
    id: song.id,
    title,
    artist,
    chords,
    key: song.key || undefined,
    bpm: song.bpm || undefined,
    difficulty: difficultyFromChords(chords, song.difficulty),
    genre: String(song.genre ?? 'catalog').trim() || 'catalog',
    lyrics,
  });
}

for (const song of pesniSongs) {
  tryKeep({
    id: song.id,
    title: song.title,
    artist: song.artist,
    chords: song.chords,
    key: song.key,
    bpm: song.bpm,
    difficulty: song.difficulty,
    genre: song.genre,
    lyrics: song.lyrics,
  });
}

for (const raw of overlaySongs) {
  const artist = String(raw.artist ?? '').trim();
  const title = String(raw.title ?? '').trim();
  tryKeep({
    id: overlaySongId(artist, title, raw.provider),
    title,
    artist,
    chords: '',
    difficulty: 2,
    genre: 'parsed',
    lyrics: raw.chordPro,
  });
}

kept.sort((a, b) => {
  const artistCmp = a.artist.localeCompare(b.artist, 'ru');
  if (artistCmp !== 0) return artistCmp;
  return a.title.localeCompare(b.title, 'ru');
});

const shards = new Map();
const indexSongs = kept.map(song => {
  const shard = shardForId(song.id);
  if (!shards.has(shard)) shards.set(shard, {});
  shards.get(shard)[song.id] = song.lyrics;
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    chords: song.chords,
    ...(song.key ? { key: song.key } : {}),
    ...(song.bpm ? { bpm: song.bpm } : {}),
    difficulty: song.difficulty,
    genre: song.genre,
    shard,
    hasTab: true,
  };
});

const artistMap = new Map();
for (const song of indexSongs) {
  const name = song.artist.trim() || 'Unknown';
  const key = name.toLowerCase();
  const prev = artistMap.get(key) ?? { name, count: 0, tabCount: 0 };
  prev.count += 1;
  if (song.hasTab) prev.tabCount += 1;
  artistMap.set(key, prev);
}
const artists = [...artistMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

if (existsSync(LYRICS_DIR)) rmSync(LYRICS_DIR, { recursive: true, force: true });
mkdirSync(LYRICS_DIR, { recursive: true });
mkdirSync(dirname(LOADERS_PATH), { recursive: true });

const index = {
  version: CATALOG_VERSION,
  generatedAt: new Date().toISOString(),
  songCount: indexSongs.length,
  artistCount: artists.length,
  songs: indexSongs,
  artists,
};

writeFileSync(INDEX_PATH, JSON.stringify(index));

const shardIds = [...shards.keys()].sort();
for (const shard of shardIds) {
  writeFileSync(join(LYRICS_DIR, `${shard}.json`), JSON.stringify(shards.get(shard)));
}

const leftover = readdirSync(LYRICS_DIR).filter(name => {
  const id = name.replace(/\.json$/, '');
  return !shards.has(id);
});
for (const name of leftover) {
  rmSync(join(LYRICS_DIR, name));
}

const cases = shardIds
  .map(id => `    case '${id}':\n      return require('../../assets/catalog/lyrics/${id}.json') as Record<string, string>;`)
  .join('\n');

writeFileSync(
  LOADERS_PATH,
  `/** Auto-generated by tools/build-offline-catalog.mjs — do not edit. */\n`
    + `export function requireLyricsShard(shard: string): Record<string, string> {\n`
    + `  switch (shard) {\n`
    + `${cases}\n`
    + `    default:\n      return {};\n`
    + `  }\n`
    + `}\n`,
);

const indexBytes = Buffer.byteLength(JSON.stringify(index));
const lyricsBytes = shardIds.reduce(
  (n, id) => n + Buffer.byteLength(JSON.stringify(shards.get(id))),
  0,
);

console.log(
  [
    `catalog v${CATALOG_VERSION}`,
    `${indexSongs.length} songs`,
    `${artists.length} artists`,
    `${shardIds.length} lyric shards`,
    `index ${(indexBytes / 1024).toFixed(1)} KB`,
    `lyrics ${(lyricsBytes / 1024).toFixed(1)} KB`,
    `skipped unverified ${skippedUnverified}`,
    `skipped dup ${skippedDup}`,
    `→ ${INDEX_PATH}`,
  ].join(' · '),
);
