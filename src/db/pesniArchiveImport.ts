import type * as SQLite from 'expo-sqlite';
import type { SongEntry } from '../data/songDatabase';
import { isVerifiedChordProLyrics } from '../utils/chordLyricsNormalize';

/**
 * Offline bundle of REAL verified ChordPro tabs harvested from pesni.ru
 * (tools/ingest-pesni-chordpro.mjs). Every entry already passed the same
 * chord-over-lyric verification as the runtime pesni.ru fetch — no stubs,
 * no progression-only glue (D8). Imported into the library so the tabs work
 * offline / phone-only without the PC proxy.
 */
type PesniArchiveFile = {
  version: number;
  count: number;
  songs: (SongEntry & { lyrics: string })[];
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PESNI_ARCHIVE = require('../../assets/archive/pesni-chordpro.json') as PesniArchiveFile;

/** Bundled verified ChordPro tabs (offline, no proxy). */
export const PESNI_OFFLINE_TAB_COUNT = PESNI_ARCHIVE?.count ?? PESNI_ARCHIVE?.songs?.length ?? 0;

const META_PESNI_ARCHIVE_VERSION = 'pesni_archive_version';

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

/** Seed pesni.ru verified ChordPro tabs into the library (once per bundle version). */
export async function importPesniChordProArchive(
  database: SQLite.SQLiteDatabase,
): Promise<{ imported: number }> {
  const songs = PESNI_ARCHIVE?.songs ?? [];
  const wantVersion = String(PESNI_ARCHIVE?.version ?? 0);
  if (songs.length === 0) return { imported: 0 };
  if ((await getMeta(database, META_PESNI_ARCHIVE_VERSION)) === wantVersion) {
    return { imported: 0 };
  }

  const ts = new Date().toISOString();
  let imported = 0;

  for (const song of songs) {
    const lyrics = song.lyrics?.trim();
    // Defensive: never insert anything that is not a real chord-over-lyric tab.
    if (!lyrics || !isVerifiedChordProLyrics(lyrics)) continue;

    const existing = await database.getFirstAsync<{ source: string; created_at: string }>(
      'SELECT source, created_at FROM songs WHERE id = ?',
      song.id,
    );
    if (existing?.source === 'user') continue;

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
      song.id,
      song.title,
      song.artist,
      song.chords,
      song.key ?? null,
      song.bpm ?? null,
      song.difficulty,
      song.genre,
      lyrics,
      existing?.created_at ?? ts,
      ts,
    );
    imported += 1;
  }

  await setMeta(database, META_PESNI_ARCHIVE_VERSION, wantVersion);
  return { imported };
}
