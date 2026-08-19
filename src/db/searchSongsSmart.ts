import { listSongs } from './songLibrary';
import type { SongEntry } from '../data/songDatabase';
import { contentQualityScore } from '../utils/songContent';
import {
  extractChordSequence,
  looksLikeChordQuery,
  scoreChordSequence,
} from '../utils/chordProgression';
import { compareSearchHits, scoreSongAgainstQuery, type MatchKind } from '../utils/searchScore';
import { blobMatchesQuery, normalizeSearchText, searchQueryForms, tokenizeQuery } from '../utils/searchNormalize';

export type SmartSearchHit = SongEntry & {
  score: number;
  matchKind: MatchKind;
};

/**
 * Smart search over builtin+user SQLite (in-memory rank after catalog load).
 * Ranking: exact > prefix > contains > fuzzy (Levenshtein + token split).
 * Title/artist/chords only — lyrics stay in getSongById for practice.
 */
export async function searchSongsSmart(
  query: string,
  options?: { limit?: number; source?: 'all' | 'builtin' | 'user' },
): Promise<SmartSearchHit[]> {
  const q = query.trim();
  if (!q) {
    const all = await listSongs();
    return all
      .map(s => ({ ...s, score: contentQualityScore(s), matchKind: 'none' as MatchKind }))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }

  const qForms = searchQueryForms(q);
  const tokens = tokenizeQuery(q);
  const queryChords = extractChordSequence(q);
  const chordIntent = looksLikeChordQuery(q);
  let songs = await listSongs();
  if (options?.source === 'builtin') songs = songs.filter(s => !s.id.startsWith('custom_'));
  if (options?.source === 'user') songs = songs.filter(s => s.id.startsWith('custom_'));

  const hits: SmartSearchHit[] = [];
  for (const song of songs) {
    const { score, kind } = scoreSongAgainstQuery(q, song.title, song.artist);
    // Query present: rank by text match; quality only breaks ties (not builtin-first).
    const qualityBoost = score > 0 ? Math.min(contentQualityScore(song) * 0.04, 8) : 0;
    let finalScore = score + qualityBoost;

    if (tokens.length > 0) {
      const genreNorm = normalizeSearchText(song.genre);
      const chordsNorm = normalizeSearchText(song.chords);
      if (tokens.every(t => genreNorm.includes(t))) finalScore = Math.max(finalScore, 25);
      if (tokens.every(t => chordsNorm.includes(t))) finalScore = Math.max(finalScore, 20);
    }

    const searchBlob = `${song.artist} ${song.title} ${song.genre} ${song.chords}`;
    if (blobMatchesQuery(searchBlob, qForms)) {
      finalScore = Math.max(finalScore, 95);
    }

    if (chordIntent) {
      const targetChords = extractChordSequence(song.chords);
      const chordScore = scoreChordSequence(queryChords, targetChords);
      if (chordScore > 0) {
        finalScore = Math.max(finalScore, 110 + chordScore);
      }
    }

    if (finalScore > 0 || kind !== 'none') {
      hits.push({ ...song, score: finalScore, matchKind: kind });
    }
  }

  hits.sort((a, b) => compareSearchHits(
    { score: a.score, kind: a.matchKind, title: a.title },
    { score: b.score, kind: b.matchKind, title: b.title },
  ));

  const limit = options?.limit ?? 200;
  return hits.slice(0, limit);
}

/** Fast offline fallback when smart search returns nothing (settings glitch, thrown import, etc.). */
export function filterSongsQuick(songs: SongEntry[], query: string): SongEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  const forms = searchQueryForms(query);
  return songs.filter(s => {
    const hay = `${s.title} ${s.artist} ${s.genre} ${s.chords}`.toLowerCase();
    if (hay.includes(q)) return true;
    const blob = `${s.artist} ${s.title} ${s.genre} ${s.chords}`;
    return blobMatchesQuery(blob, forms);
  });
}

