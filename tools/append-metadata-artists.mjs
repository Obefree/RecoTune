/**
 * Append MusicBrainz tracks for named artists into existing bundled chunks.
 * Keeps current catalog, adds new artists (e.g. Мельница) without full re-ingest.
 *
 *   node tools/append-metadata-artists.mjs
 *   node tools/append-metadata-artists.mjs --artists="Мельница,Калинов Мост"
 *   node tools/append-metadata-artists.mjs --max-total=5200 --dry-run
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets/metadata');
const SUPPLEMENT_PATH = join(ROOT, 'data/metadata-supplement-artists.json');
const SONG_DB_PATH = join(ROOT, 'src/data/songDatabase.ts');
const MANIFEST_TS = join(ROOT, 'src/metadata/bundledChunks.ts');
const BUNDLED_VERSION = 'mb-5200-v2';

const UA =
  process.env.MB_USER_AGENT ||
  'RecoTune/1.0.0 (https://github.com/lev/RecoTune; metadata-append@recotune.local)';

const MB_ROOT = 'https://musicbrainz.org/ws/2';
const RATE_MS = 1100;

function parseArgs(argv) {
  const opts = {
    maxTotal: 5200,
    maxPagesPerArtist: 6,
    chunkSize: 1750,
    dryRun: false,
    artists: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') opts.dryRun = true;
    const m = a.match(/^--max-total=(\d+)$/);
    if (m) opts.maxTotal = Number(m[1]);
    const mp = a.match(/^--max-pages=(\d+)$/);
    if (mp) opts.maxPagesPerArtist = Number(mp[1]);
    const cs = a.match(/^--chunk-size=(\d+)$/);
    if (cs) opts.chunkSize = Number(cs[1]);
    const ar = a.match(/^--artists=(.+)$/);
    if (ar) opts.artists = ar[1].split(',').map(s => s.trim()).filter(Boolean);
  }
  return opts;
}

let lastReqAt = 0;

async function mbFetch(path, params = {}) {
  const now = Date.now();
  const wait = RATE_MS - (now - lastReqAt);
  if (wait > 0) await sleep(wait);
  lastReqAt = Date.now();

  const q = new URLSearchParams({ fmt: 'json', ...params });
  const url = `${MB_ROOT}${path}?${q}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (res.status === 503) {
    await sleep(3000);
    return mbFetch(path, params);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MusicBrainz ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function normKey(artist, title) {
  return `${artist}|||${title}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseYear(date) {
  if (!date || typeof date !== 'string') return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) && y > 1900 && y < 2100 ? y : null;
}

function pickAlbum(releases) {
  if (!releases?.length) return { album: null, year: null };
  const official = releases.find(r => r.status === 'Official') || releases[0];
  return {
    album: official.title?.trim() || null,
    year: parseYear(official.date),
  };
}

function loadBuiltinIndex() {
  const raw = readFileSync(SONG_DB_PATH, 'utf8');
  const entryRe = /\{\s*id:'([^']+)',\s*title:'([^']*)',\s*artist:'([^']*)'/g;
  const byKey = new Map();
  let m;
  while ((m = entryRe.exec(raw)) !== null) {
    byKey.set(normKey(m[3], m[2]), m[1]);
  }
  return byKey;
}

function loadExistingCatalog() {
  const tracks = [];
  const artists = new Map();
  const seenMbids = new Set();
  const seenKeys = new Set();

  for (const f of readdirSync(OUT_DIR).filter(x => /^chunk-\d+\.json$/i.test(x))) {
    const payload = JSON.parse(readFileSync(join(OUT_DIR, f), 'utf8'));
    for (const a of payload.artists || []) artists.set(a.id, a);
    for (const t of payload.tracks || []) {
      if (seenMbids.has(t.mbid || t.id)) continue;
      const dk = normKey(t.artistName, t.title);
      if (seenKeys.has(dk)) continue;
      seenMbids.add(t.mbid || t.id);
      seenKeys.add(dk);
      tracks.push(t);
    }
  }
  return { tracks, artists, seenMbids, seenKeys };
}

function artistRow(mbid, name) {
  return { id: `mba_${mbid}`, name, sortName: name, mbid, searchText: '' };
}

function trackRow(rec, artistName, artistId, builtinByKey) {
  const title = (rec.title || '').trim();
  if (!title || title.length < 2) return null;
  if (/^track\s*\d+$/i.test(title)) return null;
  const { album, year } = rec._album
    ? { album: rec._album, year: rec._year ?? null }
    : pickAlbum(rec.releases);
  const key = normKey(artistName, title);
  return {
    id: `mb_${rec.id}`,
    artistId,
    artistName,
    title,
    album,
    year,
    durationMs: rec.length ?? null,
    mbid: rec.id,
    searchText: '',
    builtinSongId: builtinByKey.get(key) ?? null,
  };
}

async function resolveArtist(name) {
  const data = await mbFetch('/artist', {
    query: `artist:"${name.replace(/"/g, '')}"`,
    limit: 5,
  });
  const artists = data.artists || [];
  if (!artists.length) return null;
  const exact = artists.find(a => a.name?.toLowerCase() === name.toLowerCase());
  const pick = exact || artists[0];
  return { mbid: pick.id, name: pick.name };
}

async function fetchArtistRecordings(artistMbid, maxPages) {
  const all = [];
  const limit = 100;
  for (let page = 0; page < maxPages; page++) {
    const offset = page * limit;
    const data = await mbFetch('/release', {
      artist: artistMbid,
      limit: String(limit),
      offset: String(offset),
      inc: 'recordings',
    });
    const releases = data.releases || [];
    if (!releases.length) break;
    for (const rel of releases) {
      const { album, year } = pickAlbum([rel]);
      for (const medium of rel.media || []) {
        for (const tr of medium.tracks || []) {
          const rec = tr.recording;
          if (!rec?.id) continue;
          all.push({
            id: rec.id,
            title: (rec.title || tr.title || '').trim(),
            length: rec.length ?? null,
            releases: [{ title: album, date: rel.date, status: rel.status }],
            _year: year,
            _album: album,
          });
        }
      }
    }
    if (releases.length < limit) break;
  }
  return all;
}

function writeChunks(tracks, artistsMap, chunkSize) {
  mkdirSync(OUT_DIR, { recursive: true });
  const old = readdirSync(OUT_DIR).filter(f => f.startsWith('chunk-') && f.endsWith('.json'));
  for (const f of old) unlinkSync(join(OUT_DIR, f));

  const artists = [...artistsMap.values()];
  const chunkCount = Math.max(1, Math.ceil(tracks.length / chunkSize));
  const paths = [];

  for (let i = 0; i < chunkCount; i++) {
    const slice = tracks.slice(i * chunkSize, (i + 1) * chunkSize);
    const artistIds = new Set(slice.map(t => t.artistId));
    const chunkArtists = artists.filter(a => artistIds.has(a.id));
    const payload = {
      cursor: i,
      nextCursor: i + 1 < chunkCount ? i + 1 : null,
      totalHint: tracks.length,
      artists: chunkArtists,
      tracks: slice,
    };
    const name = `chunk-${String(i + 1).padStart(2, '0')}.json`;
    const path = join(OUT_DIR, name);
    writeFileSync(path, JSON.stringify(payload));
    paths.push(name);
    const mb = (readFileSync(path).length / (1024 * 1024)).toFixed(2);
    console.log(`  ${name}: ${slice.length} tracks, ${mb} MB`);
  }

  const requires = paths
    .map((f, i) => `  require('../../assets/metadata/${f}')${i < paths.length - 1 ? ',' : ''}`)
    .join('\n');
  const ts = `/** Auto-generated by tools/append-metadata-artists.mjs — do not edit manually */
