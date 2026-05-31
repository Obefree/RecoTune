/**
 * Smoke-test metadata chunk search_text for Latin + Cyrillic queries.
 * Run after ingest: node tools/verify-metadata-search.mjs
 */
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const metaDir = join(__dirname, '../assets/metadata');

function normalizeSearchText(s) {
  let t = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9а-яё\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function score(q, title, artist) {
  const qn = normalizeSearchText(q);
  const hay = normalizeSearchText(`${artist} ${title}`);
  if (!qn || !hay.includes(qn)) return 0;
  return qn.length >= 3 ? 80 : 40;
}

const chunks = readdirSync(metaDir).filter(f => /^chunk-\d+\.json$/i.test(f));
const tracks = [];
for (const f of chunks) {
  const p = JSON.parse(readFileSync(join(metaDir, f), 'utf8'));
  tracks.push(...(p.tracks ?? []));
}

const queries = ['beatles', 'кино', 'nirvana', 'земфира', 'radiohead', 'Bob Dylan', 'мельница'];
let ok = 0;
for (const q of queries) {
  const hits = tracks
    .map(t => ({ t, s: score(q, t.title, t.artistName) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  console.log(`\n"${q}" → ${hits.length} hits (of ${tracks.length} tracks)`);
  for (const h of hits) console.log(`  ${h.t.artistName} — ${h.t.title}`);
  if (hits.length > 0) ok += 1;
}

console.log(`\n${ok}/${queries.length} queries matched`);
process.exit(ok >= 4 ? 0 : 1);
