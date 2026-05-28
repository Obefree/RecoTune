import type { SongEntry } from '../data/songDatabase';
import { BUILTIN_SONGS_SEED } from '../data/builtinSongsSeed';
import { hasVerifiedPracticeLyrics } from './songContent';

/** Нормализация для сопоставления названий */
export function normalizeSongText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

function scoreMatch(artist: string, title: string, song: SongEntry): number {
  const na = normalizeSongText(artist);
  const nt = normalizeSongText(title);
  const sa = normalizeSongText(song.artist);
  const st = normalizeSongText(song.title);
  if (!nt || !st) return 0;

  let score = 0;
  if (nt === st) score += 100;
  else if (st.includes(nt) || nt.includes(st)) score += 70;
  else {
    const minLen = Math.min(nt.length, st.length);
    if (minLen >= 4 && (st.startsWith(nt.slice(0, minLen)) || nt.startsWith(st.slice(0, minLen)))) {
      score += 40;
    }
  }

  if (na && sa) {
    if (na === sa) score += 50;
    else if (sa.includes(na) || na.includes(sa)) score += 30;
  } else if (!na || na === 'unknown') {
    score += 10;
  }

  return score;
}

/** Лучшее совпадение в каталоге RecoTune (встроенные + пользовательские) */
export function findBestSongMatch(
  artist: string,
  title: string,
  songs: SongEntry[],
  minScore = 90,
): SongEntry | null {
  let best: SongEntry | null = null;
  let bestScore = 0;
  for (const s of songs) {
    const sc = scoreMatch(artist, title, s);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return bestScore >= minScore ? best : null;
}

/** Builtin row with verified ChordPro when metadata has no builtin_song_id link. */
export function findBuiltinVerifiedMatch(
  artist: string,
  title: string,
  minScore = 90,
): SongEntry | null {
  const verified = BUILTIN_SONGS_SEED.filter(s => hasVerifiedPracticeLyrics(s));
  return findBestSongMatch(artist, title, verified, minScore);
}
