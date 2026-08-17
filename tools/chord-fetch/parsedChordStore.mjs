/**
 * Parsed ChordPro store served by PC proxy and Vercel.
 * Seed: bundled pesni archive (verified). Overlay: live AmDm/UG/GitHub parses on disk.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '../..');
const PESNI_PATH = join(ROOT, 'assets/archive/pesni-chordpro.json');
const SNAPSHOT_PATH = join(ROOT, 'assets/archive/proxy-parsed-chords.json');
const LOCAL_DIR = join(here, 'data');
const LOCAL_PATH = join(LOCAL_DIR, 'parsed-chords.local.json');

const WRITABLE = !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;

/** @type {Map<string, { artist: string, title: string, chordPro: string, sourceUrl?: string, provider?: string }> | null} */
let index = null;

export function normalizeChordKey(artist, title) {
  const a = String(artist ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9а-я]+/g, '')
    .trim();
  const t = String(title ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9а-я]+/g, '')
    .trim();
  return `${a}|${t}`;
}

function loadJsonFile(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function putSong(map, song) {
  const chordPro = String(song.chordPro || song.lyrics || '').trim();
  const artist = String(song.artist || '').trim();
  const title = String(song.title || '').trim();
  if (!chordPro || !artist || !title) return;
  if (!/\[[A-H][#b]?/.test(chordPro)) return;
  const rec = {
    artist,
    title,
    chordPro,
    sourceUrl: song.sourceUrl || song.url || '',
    provider: song.provider || 'store',
  };
  const key = normalizeChordKey(artist, title);
  if (!map.has(key)) map.set(key, rec);
}

function ensureIndex() {
  if (index) return index;
  const map = new Map();
  const pesni = loadJsonFile(PESNI_PATH);
  for (const song of pesni?.songs ?? []) {
    putSong(map, { ...song, provider: 'pesni_bundle' });
  }
  const snapshot = loadJsonFile(SNAPSHOT_PATH);
  for (const song of snapshot?.songs ?? []) putSong(map, song);
  const local = loadJsonFile(LOCAL_PATH);
  for (const song of local?.songs ?? []) putSong(map, song);
  index = map;
  return map;
}

export function parsedStoreStats() {
  const map = ensureIndex();
  return {
    songs: map.size,
    writable: WRITABLE,
    localPath: LOCAL_PATH,
  };
}

export function lookupParsedChord(artist, title) {
  const map = ensureIndex();
  const exact = map.get(normalizeChordKey(artist, title));
  if (exact) return exact;
  const swapped = map.get(normalizeChordKey(title, artist));
  if (swapped) return swapped;

  const wantA = normalizeChordKey(artist, '').replace('|', '');
  const wantT = normalizeChordKey('', title).replace('|', '');
  if (wantT.length < 4) return null;
  for (const rec of map.values()) {
    const a = normalizeChordKey(rec.artist, '').replace('|', '');
    const t = normalizeChordKey('', rec.title).replace('|', '');
    const titleOk = t === wantT || t.includes(wantT) || wantT.includes(t);
    const artistOk = !wantA || a.includes(wantA) || wantA.includes(a);
    if (titleOk && artistOk) return rec;
  }
  return null;
}

export function searchParsedStore(query, limit = 16) {
  const q = String(query ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9а-я]+/g, '')
    .trim();
  if (q.length < 2) return [];
  const hits = [];
  for (const rec of ensureIndex().values()) {
    const blob = normalizeChordKey(rec.artist, rec.title).replace('|', '');
    let score = 0;
    const a = normalizeChordKey(rec.artist, '').replace('|', '');
    const t = normalizeChordKey('', rec.title).replace('|', '');
    if (t === q) score += 90;
    else if (t.includes(q) || q.includes(t)) score += 50;
    if (a === q) score += 70;
    else if (a.includes(q) || q.includes(a)) score += 40;
    if (blob.includes(q)) score += 20;
    if (score < 40) continue;
    hits.push({
      provider: rec.provider || 'store',
      artist: rec.artist,
      title: rec.title,
      sourceUrl: rec.sourceUrl || '',
      score,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export function rememberParsedChord(song) {
  const chordPro = String(song.chordPro || '').trim();
  const artist = String(song.artist || '').trim();
  const title = String(song.title || '').trim();
  if (!WRITABLE || !chordPro || !artist || !title) return;
  if (!/\[[A-H][#b]?/.test(chordPro)) return;
  const map = ensureIndex();
  const rec = {
    artist,
    title,
    chordPro,
    sourceUrl: song.sourceUrl || '',
    provider: song.provider || 'amdm',
  };
  map.set(normalizeChordKey(artist, title), rec);
  try {
    mkdirSync(LOCAL_DIR, { recursive: true });
    const existing = loadJsonFile(LOCAL_PATH);
    const songs = Array.isArray(existing?.songs) ? existing.songs.filter(s =>
      normalizeChordKey(s.artist, s.title) !== normalizeChordKey(artist, title),
    ) : [];
    songs.push({ ...rec, savedAt: new Date().toISOString() });
    writeFileSync(
      LOCAL_PATH,
      JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), count: songs.length, songs }, null, 0),
    );
  } catch {
    /* read-only host */
  }
}

export function resetParsedStoreIndex() {
  index = null;
}

export function publishLocalOverlayToSnapshot() {
  const local = loadJsonFile(LOCAL_PATH);
  const songs = (local?.songs ?? []).map(rec => ({
    artist: rec.artist,
    title: rec.title,
    chordPro: rec.chordPro,
    sourceUrl: rec.sourceUrl || '',
    provider: rec.provider || 'amdm',
  }));
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(
    SNAPSHOT_PATH,
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      count: songs.length,
      songs,
    }),
  );
  return { path: SNAPSHOT_PATH, count: songs.length };
}
