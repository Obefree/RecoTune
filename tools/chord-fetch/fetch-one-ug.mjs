#!/usr/bin/env node
/**
 * One-song Ultimate Guitar fetch on PC (dev-proxy parser).
 * Usage: node fetch-one-ug.mjs "Artist" "Title"
 */
import { writeFileSync } from 'fs';
import { fetchUgChordPro } from './ugFetch.mjs';

const artist = process.argv[2] ?? '';
const title = process.argv[3] ?? '';
if (!artist || !title) {
  console.error('Usage: node fetch-one-ug.mjs "Artist" "Title"');
  process.exit(1);
}

const result = await fetchUgChordPro(artist, title);
if (result.stub || !result.chordPro?.trim()) {
  console.error(result.error ?? 'Tab not found');
  process.exit(1);
}

const out = {
  title: result.title ?? title,
  artist: result.artist ?? artist,
  chords: '',
  lyrics: result.chordPro,
  genre: 'Ultimate Guitar',
  sourceUrl: result.sourceUrl,
};

writeFileSync('import-chord-song.json', JSON.stringify(out, null, 2), 'utf8');
console.log('OK', result.sourceUrl ?? '');
