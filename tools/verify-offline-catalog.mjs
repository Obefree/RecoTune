/**
 * Checks the slim catalog: index counts, shard files, verified lyrics lookup.
 *   node tools/verify-offline-catalog.mjs
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { isVerifiedChordProLyrics } from './lib/chordNormalize.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(ROOT, 'assets/catalog/index.json'), 'utf8'));

const tests = [];
function check(name, ok) {
  tests.push([name, !!ok]);
}

check('index has songs', index.songCount > 0 && index.songs.length === index.songCount);
check('index has artists', index.artistCount > 0 && index.artists.length === index.artistCount);
check('artist count matches unique names', index.artistCount === new Set(index.songs.map(s => s.artist.trim().toLowerCase())).size);

const sample = index.songs.slice(0, 8).concat(index.songs.slice(-4));
for (const song of sample) {
  const shardPath = join(ROOT, 'assets/catalog/lyrics', `${song.shard}.json`);
  check(`${song.id} shard exists`, existsSync(shardPath));
  if (!existsSync(shardPath)) continue;
  const shard = JSON.parse(readFileSync(shardPath, 'utf8'));
  const lyrics = shard[song.id];
  check(`${song.id} lyrics verified`, isVerifiedChordProLyrics(lyrics));
}

const failed = tests.filter(([, ok]) => !ok);
for (const [name, ok] of tests) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${name}`);
}
if (failed.length) {
  console.error(`\n${failed.length} failed`);
  process.exit(1);
}
console.log(`\n${tests.length} checks · ${index.songCount} songs · ${index.artistCount} artists`);
