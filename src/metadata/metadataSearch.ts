import { getSongById } from '../db/songLibrary';
import { normalizeSearchText } from '../utils/searchNormalize';
import { compareSearchHits, scoreSongAgainstQuery } from '../utils/searchScore';

import { BUNDLED_METADATA_CHUNKS, METADATA_BUNDLED_TOTAL_HINT } from './bundledChunks';
import { getMetadataTrackCount, type MetadataSearchHit } from './metadataDb';
import { searchMetadataTracks } from './metadataDb';
import { isBundledMetadataSeeded } from './metadataSync';
import type { MetadataTrackRow } from './types';

/** Max hits per metadata page (UI + merge). */
export const METADATA_SEARCH_RESULT_CAP = 150;

/** Chunk scan starts at this query length; shorter queries use builtin SQLite only. */
export const METADATA_MIN_CHUNK_QUERY_LEN = 2;

export const BUNDLED_CATALOG_HINT = METADATA_BUNDLED_TOTAL_HINT;

/**
 * Scan in-memory bundled JSON chunks (no SQLite insert).
 * Early-exits once enough candidates are collected.
 */
export async function searchBundledMetadata(
  query: string,
  options?: { limit?: number; offset?: number },
): Promise<MetadataSearchHit[]> {
  const limit = Math.min(
    options?.limit ?? METADATA_SEARCH_RESULT_CAP,
    METADATA_SEARCH_RESULT_CAP,
  );
  const offset = Math.max(options?.offset ?? 0, 0);
  const q = query.trim();
  if (q.length < METADATA_MIN_CHUNK_QUERY_LEN) return [];

  const qNorm = normalizeSearchText(q);
  const hits: MetadataSearchHit[] = [];
  const candidateCap = (offset + limit) * 4;

  for (const chunk of BUNDLED_METADATA_CHUNKS) {
    const artistBoostIds = new Set<string>();
    for (const a of chunk.artists ?? []) {
      const { score, kind } = scoreSongAgainstQuery(q, '', a.name);
      const nameNorm = normalizeSearchText(a.name);
      if (score > 0 || kind !== 'none' || (qNorm.length >= 2 && nameNorm.includes(qNorm))) {
        artistBoostIds.add(a.id);
      }
    }

    for (const t of chunk.tracks) {
      const { score, kind } = scoreSongAgainstQuery(q, t.title, t.artistName);
      let finalScore = score;
      const albumNorm = normalizeSearchText(t.album ?? '');
      if (albumNorm.includes(qNorm) && qNorm.length >= METADATA_MIN_CHUNK_QUERY_LEN) {
        finalScore = Math.max(finalScore, 40);
      }
      if (artistBoostIds.has(t.artistId)) {
        finalScore = Math.max(finalScore, 52);
      }

      if (finalScore > 0 || kind !== 'none') {
        hits.push({
          ...(t as MetadataTrackRow),
          score: finalScore,
          matchKind: kind,
          linkedSong: null,
        });
      }

      if (hits.length >= candidateCap) break;
    }
    if (hits.length >= candidateCap) break;
  }

  hits.sort((a, b) =>
    compareSearchHits(
      { score: a.score, kind: a.matchKind, title: a.title },
      { score: b.score, kind: b.matchKind, title: b.title },
    ),
  );

  const page = hits.slice(offset, offset + limit);
  for (const h of page) {
    if (h.builtinSongId) {
      h.linkedSong = await getSongById(h.builtinSongId);
      if (h.linkedSong) h.score += 15;
    }
  }

  return page;
}

/** Prefer SQLite when full offline index exists; otherwise scan bundled chunks. */
export async function searchMetadataCatalog(
  query: string,
  options?: { limit?: number; offset?: number },
): Promise<MetadataSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.min(options?.limit ?? METADATA_SEARCH_RESULT_CAP, METADATA_SEARCH_RESULT_CAP);
  const offset = Math.max(options?.offset ?? 0, 0);
  const count = await getMetadataTrackCount();
  const seeded = await isBundledMetadataSeeded();
  const useSqlite = seeded && count >= Math.floor(METADATA_BUNDLED_TOTAL_HINT * 0.9);

  if (useSqlite) {
    const sqliteHits = await searchMetadataTracks(q, { limit, offset });
    if (sqliteHits.length > 0) return sqliteHits;
    return searchBundledMetadata(q, { limit, offset });
  }
  return searchBundledMetadata(q, { limit, offset });
}
