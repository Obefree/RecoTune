/**
 * Quick check for chordLyricsNormalize.
 * Run: node tools/verify-chord-normalize.mjs
 * (Uses inline logic mirror — no TS build required.)
 */

const ROOT = '[A-G](?:#|b|♯|♭)?';
const CHORD_SUFFIX =
  '(?:maj7|maj|min|m(?!aj)|dim|aug|sus2|sus4|sus|add\\d+|m7|7|9|11|13|6|°|Ø|\\d+)?';
const CHORD_SLASH = `(?:\\/${ROOT})?`;
const CHORD_TOKEN = `${ROOT}${CHORD_SUFFIX}${CHORD_SLASH}`;
const VALID_CHORD_TOKEN_RE = new RegExp(`^${CHORD_TOKEN}$`, 'i');
const CHORD_MARKER_RE = /\[[A-G][#b♯♭\d]/i;

function isChordToken(token) {
  return VALID_CHORD_TOKEN_RE.test(token);
}

function splitTokenPunctuation(token) {
  const lead = token.match(/^[^\w[\]#♯♭/]+/)?.[0] ?? '';
  const rest = token.slice(lead.length);
  const trail = rest.match(/[^\w[\]#♯♭/]+$/)?.[0] ?? '';
  const core = rest.slice(0, rest.length - trail.length);
  return { lead, core, trail };
}

function parenToBrackets(text) {
  return text.replace(/\(\s*([^)\n]+?)\s*\)/g, (match, inner) => {
    const ch = inner.trim();
    return isChordToken(ch) ? `[${ch}]` : match;
  });
}

function bracketBareChords(line) {
  if (!line.trim() || CHORD_MARKER_RE.test(line)) return line;
  return line.replace(/\S+/g, token => {
    if (token.includes('[')) return token;
    const { lead, core, trail } = splitTokenPunctuation(token);
    if (!core || !isChordToken(core)) return token;
    return `${lead}[${core}]${trail}`;
  });
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

function normalizeLyricsChords(text) {
  if (!text?.trim()) return text?.trim() ?? '';
  let normalized = text.replace(/\r\n/g, '\n').trim();
  normalized = parenToBrackets(normalized);
  const lines = mergeChordLineAboveLyric(normalized.split('\n'));
  normalized = lines.map(line => bracketBareChords(parenToBrackets(line))).join('\n');
  return normalized.trim();
}

const creep =
  "When you were here before\nG\nCouldn't look you in the eye";
const creepOut = normalizeLyricsChords(creep);

const tests = [
  ['creep no [e]', !/\[e\]/i.test(creepOut)],
  ['creep has [G]', /\[G\]/i.test(creepOut)],
  ['paren Am', normalizeLyricsChords('(Am) over you') === '[Am] over you'],
  [
    'chord line',
    (() => {
      const o = normalizeLyricsChords('G B C\nHello world');
      return o.includes('[G]Hello') && !/\[e\]/.test(o);
    })(),
  ],
  ['Cant', !normalizeLyricsChords("Can't stop").includes('[C]')],
];

console.log('Output:\n' + creepOut + '\n');
let failed = 0;
for (const [name, pass] of tests) {
  console.log((pass ? 'PASS' : 'FAIL') + ' ' + name);
  if (!pass) failed++;
}
process.exit(failed ? 1 : 0);
