import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { SONGS, type SongEntry } from '../data/songDatabase';
import { countAnnotatedInEntries, resolveLyricsText } from '../utils/songContent';
import { isVerifiedChordProLyrics } from '../utils/chordLyricsNormalize';
import { combinedArtistTitle } from '../utils/searchNormalize';
import { importPesniChordProArchive } from './pesniArchiveImport';

const DB_NAME = 'recotune_song_library.db';
const SCHEMA_VERSION = 4;
/** Bump when bundled builtin catalog (chords/lyrics) changes — re-upserts builtin rows only. */
export const BUILTIN_SEED_VERSION = '2026-05-24-verified-chordpro-only';
/** Dev-only bundle marker; not shown in production Chords UI. */
export const CHORD_LIBRARY_BUILD = 'chord-v5-pesni1113';

let pesniArchiveImportPromise: Promise<{ imported: number }> | null = null;

/** Await background pesni bundle import started during init (null if none / finished). */
export function getPesniArchiveImportPromise(): Promise<{ imported: number }> | null {
  return pesniArchiveImportPromise;
}

const CUSTOM_SONGS_FILE = (FileSystem.documentDirectory ?? '') + 'custom_songs.json';
const FAVORITES_FILE = (FileSystem.documentDirectory ?? '') + 'song_favorites.json';

type SongSource = 'builtin' | 'user';

type SongRow = {
  id: string;
  title: string;
  artist: string;
  chords: string;
  key: string | null;
  bpm: number | null;
  difficulty: number;
  genre: string;
  lyrics: string | null;
  source: SongSource;
  created_at: string;
  updated_at: string;
};

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<BuiltinCatalogUpgradeResult> | null = null;

export type BuiltinCatalogUpgradeResult = {
  upgraded: boolean;
  totalBuiltin: number;
  fullChordCount: number;
  /** First-time pesni.ru archive seed into SQLite (0 if already at bundle version). */
  pesniArchiveImported: number;
};

function builtinCatalogStats(): BuiltinCatalogUpgradeResult {
  const bundled = SONGS.map(bundleBuiltinEntry);
  return {
    upgraded: false,
    totalBuiltin: SONGS.length,
    fullChordCount: countAnnotatedInEntries(bundled),
    pesniArchiveImported: 0,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowToEntry(row: SongRow): SongEntry {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    chords: row.chords,
    key: row.key ?? undefined,
    bpm: row.bpm ?? undefined,
    difficulty: row.difficulty as 1 | 2 | 3,
    genre: row.genre,
    lyrics: row.lyrics ?? undefined,
  };
}

function entryToRow(song: SongEntry, source: SongSource, timestamps?: { created_at: string; updated_at: string }): {
  id: string;
  title: string;
  artist: string;
  chords: string;
  key: string | null;
  bpm: number | null;
  difficulty: number;
  genre: string;
  lyrics: string | null;
  source: SongSource;
  created_at: string;
  updated_at: string;
} {
  const ts = timestamps ?? { created_at: nowIso(), updated_at: nowIso() };
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    chords: song.chords,
    key: song.key ?? null,
    bpm: song.bpm ?? null,
    difficulty: song.difficulty,
    genre: song.genre,
    lyrics: song.lyrics ?? null,
    source,
    created_at: ts.created_at,
    updated_at: ts.updated_at,
  };
}