import type { MetadataBatchPayload } from './types';

export const METADATA_BUNDLED_VERSION = '${BUNDLED_VERSION}';
export const METADATA_BUNDLED_TOTAL_HINT = ${tracks.length};

export const BUNDLED_METADATA_CHUNKS: MetadataBatchPayload[] = [
${requires}
];
`;
  writeFileSync(MANIFEST_TS, ts);
  console.log(`  manifest: ${MANIFEST_TS} (${paths.length} chunks, hint=${tracks.length})`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const names =
    opts.artists ??
    JSON.parse(readFileSync(SUPPLEMENT_PATH, 'utf8')).filter(
      (n, i, a) => a.indexOf(n) === i,
    );

  console.log('Append metadata artists', { names: names.length, maxTotal: opts.maxTotal });

  const builtinByKey = loadBuiltinIndex();
  const { tracks, artists, seenMbids, seenKeys } = loadExistingCatalog();
  console.log(`Existing: ${tracks.length} tracks, ${artists.size} artists`);

  let added = 0;
  for (const seedName of names) {
    if (tracks.length >= opts.maxTotal) break;
    process.stdout.write(`${seedName} … `);
    try {
      const resolved = await resolveArtist(seedName);
      if (!resolved) {
        console.log('not found');
        continue;
      }
      const { mbid, name } = resolved;
      const artistId = `mba_${mbid}`;
      if (!artists.has(artistId)) artists.set(artistId, artistRow(mbid, name));

      const recordings = await fetchArtistRecordings(mbid, opts.maxPagesPerArtist);
      let artistAdded = 0;
      for (const rec of recordings) {
        if (tracks.length >= opts.maxTotal) break;
        if (seenMbids.has(rec.id)) continue;
        const row = trackRow(rec, name, artistId, builtinByKey);
        if (!row) continue;
        const dk = normKey(row.artistName, row.title);
        if (seenKeys.has(dk)) continue;
        seenMbids.add(rec.id);
        seenKeys.add(dk);
        tracks.push(row);
        artistAdded += 1;
        added += 1;
      }
      console.log(`+${artistAdded} (total ${tracks.length})`);
    } catch (e) {
      console.log(`error: ${e.message}`);
      throw e;
    }
  }

  console.log(`\nAdded ${added} tracks → ${tracks.length} total`);

  if (opts.dryRun) {
    console.log('Dry run — chunks not written.');
    return;
  }

  console.log('\nWriting chunks:');
  writeChunks(tracks, artists, opts.chunkSize);
  console.log('Done. Restart Expo to pick up bundledChunks.ts');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
