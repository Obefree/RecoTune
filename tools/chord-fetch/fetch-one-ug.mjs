#!/usr/bin/env node
/**
 * Stub: one-song Ultimate Guitar fetch on PC (wire your parser here).
 * Usage: node fetch-one-ug.mjs "Artist" "Title"
 */

import { writeFileSync } from 'fs';

const artist = process.argv[2] ?? '';
const title = process.argv[3] ?? '';
if (!artist || !title) {
  console.error('Usage: node fetch-one-ug.mjs "Artist" "Title"');
  process.exit(1);
}

const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(`${artist} ${title}`)}`;
console.log('Search URL (open manually or implement fetch):', searchUrl);

const out = {
  title,
  artist,
  chords: 'C G Am F',
  lyrics: '',
  genre: 'Ultimate Guitar',
  difficulty: 1,
  _note: 'UG parser must run outside the mobile app. No bulk export.',
};

writeFileSync('import-chord-song.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote import-chord-song.json (placeholder).');
