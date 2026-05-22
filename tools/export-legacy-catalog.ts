import fs from 'fs';
import path from 'path';

import { LEGACY_ARCHIVE_SONGS } from './legacySongDatabase.snapshot';
import { hasAnnotatedLyrics } from '../src/utils/songContent';

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'archive');

function main(): void {
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString().slice(0, 10),
    note: 'Full builtin catalog before 2026-05-22 minimal seed. Lyrics quality mixed; not for default practice.',
    count: LEGACY_ARCHIVE_SONGS.length,
    songs: LEGACY_ARCHIVE_SONGS,
  };
  const outFile = path.join(outDir, 'legacy-songs-536.json');
  fs.writeFileSync(outFile, JSON.stringify(payload));
  console.log(`Wrote ${outFile} (${payload.count} songs)`);

  const seedSongs = LEGACY_ARCHIVE_SONGS.filter(s => hasAnnotatedLyrics(s.lyrics)).slice(0, 32);
  const seedPath = path.join(root, 'src', 'data', 'builtinSongsSeed.ts');
  const seedJson = JSON.stringify(seedSongs, null, 2);
  const seedBody =
    '/** Default practice builtin seed — ChordPro-quality lyrics only (~32 songs). */\n' +
    "import type { SongEntry } from './songDatabase';\n\n" +
    `export const BUILTIN_SONGS_SEED: SongEntry[] = ${seedJson} as SongEntry[];\n`;
  fs.writeFileSync(seedPath, seedBody);
  console.log(`Wrote ${seedPath} (${seedSongs.length} songs, inlined)`);
}

main();
