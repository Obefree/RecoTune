/**
 * One-off / maintenance: export LEGACY_ARCHIVE_SONGS → assets/archive/legacy-songs-536.json
 * Run: node tools/export-legacy-catalog.mjs  (from repo root; requires built TS or use tsx on .ts variant)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyPath = path.join(root, 'src', 'data', 'legacySongDatabase.ts');

// Dynamic import via tsx if available; fallback: instruct user
async function main() {
  try {
    const { LEGACY_ARCHIVE_SONGS } = await import('../src/data/legacySongDatabase.ts');
    const outDir = path.join(root, 'assets', 'archive');
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
  } catch (e) {
    console.error('Run with: npx tsx tools/export-legacy-catalog.ts');
    console.error(e);
    process.exit(1);
  }
}

main();
