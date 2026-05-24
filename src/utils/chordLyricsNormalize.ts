/**
 * Normalize ChordPro / plain lyrics to inline [Chord] markers for practice UI.
 *
 * Unit expectations (run: npm run verify-chord-normalize):
 * - "When you were here before\nG\nCouldn't look you in the eye"
 *   → must NOT contain [e] inside When; G merges or becomes [G]
 * - "(Am) over you" → "[Am] over you"
 * - "G B C Cm" + lyric line → no [a] on articles; keep [G], [Am], [Cm]
 * - "G\\nBut I'm a creep" / "But [G]I'm a creep" → chord on last word, not before I'm
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

/** Lyric lines that often carry one chord on the last word (e.g. "But I'm a creep"). */
const LINE_LEAD_CONNECTORS = new Set([
  'but',
  'and',
  'or',
  'so',
  'yet',
  'for',
  'nor',
  "'cause",
  'because',
]);

const CONTRACTION_AFTER_CHORD_RE =
  /^(I'm|I've|I'll|I'd|you're|we're|they're|it's|don't|can't|won't|isn't|aren't)$/i;

/** Curly/typographic apostrophes (common in legacy tabs) → ASCII for contraction matching. */
function normalizeLyricApostrophes(text: string): string {
  return text.replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'");
}

function lastWordHasInlineChord(line: string): boolean {
  const last = line.trim().split(/\s+/).pop() ?? '';
  return /\[[A-G][^\]]*\]/i.test(last);
}

function firstWordCore(line: string): string {
  const w = line.trim().split(/\s+/)[0] ?? '';
  return splitTokenPunctuation(w).core.toLowerCase().replace(/^'/, "'");
}

function lineStartsWithConnector(line: string): boolean {
  return LINE_LEAD_CONNECTORS.has(firstWordCore(line));
}

function attachChordToLastWord(line: string, chord: string): string {
  const words = line.trim().split(/\s+/);
  if (words.length === 0) return line;
  const last = words[words.length - 1];
  const { lead, core, trail } = splitTokenPunctuation(last);
  words[words.length - 1] = `${lead}[${chord}]${core}${trail}`;
  return words.join(' ');
}

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

/**
 * Fix chords glued before contractions mid-line ("But [G]I'm") or after bad
 * single-chord merge ("[G]But I'm a creep") on connector-led phrases.
 */
function repositionMisplacedInlineChords(line: string): string {
  const leadChord = line.match(
    /^\[([^\]\n]+)\]\s*((?:But|And|Or|So|Yet|For|Nor|'cause|Because)\b.+)$/i,
  );
  if (leadChord) {
    return attachChordToLastWord(leadChord[2], leadChord[1]);
  }

  const midChord = line.match(
    /^(.+?)\s+\[([^\]\n]+)\](I'm|I've|I'll|I'd|you're|we're|they're|it's|don't|can't|won't|isn't|aren't)\b(.*)$/i,
  );
  if (midChord) {
    const [, before, chord, contraction, rest] = midChord;
    if (!before.trim()) return line;
    const tail = `${contraction}${rest ?? ''}`.trim();
    const body = `${before.trim()} ${tail}`.trim();
    if (!CONTRACTION_AFTER_CHORD_RE.test(contraction)) return line;
    return attachChordToLastWord(body, chord);
  }

  return line;
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
        const chord = tokens[0];
        const trimmedNext = next.trim();
        const words = trimmedNext.split(/\s+/);
        if (words.length === 1) {
          out.push(`[${chord}]${trimmedNext}`);
        } else if (lineStartsWithConnector(trimmedNext)) {
          const prepped = repositionMisplacedInlineChords(trimmedNext);
          out.push(
            lastWordHasInlineChord(prepped)
              ? prepped
              : attachChordToLastWord(prepped, chord),
          );
        } else {
          out.push(`[${chord}]${trimmedNext}`);
        }
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

export type NormalizeLyricsOptions = {
  /** Merge chord-only line above lyric (ChordPro export). Off by default — site tabs stay as fetched. */
  allowMerge?: boolean;
};

/** True when text has chord-only line(s) immediately above lyric lines (AmDm / ChordPro export). */
export function hasChordLineAboveLyricFormat(text: string): boolean {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const allChords = tokens.length > 0 && tokens.every(t => isChordToken(t));
    if (allChords && lines[i + 1]?.trim()) return true;
  }
  return false;
}

/** Inline ChordPro cleanup without merging chord lines (builtin / already inline). */
export function cleanupVerifiedChordPro(text: string): string {
  return normalizeLyricsChords(text, { allowMerge: false });
}

/** Full normalization pipeline for stored / fetched lyrics. */
export function normalizeLyricsChords(text: string, opts?: NormalizeLyricsOptions): string {
  if (!text?.trim()) return text?.trim() ?? '';

  let normalized = normalizeLyricApostrophes(text).replace(/\r\n/g, '\n').trim();
  normalized = stripSpuriousChordBrackets(normalized);
  normalized = parenToBrackets(normalized);

  const split = normalized.split('\n');
  const lines = opts?.allowMerge === true ? mergeChordLineAboveLyric(split) : split;
  normalized = lines
    .map(line =>
      repositionMisplacedInlineChords(bracketBareChords(parenToBrackets(line))),
    )
    .join('\n');

  return stripSpuriousChordBrackets(normalized).trim();
}
