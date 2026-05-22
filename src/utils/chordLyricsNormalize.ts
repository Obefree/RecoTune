/**
 * Normalize ChordPro / plain lyrics to inline [Chord] markers for practice UI.
 *
 * Unit expectations (run: npm run verify-chord-normalize):
 * - "When you were here before\nG\nCouldn't look you in the eye"
 *   → must NOT contain [e] inside When; G merges or becomes [G]
 * - "(Am) over you" → "[Am] over you"
 * - "G B C Cm" + lyric line → no [a] on articles; keep [G], [Am], [Cm]
 */

const CHORD_MARKER_RE = /\[[A-G][#b♯♭\d]/i;

const ROOT = '[A-G](?:#|b|♯|♭)?';
const CHORD_SUFFIX =
  '(?:maj7|maj|min|m(?!aj)|dim|aug|sus2|sus4|sus|add\\d+|m7|7|9|11|13|6|°|Ø|\\d+)?';
const CHORD_SLASH = `(?:\\/${ROOT})?`;
/** Whole-token chord: G, Am, C#m7, F/A — never a letter inside a word. */
const CHORD_TOKEN = `${ROOT}${CHORD_SUFFIX}${CHORD_SLASH}`;
const VALID_CHORD_TOKEN_RE = new RegExp(`^${CHORD_TOKEN}$`, 'i');

/** Articles / pronouns that look like note names but are lyrics. */
const COMMON_WORD_CHORD_FALSE_POS = new Set(['a', 'A', 'i', 'I']);

function isChordToken(token: string): boolean {
  return VALID_CHORD_TOKEN_RE.test(token);
}

/** Bracket only real chord symbols in prose — not single-letter articles. */
function isBareWordChordToken(token: string): boolean {
  if (!isChordToken(token) || COMMON_WORD_CHORD_FALSE_POS.has(token)) return false;
  if (token.length === 1) {
    return /^[GBCDEF]$/i.test(token);
  }
  return true;
}

/** Keep [G]/[Am]; unwrap spurious [a], [e], [r], [A], [I]. */
export function stripSpuriousChordBrackets(text: string): string {
  return text.replace(/\[([^\]\n]+)\]/g, (match, inner: string) => {
    const ch = inner.trim();
    if (!ch) return match;
    if (COMMON_WORD_CHORD_FALSE_POS.has(ch)) return ch;
    if (ch.length === 1 && !isBareWordChordToken(ch)) return ch;
    if (!isChordToken(ch)) return ch;
    return match;
  });
}

function lineHasSpuriousChordBrackets(line: string): boolean {
  return /\[[^\]\n]+\]/.test(line) && stripSpuriousChordBrackets(line) !== line;
}

/** Split "word," into { lead, core, trail } punctuation around a token. */
function splitTokenPunctuation(token: string): {
  lead: string;
  core: string;
  trail: string;
} {
  const lead = token.match(/^[^\w[\]#♯♭/]+/)?.[0] ?? '';
  const rest = token.slice(lead.length);
  const trail = rest.match(/[^\w[\]#♯♭/]+$/)?.[0] ?? '';
  const core = rest.slice(0, rest.length - trail.length);
  return { lead, core, trail };
}

/** Parentheses chord markers: (Am) → [Am]; other parens unchanged. */
function parenToBrackets(text: string): string {
  return text.replace(/\(\s*([^)\n]+?)\s*\)/g, (match, inner: string) => {
    const ch = inner.trim();
    return isBareWordChordToken(ch) ? `[${ch}]` : match;
  });
}

/** Bare chord tokens (whole words only) not already in [brackets] → [Chord] */
function bracketBareChords(line: string): string {
  if (!line.trim() || CHORD_MARKER_RE.test(line) || lineHasSpuriousChordBrackets(line)) {
    return line;
  }
  return line.replace(/\S+/g, token => {
    if (token.includes('[')) return token;
    const { lead, core, trail } = splitTokenPunctuation(token);
    if (!core || !isBareWordChordToken(core)) return token;
    return `${lead}[${core}]${trail}`;
  });
}

/** Chord-only line (above lyrics in ChordPro) merged into next lyric line when counts align. */
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
    const allChords =
      tokens.length > 0 && tokens.every(t => isChordToken(t));
    if (allChords && i + 1 < lines.length && lines[i + 1].trim()) {
      const next = lines[i + 1];
      const words = next.trim().split(/\s+/);
      if (tokens.length === 1) {
        out.push(`[${tokens[0]}]${next.trim()}`);
        i += 1;
        continue;
      }
      if (tokens.length === words.length) {
        const chords = tokens.map(c => `[${c}]`);
        const merged = words
          .map((w, wi) => `${chords[wi]}${w}`)
          .join(' ')
          .replace(/\[\]/g, '');
        out.push(merged);
        i += 1;
        continue;
      }
      if (tokens.length > words.length && words.length > 0) {
        const merged = words
          .map((w, wi) => `${wi < tokens.length ? `[${tokens[wi]}]` : ''}${w}`)
          .join(' ');
        out.push(merged);
        i += 1;
        continue;
      }
      out.push(line);
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
  normalized = stripSpuriousChordBrackets(normalized);
  normalized = parenToBrackets(normalized);

  const lines = mergeChordLineAboveLyric(normalized.split('\n'));
  normalized = lines
    .map(line => bracketBareChords(parenToBrackets(line)))
    .join('\n');

  return stripSpuriousChordBrackets(normalized).trim();
}
