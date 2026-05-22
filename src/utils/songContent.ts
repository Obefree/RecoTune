import { LYRICS_DB } from '../data/lyricsDatabase';
import type { SongEntry } from '../data/songDatabase';

const CHORD_MARKER_RE = /\[[A-G][#b\d]*(?:\/[A-G][#b\d]*)?[^\]]*\]/i;

/** ChordPro / inline [Am]word lines suitable for practice lyrics panel. */
export function hasAnnotatedLyrics(text?: string | null): boolean {
  if (!text?.trim()) return false;
  return CHORD_MARKER_RE.test(text);
}

export function resolveLyricsText(song: SongEntry): string | undefined {
  const fromDb = LYRICS_DB[song.id];
  const inline = song.lyrics;
  if (hasAnnotatedLyrics(fromDb) && !hasAnnotatedLyrics(inline)) {
    return fromDb.trim() ? fromDb : undefined;
  }
  const merged = inline ?? fromDb;
  return merged?.trim() ? merged : undefined;
}

/** Merge bundle lyrics DB into entry (runtime + before SQLite persist). */
export function resolveSongEntry(song: SongEntry): SongEntry {
  const lyrics = resolveLyricsText(song);
  if (lyrics === song.lyrics) return song;
  return { ...song, lyrics };
}

/**
 * Title + short progression only (no ChordPro lines).
 * ~450/536 builtin songs are in this bucket.
 */
export function isMetadataOnlySong(song: SongEntry): boolean {
  const lyrics = resolveLyricsText(song);
  if (hasAnnotatedLyrics(lyrics)) return false;
  if (lyrics && lyrics.length > 0) return false;
  const tokens = song.chords?.trim().split(/[\s,|/]+/).filter(Boolean) ?? [];
  return tokens.length > 0 && tokens.length <= 14;
}

export type SongContentBadge = 'chords' | 'progression' | 'title' | 'metadata';

export function isMetadataCatalogId(id: string): boolean {
  return id.startsWith('meta_');
}

export function songContentBadge(song: SongEntry): SongContentBadge {
  if (isMetadataCatalogId(song.id) && !song.chords?.trim() && !hasAnnotatedLyrics(resolveLyricsText(song))) {
    return 'metadata';
  }
  const lyrics = resolveLyricsText(song);
  if (hasAnnotatedLyrics(lyrics)) return 'chords';
  if (song.chords?.trim()) return 'progression';
  return 'title';
}

export function songContentBadgeLabel(badge: SongContentBadge): string {
  switch (badge) {
    case 'chords': return 'аккорды ✓';
    case 'progression': return 'прогрессия';
    case 'metadata': return 'метаданные';
    default: return 'только название';
  }
}

/** Higher = richer catalog row; used for smart-search ranking. */
/** Progression-only / metadata-only — user may fetch full tab via on-demand providers. */
export function needsOnDemandChordFetch(song: SongEntry): boolean {
  const resolved = resolveSongEntry(song);
  if (hasAnnotatedLyrics(resolved.lyrics)) return false;
  const badge = songContentBadge(resolved);
  return badge === 'metadata' || badge === 'progression' || isMetadataOnlySong(resolved);
}

/** Builtin bundle rows with ChordPro-style lines (for catalog upgrade toast / dev). */
export function countAnnotatedInEntries(songs: SongEntry[]): number {
  return songs.filter(s => hasAnnotatedLyrics(resolveLyricsText(s))).length;
}

export const PROGRESSION_ONLY_HINT =
  'Только прогрессия аккордов — полный таб подгружается автоматически или по кнопке ниже.';

export function contentQualityScore(song: SongEntry): number {
  const lyrics = resolveLyricsText(song);
  if (hasAnnotatedLyrics(lyrics)) return 100 + Math.min(lyrics!.length, 200);
  if (lyrics && lyrics.length > 40) return 35;
  if (song.chords?.trim()) return 8;
  return 0;
}
