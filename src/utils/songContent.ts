import type { SongEntry } from '../data/songDatabase';
import { BUILTIN_SONGS_SEED } from '../data/builtinSongsSeed';
import {
  cleanupVerifiedChordPro,
  isVerifiedChordProLyrics,
  normalizeLyricsChords,
  type NormalizeLyricsOptions,
} from './chordLyricsNormalize';
import { extractChordSequence } from './chordProgression';

const CHORD_MARKER_RE = /\[[A-G][#b\d]*(?:\/[A-G][#b\d]*)?[^\]]*\]/i;

const BUILTIN_VERIFIED_IDS = new Set(BUILTIN_SONGS_SEED.map(s => s.id));

/** Inline [Am] markers present in text (not proof of verified alignment). */
export function hasAnnotatedLyrics(text?: string | null): boolean {
  if (!text?.trim()) return false;
  return CHORD_MARKER_RE.test(text);
}

/** Builtin bundle or AmDm fetch — safe for practice lyrics panel. */
export function isChordProVerified(song: SongEntry): boolean {
  if (song.chordProVerified === true) return true;
  if (BUILTIN_VERIFIED_IDS.has(song.id)) return true;
  if (song.id.startsWith('custom_amdm_')) return true;
  if (song.id.startsWith('pesni_ru_')) return true;
  if (song.id.startsWith('custom_pesni_')) return true;
  if (song.id.startsWith('custom_chordpro_')) return true;
  return false;
}

/** Verified ChordPro suitable for practice (no progression glue). */
export function hasVerifiedPracticeLyrics(song: SongEntry): boolean {
  if (!isChordProVerified(song)) return false;
  return isVerifiedChordProLyrics(song.lyrics);
}

export function resolveLyricsText(
  song: SongEntry,
  opts?: NormalizeLyricsOptions,
): string | undefined {
  const raw = song.lyrics?.trim();
  if (!raw || !isChordProVerified(song)) return undefined;
  if (!isVerifiedChordProLyrics(raw)) return undefined;
  if (opts?.allowMerge === true) {
    return normalizeLyricsChords(raw, opts) || undefined;
  }
  return cleanupVerifiedChordPro(raw) || undefined;
}

/** Merge bundle lyrics into entry (runtime + before SQLite persist). */
export function resolveSongEntry(song: SongEntry): SongEntry {
  const verified =
    song.chordProVerified === true
      ? song
      : isChordProVerified(song)
        ? { ...song, chordProVerified: true }
        : song;
  const lyrics = resolveLyricsText(verified);
  if (lyrics === verified.lyrics) return verified;
  return { ...verified, lyrics };
}

/**
 * Title + short progression only (no ChordPro lines).
 * ~450/536 builtin songs are in this bucket.
 */
export function isMetadataOnlySong(song: SongEntry): boolean {
  if (hasVerifiedPracticeLyrics(song)) return false;
  const lyrics = song.lyrics?.trim();
  if (lyrics && lyrics.length > 0) return false;
  const tokens = song.chords?.trim().split(/[\s,|/]+/).filter(Boolean) ?? [];
  return tokens.length > 0 && tokens.length <= 14;
}

export type SongContentBadge = 'chords' | 'progression' | 'title' | 'metadata';

export function isMetadataCatalogId(id: string): boolean {
  return id.startsWith('meta_');
}

export function songContentBadge(song: SongEntry): SongContentBadge {
  if (
    isMetadataCatalogId(song.id) &&
    !song.chords?.trim() &&
    !hasVerifiedPracticeLyrics(song)
  ) {
    return 'metadata';
  }
  if (hasVerifiedPracticeLyrics(song)) return 'chords';
  if (song.chords?.trim()) return 'progression';
  return 'title';
}

export function songContentBadgeLabel(badge: SongContentBadge): string {
  switch (badge) {
    case 'chords':
      return 'текст ✓';
    case 'progression':
      return 'прогрессия, не таб';
    case 'metadata':
      return 'метаданные';
    default:
      return 'только название';
  }
}

/** Progression-only / metadata-only — user may fetch full tab via on-demand providers. */
export function needsOnDemandChordFetch(song: SongEntry): boolean {
  const resolved = resolveSongEntry(song);
  if (hasVerifiedPracticeLyrics(resolved)) return false;
  const badge = songContentBadge(resolved);
  return badge === 'metadata' || badge === 'progression' || isMetadataOnlySong(resolved);
}

/** Builtin bundle rows with verified ChordPro lines (for catalog upgrade toast / dev). */
export function countAnnotatedInEntries(songs: SongEntry[]): number {
  return songs.filter(s => hasVerifiedPracticeLyrics(s)).length;
}

export const PROGRESSION_ONLY_HINT =
  'Полный таб — AmDm / Ultimate Guitar через прокси на ПК (npm run dev-proxy).';

export function contentQualityScore(song: SongEntry): number {
  if (hasVerifiedPracticeLyrics(song)) {
    return 100 + Math.min(song.lyrics!.length, 200);
  }
  if (song.chords?.trim()) return 8;
  return 0;
}

/** Short progression for library list rows — never infer chords from unverified lyrics. */
export function libraryListChordSnippet(song: SongEntry): string {
  const resolved = resolveSongEntry(song);
  const direct = resolved.chords?.trim();
  if (direct) return direct;
  if (hasVerifiedPracticeLyrics(resolved)) {
    const fromLyrics = [...new Set(extractChordSequence(resolved.lyrics))].slice(0, 12);
    if (fromLyrics.length) return fromLyrics.join(' ');
  }
  return '';
}
