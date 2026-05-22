/** Metadata catalog row shapes (no full chords/lyrics). */

export type MetadataArtistRow = {
  id: string;
  name: string;
  sortName?: string;
  mbid?: string | null;
  searchText: string;
};

export type MetadataTrackRow = {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  album?: string | null;
  year?: number | null;
  durationMs?: number | null;
  mbid?: string | null;
  searchText: string;
  /** When metadata row mirrors a builtin SQLite song */
  builtinSongId?: string | null;
};

export type MetadataBatchPayload = {
  cursor: number;
  nextCursor: number | null;
  totalHint?: number;
  artists: MetadataArtistRow[];
  tracks: MetadataTrackRow[];
};

export type MetadataSyncProgress = {
  phase: 'idle' | 'syncing' | 'done' | 'error';
  batchIndex: number;
  batchTotal: number;
  tracksImported: number;
  message: string;
};
