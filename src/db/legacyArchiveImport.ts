import type { SongEntry } from '../data/songDatabase';
import { resolveLyricsText } from '../utils/songContent';
import { getSchemaMeta, getSongLibraryDb, setSchemaMeta } from './songLibrary';

function bundleBuiltinEntry(song: SongEntry): SongEntry {
  const lyrics = resolveLyricsText(song);
  return { ...song, lyrics };
}

type LegacyArchiveFile = {
  version: number;
  songs: SongEntry[];
};

function loadLegacyArchive(): LegacyArchiveFile {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../assets/archive/legacy-songs-536.json') as LegacyArchiveFile;
}

const META_LEGACY_IMPORTED = 'legacy_archive_imported';

export async function isLegacyArchiveImported(): Promise<boolean> {
  return (await getSchemaMeta(META_LEGACY_IMPORTED)) === '1';
}

/** Optional restore of full ~536 builtin catalog from assets archive. */
export async function importLegacyArchiveCatalog(): Promise<{ imported: number }> {
  const database = await getSongLibraryDb();
  const songs = loadLegacyArchive().songs ?? [];
  const ts = new Date().toISOString();
  let imported = 0;

  for (const song of songs) {
    const bundled = bundleBuiltinEntry(song);
    const existing = await database.getFirstAsync<{ source: string; created_at: string }>(
      'SELECT source, created_at FROM songs WHERE id = ?',
      song.id,
    );
    if (existing?.source === 'user') continue;

    const row = {
      id: bundled.id,
      title: bundled.title,
      artist: bundled.artist,
      chords: bundled.chords,
      key: bundled.key ?? null,
      bpm: bundled.bpm ?? null,
      difficulty: bundled.difficulty,
      genre: bundled.genre,
      lyrics: bundled.lyrics ?? null,
      created_at: existing?.created_at ?? ts,
      updated_at: ts,
    };

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
    imported += 1;
  }

  await setSchemaMeta(META_LEGACY_IMPORTED, '1');
  return { imported };
}
