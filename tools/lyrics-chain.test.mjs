#!/usr/bin/env node
/**
 * Chain test for lyrics lookup / merge.
 * Compiles the pure data modules and checks: no fake overlay,
 * artist+title wins over colliding ids, fill-only merge, duplicate catalogue rows.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tmp', 'lyrics-chain-test');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const tsc = spawnSync(
  path.join(root, 'node_modules', '.bin', 'tsc'),
  [
    path.join(root, 'src/data/lyricsDatabase.ts'),
    path.join(root, 'src/data/songDatabase.ts'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--esModuleInterop',
    '--skipLibCheck',
    '--target', 'es2020',
    '--strict', 'false',
  ],
  { encoding: 'utf8' },
);
if (tsc.status !== 0) {
  console.error(tsc.stdout, tsc.stderr);
  process.exit(tsc.status ?? 1);
}

const require = createRequire(import.meta.url);
const {
  findLyrics,
  resolvedLyrics,
  hasChordMarkers,
  lyricsKey,
  LYRICS_DB,
  LYRICS_BY_KEY,
} = require(path.join(outDir, 'lyricsDatabase.js'));
const { SONGS } = require(path.join(outDir, 'songDatabase.js'));

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('lyrics-chain');

ok('plain text is not a tab', !hasChordMarkers('hello world\nsecond line'));
ok('ChordPro is a tab', hasChordMarkers('[Am]Hello [F]world'));
ok('(paren) alone is not a tab', !hasChordMarkers('(chorus) hello'));

const yesterday = findLyrics({ artist: 'The Beatles', title: 'Yesterday' });
ok('Yesterday via artist+title', hasChordMarkers(yesterday));
ok('Yesterday not via wrong id s029', !LYRICS_DB['s029']);
ok('s029 catalogue fills from key, not id', hasChordMarkers(resolvedLyrics({
  id: 's029', artist: 'The Beatles', title: 'Yesterday',
})));

const inlineLetItBe = SONGS.find(s => s.id === 's001').lyrics;
const mergedLetItBe = resolvedLyrics(SONGS.find(s => s.id === 's001'));
ok('Let It Be keeps inline tab (no overwrite)', mergedLetItBe === inlineLetItBe);

const colliding = findLyrics({
  id: 's001',
  artist: 'Nirvana',
  title: 'Come As You Are',
});
ok('artist+title wins over colliding id s001', colliding === findLyrics({
  artist: 'Nirvana', title: 'Come As You Are',
}));
ok('colliding id does not return Let It Be', colliding !== LYRICS_DB['s001']);

const incubus = resolvedLyrics({
  id: 's052', artist: 'Incubus', title: 'Wish You Were Here',
});
const floyd = findLyrics({ artist: 'Pink Floyd', title: 'Wish You Were Here' });
ok('Incubus Wish You Were Here is not Pink Floyd tab', incubus !== floyd);
ok('Pink Floyd Wish You Were Here is a tab', hasChordMarkers(floyd));

const plain = 'When I find myself in times of trouble';
const notOverlaid = resolvedLyrics({
  id: 'x', artist: 'Nobody', title: 'Nope', lyrics: plain,
});
ok('plain lyrics stay plain (no fake [Chord] overlay)', notOverlaid === plain);
ok('plain lyrics have no markers after merge', !hasChordMarkers(notOverlaid));

const filled = SONGS.filter(s => hasChordMarkers(resolvedLyrics(s)));
const inline = SONGS.filter(s => hasChordMarkers(s.lyrics));
ok('fill-only increases coverage', filled.length > inline.length, `${inline.length} inline → ${filled.length} resolved / ${SONGS.length} songs`);
console.log(`  info coverage: ${inline.length} inline ChordPro → ${filled.length} after fill / ${SONGS.length} catalogue songs`);

const byKey = new Map();
for (const s of SONGS) {
  const k = lyricsKey(s.artist, s.title);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(s.id);
}
const dupes = [...byKey.entries()].filter(([, ids]) => ids.length > 1);
const wonderwallIds = (dupes.find(([k]) => k.includes('wonderwall')) || [null, []])[1];
const wwInline = wonderwallIds.map(id => SONGS.find(s => s.id === id)).filter(s => hasChordMarkers(s.lyrics));
const wwEmpty = wonderwallIds.map(id => SONGS.find(s => s.id === id)).filter(s => !s.lyrics);
const wwDict = findLyrics({ artist: 'Oasis', title: 'Wonderwall' });
ok('Wonderwall with inline keeps its own tab', wwInline.length > 0 && wwInline.every(s => resolvedLyrics(s) === s.lyrics));
ok('Wonderwall without inline fills the same dictionary tab', wwEmpty.length > 0 && wwEmpty.every(s => resolvedLyrics(s) === wwDict));

const mappedBodies = new Set(Object.values(LYRICS_BY_KEY));
const orphanIds = Object.keys(LYRICS_DB).filter(id => !mappedBodies.has(LYRICS_DB[id]));
console.log(`  info unmapped LYRICS_DB ids (not wired by artist+title): ${orphanIds.join(', ') || '(none)'}`);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
