import { getSongLibraryDb } from './songLibrary';
import type { OnDemandChordProviderId, SongDetail } from '../providers/types';
import { combinedArtistTitle } from '../utils/searchNormalize';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ChordCachePayload = {
  title: string;
  artist: string;
  chords: string;
  lyrics?: string;
  key?: string;
  bpm?: number;
  difficulty: 1 | 2 | 3;
  sourceUrl?: string;
  /** Marker for SQLite / practice: AmDm fetch succeeded with verified ChordPro. */
  lyricsSource?: 'fetch-amdm';
};

function cacheKey(provider: OnDemandChordProviderId, artist: string, title: string): string {
  return `${provider}:${combinedArtistTitle(artist, title)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function getChordCache(
  provider: OnDemandChordProviderId,
  artist: string,
  title: string,
): Promise<ChordCachePayload | null> {
  const database = await getSongLibraryDb();
  const key = cacheKey(provider, artist, title);
  const row = await database.getFirstAsync<{
    content_json: string;
    expires_at: string;
  }>('SELECT content_json, expires_at FROM chord_cache WHERE cache_key = ?', key);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await database.runAsync('DELETE FROM chord_cache WHERE cache_key = ?', key);
    return null;
  }
  try {
    return JSON.parse(row.content_json) as ChordCachePayload;
  } catch {
    return null;
  }
}

export async function setChordCache(
  provider: OnDemandChordProviderId,
  artist: string,
  title: string,
  payload: ChordCachePayload,
): Promise<void> {
  const database = await getSongLibraryDb();
  const key = cacheKey(provider, artist, title);
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  await database.runAsync(
    `INSERT INTO chord_cache (cache_key, provider, content_json, source_url, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       provider = excluded.provider,
       content_json = excluded.content_json,
       source_url = excluded.source_url,
       expires_at = excluded.expires_at`,
    key,
    provider,
    JSON.stringify(payload),
    payload.sourceUrl ?? null,
    expiresAt,
    nowIso(),
  );
}

export function chordCacheToSongDetail(
  payload: ChordCachePayload,
  provider: OnDemandChordProviderId,
  id: string,
  attribution: SongDetail['attribution'],
): SongDetail {
  return {
    id,
    title: payload.title,
    artist: payload.artist,
    chords: payload.chords,
    key: payload.key,
    bpm: payload.bpm,
    difficulty: payload.difficulty,
    genre: payload.lyricsSource === 'fetch-amdm' ? 'fetch-amdm' : 'Таб из интернета',
    lyrics: payload.lyrics,
    chordProVerified: true,
    provider,
    attribution,
  };
}
