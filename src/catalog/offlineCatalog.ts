import type { SongEntry } from '../data/songDatabase';
import { canonicalizeArtist } from '../utils/artistName';

export type CatalogArtist = { name: string; count: number; tabCount: number };
export type CatalogSong = {
  id: string;
  title: string;
  artist: string;
  chords: string;
  key?: string;
  bpm?: number;
  difficulty: number;
  genre: string;
  shard: string;
  hasTab: boolean;
};

type CatalogFile = {
  version: number;
  generatedAt: string;
  songCount: number;
  artistCount: number;
  songs: CatalogSong[];
  artists: CatalogArtist[];
};

let cached: { file: CatalogFile; byId: Map<string, CatalogSong> } | null = null;
const shardCache = new Map<string, Record<string, string>>();
let songListCache: SongEntry[] | null = null;

function loadCatalog(): { file: CatalogFile; byId: Map<string, CatalogSong> } {
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const file = require('../../assets/catalog/index.json') as CatalogFile;
    cached = { file, byId: new Map(file.songs.map(s => [s.id, s])) };
  }
  return cached;
}

export function getOfflineCatalogTabCount(): number {
  return loadCatalog().file.songCount;
}

export function getOfflineCatalogArtists(): CatalogArtist[] {
  return loadCatalog().file.artists;
}

export function getCatalogSongMeta(id: string): CatalogSong | undefined {
  return loadCatalog().byId.get(id);
}

export function catalogSongToEntry(song: CatalogSong, lyrics?: string): SongEntry {
  const difficulty = song.difficulty === 1 || song.difficulty === 3 ? song.difficulty : 2;
  return {
    id: song.id,
    title: song.title,
    artist: canonicalizeArtist(song.artist).name,
    chords: song.chords ?? '',
    key: song.key,
    bpm: song.bpm,
    difficulty,
    genre: song.genre,
    lyrics,
    chordProVerified: song.hasTab,
  };
}

/** Browse/search rows — no lyrics blob. */
export function listOfflineCatalogSongs(): SongEntry[] {
  if (!songListCache) {
    songListCache = loadCatalog().file.songs.map(s => catalogSongToEntry(s));
  }
  return songListCache;
}

export function loadCatalogLyrics(id: string, shard?: string): string | undefined {
  const resolvedShard = shard ?? getCatalogSongMeta(id)?.shard;
  if (!resolvedShard) return undefined;
  let map = shardCache.get(resolvedShard);
  if (!map) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireLyricsShard } = require('./lyricsShardLoaders') as typeof import('./lyricsShardLoaders');
    map = requireLyricsShard(resolvedShard);
    shardCache.set(resolvedShard, map);
  }
  return map[id];
}

/** Open-song route: index lookup + one lyric shard. */
export function loadOfflineCatalogSong(id: string): SongEntry | null {
  const meta = getCatalogSongMeta(id);
  if (!meta) return null;
  const lyrics = loadCatalogLyrics(id, meta.shard);
  return catalogSongToEntry(meta, lyrics);
}
