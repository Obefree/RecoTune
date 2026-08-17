import type * as SQLite from 'expo-sqlite';
import type { SongEntry } from '../data/songDatabase';
import { isVerifiedChordProLyrics } from '../utils/chordLyricsNormalize';
import { extractChordSequence } from '../utils/chordProgression';
import { combinedArtistTitle } from '../utils/searchNormalize';

/**
 * Offline bundle of REAL verified ChordPro tabs: pesni.ru harvest plus the
 * published AmDm/UG overlay (`proxy-parsed-chords.json`). Same verification
 * gate as runtime fetch — no stubs (D8). Lands in SQLite so the APK has tabs
 * without the PC proxy.
 */
type PesniArchiveFile = {
  version: number;
  count: number;
  songs: (SongEntry & { lyrics: string })[];
};

type OverlayArchiveFile = {
  version?: number;
  count?: number;
  songs?: { artist?: string; title?: string; chordPro?: string; provider?: string }[];
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PESNI_ARCHIVE = require('../../assets/archive/pesni-chordpro.json') as PesniArchiveFile;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OVERLAY_ARCHIVE = require('../../assets/archive/proxy-parsed-chords.json') as OverlayArchiveFile;

const PESNI_SONG_COUNT = PESNI_ARCHIVE?.count ?? PESNI_ARCHIVE?.songs?.length ?? 0;
const OVERLAY_SONG_COUNT = OVERLAY_ARCHIVE?.count ?? OVERLAY_ARCHIVE?.songs?.length ?? 0;

/** Bundled verified ChordPro tabs in the APK (pesni + AmDm/UG overlay). */
export const PESNI_OFFLINE_TAB_COUNT = PESNI_SONG_COUNT + OVERLAY_SONG_COUNT;

const META_PESNI_ARCHIVE_VERSION = 'pesni_archive_version';
const META_PARSED_OVERLAY_VERSION = 'parsed_overlay_version';

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

function overlaySongId(artist: string, title: string, provider: string): string {
  const key = combinedArtistTitle(artist, title)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const src = provider.replace(/[^a-z0-9]+/gi, '').slice(0, 12) || 'store';
  return `parsed_${src}_${key || 'song'}`;
}

function overlayEntries(pesniSongs: (SongEntry & { lyrics: string })[]): SongEntry[] {
  const seen = new Set(
    pesniSongs.map(s => combinedArtistTitle(s.artist, s.title).toLowerCase()),
  );
  const out: SongEntry[] = [];
  for (const raw of OVERLAY_ARCHIVE?.songs ?? []) {
    const artist = String(raw.artist ?? '').trim();
    const title = String(raw.title ?? '').trim();
    const lyrics = String(raw.chordPro ?? '').trim();
    if (!artist || !title || !lyrics || !isVerifiedChordProLyrics(lyrics)) continue;
    const dup = combinedArtistTitle(artist, title).toLowerCase();
    if (seen.has(dup)) continue;
    seen.add(dup);
    const chords = extractChordSequence(lyrics).slice(0, 12).join(' ');
    out.push({
      id: overlaySongId(artist, title, String(raw.provider ?? 'store')),
      title,
      artist,
      chords,
      difficulty: chords.split(/\s+/).filter(Boolean).length > 5 ? 3 : 2,
      genre: 'parsed',
      lyrics,
      chordProVerified: true,
    });
  }
  return out;
}

async function insertVerifiedSongs(
  database: SQLite.SQLiteDatabase,
  songs: SongEntry[],
): Promise<number> {
  const ts = new Date().toISOString();
  let imported = 0;
  for (let i = 0; i < songs.length; i += IMPORT_BATCH) {
    const batch = songs.slice(i, i + IMPORT_BATCH);
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
  return imported;
}

/** Seed pesni.ru + published overlay into the library (once per bundle version+count). */
export async function importPesniChordProArchive(
  database: SQLite.SQLiteDatabase,
): Promise<{ imported: number }> {
  const pesniSongs = PESNI_ARCHIVE?.songs ?? [];
  const overlaySongs = overlayEntries(pesniSongs);
  const bundleVersion = PESNI_ARCHIVE?.version ?? 0;
  const pesniMeta = archiveImportMetaValue(bundleVersion, pesniSongs.length);
  const overlayMeta = archiveImportMetaValue(OVERLAY_ARCHIVE?.version ?? 1, overlaySongs.length);
  if (pesniSongs.length === 0 && overlaySongs.length === 0) return { imported: 0 };

  const pesniDone = (await getMeta(database, META_PESNI_ARCHIVE_VERSION)) === pesniMeta;
  const overlayDone = (await getMeta(database, META_PARSED_OVERLAY_VERSION)) === overlayMeta;
  if (pesniDone && overlayDone) return { imported: 0 };

  let imported = 0;
  if (!pesniDone && pesniSongs.length > 0) {
    const verified = pesniSongs.filter(s => {
      const lyrics = s.lyrics?.trim();
      return lyrics && isVerifiedChordProLyrics(lyrics);
    });
    imported += await insertVerifiedSongs(database, verified);
    await setMeta(database, META_PESNI_ARCHIVE_VERSION, pesniMeta);
  }
  if (!overlayDone && overlaySongs.length > 0) {
    imported += await insertVerifiedSongs(database, overlaySongs);
    await setMeta(database, META_PARSED_OVERLAY_VERSION, overlayMeta);
  }
  return { imported };
}
