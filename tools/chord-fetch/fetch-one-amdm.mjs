#!/usr/bin/env node
/**
 * One-song AmDm fetch on PC (same parser as the dev proxy).
 * Usage: node fetch-one-amdm.mjs "Artist" "Title"
 */
import { writeFileSync } from 'fs';
import { fetchAmdmChordPro } from './amdmFetch.mjs';

const artist = process.argv[2] ?? '';
const title = process.argv[3] ?? '';
if (!artist || !title) {
  console.error('Usage: node fetch-one-amdm.mjs "Artist" "Title"');
  process.exit(1);
}

const result = await fetchAmdmChordPro(artist, title);
if (result.stub || !result.chordPro?.trim()) {
  console.error(result.error ?? 'Tab not found');
  process.exit(1);
}

const out = {
  title: result.title ?? title,
  artist: result.artist ?? artist,
  chords: '',
  lyrics: result.chordPro,
  genre: 'AmDm',
  sourceUrl: result.sourceUrl,
};

writeFileSync('import-chord-song.json', JSON.stringify(out, null, 2), 'utf8');
console.log('OK', result.sourceUrl ?? '');
