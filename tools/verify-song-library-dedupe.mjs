#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Mirror of combinedArtistTitle in src/utils/searchNormalize.ts (run: node tools/verify-song-library-dedupe.mjs)
const CYR_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function normalizeSearchText(s, transliterate = true) {
  let t = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9а-яё\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (transliterate && /[а-яё]/.test(t)) {
    t = t.split('').map(ch => CYR_TO_LAT[ch] ?? ch).join('');
  }
  return t;
}

function combinedArtistTitle(artist, title) {
  return normalizeSearchText(`${artist} ${title}`);
}

// Mirror of dedupeSongRows in src/db/songLibrary.ts
function dedupeSongRows(rows) {
  const byKey = new Map();
  const order = [];
  for (const row of rows) {
    const key = combinedArtistTitle(row.artist, row.title);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      order.push(key);
      continue;
    }
    if (existing.id.startsWith('pesni_ru_') && !row.id.startsWith('pesni_ru_')) {
      byKey.set(key, row);
    }
  }
  return order.map(key => byKey.get(key));
}

// Synthetic cases
{
  const rows = [
    { id: 's002', title: "Blowin' in the Wind", artist: 'Bob Dylan' },
    { id: 'pesni_ru_blowin-in-the-wind', title: "Blowin' in the Wind", artist: 'Bob Dylan' },
    { id: 'pesni_ru_180-santimetrov', title: '180 сантиметров', artist: 'ДДТ (Юрий Шевчук)' },
  ];
  const out = dedupeSongRows(rows);
  assert.equal(out.length, 2, 'exact artist+title dup collapses to one row');
  assert.equal(out[0].id, 's002', 'curated non-pesni row wins over pesni_ru duplicate');
  assert.equal(out[1].id, 'pesni_ru_180-santimetrov', 'unique song untouched');
}
{
  // Different titles must never merge, even if they share an artist.
  const rows = [
    { id: 'pesni_ru_a', title: '180 сантиметров', artist: 'ДДТ' },
    { id: 'pesni_ru_b', title: '180 сантиметров назад', artist: 'ДДТ' },
  ];
  assert.equal(dedupeSongRows(rows).length, 2, 'distinct titles are not merged');
}

console.log('PASS synthetic dedupe cases');

// Regression guard: cross-check the real bundled seed + pesni archive don't
// currently produce a second, un-deduped artist+title collision the fix
// wouldn't catch (i.e. the fix's key function actually matches real data).
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seedSrc = readFileSync(path.join(root, 'src/data/builtinSongsSeed.ts'), 'utf8');
const seedRe = /"id":\s*"([^"]+)"\s*,\s*"title":\s*"((?:[^"\\]|\\.)*)"\s*,\s*"artist":\s*"((?:[^"\\]|\\.)*)"/g;
const seedRows = [];
let m;
while ((m = seedRe.exec(seedSrc))) {
  seedRows.push({ id: m[1], title: m[2], artist: m[3] });
}
assert.ok(seedRows.length > 0, 'builtin seed parsed');

const pesni = JSON.parse(
  readFileSync(path.join(root, 'assets/archive/pesni-chordpro.json'), 'utf8'),
).songs;

const before = seedRows.length + pesni.length;
const after = dedupeSongRows([...seedRows, ...pesni]).length;
assert.ok(after < before, `expected duplicates between seed(${seedRows.length}) and pesni(${pesni.length}) bundle to collapse (before=${before}, after=${after})`);
console.log(`PASS real-bundle dedupe collapses ${before - after} duplicate row(s) (e.g. seed vs pesni.ru overlap)`);
