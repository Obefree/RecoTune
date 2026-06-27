#!/usr/bin/env node
/**
 * Ensures local dev servers for RecoTune: chord-fetch (:8787) + stem-separate (:8788).
 * Used by `npm start` / `npm run dev:all` before Expo.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScript(relPath) {
  return new Promise((resolve, reject) => {
    const script = path.join(root, relPath);
    const child = spawn(process.execPath, [script], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${relPath} exited with ${code}`));
    });
  });
}

async function main() {
  await runScript('tools/chord-fetch/chords-dev.mjs');
  await runScript('tools/stem-separate/stems-dev.mjs');
  console.log('[dev:all] chord :8787 + stems :8788 ready (or warned)');
}

main().catch(err => {
  console.error('[dev:all]', err);
  process.exit(1);
});
