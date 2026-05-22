#!/usr/bin/env node
/**
 * Stub: one-song AmDm fetch on PC (wire your parser here).
 * Usage: node fetch-one-amdm.mjs "Artist" "Title"
 * Output: import-chord-song.json (not committed by default — add to .gitignore if needed)
 */

import { writeFileSync } from 'fs';

const artist = process.argv[2] ?? '';
const title = process.argv[3] ?? '';
if (!artist || !title) {
  console.error('Usage: node fetch-one-amdm.mjs "Artist" "Title"');
  process.exit(1);
}

const searchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(`${artist} ${title}`)}`;
console.log('Search URL (open manually or implement fetch):', searchUrl);

const out = {
  title,
  artist,
  chords: 'C G Am F',
  lyrics: '',
  genre: 'AmDm',
  difficulty: 1,
  _note: 'Replace with ChordPro from your parser; do not commit scraped bulk.',
};

writeFileSync('import-chord-song.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote import-chord-song.json (placeholder). Implement HTML→ChordPro in this script or external repo.');
