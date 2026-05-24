import type { SongEntry } from '../data/songDatabase';
import {
  cleanupVerifiedChordPro,
  hasChordLineAboveLyricFormat,
  isVerifiedChordProLyrics,
  normalizeLyricsChords,
} from './chordLyricsNormalize';

export type ChordProParseResult = {
  title: string;
  artist: string;
  key?: string;
  bpm?: number;
  chords: string;
  lyrics: string;
  difficulty: 1 | 2 | 3;
};

/** Parse ChordPro / plain text with {title:} directives and [Chord] markers. */
export function parseChordProText(raw: string, fallbackTitle = 'Без названия'): ChordProParseResult {
  const lines = raw.split('\n');
  let title = fallbackTitle;
  let artist = 'Unknown';
  let key = '';
  let bpm: number | undefined;
  const lyricsLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const titleM = trimmed.match(/^\{(?:title|t):\s*(.+)\}/i);
    if (titleM) { title = titleM[1].trim(); continue; }
    const artistM = trimmed.match(/^\{(?:artist|a|subtitle|st):\s*(.+)\}/i);
    if (artistM) { artist = artistM[1].trim(); continue; }
    const keyM = trimmed.match(/^\{key:\s*(.+)\}/i);
    if (keyM) { key = keyM[1].trim(); continue; }
    const tempoM = trimmed.match(/^\{(?:tempo|bpm):\s*(\d+)\}/i);
    if (tempoM) { bpm = parseInt(tempoM[1], 10); continue; }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) continue;
    lyricsLines.push(line);
  }

  const chordMatches = raw.match(/\[([A-G][^\]]*)\]/g) ?? [];
  const uniqueChords = [...new Set(chordMatches.map(c => c.replace(/[\[\]]/g, '')))];

  const body = lyricsLines.join('\n');
  const lyrics = hasChordLineAboveLyricFormat(body)
    ? normalizeLyricsChords(body, { allowMerge: true })
    : cleanupVerifiedChordPro(body);

  return {
    title,
    artist,
    key: key || undefined,
    bpm,
    chords: uniqueChords.slice(0, 12).join(' ') || 'C G Am F',
    lyrics,
    difficulty: uniqueChords.length <= 3 ? 1 : uniqueChords.length <= 5 ? 2 : 3,
  };
}

export function chordProToSongEntry(parsed: ChordProParseResult, id?: string): SongEntry {
  const lyrics = parsed.lyrics || undefined;
  return {
    id: id ?? `custom_${Date.now()}`,
    title: parsed.title,
    artist: parsed.artist,
    chords: parsed.chords,
    key: parsed.key,
    bpm: parsed.bpm,
    difficulty: parsed.difficulty,
    genre: 'Импорт',
    lyrics,
    chordProVerified: lyrics && isVerifiedChordProLyrics(lyrics) ? true : undefined,
  };
}
