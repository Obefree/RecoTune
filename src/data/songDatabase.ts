/** Built-in song library — active practice seed (minimal, quality lyrics). */

import { BUILTIN_SONGS_SEED } from './builtinSongsSeed';

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  /** Space-separated chord names, e.g. "Am F C G" */
  chords: string;
  key?: string;
  bpm?: number;
  /** 1=easy (2-3 chords), 2=medium (4-5), 3=hard (6+) */
  difficulty: 1 | 2 | 3;
  genre: string;
  /** Optional annotated lyrics. Format: [Chord]word or plain text. Each line is a new line. */
  lyrics?: string;
  /** True when lyrics are site/bundle ChordPro — not heuristic progression glue. */
  chordProVerified?: boolean;
}

/** Default builtin rows seeded into SQLite (not the 536 legacy archive). */
export const SONGS: SongEntry[] = BUILTIN_SONGS_SEED;

export function searchSongs(query: string): SongEntry[] {
  if (!query.trim()) return SONGS;
  const q = query.toLowerCase();
  return SONGS.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    s.genre.toLowerCase().includes(q) ||
    s.chords.toLowerCase().includes(q),
  );
}

export const GENRES = Array.from(new Set(SONGS.map(s => s.genre))).sort();
