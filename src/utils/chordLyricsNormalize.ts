/**
 * Normalize ChordPro / plain lyrics to inline [Chord] markers for practice UI.
 */

const CHORD_MARKER_RE = /\[[A-G][#b♯♭\d]/i;

const CHORD_BODY =
  '(?:maj7|maj|min|m(?!aj)|dim|aug|sus2|sus4|sus|add|m7|7|9|11|13|6|°|Ø|\\d+)?';
const ROOT = '[A-G](?:#|b|♯|♭)?';
const CHORD_RE = new RegExp(
  `(${ROOT}${CHORD_BODY}(?:\\/${ROOT})?)`,
  'gi',
);

/** Parentheses chord markers: (Am) → [Am] */
function parenToBrackets(text: string): string {
  return text.replace(
    /\(\s*([A-G][#b♯♭]?[^)\n]{0,14})\s*\)/gi,
    (_m, ch: string) => `[${ch.trim()}]`,
  );
}

/** Bare chord tokens not already in [brackets] → [Chord] */
function bracketBareChords(line: string): string {
  if (!line.trim() || CHORD_MARKER_RE.test(line)) {
    return line;
  }
  return line.replace(
    new RegExp(`(^|[^\\[])${ROOT}${CHORD_BODY}(?:\\/${ROOT})?`, 'gi'),
    (match, prefix: string) => {
      const chord = match.slice(prefix.length);
      if (!chord || chord.length > 12) return match;
      return `${prefix}[${chord}]`;
    },
  );
}

/** Chord-only line (above lyrics in ChordPro) merged into next lyric line. */
function mergeChordLineAboveLyric(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const chordOnly = new RegExp(`^${ROOT}${CHORD_BODY}(?:\\/${ROOT})?$`, 'i');
    const allChords = tokens.length > 0 && tokens.every(t => chordOnly.test(t));
    if (allChords && i + 1 < lines.length && lines[i + 1].trim()) {
      const next = lines[i + 1];
      const chords = tokens.map(c => `[${c}]`);
      const words = next.trim().split(/\s+/);
      const merged = words
        .map((w, wi) => `${chords[wi] ?? chords[chords.length - 1] ?? ''}${w}`)
        .join(' ')
        .replace(/\[\]/g, '');
      out.push(merged);
      i += 1;
      continue;
    }
    out.push(line);
  }
  return out;
}

/** Full normalization pipeline for stored / fetched lyrics. */
export function normalizeLyricsChords(text: string): string {
  if (!text?.trim()) return text?.trim() ?? '';

  let normalized = text.replace(/\r\n/g, '\n').trim();
  normalized = parenToBrackets(normalized);

  const lines = mergeChordLineAboveLyric(normalized.split('\n'));
  normalized = lines
    .map(line => bracketBareChords(parenToBrackets(line)))
    .join('\n');

  return normalized.trim();
}
