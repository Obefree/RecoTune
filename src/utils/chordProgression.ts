import { normalizeLyricsChords } from './chordLyricsNormalize';

const ROOT = '[A-G](?:#|b|\\u266f|\\u266d)?';
const SUFFIX = '(?:maj7|maj|min|m(?!aj)|dim|aug|sus2|sus4|sus|add\\d+|m7|7|9|11|13|6|\\u00b0|\\u00d8|\\d+)?';
const SLASH = `(?:/${ROOT})?`;
const CHORD_TOKEN_RE = new RegExp(`^${ROOT}${SUFFIX}${SLASH}$`, 'i');
const BRACKET_CHORD_RE = new RegExp(`\\[(${ROOT}${SUFFIX}${SLASH})\\]`, 'gi');

function cleanChordToken(token: string): string {
  return token
    .trim()
    .replace(/[|,;]+$/g, '')
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\u266f/g, '#')
    .replace(/\u266d/g, 'b');
}

export function isChordToken(token: string): boolean {
  const clean = cleanChordToken(token);
  if (!clean) return false;
  if (/^[AI]$/i.test(clean)) return false;
  if (clean.length === 1 && !/^[BCDEFG]$/i.test(clean)) return false;
  return CHORD_TOKEN_RE.test(clean);
}

export function extractChordSequence(input?: string | null): string[] {
  if (!input?.trim()) return [];
  const fromBrackets = [...input.matchAll(BRACKET_CHORD_RE)].map(m => cleanChordToken(m[1]));
  const plain = input
    .replace(BRACKET_CHORD_RE, ' ')
    .split(/[\s,;|]+/)
    .map(cleanChordToken)
    .filter(Boolean);
  return [...fromBrackets, ...plain].filter(isChordToken);
}

export function looksLikeChordQuery(query: string): boolean {
  const chords = extractChordSequence(query);
  if (chords.length >= 2) return true;
  return /[\[\]|,\/]/.test(query) && chords.length > 0;
}

export function scoreChordSequence(queryChords: string[], targetChords: string[]): number {
  if (queryChords.length === 0 || targetChords.length === 0) return 0;
  const q = queryChords.map(c => c.toLowerCase());
  const t = targetChords.map(c => c.toLowerCase());
  const targetJoined = ` ${t.join(' ')} `;
  const queryJoined = ` ${q.join(' ')} `;
  if (targetJoined.includes(queryJoined)) return 120 + q.length * 8;

  let ordered = 0;
  let cursor = 0;
  for (const chord of q) {
    const idx = t.indexOf(chord, cursor);
    if (idx >= 0) {
      ordered++;
      cursor = idx + 1;
    }
  }
  const overlap = q.filter(chord => t.includes(chord)).length;
  const orderedScore = ordered > 0 ? (ordered / q.length) * 80 : 0;
  const overlapScore = overlap > 0 ? (overlap / q.length) * 45 : 0;
  return Math.round(Math.max(orderedScore, overlapScore));
}

function hasChordAnnotations(text: string): boolean {
  return new RegExp(`\\[(${ROOT}${SUFFIX}${SLASH})\\]`, 'i').test(text);
}

function insertChordBeforeWord(words: string[], index: number, chord: string): void {
  const safeIndex = Math.max(0, Math.min(words.length - 1, index));
  if (!words[safeIndex].startsWith('[')) {
    words[safeIndex] = `[${chord}]${words[safeIndex]}`;
  }
}

export function projectChordsOntoLyrics(lyrics?: string | null, chords?: string | null): string {
  const normalized = normalizeLyricsChords(lyrics?.trim() ?? '');
  if (!normalized) return '';
  if (hasChordAnnotations(normalized)) return normalized;

  const sequence = extractChordSequence(chords);
  if (sequence.length === 0) return normalized;

  let chordIndex = 0;
  return normalized.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    const words = trimmed.split(/\s+/);
    if (words.length === 0) return line;

    const placements = words.length >= 9
      ? [0, Math.floor(words.length / 3), Math.floor(words.length * 0.68)]
      : words.length >= 5
        ? [0, Math.floor(words.length / 2)]
        : [0];

    for (const pos of placements) {
      const chord = sequence[chordIndex % sequence.length];
      insertChordBeforeWord(words, pos, chord);
      chordIndex++;
    }
    return words.join(' ');
  }).join('\n');
}
