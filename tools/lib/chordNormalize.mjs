/**
 * Node mirror of src/utils/chordLyricsNormalize.ts (+ pesni.ru helpers from
 * src/providers/pesniRuProvider.ts). Shared by tools/verify-chord-normalize.mjs
 * and tools/ingest-pesni-chordpro.mjs so there is ONE offline copy of the
 * chord-above-lyric → inline [Chord] logic.
 *
 * Keep in sync with the TS source. `npm run verify-chord-normalize` guards it.
 */

const ROOT = '[A-H](?:#|b|♯|♭)?';
const CHORD_PIECE =
  '(?:maj7|maj9|maj|min|dim7|dim|aug|sus4|sus2|sus|add\\d+|m7b5|m7-5|m11|m13|m7|m9|m6|m(?!aj)|6\\/9|7\\+|7-|9\\+|11|13|7|9|6|2|4|5|°|Ø|\\+)';
const CHORD_ALTER = '(?:\\/(?:5[-+−]|9|11)|[-+−]5|b5|#5)?';
const CHORD_SLASH = `(?:\\/${ROOT})?`;
const CHORD_FRET = '(?:\\(\\s*(?:[IVXivx]+|\\d{1,2})\\s*\\))?';
const CHORD_TOKEN = `${ROOT}${CHORD_PIECE}*${CHORD_ALTER}${CHORD_SLASH}${CHORD_FRET}`;
const VALID_CHORD_TOKEN_RE = new RegExp(`^${CHORD_TOKEN}$`, 'i');
const CHORD_MARKER_RE = new RegExp(`\\[${CHORD_TOKEN}\\]`, 'i');
const BRACKET_CHORD_RE = new RegExp(`\\[(${CHORD_TOKEN})\\]`, 'gi');
const LYRIC_ARTICLE_TOKENS = new Set(['a', 'i']);
const LYRIC_PRONOUN_TOKENS = new Set(['I']);

export function isChordToken(token) {
  return VALID_CHORD_TOKEN_RE.test(token);
}

function chordBare(token) {
  const { core } = splitTokenPunctuation(token);
  return core.replace(/^\[+|\]+$/g, '');
}

function lineHasLyricWords(line) {
  const prose = String(line ?? '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ');
  return /[a-zA-Zа-яА-ЯёЁ]{2,}/.test(prose);
}

function chordRowTokens(line) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const bare = chordBare(m[0]);
    if (bare && isChordToken(bare)) out.push({ chord: bare, col: m.index });
  }
  return out;
}

function snapToWordStart(lyric, pos) {
  const len = lyric.length;
  let p = Math.max(0, Math.min(pos, len));
  while (p < len && /\s/.test(lyric[p])) p += 1;
  while (p > 0 && !/\s/.test(lyric[p - 1])) p -= 1;
  return p;
}

function mergeByColumns(lyric, tokens) {
  if (!tokens.length) return lyric;
  const lead = lyric.match(/^\s*/)?.[0].length ?? 0;
  const body = lyric.slice(lead);
  const len = body.length;
  const sorted = tokens
    .map(t => ({ chord: t.chord, col: Math.max(0, t.col - lead) }))
    .sort((a, b) => a.col - b.col);
  let result = '';
  let cursor = 0;
  for (const { chord, col } of sorted) {
    let pos = snapToWordStart(body, col);
    if (pos < cursor) pos = cursor;
    if (pos > len) pos = len;
    result += body.slice(cursor, pos);
    result += `[${chord}]`;
    cursor = pos;
  }
  result += body.slice(cursor);
  return result;
}

function spreadChordsOnWords(lyric, chords) {
  const words = lyric.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return chords.map(c => `[${c}]`).join(' ');
  if (chords.length === 1) return `[${chords[0]}]${lyric.trim()}`;
  const marks = words.map(() => '');
  const last = Math.max(chords.length - 1, 1);
  const used = new Set();
  for (let i = 0; i < chords.length; i += 1) {
    let wi = Math.round((i * (words.length - 1)) / last);
    wi = Math.max(0, Math.min(words.length - 1, wi));
    while (used.has(wi) && wi < words.length - 1) wi += 1;
    while (used.has(wi) && wi > 0) wi -= 1;
    used.add(wi);
    marks[wi] += `[${chords[i]}]`;
  }
  return words.map((w, i) => `${marks[i]}${w}`).join(' ');
}

