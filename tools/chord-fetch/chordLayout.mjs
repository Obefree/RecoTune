/**
 * Shared chords-over-lyrics → inline ChordPro converter (AmDm + Ultimate Guitar).
 *
 * Source sites render chords on a separate line above the lyric, positioned by
 * column (monospace). Older parser piled every chord at the start of the next
 * lyric line ("[C][G][Em]word"), destroying alignment. This module keeps the
 * column of each chord and inserts an inline [chord] marker right above the
 * matching syllable, which the practice UI renders correctly.
 *
 * One module instead of duplicating the column-merge in amdmFetch + ugFetch.
 */

/** Whole-token chord: G, Am, Hm7/5-, A7sus4, Dm(V) — keep in sync with src/utils/chordToken.ts */
const ROOT = '[A-H](?:#|b|♯|♭)?';
const CHORD_PIECE =
  '(?:maj7|maj9|maj|min|dim7|dim|aug|sus4|sus2|sus|add\\d+|m7b5|m7-5|m11|m13|m7|m9|m6|m(?!aj)|6\\/9|7\\+|7-|9\\+|11|13|7|9|6|2|4|5|°|Ø|\\+)';
const CHORD_ALTER = '(?:\\/(?:5[-+−]|9|11)|[-+−]5|b5|#5)?';
const CHORD_SLASH = `(?:\\/${ROOT})?`;
const CHORD_FRET = '(?:\\(\\s*(?:[IVXivx]+|\\d{1,2})\\s*\\))?';
const CHORD_TOKEN_RE = new RegExp(
  `^${ROOT}${CHORD_PIECE}*${CHORD_ALTER}${CHORD_SLASH}${CHORD_FRET}$`,
  'i',
);

function stripBrackets(token) {
  return token
    .replace(/^\[+/, '')
    .replace(/\]+$/, '')
    // AmDm fret-position hint: Dm(V), C(III), A(VII) → keep the chord, drop the position.
    .replace(/\((?:[ivxlcdm]+|\d{1,2})\)$/i, '');
}

export function isChordToken(token) {
  const bare = stripBrackets(String(token ?? '').trim());
  if (!bare) return false;
  return CHORD_TOKEN_RE.test(bare);
}

/** A physical line that is only chord symbols (the row above lyrics). */
export function isChordRowLine(line) {
  const t = String(line ?? '').trim();
  if (!t) return false;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  if (tokens.length > 16) return false;
  return tokens.every(isChordToken);
}

/** Does this line contain lyric words (letters outside chord brackets)? */
export function lineHasLyricWords(line) {
  const prose = String(line ?? '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ');
  return /[A-Za-zА-Яа-яЁё]{2,}/.test(prose);
}

/** Column-tagged chords in a chord row: [{ chord, col }] using the raw spacing. */
export function chordRowTokens(line) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const chord = stripBrackets(m[0]);
    if (chord) out.push({ chord, col: m.index });
  }
  return out;
}

/** Insert inline [chord] markers into a lyric line at the chord columns (snap to word). */
export function mergeChordRowIntoLyric(lyric, tokens) {
  if (!tokens.length) return lyric;
  const sorted = [...tokens].sort((a, b) => a.col - b.col);
  const len = lyric.length;
  let result = '';
  let cursor = 0;
  for (const { chord, col } of sorted) {
    let pos = Math.max(0, Math.min(col, len));
    while (pos < len && /\s/.test(lyric[pos])) pos++;
    while (pos > 0 && !/\s/.test(lyric[pos - 1])) pos--;
    if (pos < cursor) pos = cursor;
    result += lyric.slice(cursor, pos);
    result += `[${chord}]`;
    cursor = pos;
  }
  result += lyric.slice(cursor);
  return result;
}

/** A bare chord row with no lyric below → keep as a chord-only line for the UI. */
export function chordOnlyLine(tokens) {
  return tokens.map(t => `[${t.chord}]`).join(' ');
}

/** Section header followed by glued chord row (AmDm: "[Куплет]:C  G  Em"). */
const SECTION_LABEL_RE =
  /^\s*(\[[^\]\n]+\]|(?:вступлени|куплет|припев|проигрыш|бридж|кода|интро|аутро|соло|интерлюди|intro|outro|verse|chorus|bridge|solo|pre-?chorus|interlude|coda)[^:]*)\s*:\s*(.*)$/i;

/**
 * Split "Label: <chord row>" into the header and the remainder. AmDm puts the
 * first chord row of a section on the same line as the label; the chords are
 * still aligned to the lyric below once the label prefix is removed.
 * @returns {{ label: string, rest: string } | null}
 */
export function splitSectionLabel(line) {
  const m = String(line ?? '').match(SECTION_LABEL_RE);
  if (!m) return null;
  // Strip the wrapping brackets AmDm uses ("[Куплет]" → "Куплет") so the
  // practice view shows a clean header, not literal [brackets].
  const label = m[1].trim().replace(/^\[+/, '').replace(/\]+$/, '').trim();
  return { label: `${label}:`, rest: m[2] ?? '' };
}

/**
 * Convert a plain "chords over lyrics" sheet into inline [chord] ChordPro lines.
 * @param {string} text
 * @returns {string[]} body lines (no {directives})
 */
export function plainChordSheetToChordPro(text) {
  const rawLines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map(l => l.replace(/\s+$/g, '')); // keep leading spaces (columns), drop trailing

  const out = [];
  /** @type {{chord:string,col:number}[] | null} */
  let pendingChords = null;

  const flushPending = () => {
    if (pendingChords && pendingChords.length) {
      out.push(chordOnlyLine(pendingChords));
    }
    pendingChords = null;
  };

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushPending();
      out.push('');
      continue;
    }
    const labelSplit = splitSectionLabel(line);
    if (labelSplit) {
      flushPending();
      out.push(labelSplit.label);
      const rest = labelSplit.rest;
      if (rest.trim()) {
        if (isChordRowLine(rest)) pendingChords = chordRowTokens(rest);
        else out.push(rest.trim());
      }
      continue;
    }
    if (isChordRowLine(line)) {
      // Two chord rows in a row → previous one was an intro/instrumental line.
      flushPending();
      pendingChords = chordRowTokens(line);
      continue;
    }
    // Lyric line.
    if (pendingChords && pendingChords.length) {
      out.push(mergeChordRowIntoLyric(line.replace(/^\s+/, ''), shiftCols(pendingChords, line)));
      pendingChords = null;
    } else {
      out.push(line.replace(/^\s+/, ''));
    }
  }
  flushPending();

  // Collapse 3+ blank lines to a single spacer and trim outer blanks.
  const compact = [];
  for (const l of out) {
    if (!l.trim() && (!compact.length || !compact[compact.length - 1].trim())) continue;
    compact.push(l);
  }
  while (compact.length && !compact[0].trim()) compact.shift();
  while (compact.length && !compact[compact.length - 1].trim()) compact.pop();
  return compact;
}

/** Account for leading whitespace we trim off the lyric so chord columns stay aligned. */
function shiftCols(tokens, lyricLine) {
  const lead = lyricLine.match(/^\s*/)?.[0].length ?? 0;
  if (!lead) return tokens;
  return tokens.map(t => ({ chord: t.chord, col: Math.max(0, t.col - lead) }));
}
