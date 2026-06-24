/**
 * Quick check for chordLyricsNormalize.
 * Run: node tools/verify-chord-normalize.mjs
 * (Uses inline logic mirror — no TS build required.)
 */

const ROOT = '[A-H](?:#|b|♯|♭)?';
const CHORD_SUFFIX =
  '(?:maj7|maj|min|m(?!aj)|dim|aug|sus2|sus4|sus|add\\d+|m7|7|9|11|13|6|°|Ø|\\d+)?';
const CHORD_SLASH = `(?:\\/${ROOT})?`;
const CHORD_TOKEN = `${ROOT}${CHORD_SUFFIX}${CHORD_SLASH}`;
const VALID_CHORD_TOKEN_RE = new RegExp(`^${CHORD_TOKEN}$`, 'i');
const CHORD_MARKER_RE = /\[[A-H][#b♯♭\d]*(?:\/[A-H][#b♯♭\d]*)?[^\]]*\]/i;
const LYRIC_ARTICLE_TOKENS = new Set(['a', 'i']);
const LYRIC_PRONOUN_TOKENS = new Set(['I']);

function isChordToken(token) {
  return VALID_CHORD_TOKEN_RE.test(token);
}

function isBareWordChordToken(token, opts) {
  if (!isChordToken(token)) return false;
  if (LYRIC_ARTICLE_TOKENS.has(token)) return false;
  if (!opts?.chordLine && LYRIC_PRONOUN_TOKENS.has(token)) return false;
  if (token.length === 1) return /^[A-H]$/i.test(token);
  return true;
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

function splitTokenPunctuation(token) {
  const lead = token.match(/^[^\w[\]#♯♭/]+/)?.[0] ?? '';
  const rest = token.slice(lead.length);
  const trail = rest.match(/[^\w[\]#♯♭/]+$/)?.[0] ?? '';
  const core = rest.slice(0, rest.length - trail.length);
  return { lead, core, trail };
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

function normalizeLyricsChords(text, opts) {
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

function isVerifiedChordProLyrics(text) {
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

const creep =
  "When you were here before\nG\nCouldn't look you in the eye";
const creepOut = normalizeLyricsChords(creep, { allowMerge: true });

const creepFeather = normalizeLyricsChords(
  'G B C Cm\nYou float like a feather\nIn a beautiful world',
  { allowMerge: true },
);
const creepChorus = normalizeLyricsChords("But I'm a creep");
const creepChorusMerge = normalizeLyricsChords("G\nBut I'm a creep", { allowMerge: true });
const creepChorusBad = normalizeLyricsChords("But [G]I'm a creep");
const creepChorusCurly = normalizeLyricsChords('But [G]I\u2019m a creep');
const creepMergeBad = normalizeLyricsChords("G\nBut [G]I'm a creep", { allowMerge: true });
const csharpLine = normalizeLyricsChords('C#\nHello world', { allowMerge: true });
const bbLine = normalizeLyricsChords('Bb\nShe loves you', { allowMerge: true });
// German/Russian H (=B) used on AmDm / pesni.ru — must be recognized as a chord.
const hmLine = normalizeLyricsChords('Hm\nМного дней грустил', { allowMerge: true });
const hRow = normalizeLyricsChords('A G Hm D\nраз два три четыре', { allowMerge: true });
const hVerified = isVerifiedChordProLyrics(
  normalizeLyricsChords('Hm\nМного дней грустил\nEm\nНе знал народ', { allowMerge: true }),
);

const tests = [
  ['creep no [e]', !/\[e\]/i.test(creepOut)],
  ['creep has [G]', /\[G\]/i.test(creepOut)],
  ['creep single G line', creepOut.includes("[G]Couldn't") && !/\[G\]look/i.test(creepOut)],
  ['paren Am', normalizeLyricsChords('(Am) over you') === '[Am] over you'],
  [
    'chord line',
    (() => {
      const o = normalizeLyricsChords('G B C\nHello world', { allowMerge: true });
      return o.includes('[G]Hello') && !/\[e\]/.test(o);
    })(),
  ],
  ['Cant', !normalizeLyricsChords("Can't stop").includes('[C]')],
  ['feather no [a]', !/\[a\]/i.test(creepFeather)],
  ['feather chord line', /\[G\].*\[Cm\]/.test(creepFeather.split('\n')[0])],
  ['chorus no [a]', !/\[a\]/i.test(creepChorus)],
  [
    'creep chorus merge',
    creepChorusMerge === "But I'm a [G]creep" && !/\[G\]I'm/i.test(creepChorusMerge),
  ],
  [
    'creep chorus reposition',
    creepChorusBad === "But I'm a [G]creep" && !/\[G\]I'm/i.test(creepChorusBad),
  ],
  [
    'strip [a] creep line',
    normalizeLyricsChords('But [G]I\'m [a] creep') === "But I'm a [G]creep",
  ],
  [
    'creep curly apostrophe',
    creepChorusCurly === "But I'm a [G]creep" && !/\[G\]I/i.test(creepChorusCurly),
  ],
  [
    'creep merge bad inline',
    creepMergeBad === "But I'm a [G]creep" && !/\[G\]\[G\]/i.test(creepMergeBad),
  ],
  ['C# chord line', csharpLine.includes('[C#]Hello') && !/\[C\]#/i.test(csharpLine)],
  ['Bb chord line', bbLine.includes('[Bb]She') && !/\[B\]b/i.test(bbLine)],
  [
    'A chord line',
    (() => {
      const merged = normalizeLyricsChords('A\nVerse', { allowMerge: true });
      const row = normalizeLyricsChords('A D E', { allowMerge: true });
      return merged.includes('[A]Verse') && /\[A\].*\[D\].*\[E\]/.test(row) && !/\[a\]/.test(row);
    })(),
  ],
  [
    'keep [A] bracket',
    normalizeLyricsChords('[A]Hello') === '[A]Hello',
  ],
  [
    'feather article lowercase',
    !/\[a\]/i.test(normalizeLyricsChords('like a feather', { allowMerge: true })),
  ],
  ['H chord line', hmLine.includes('[Hm]Много')],
  ['H in chord row', /\[A\].*\[G\].*\[Hm\].*\[D\]/.test(hRow.split('\n')[0])],
  ['H tab verifies', hVerified === true],
];

console.log('Output:\n' + creepOut + '\n');
console.log('Feather:\n' + creepFeather + '\n');
let failed = 0;
for (const [name, pass] of tests) {
  console.log((pass ? 'PASS' : 'FAIL') + ' ' + name);
  if (!pass) failed++;
}
process.exit(failed ? 1 : 0);
