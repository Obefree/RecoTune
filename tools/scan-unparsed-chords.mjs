import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = '[A-H](?:#|b|♯|♭)?';
const CHORD_PIECE =
  '(?:maj7|maj9|maj|min|dim7|dim|aug|sus4|sus2|sus|add\\d+|m7b5|m7-5|m11|m13|m7|m9|m6|m(?!aj)|6\\/9|7\\+|7-|9\\+|11|13|7|9|6|2|4|5|°|Ø|\\+)';
const CHORD_ALTER = '(?:\\/(?:5[-+−]|9|11)|[-+−]5|b5|#5)?';
const CHORD_BASS = `(?:\\/${ROOT})?`;
const CHORD_FRET = '(?:\\(\\s*(?:[IVXivx]+|\\d{1,2})\\s*\\))?';
const RE = new RegExp(`^${ROOT}${CHORD_PIECE}*${CHORD_ALTER}${CHORD_BASS}${CHORD_FRET}$`, 'i');
const JUNK = new Set(['G1', 'A320', 'a8', 'C3']);
const LOOKS = /^[A-Ha-h](?:#|b|♯|♭)?/;
const SKIP = /chorus|verse|intro|bridge|outro|куплет|припев|проигрыш|solo|riff|tab/i;

const dir = join(dirname(fileURLToPath(import.meta.url)), '../assets/catalog/lyrics');
const fail = new Map();
let ok = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const shard = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const text of Object.values(shard)) {
    for (const m of String(text).matchAll(/\[([^\]\n]{1,40})\]/g)) {
      const inner = m[1].trim().replace(/\u2212/g, '-');
      if (!LOOKS.test(inner) || SKIP.test(inner)) continue;
      if (RE.test(inner)) {
        ok += 1;
        continue;
      }
      fail.set(inner, (fail.get(inner) ?? 0) + 1);
    }
  }
}
const ranked = [...fail.entries()].sort((a, b) => b[1] - a[1]);
console.log(`matched ${ok} · failed unique ${ranked.length} · total fail ${ranked.reduce((n, [, c]) => n + c, 0)}`);
for (const [token, n] of ranked.slice(0, 100)) console.log(`${String(n).padStart(5)}  ${token}`);
const unexpected = ranked.filter(([token]) => !JUNK.has(token));
if (unexpected.length) {
  console.error('unexpected unparsed chords:', unexpected.map(([t]) => t).join(', '));
  process.exit(1);
}

const extras = new Map();
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const shard = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const text of Object.values(shard)) {
    for (const m of String(text).matchAll(/\[([^\]\n]{1,40})\]/g)) {
      const inner = m[1].trim();
      if (!LOOKS.test(inner)) continue;
      if (/[()IVXivx]/.test(inner) || /\/\d/.test(inner) || /add|sus|maj|dim/.test(inner)) {
        if (!RE.test(inner.replace(/\u2212/g, '-'))) extras.set(inner, (extras.get(inner) ?? 0) + 1);
      }
    }
  }
}
const extraRanked = [...extras.entries()].sort((a, b) => b[1] - a[1]);
if (extraRanked.length) {
  console.log('\nalter / fret / stacked (failed):');
  for (const [token, n] of extraRanked.slice(0, 40)) console.log(`${String(n).padStart(5)}  ${token}`);
}
