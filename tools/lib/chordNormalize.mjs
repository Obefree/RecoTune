/**
 * Node mirror of src/utils/chordLyricsNormalize.ts (+ pesni.ru helpers from
 * src/providers/pesniRuProvider.ts). Shared by tools/verify-chord-normalize.mjs
 * and tools/ingest-pesni-chordpro.mjs so there is ONE offline copy of the
 * chord-above-lyric → inline [Chord] logic.
 *
 * Keep in sync with the TS source. `npm run verify-chord-normalize` guards it.
 */

const ROOT = '[A-H](?:#|b|♯|♭)?';
const CHORD_SUFFIX =
  '(?:maj7|maj|min|m(?!aj)|dim|aug|sus2|sus4|sus|add\\d+|m7|7|9|11|13|6|°|Ø|\\d+)?';
const CHORD_SLASH = `(?:\\/${ROOT})?`;
const CHORD_TOKEN = `${ROOT}${CHORD_SUFFIX}${CHORD_SLASH}`;
const VALID_CHORD_TOKEN_RE = new RegExp(`^${CHORD_TOKEN}$`, 'i');
const CHORD_MARKER_RE = /\[[A-H][#b♯♭\d]*(?:\/[A-H][#b♯♭\d]*)?[^\]]*\]/i;
const BRACKET_CHORD_RE = new RegExp(`\\[(${CHORD_TOKEN})\\]`, 'gi');
const LYRIC_ARTICLE_TOKENS = new Set(['a', 'i']);
const LYRIC_PRONOUN_TOKENS = new Set(['I']);

export function isChordToken(token) {
  return VALID_CHORD_TOKEN_RE.test(token);
}

function isBareWordChordToken(token, opts) {
  if (!isChordToken(token)) return false;
  if (LYRIC_ARTICLE_TOKENS.has(token)) return false;
  if (!opts?.chordLine && LYRIC_PRONOUN_TOKENS.has(token)) return false;
  if (token.length === 1) return /^[A-H]$/i.test(token);
  return true;
}

function splitTokenPunctuation(token) {
  const lead = token.match(/^[^\w[\]#♯♭/]+/)?.[0] ?? '';
  const rest = token.slice(lead.length);
  const trail = rest.match(/[^\w[\]#♯♭/]+$/)?.[0] ?? '';
  const core = rest.slice(0, rest.length - trail.length);
  return { lead, core, trail };
}

function lineIsBareChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(t => {
    const { core } = splitTokenPunctuation(t);
    return Boolean(core) && isChordToken(core);
  });
}

function stripSpuriousChordBrackets(text) {
  return text.replace(/\[([^\]\n]+)\]/g, (match, inner) => {
    const ch = inner.trim();
    if (!ch) return match;
    if (LYRIC_ARTICLE_TOKENS.has(ch) || LYRIC_PRONOUN_TOKENS.has(ch)) return ch;
    if (ch.length === 1 && !isBareWordChordToken(ch)) return ch;
    if (!isChordToken(ch)) return ch;
    return match;
  });
}

function lineHasSpuriousChordBrackets(line) {
  return /\[[^\]\n]+\]/.test(line) && stripSpuriousChordBrackets(line) !== line;
}

function parenToBrackets(text) {
  return text.replace(/\(\s*([^)\n]+?)\s*\)/g, (match, inner) => {
    const ch = inner.trim();
    return isBareWordChordToken(ch) ? `[${ch}]` : match;
  });
}

function bracketBareChords(line) {
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

function normalizeLyricApostrophes(text) {
  return text.replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'");
}

function lastWordHasInlineChord(line) {
  const last = line.trim().split(/\s+/).pop() ?? '';
  return /\[[A-H][^\]]*\]/i.test(last);
}

function firstWordCore(line) {
  const w = line.trim().split(/\s+/)[0] ?? '';
  const { core } = splitTokenPunctuation(w);
  return core.toLowerCase().replace(/^'/, "'");
}

function lineStartsWithConnector(line) {
  return LINE_LEAD_CONNECTORS.has(firstWordCore(line));
}

function attachChordToLastWord(line, chord) {
  const words = line.trim().split(/\s+/);
  if (words.length === 0) return line;
  const last = words[words.length - 1];
  const { lead, core, trail } = splitTokenPunctuation(last);
  words[words.length - 1] = `${lead}[${chord}]${core}${trail}`;
  return words.join(' ');
}

function repositionMisplacedInlineChords(line) {
  const leadChord = line.match(
    /^\[([^\]\n]+)\]\s*((?:But|And|Or|So|Yet|For|Nor|'cause|Because)\b.+)$/i,
  );
  if (leadChord) return attachChordToLastWord(leadChord[2], leadChord[1]);

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

function mergeChordLineAboveLyric(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const allChords = tokens.length > 0 && tokens.every(t => isChordToken(t));
    if (allChords && i + 1 < lines.length && lines[i + 1].trim()) {
      const next = lines[i + 1];
      const words = next.trim().split(/\s+/);
      if (tokens.length === 1) {
        const chord = tokens[0];
        const trimmedNext = next.trim();
        const nextWords = trimmedNext.split(/\s+/);
        if (nextWords.length === 1) {
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

export function normalizeLyricsChords(text, opts) {
  if (!text?.trim()) return text?.trim() ?? '';
  let normalized = normalizeLyricApostrophes(text).replace(/\r\n/g, '\n').trim();
  normalized = stripSpuriousChordBrackets(normalized);
  normalized = parenToBrackets(normalized);
  const split = normalized.split('\n');
  const lines = opts?.allowMerge === true ? mergeChordLineAboveLyric(split) : split;
  normalized = lines
    .map(line => repositionMisplacedInlineChords(bracketBareChords(parenToBrackets(line))))
    .join('\n');
  return stripSpuriousChordBrackets(normalized).trim();
}

function lineIsChordOnly(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(t => isChordToken(t.replace(/^\[|\]$/g, '')));
}

export function isVerifiedChordProLyrics(text) {
  if (!text?.trim()) return false;
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  let markers = 0;
  let lyricWords = 0;
  for (const line of lines) {
    if (CHORD_MARKER_RE.test(line)) markers++;
    const prose = line.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ');
    if (/[a-zA-Zа-яА-ЯёЁ]{2,}/.test(prose)) lyricWords++;
  }
  if (markers < 2 || lyricWords < 2) return false;
  if (lines.every(lineIsChordOnly)) return false;
  return true;
}

/** pesni.ru indents every line with leading tabs; strip them before alignment. */
export function dedentPesniText(text) {
  return text.replace(/^\t+/gm, '');
}

/** Chord-above-lyric plain text from pesni.ru → inline ChordPro, or null when unverified. */
export function pesniRuTextToVerifiedLyrics(text) {
  const raw = text?.trim();
  if (!raw) return null;
  const merged = normalizeLyricsChords(dedentPesniText(raw), { allowMerge: true });
  if (!isVerifiedChordProLyrics(merged)) return null;
  return merged;
}

/** Unique chord tokens in order of first appearance (for the `chords` hint field). */
export function extractBracketChords(lyrics, limit = 12) {
  const seen = new Set();
  const out = [];
  for (const m of lyrics.matchAll(BRACKET_CHORD_RE)) {
    const c = m[1].replace(/♯/g, '#').replace(/♭/g, 'b');
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}
