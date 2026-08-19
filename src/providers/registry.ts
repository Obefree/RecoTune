import { initSongLibrary } from '../db/songLibrary';
import { searchSongsSmart } from '../db/searchSongsSmart';
import type { SongEntry } from '../data/songDatabase';
import { resolveSongEntry } from '../utils/songContent';
import { metadataDedupeKey, metadataTrackToSongEntry } from '../metadata/metadataDb';
import { searchMetadataCatalog } from '../metadata/metadataSearch';

import { combinedArtistTitle } from '../utils/searchNormalize';

import { compareSearchHits, type MatchKind } from '../utils/searchScore';

import { builtinProvider } from './builtinProvider';

import { userProvider } from './userProvider';

import { chordproUrlProvider } from './chordproUrlProvider';

import { lyricsProvider } from './lyricsProvider';

import { pesniRuProvider } from './pesniRuProvider';

import { isProviderEnabled } from './providerSettings';
import { searchRemoteChordCatalog } from './remoteChordSearch';

import type { ProviderId, SongProvider, SongSearchResult } from './types';



export { searchSongsSmart } from '../db/searchSongsSmart';

/** Map provider hit to SongEntry when SQLite `song` is absent (lyrics.ovh stub, etc.). */
export function searchResultToSongEntry(r: SongSearchResult): SongEntry | null {
  if (r.song) return resolveSongEntry(r.song);
  const title = r.title.trim();
  if (!title) return null;
  if (!r.chords?.trim()) {
    return {
      id: r.id,
      title,
      artist: r.artist.trim() || 'Unknown',
      chords: '',
      difficulty: 1,
      genre: 'метаданные',
    };
  }
  if (r.provider === 'lyrics') {
    return {
      id: r.id,
      title,
      artist: r.artist.trim() || 'Unknown',
      chords: '',
      difficulty: 1,
      genre: 'текст (online)',
    };
  }
  if (r.chords?.trim()) {
    return {
      id: r.id,
      title,
      artist: r.artist.trim() || 'Unknown',
      chords: r.chords.trim(),
      difficulty: 1,
      genre: 'НАЙТИ',
    };
  }
  return null;
}

const LOCAL_PROVIDERS: SongProvider[] = [builtinProvider, userProvider];

const REMOTE_PROVIDERS: SongProvider[] = [chordproUrlProvider, lyricsProvider];



function dedupeKey(title: string, artist: string): string {
  return combinedArtistTitle(artist, title);
}

async function mergeMetadataHits(
  map: Map<string, SongSearchResult>,
  query: string,
  limit: number,
  offset: number,
): Promise<void> {
  const metaHits = await searchMetadataCatalog(query, {
    limit: Math.min(limit, 150),
    offset,
  });
  for (const h of metaHits) {
    const song = await metadataTrackToSongEntry(h);
    const resolved = resolveSongEntry(song);
    const key = metadataDedupeKey(resolved.title, resolved.artist);
    const provider: ProviderId = 'builtin';
    if (h.score < 12 && !h.linkedSong && h.matchKind === 'fuzzy') continue;
    merge(map, {
      id: resolved.id,
      title: resolved.title,
      artist: resolved.artist,
      provider,
      score: h.score,
      matchKind: h.matchKind,
      chords: resolved.chords,
      song: resolved,
    }, key);
  }
}

function merge(
  map: Map<string, SongSearchResult>,
  hit: SongSearchResult,
  keyOverride?: string,
): void {
  const key = keyOverride ?? dedupeKey(hit.title, hit.artist);
  const prev = map.get(key);
  if (!prev || hit.score > prev.score) map.set(key, hit);
}



/**

 * Merge search across enabled providers; dedupe by normalized title+artist (keep higher score).

 */

export const LIBRARY_SEARCH_PAGE_SIZE = 50;

export async function searchProviders(

  query: string,

  options?: {

    limit?: number;

    offset?: number;

    /** When false, SQLite catalog only (library overlay). Skips MusicBrainz, remote chord catalog, pesni HTTP. */
    includeRemote?: boolean;

    /** pesni.ru hits — only on first page by default (low priority). */
    includePesni?: boolean;

  },

): Promise<SongSearchResult[]> {
  await initSongLibrary();

  const pageSize = options?.limit ?? LIBRARY_SEARCH_PAGE_SIZE;
  const offset = Math.max(options?.offset ?? 0, 0);
  const fetchCap = offset + pageSize;

  const q = query.trim();

  const map = new Map<string, SongSearchResult>();

  if (!q) {
    const all = await searchSongsSmart('', { limit: fetchCap });
    for (const h of all) {
      const provider: ProviderId = h.id.startsWith('custom_') ? 'user' : 'builtin';
      merge(map, {
        id: h.id,
        title: h.title,
        artist: h.artist,
        provider,
        score: 0,
        chords: h.chords,
        song: h,
      });
    }
    return [...map.values()].slice(offset, fetchCap);
  }

  const smartHits = await searchSongsSmart(q, { limit: fetchCap });

  for (const h of smartHits) {

    const provider: ProviderId = h.id.startsWith('custom_') ? 'user' : 'builtin';

    // Offline SQLite catalog is always searchable; provider toggles affect remote/on-demand only.

    merge(map, {
      id: h.id,
      title: h.title,
      artist: h.artist,
      provider,
      score: h.score,
      matchKind: h.matchKind,
      chords: h.chords,
      song: h,
    });
  }

  const localOnly = options?.includeRemote === false;

  if (!localOnly) {
    await mergeMetadataHits(map, q, pageSize, offset);

    if (offset === 0 && q.length >= 2) {
      try {
        const remoteHits = await searchRemoteChordCatalog(q, { limit: 28 });
        for (const hit of remoteHits) {
          merge(map, hit, metadataDedupeKey(hit.title, hit.artist));
        }
      } catch {
        /* offline / proxy down — metadata-only */
      }
    }

    const includePesni =
      options?.includePesni !== false &&
      offset === 0 &&
      (await isProviderEnabled('pesni_ru'));
    if (includePesni && q.length >= 2) {
      try {
        const pesniLimit = Math.min(pageSize, 50);
        const hits = await pesniRuProvider.search(q, pesniLimit);
        for (const hit of hits) merge(map, hit);
      } catch {
        /* skip failed pesni.ru */
      }
    }
  }

  if (options?.includeRemote !== false) {

    for (const p of REMOTE_PROVIDERS) {

      if (!(await isProviderEnabled(p.id))) continue;

      try {

        const hits = await p.search(q, 10);

        for (const hit of hits) merge(map, hit);

      } catch { /* skip failed remote */ }

    }

  }



  const sorted = [...map.values()].sort((a, b) =>

    compareSearchHits(

      { score: a.score, kind: (a.matchKind as MatchKind) ?? 'fuzzy', title: a.title },

      { score: b.score, kind: (b.matchKind as MatchKind) ?? 'fuzzy', title: b.title },

    ),

  );

  return sorted.slice(offset, fetchCap);
}



export async function getEnabledProviders(): Promise<SongProvider[]> {

  const out: SongProvider[] = [];

  for (const p of [...LOCAL_PROVIDERS, ...REMOTE_PROVIDERS]) {

    if (await isProviderEnabled(p.id)) out.push(p);

  }

  return out;

}



export { builtinProvider, userProvider, chordproUrlProvider, lyricsProvider, pesniRuProvider };


