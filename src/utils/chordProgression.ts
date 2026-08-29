import { CHORD_BRACKET_GLOBAL_RE, CHORD_TOKEN_RE } from './chordToken';

function cleanChordToken(token: string): string {
  return token
    .trim()
    .replace(/[|,;]+$/g, '')
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\u266f/g, '#')
    .replace(/\u266d/g, 'b')
    .replace(/\u2212/g, '-');
}

export function isChordToken(token: string): boolean {
  const clean = cleanChordToken(token);
  if (!clean) return false;
  if (/^[AI]$/i.test(clean)) return false;
  if (clean.length === 1 && !/^[BCDEFGH]$/i.test(clean)) return false;
  return CHORD_TOKEN_RE.test(clean);
}

/** Next real [Am]/[H7]/[Hm7/5-] marker — skips [Chorus] and lyric brackets. */
export function findNextBracketChord(
  text: string,
): { index: number; chord: string; end: number } | null {
  let from = 0;
  while (from < text.length) {
    const start = text.indexOf('[', from);
    if (start < 0) return null;
    const close = text.indexOf(']', start + 1);
    if (close < 0) return null;
    const chord = cleanChordToken(text.slice(start + 1, close));
    if (CHORD_TOKEN_RE.test(chord) && !/^I$/i.test(chord)) {
      return { index: start, chord, end: close + 1 };
    }
    from = start + 1;
  }
  return null;
}

export function extractChordSequence(input?: string | null): string[] {
  if (!input?.trim()) return [];
  const fromBrackets = [...input.matchAll(CHORD_BRACKET_GLOBAL_RE)].map(m => cleanChordToken(m[1]));
  const plain = input
    .replace(CHORD_BRACKET_GLOBAL_RE, ' ')
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
