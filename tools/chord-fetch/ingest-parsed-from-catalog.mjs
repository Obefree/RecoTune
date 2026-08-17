#!/usr/bin/env node
/**
 * Fill PC parsed-chord store from metadata catalog (skips songs already in store).
 * Resume: tools/.amdm-store-ingest-checkpoint.json or tools/.ug-store-ingest-checkpoint.json
 *
 *   node tools/chord-fetch/ingest-parsed-from-catalog.mjs --resume
 *   node tools/chord-fetch/ingest-parsed-from-catalog.mjs --source=ug --resume
 *   node tools/chord-fetch/ingest-parsed-from-catalog.mjs --limit=50
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAmdmChordPro } from './amdmFetch.mjs';
import { fetchUgChordPro } from './ugFetch.mjs';
import { lookupParsedChord, rememberParsedChord, parsedStoreStats } from './parsedChordStore.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '../..');
const AMDM_CHECKPOINT = join(ROOT, 'tools/.amdm-store-ingest-checkpoint.json');
const UG_CHECKPOINT = join(ROOT, 'tools/.ug-store-ingest-checkpoint.json');
const AMDM_RATE_MS = Number(process.env.AMDM_INGEST_MS || 2200);
const UG_RATE_MS = Number(process.env.UG_INGEST_MS || 8000);

function parseArgs(argv) {
  const o = { resume: false, limit: 0, offset: 0, source: 'amdm' };
  for (const a of argv) {
    let m;
    if (a === '--resume') o.resume = true;
    else if ((m = a.match(/^--limit=(\d+)$/))) o.limit = Number(m[1]);
    else if ((m = a.match(/^--offset=(\d+)$/))) o.offset = Number(m[1]);
    else if ((m = a.match(/^--source=(amdm|ug)$/))) o.source = m[1];
  }
  return o;
}

function loadTracks() {
  const tracks = [];
  for (const f of ['01', '02', '03']) {
    const chunk = JSON.parse(readFileSync(join(ROOT, `assets/metadata/chunk-${f}.json`), 'utf8'));
    for (const t of chunk.tracks ?? []) {
      if (t?.artistName && t?.title) tracks.push({ artist: t.artistName, title: t.title, id: t.id });
    }
  }
  return tracks;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const source = opts.source === 'ug' ? 'ug' : 'amdm';
  const tag = source === 'ug' ? 'ug-store' : 'amdm-store';
  const checkpoint = source === 'ug' ? UG_CHECKPOINT : AMDM_CHECKPOINT;
  const rateMs = source === 'ug' ? UG_RATE_MS : AMDM_RATE_MS;
  const fetchOne = source === 'ug' ? fetchUgChordPro : fetchAmdmChordPro;
  const provider = source === 'ug' ? 'ultimate_guitar' : 'amdm';

  function loadCp() {
    try {
      if (existsSync(checkpoint)) return JSON.parse(readFileSync(checkpoint, 'utf8'));
    } catch { /* ignore */ }
    return { index: 0, ok: 0, skip: 0, fail: 0 };
  }
  function saveCp(cp) {
    writeFileSync(checkpoint, JSON.stringify(cp));
  }

  const tracks = loadTracks();
  const cp = opts.resume ? loadCp() : { index: opts.offset, ok: 0, skip: 0, fail: 0 };
  if (!opts.resume && opts.offset) cp.index = opts.offset;
  const end = opts.limit > 0 ? Math.min(tracks.length, cp.index + opts.limit) : tracks.length;
  console.log(`[${tag}] ${tracks.length} catalog tracks, start @ ${cp.index}, end ${end}`);
  console.log(`[${tag}] already in store`, parsedStoreStats().songs);
  let consecutiveBlocks = 0;

  for (let i = cp.index; i < end; i++) {
    const t = tracks[i];
    cp.index = i;
    if (lookupParsedChord(t.artist, t.title)) {
      cp.skip++;
      if (i % 50 === 0) saveCp(cp);
      continue;
    }
    try {
      const result = await fetchOne(t.artist, t.title);
      if (result?.chordPro && !result.stub) {
        rememberParsedChord({
          artist: t.artist,
          title: t.title,
          chordPro: result.chordPro,
          sourceUrl: result.sourceUrl,
          provider,
        });
        cp.ok++;
        consecutiveBlocks = 0;
        console.log(`+ ${t.artist} — ${t.title}`);
      } else {
        cp.fail++;
        if (result?.code === 'ultimate_api_down' || result?.code === 'blocked') {
          consecutiveBlocks++;
          console.log(`! ${result.error}`);
          saveCp(cp);
          if (consecutiveBlocks >= 5) {
            console.log(`[${tag}] stopping after ${consecutiveBlocks} blocks — resume later`);
            process.exit(1);
          }
          const wait = Math.min(120_000, 20_000 * consecutiveBlocks);
          console.log(`[${tag}] Cloudflare backoff ${wait}ms`);
          await sleep(wait);
        }
        if (cp.fail % 20 === 1) console.log(`· miss ${t.artist} — ${t.title}`);
      }
    } catch (e) {
      cp.fail++;
      console.log(`! ${t.artist} — ${t.title}: ${e.message}`);
    }
    saveCp(cp);
    await sleep(rateMs);
    if ((cp.ok + cp.fail) % 25 === 0) {
      console.log(`[${tag}] i=${i} ok=${cp.ok} skip=${cp.skip} fail=${cp.fail} store=${parsedStoreStats().songs}`);
    }
  }
  cp.index = end;
  saveCp(cp);
  console.log(`[${tag}] done ok=${cp.ok} skip=${cp.skip} fail=${cp.fail}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