async function migrateSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  if (current < 3) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS chord_cache (
        cache_key TEXT NOT NULL PRIMARY KEY,
        provider TEXT NOT NULL,
        content_json TEXT NOT NULL,
        source_url TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chord_cache_expires ON chord_cache(expires_at);
    `);
  }

  if (current < 4) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS metadata_artists (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        sort_name TEXT,
        mbid TEXT,
        search_text TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_metadata_artists_search ON metadata_artists(search_text);
      CREATE TABLE IF NOT EXISTS metadata_tracks (
        id TEXT NOT NULL PRIMARY KEY,
        artist_id TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        title TEXT NOT NULL,
        album TEXT,
        year INTEGER,
        duration_ms INTEGER,
        mbid TEXT,
        search_text TEXT NOT NULL,
        builtin_song_id TEXT,
        FOREIGN KEY (artist_id) REFERENCES metadata_artists(id)
      );
      CREATE INDEX IF NOT EXISTS idx_metadata_tracks_search ON metadata_tracks(search_text);
      CREATE INDEX IF NOT EXISTS idx_metadata_tracks_title ON metadata_tracks(title);
      CREATE INDEX IF NOT EXISTS idx_metadata_tracks_artist ON metadata_tracks(artist_name);
    `);
  }

  if (current === 0) {
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT NOT NULL PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        chords TEXT NOT NULL,
        key TEXT,
        bpm INTEGER,
        difficulty INTEGER NOT NULL,
        genre TEXT NOT NULL,
        lyrics TEXT,
        source TEXT NOT NULL CHECK (source IN ('builtin', 'user')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
      CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
      CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);
      CREATE TABLE IF NOT EXISTS song_favorites (
        song_id TEXT NOT NULL PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT NOT NULL PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

async function getMeta(database: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM schema_meta WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

async function setMeta(database: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  await database.runAsync(
    'INSERT INTO schema_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

function bundleBuiltinEntry(song: SongEntry): SongEntry {
  const verified: SongEntry = { ...song, chordProVerified: true };
  const lyrics = resolveLyricsText(verified);
  return { ...verified, lyrics };
}

async function seedBuiltinIfEmpty(database: SQLite.SQLiteDatabase): Promise<void> {
  const countRow = await database.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM songs');
  if ((countRow?.n ?? 0) > 0) return;

  const ts = nowIso();
  for (const song of SONGS) {
    const row = entryToRow(bundleBuiltinEntry(song), 'builtin', { created_at: ts, updated_at: ts });
    await database.runAsync(
      `INSERT INTO songs (id, title, artist, chords, key, bpm, difficulty, genre, lyrics, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.title,
      row.artist,
      row.chords,
      row.key,
      row.bpm,
      row.difficulty,
      row.genre,
      row.lyrics,
      row.source,
      row.created_at,
      row.updated_at,
    );
  }
}

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return JSON.parse(await FileSystem.readAsStringAsync(path)) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

async function migrateLegacyJson(database: SQLite.SQLiteDatabase): Promise<void> {
  if ((await getMeta(database, 'legacy_json_imported')) === '1') return;

  const custom = await loadJson<SongEntry[]>(CUSTOM_SONGS_FILE, []);
  const ts = nowIso();
  for (const song of custom) {
    const row = entryToRow(song, 'user', { created_at: ts, updated_at: ts });
    await database.runAsync(
      `INSERT INTO songs (id, title, artist, chords, key, bpm, difficulty, genre, lyrics, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         artist = excluded.artist,
         chords = excluded.chords,
         key = excluded.key,
         bpm = excluded.bpm,
         difficulty = excluded.difficulty,
         genre = excluded.genre,
         lyrics = excluded.lyrics,
         source = 'user',
         updated_at = excluded.updated_at`,
      row.id,
      row.title,
      row.artist,
      row.chords,
      row.key,
      row.bpm,
      row.difficulty,
      row.genre,
      row.lyrics,
      row.source,
      row.created_at,
      row.updated_at,
    );
  }

  const favIds = await loadJson<string[]>(FAVORITES_FILE, []);
  for (const id of favIds) {
    const exists = await database.getFirstAsync<{ id: string }>('SELECT id FROM songs WHERE id = ?', id);
    if (exists) {
      await database.runAsync(
        'INSERT INTO song_favorites (song_id) VALUES (?) ON CONFLICT(song_id) DO NOTHING',
        id,
      );
    }
  }

  await setMeta(database, 'legacy_json_imported', '1');
}

const META_LEGACY_ARCHIVE = 'legacy_archive_imported';

/** Remove builtin rows from old 536 seed unless user imported legacy archive. */
async function purgeStaleBuiltinRows(database: SQLite.SQLiteDatabase): Promise<void> {
  if ((await getMeta(database, META_LEGACY_ARCHIVE)) === '1') return;
  const keepIds = SONGS.map(s => s.id);
  if (keepIds.length === 0) return;
  const placeholders = keepIds.map(() => '?').join(',');
  // Keep bundled verified tabs (pesni_ru_* / parsed_*) — seeded by
  // importPesniChordProArchive, not part of SONGS, and must not be purged.
  await database.runAsync(
    `DELETE FROM songs WHERE source = 'builtin' AND id NOT IN (${placeholders}) AND id NOT LIKE 'pesni_ru_%' AND id NOT LIKE 'parsed_%'`,
    ...keepIds,
  );
}

/** Drop lyrics that fail verified ChordPro heuristic (progression glue, lyrics.ovh, stale merge). */
async function purgeUnverifiedMergedLyrics(database: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await database.getAllAsync<{ id: string; lyrics: string | null }>(
    "SELECT id, lyrics FROM songs WHERE lyrics IS NOT NULL AND trim(lyrics) != ''",
  );
  const ts = nowIso();
  for (const row of rows) {
    const lyrics = row.lyrics ?? '';
    if (isVerifiedChordProLyrics(lyrics)) continue;
    await database.runAsync(
      'UPDATE songs SET lyrics = NULL, updated_at = ? WHERE id = ?',
      ts,
      row.id,
    );
  }
}

/** Sync builtin SQLite lyrics from bundled seed (verified ChordPro only). */
async function repairBuiltinLyricsInDb(database: SQLite.SQLiteDatabase): Promise<void> {
  const ts = nowIso();
  for (const song of SONGS) {
    const bundled = bundleBuiltinEntry(song);
    await database.runAsync(
      "UPDATE songs SET lyrics = ?, updated_at = ? WHERE id = ? AND source = 'builtin'",
      bundled.lyrics ?? null,
      ts,
      song.id,
    );
  }
}

/** Refresh builtin rows from app bundle; never overwrites source=user. */
async function upgradeBuiltinCatalog(database: SQLite.SQLiteDatabase): Promise<BuiltinCatalogUpgradeResult> {
  const stats = builtinCatalogStats();
  const prevVersion = await getMeta(database, 'builtin_seed_version');
  if (prevVersion === BUILTIN_SEED_VERSION) {
    return stats;
  }

  if (prevVersion && prevVersion !== BUILTIN_SEED_VERSION) {
    await purgeStaleBuiltinRows(database);
  }

  const ts = nowIso();
  for (const song of SONGS) {
    const bundled = bundleBuiltinEntry(song);
    const existing = await database.getFirstAsync<{ source: SongSource; created_at: string }>(
      'SELECT source, created_at FROM songs WHERE id = ?',
      song.id,
    );
    if (existing?.source === 'user') continue;

    const row = entryToRow(
      bundled,
      'builtin',
      existing
        ? { created_at: existing.created_at, updated_at: ts }
        : { created_at: ts, updated_at: ts },
    );
    await database.runAsync(
      `INSERT INTO songs (id, title, artist, chords, key, bpm, difficulty, genre, lyrics, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'builtin', ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         artist = excluded.artist,
         chords = excluded.chords,
         key = excluded.key,
         bpm = excluded.bpm,
         difficulty = excluded.difficulty,
         genre = excluded.genre,
         lyrics = excluded.lyrics,
         source = 'builtin',
         updated_at = excluded.updated_at
       WHERE songs.source = 'builtin'`,
      row.id,
      row.title,
      row.artist,
      row.chords,
      row.key,
      row.bpm,
      row.difficulty,
      row.genre,
      row.lyrics,
      row.created_at,
      row.updated_at,
    );
  }

  await setMeta(database, 'builtin_seed_version', BUILTIN_SEED_VERSION);
  return {
    upgraded: true,
    totalBuiltin: stats.totalBuiltin,
    fullChordCount: stats.fullChordCount,
    pesniArchiveImported: 0,
  };
}

export async function initSongLibrary(): Promise<BuiltinCatalogUpgradeResult> {
  if (!initPromise) {
    initPromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DB_NAME);
      await migrateSchema(database);
      await seedBuiltinIfEmpty(database);
      await purgeStaleBuiltinRows(database);
      const upgrade = await upgradeBuiltinCatalog(database);
      await repairBuiltinLyricsInDb(database);
      db = database;
      pesniArchiveImportPromise = (async () => {
        const pesni = await importPesniChordProArchive(database);
        await purgeUnverifiedMergedLyrics(database);
        await migrateLegacyJson(database);
        return pesni;
      })().finally(() => {
        pesniArchiveImportPromise = null;
      });
      void pesniArchiveImportPromise.catch(err => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[RecoTune] pesni archive import failed', err);
        }
      });
      return { ...upgrade, pesniArchiveImported: 0 };
    })().catch(err => {
      initPromise = null;
      db = null;
      throw err;
    });
  }
  return initPromise;
}

async function ensureDb(): Promise<SQLite.SQLiteDatabase> {
  await initSongLibrary();
  if (!db) throw new Error('Song library not initialized');
  return db;
}

/** Shared SQLite handle (after initSongLibrary). */
export async function getSongLibraryDb(): Promise<SQLite.SQLiteDatabase> {
  return ensureDb();
}

export async function getSchemaMeta(key: string): Promise<string | null> {
  const database = await ensureDb();
  return getMeta(database, key);
}

export async function setSchemaMeta(key: string, value: string): Promise<void> {
  const database = await ensureDb();
  await setMeta(database, key, value);
}

/**
 * The legacy seed (`sNNN`) and the bundled pesni.ru archive (`pesni_ru_*`) are
 * imported into `songs` under different ids, so the same artist+title (e.g.
 * "Blowin' in the Wind" — Bob Dylan) can land in the table twice. Collapse
 * those to one row per song so "База песен" doesn't show duplicates
 * (user report: «повторы аккордов»); prefer the curated non-pesni row when
 * both exist, keep title-sorted order otherwise.
 */
function dedupeSongRows(rows: SongRow[]): SongRow[] {
  const byKey = new Map<string, SongRow>();
  const order: string[] = [];
  for (const row of rows) {
    const key = combinedArtistTitle(row.artist, row.title);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      order.push(key);
      continue;
    }
    if (existing.id.startsWith('pesni_ru_') && !row.id.startsWith('pesni_ru_')) {
      byKey.set(key, row);
    }
  }
  return order.map(key => byKey.get(key)!);
}

export async function listSongs(): Promise<SongEntry[]> {
  const database = await ensureDb();
  const rows = await database.getAllAsync<SongRow>(
    'SELECT * FROM songs ORDER BY title COLLATE NOCASE ASC',
  );
  return dedupeSongRows(rows).map(r => bundleBuiltinEntry(rowToEntry(r)));
}

export async function getSongById(id: string): Promise<SongEntry | null> {
  const database = await ensureDb();
  const row = await database.getFirstAsync<SongRow>('SELECT * FROM songs WHERE id = ?', id);
  return row ? bundleBuiltinEntry(rowToEntry(row)) : null;
}

export async function listUserSongs(): Promise<SongEntry[]> {
  const database = await ensureDb();
  const rows = await database.getAllAsync<SongRow>(
    "SELECT * FROM songs WHERE source = 'user' ORDER BY updated_at DESC",
  );
  return rows.map(rowToEntry);
}

export async function upsertUserSong(song: SongEntry): Promise<void> {
  const database = await ensureDb();
  const existing = await database.getFirstAsync<{ created_at: string }>(
    'SELECT created_at FROM songs WHERE id = ?',
    song.id,
  );
  const ts = nowIso();
  const row = entryToRow(
    song,
    'user',
    existing
      ? { created_at: existing.created_at, updated_at: ts }
      : { created_at: ts, updated_at: ts },
  );
  await database.runAsync(
    `INSERT INTO songs (id, title, artist, chords, key, bpm, difficulty, genre, lyrics, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       artist = excluded.artist,
       chords = excluded.chords,
       key = excluded.key,
       bpm = excluded.bpm,
       difficulty = excluded.difficulty,
       genre = excluded.genre,
       lyrics = excluded.lyrics,
       source = 'user',
       updated_at = excluded.updated_at`,
    row.id,
    row.title,
    row.artist,
    row.chords,
    row.key,
    row.bpm,
    row.difficulty,
    row.genre,
    row.lyrics,
    row.created_at,
    row.updated_at,
  );
}

export async function deleteUserSong(id: string): Promise<void> {
  const database = await ensureDb();
  await database.runAsync("DELETE FROM songs WHERE id = ? AND source = 'user'", id);
  await database.runAsync('DELETE FROM song_favorites WHERE song_id = ?', id);
}

export async function getFavoriteIds(): Promise<Set<string>> {
  const database = await ensureDb();
  const rows = await database.getAllAsync<{ song_id: string }>('SELECT song_id FROM song_favorites');
  return new Set(rows.map(r => r.song_id));
}

export async function setFavorite(id: string, on: boolean): Promise<void> {
  const database = await ensureDb();
  if (on) {
    await database.runAsync(
      'INSERT INTO song_favorites (song_id) VALUES (?) ON CONFLICT(song_id) DO NOTHING',
      id,
    );
  } else {
    await database.runAsync('DELETE FROM song_favorites WHERE song_id = ?', id);
  }
}

export function isUserSongId(id: string): boolean {
  return id.startsWith('custom_');
}
