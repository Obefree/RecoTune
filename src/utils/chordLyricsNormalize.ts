/**
 * Normalize ChordPro / plain lyrics to inline [Chord] markers for practice UI.
 *
 * Unit expectations (run: npm run verify-chord-normalize):
 * - "When you were here before\nG\nCouldn't look you in the eye"
 *   → must NOT contain [e] inside When; G merges or becomes [G]
 * - "(Am) over you" → "[Am] over you"
 * - "G B C Cm" + lyric line → no [a] on articles; keep [G], [Am], [Cm], [A]
 * - "A D E" chord row / "[A]Hello" → capital A kept as chord, not stripped
 * - "G\\nBut I'm a creep" / "But [G]I'm a creep" → chord on last word, not before I'm
 */

// [A-H]: H is German/Russian notation for B (used widely on AmDm / pesni.ru);
// must match the server parser tools/chord-fetch/chordLayout.mjs so H/Hm tabs verify.
const CHORD_MARKER_RE = /\[[A-H][#b♯♭\d]*(?:\/[A-H][#b♯♭\d]*)?[^\]]*\]/i;

/** Guitar/bass tab row — must stay one line in practice UI (no word-wrap). */
export function isTablatureLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 4) return false;
  if (/^\|.*\|/.test(t)) return true;
  if (/\|--/.test(t) && /\d/.test(t)) return true;
  if (/^[-=]{4,}$/.test(t)) return true;
  if (/^[eEbBgGdDaA]\|/i.test(t) && /\d/.test(t)) return true;
  return false;
}

const ROOT = '[A-H](?:#|b|♯|♭)?';
const CHORD_SUFFIX =
  '(?:maj7|maj|min|m(?!aj)|dim|aug|sus2|sus4|sus|add\\d+|m7|7|9|11|13|6|°|Ø|\\d+)?';
const CHORD_SLASH = `(?:\\/${ROOT})?`;
/** Whole-token chord: G, Am, C#m7, F/A — never a letter inside a word. */
const CHORD_TOKEN = `${ROOT}${CHORD_SUFFIX}${CHORD_SLASH}`;
const VALID_CHORD_TOKEN_RE = new RegExp(`^${CHORD_TOKEN}$`, 'i');

/** Lowercase articles in lyric prose — never bracket as chords. */
const LYRIC_ARTICLE_TOKENS = new Set(['a', 'i']);
/** Capital pronoun — not a chord in prose; chord symbol is uppercase A. */
const LYRIC_PRONOUN_TOKENS = new Set(['I']);

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
  return /\[[A-H][^\]]*\]/i.test(last);
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

type BareChordOpts = { /** Line is chord symbols only (ChordPro row above lyrics). */ chordLine?: boolean };

/** Bracket only real chord symbols — not articles in prose; A–G allowed as chords. */
function isBareWordChordToken(token: string, opts?: BareChordOpts): boolean {
  if (!isChordToken(token)) return false;
  if (LYRIC_ARTICLE_TOKENS.has(token)) return false;
  if (!opts?.chordLine && LYRIC_PRONOUN_TOKENS.has(token)) return false;
  if (token.length === 1) return /^[A-H]$/i.test(token);
  return true;
}

function lineIsBareChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(t => {
    const { core } = splitTokenPunctuation(t);
    return Boolean(core) && isChordToken(core);
  });
}

/** Keep [G]/[Am]; unwrap spurious [a], [e], [r], [A], [I]. */
export function stripSpuriousChordBrackets(text: string): string {
  return text.replace(/\[([^\]\n]+)\]/g, (match, inner: string) => {
    const ch = inner.trim();
    if (!ch) return match;
    if (LYRIC_ARTICLE_TOKENS.has(ch) || LYRIC_PRONOUN_TOKENS.has(ch)) return ch;
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
  const chordLine = lineIsBareChordLine(line);
  return line.replace(/\S+/g, token => {
    if (token.includes('[')) return token;
    const { lead, core, trail } = splitTokenPunctuation(token);
    if (!core || !isBareWordChordToken(core, { chordLine })) return token;
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

function lineIsChordOnly(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(t => {
    const bare = t.replace(/^\[|\]$/g, '');
    return isChordToken(bare);
  });
}

/** Human-readable reason when lyrics fail verified ChordPro checks (for fetch errors). */
export function chordProRejectionReason(text?: string | null): string | null {
  if (!text?.trim()) return 'Пустой текст таба.';
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return 'Таб слишком короткий — возможно не та страница на AmDm.';
  }
  let linesWithChordMarkers = 0;
  let linesWithLyricWords = 0;
  for (const line of lines) {
    if (CHORD_MARKER_RE.test(line)) linesWithChordMarkers++;
    const prose = line.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ');
    if (/[a-zA-Zа-яА-ЯёЁ]{2,}/.test(prose)) linesWithLyricWords++;
  }
  if (lines.every(lineIsChordOnly)) {
    return 'Только прогрессия без текста — нужен полный подбор.';
  }
  if (linesWithChordMarkers < 2) {
    return 'Нет построчных аккордов в тексте — проверьте название или прокси.';
  }
  if (linesWithLyricWords < 2) {
    return 'Найдено на AmDm, но мало текста песни — попробуйте другое написание.';
  }
  return null;
}

/** Multi-line ChordPro with inline [Am] markers (AmDm parser / builtin seed). */
export function isVerifiedChordProLyrics(text?: string | null): boolean {
  if (!text?.trim()) return false;
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;

  let linesWithChordMarkers = 0;
  let linesWithLyricWords = 0;

  for (const line of lines) {
    if (CHORD_MARKER_RE.test(line)) linesWithChordMarkers++;
    const prose = line.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ');
    if (/[a-zA-Zа-яА-ЯёЁ]{2,}/.test(prose)) linesWithLyricWords++;
  }

  if (linesWithChordMarkers < 2) return false;
  if (linesWithLyricWords < 2) return false;
  if (lines.every(lineIsChordOnly)) return false;

  return true;
}

/** Inline ChordPro cleanup without merging chord lines (builtin / AmDm inline). */
export function cleanupVerifiedChordPro(text: string): string {
  if (!text?.trim()) return text?.trim() ?? '';

  let normalized = normalizeLyricApostrophes(text).replace(/\r\n/g, '\n').trim();
  normalized = stripSpuriousChordBrackets(normalized);
  normalized = parenToBrackets(normalized);
  normalized = normalized
    .split('\n')
    .map(line =>
      isTablatureLine(line)
        ? line
        : repositionMisplacedInlineChords(stripSpuriousChordBrackets(parenToBrackets(line))),
    )
    .join('\n');
  return stripSpuriousChordBrackets(normalized).trim();
}

/** Full normalization pipeline for stored / fetched lyrics. */
export function normalizeLyricsChords(text: string, opts?: NormalizeLyricsOptions): string {
  if (!text?.trim()) return text?.trim() ?? '';

  let normalized = normalizeLyricApostrophes(text).replace(/\r\n/g, '\n').trim();
  normalized = stripSpuriousChordBrackets(normalized);
  normalized = parenToBrackets(normalized);

  if (opts?.allowMerge === true) {
    const lines = mergeChordLineAboveLyric(normalized.split('\n'));
    normalized = lines
      .map(line =>
        repositionMisplacedInlineChords(bracketBareChords(parenToBrackets(line))),
      )
      .join('\n');
    return stripSpuriousChordBrackets(normalized).trim();
  }

  return cleanupVerifiedChordPro(normalized);
}