function isBareWordChordToken(token, opts) {
  if (!isChordToken(token)) return false;
  if (LYRIC_ARTICLE_TOKENS.has(token)) return false;
  if (!opts?.chordLine && LYRIC_PRONOUN_TOKENS.has(token)) return false;
  if (token.length === 1) return /^[A-H]$/i.test(token);
  return true;
}

function splitTokenPunctuation(token) {
  const keep = /[A-Za-z0-9[\]#♯♭/+−-]/;
  let start = 0;
  while (start < token.length && !keep.test(token[start])) start += 1;
  let end = token.length;
  while (end > start && !keep.test(token[end - 1])) end -= 1;
  return {
    lead: token.slice(0, start),
    core: token.slice(start, end),
    trail: token.slice(end),
  };
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
    const rowTokens = chordRowTokens(line);
    const next = i + 1 < lines.length ? lines[i + 1] : '';
    const allChords = rowTokens.length > 0 && lineIsChordOnly(line);
    if (allChords && next.trim() && lineHasLyricWords(next) && !lineIsChordOnly(next)) {
      const chords = rowTokens.map(t => t.chord);
      const words = next.trim().split(/\s+/).filter(Boolean);
      if (chords.length === 1) {
        const chord = chords[0];
        const trimmedNext = next.trim();
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
      if (/\S\s{3,}\S/.test(line)) {
        out.push(mergeByColumns(next, rowTokens));
        i += 1;
        continue;
      }
      if (chords.length === words.length) {
        out.push(words.map((w, wi) => `[${chords[wi]}]${w}`).join(' '));
        i += 1;
        continue;
      }
      if (chords.length > words.length && words.length > 0) {
        out.push(
          words
            .map((w, wi) =>
              wi < words.length - 1
                ? `[${chords[wi]}]${w}`
                : `${chords.slice(wi).map(c => `[${c}]`).join('')}${w}`,
            )
            .join(' '),
        );
        i += 1;
        continue;
      }
      if (words.length > 0) {
        out.push(spreadChordsOnWords(next, chords));
        i += 1;
        continue;
      }
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
  const lines = mergeChordLineAboveLyric(normalized.split('\n'));
  normalized = lines
    .map(line =>
      opts?.allowMerge === true
        ? repositionMisplacedInlineChords(bracketBareChords(parenToBrackets(line)))
        : repositionMisplacedInlineChords(parenToBrackets(line)),
    )
    .join('\n');
  return stripSpuriousChordBrackets(normalized).trim();
}

function lineIsChordOnly(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(t => {
    const bare = chordBare(t);
    return Boolean(bare) && isChordToken(bare);
  });
}

/** ASCII/OLGA guitar-tab archive headers — not ChordPro practice content (D8). */
export function isTabArchiveDumpLyrics(text) {
  if (!text?.trim()) return false;
  const head = text.slice(0, 900);
  if (/^\s*(Date|From|Subject|Newsgroups|To|Reply-To|Message-ID)\s*:/im.test(head)) return true;
  if (/PLEASE\s+NOTE|author'?s\s+own\s+work|This\s+file\s+is\s+the|Usenet|OLGA|Guitar\s*Pro/i.test(head)) {
    return true;
  }
  if (/^#\s*-{3,}/m.test(head) && /interpreta/i.test(head)) return true;
  if (/^\s*Band\s*:/im.test(head) && /^\s*Song\s*:/im.test(head)) return true;
  return false;
}

export function isVerifiedChordProLyrics(text) {
  if (!text?.trim()) return false;
  if (isTabArchiveDumpLyrics(text)) return false;
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
