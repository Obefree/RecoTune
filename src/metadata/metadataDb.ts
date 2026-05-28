import type { SongEntry } from '../data/songDatabase';
import { enqueueSqliteWrite } from '../db/sqliteWriteLock';
import { getSongById, getSongLibraryDb } from '../db/songLibrary';
import { combinedArtistTitle, normalizeSearchText } from '../utils/searchNormalize';
import { compareSearchHits, scoreSongAgainstQuery, type MatchKind } from '../utils/searchScore';
import type { MetadataArtistRow, MetadataTrackRow } from './types';

export const METADATA_TRACK_ID_PREFIX = 'meta_';

export type MetadataSearchHit = MetadataTrackRow & {
  score: number;
  matchKind: MatchKind;
  linkedSong?: SongEntry | null;
};

function buildTrackSearchText(t: Pick<MetadataTrackRow, 'artistName' | 'title' | 'album'>): string {
  return normalizeSearchText(`${t.artistName} ${t.title} ${t.album ?? ''}`);
}

function buildArtistSearchText(name: string): string {
  return normalizeSearchText(name);
}

export async function upsertMetadataBatch(
  artists: MetadataArtistRow[],
  tracks: MetadataTrackRow[],
): Promise<{ artists: number; tracks: number }> {
  return enqueueSqliteWrite(async () => {
    const db = await getSongLibraryDb();
    let artistCount = 0;
    let trackCount = 0;

    await db.withTransactionAsync(async () => {
      for (const a of artists) {
        const searchText = a.searchText || buildArtistSearchText(a.name);
        await db.runAsync(
          `INSERT INTO metadata_artists (id, name, sort_name, mbid, search_text)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             sort_name = excluded.sort_name,
             mbid = excluded.mbid,
             search_text = excluded.search_text`,
          a.id,
          a.name,
          a.sortName ?? a.name,
          a.mbid ?? null,
          searchText,
        );
        artistCount += 1;
      }

      for (const t of tracks) {
        const searchText = t.searchText || buildTrackSearchText(t);
        await db.runAsync(
          `INSERT INTO metadata_tracks (
             id, artist_id, artist_name, title, album, year, duration_ms, mbid, search_text, builtin_song_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             artist_id = excluded.artist_id,
             artist_name = excluded.artist_name,
             title = excluded.title,
             album = excluded.album,
             year = excluded.year,
             duration_ms = excluded.duration_ms,
             mbid = excluded.mbid,
             search_text = excluded.search_text,
             builtin_song_id = excluded.builtin_song_id`,
          t.id,
          t.artistId,
          t.artistName,
          t.title,
          t.album ?? null,
          t.year ?? null,
          t.durationMs ?? null,
          t.mbid ?? null,
          searchText,
          t.builtinSongId ?? null,
        );
        trackCount += 1;
      }
    });

    return { artists: artistCount, tracks: trackCount };
  });
}

export async function getMetadataTrackCount(): Promise<number> {
  const db = await getSongLibraryDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM metadata_tracks');
  return row?.n ?? 0;
}

export async function metadataTrackToSongEntry(track: MetadataTrackRow): Promise<SongEntry> {
  if (track.builtinSongId) {
    const linked = await getSongById(track.builtinSongId);
    if (linked) return linked;
  }
  return {
    id: `${METADATA_TRACK_ID_PREFIX}${track.id}`,
    title: track.title,
    artist: track.artistName,
    chords: '',
    difficulty: 1,
    genre: 'метаданные',
  };
}

export async function searchMetadataTracks(
  query: string,
  options?: { limit?: number },
): Promise<MetadataSearchHit[]> {
  const db = await getSongLibraryDb();
  const limit = options?.limit ?? 80;
  const q = query.trim();

  if (!q) {
    const rows = await db.getAllAsync<MetadataTrackRow & { builtin_song_id: string | null }>(
      `SELECT id, artist_id AS artistId, artist_name AS artistName, title, album, year, duration_ms AS durationMs,
              mbid, search_text AS searchText, builtin_song_id AS builtinSongId
       FROM metadata_tracks
       ORDER BY artist_name COLLATE NOCASE, title COLLATE NOCASE
       LIMIT ?`,
      limit,
    );
    const hits: MetadataSearchHit[] = [];
    for (const row of rows) {
      const linked = row.builtinSongId ? await getSongById(row.builtinSongId) : null;
      hits.push({
        ...row,
        score: linked ? 50 : 10,
        matchKind: 'none',
        linkedSong: linked,
      });
    }
    return hits;
  }

  const qNorm = normalizeSearchText(q);
  const tokens = qNorm.split(/\s+/).filter(t => t.length >= 2);
  const likeClauses: string[] = [];
  const likeArgs: string[] = [];
  if (tokens.length > 0) {
    for (const t of tokens.slice(0, 4)) {
      likeClauses.push('search_text LIKE ?');
      likeArgs.push(`%${t}%`);
    }
  } else if (qNorm.length >= 2) {
    likeClauses.push('search_text LIKE ?');
    likeArgs.push(`%${qNorm}%`);
  }

  if (!likeClauses.length) return [];

  const whereSql = `WHERE ${likeClauses.join(' AND ')}`;
  const scanLimit = Math.min(Math.max(limit * 8, 120), 600);
  const rows = await db.getAllAsync<MetadataTrackRow & { builtin_song_id: string | null }>(
    `SELECT id, artist_id AS artistId, artist_name AS artistName, title, album, year, duration_ms AS durationMs,
            mbid, search_text AS searchText, builtin_song_id AS builtinSongId
     FROM metadata_tracks
     ${whereSql}
     LIMIT ?`,
    ...likeArgs,
    scanLimit,
  );

  const hits: MetadataSearchHit[] = [];
  for (const row of rows) {
    const { score, kind } = scoreSongAgainstQuery(q, row.title, row.artistName);
    const albumNorm = normalizeSearchText(row.album ?? '');
    let finalScore = score;
    if (albumNorm.includes(qNorm) && qNorm.length >= 2) finalScore = Math.max(finalScore, 40);

    if (finalScore > 0 || kind !== 'none') {
      const linked = row.builtinSongId ? await getSongById(row.builtinSongId) : null;
      hits.push({
        ...row,
        score: finalScore + (linked ? 15 : 0),
        matchKind: kind,
        linkedSong: linked,
      });
    }
  }

  hits.sort((a, b) =>
    compareSearchHits(
      { score: a.score, kind: a.matchKind, title: a.title },
      { score: b.score, kind: b.matchKind, title: b.title },
    ),
  );

  return hits.slice(0, limit);
}

export function metadataDedupeKey(title: string, artist: string): string {
  return combinedArtistTitle(artist, title);
}
