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

const IMPORT_BATCH = 48;

function archiveImportMetaValue(version: number, count: number): string {
  return `${version}:${count}`;
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

/** Seed pesni.ru verified ChordPro tabs into the library (once per bundle version+count). */
export async function importPesniChordProArchive(
  database: SQLite.SQLiteDatabase,
): Promise<{ imported: number }> {
  const songs = PESNI_ARCHIVE?.songs ?? [];
  const bundleVersion = PESNI_ARCHIVE?.version ?? 0;
  const wantMeta = archiveImportMetaValue(bundleVersion, songs.length);
  if (songs.length === 0) return { imported: 0 };
  if ((await getMeta(database, META_PESNI_ARCHIVE_VERSION)) === wantMeta) {
    return { imported: 0 };
  }

  const ts = new Date().toISOString();
  let imported = 0;

  const verified = songs.filter(s => {
    const lyrics = s.lyrics?.trim();
    return lyrics && isVerifiedChordProLyrics(lyrics);
  });

  for (let i = 0; i < verified.length; i += IMPORT_BATCH) {
    const batch = verified.slice(i, i + IMPORT_BATCH);
    await database.withTransactionAsync(async () => {
      for (const song of batch) {
        const lyrics = song.lyrics!.trim();
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
    });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  await setMeta(database, META_PESNI_ARCHIVE_VERSION, wantMeta);
  return { imported };
}
