/**
 * Ingest real track metadata from MusicBrainz → assets/metadata/chunk-*.json
 *
 * Rate limit: 1 req/s. User-Agent required by MusicBrainz.
 *
 *   node tools/ingest-musicbrainz-metadata.mjs --target=5000 --limit-artists=200
 *   node tools/ingest-musicbrainz-metadata.mjs --resume
 *   node tools/ingest-musicbrainz-metadata.mjs --target=500 --limit-artists=10  # smoke test
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
const CHECKPOINT_PATH = join(ROOT, 'tools/.metadata-ingest-checkpoint.json');
const SEED_PATH = join(ROOT, 'data/seed-artists-mb.json');
const SONG_DB_PATH = join(ROOT, 'src/data/songDatabase.ts');
const MANIFEST_TS = join(ROOT, 'src/metadata/bundledChunks.ts');
const BUNDLED_VERSION = 'mb-5000-v1';

const UA =
  process.env.MB_USER_AGENT ||
  'RecoTune/1.0.0 (https://github.com/lev/RecoTune; metadata-ingest@recotune.local)';

const MB_ROOT = 'https://musicbrainz.org/ws/2';
const RATE_MS = 1100;

function parseArgs(argv) {
  const opts = {
    target: 5000,
    limitArtists: 200,
    maxPagesPerArtist: 8,
    chunkSize: 1750,
    resume: false,
    dryRun: false,
  };
  for (const a of argv) {
    if (a === '--resume') opts.resume = true;
    if (a === '--dry-run') opts.dryRun = true;
    const m = a.match(/^--target=(\d+)$/);
    if (m) opts.target = Number(m[1]);
    const la = a.match(/^--limit-artists=(\d+)$/);
    if (la) opts.limitArtists = Number(la[1]);
    const mp = a.match(/^--max-pages=(\d+)$/);
    if (mp) opts.maxPagesPerArtist = Number(mp[1]);
    const cs = a.match(/^--chunk-size=(\d+)$/);
    if (cs) opts.chunkSize = Number(cs[1]);
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
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
    },
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

function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'x';
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

function loadSeedArtists(limit) {
  const list = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const seen = new Set();
  const out = [];
  for (const name of list) {
    const n = String(name).trim();
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveCheckpoint(data) {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 0));
}

function artistRow(mbid, name) {
  return {
    id: `mba_${mbid}`,
    name,
    sortName: name,
    mbid,
    searchText: '',
  };
}

function trackRow(rec, artistName, artistId, builtinByKey) {
  const title = (rec.title || '').trim();
  if (!title || title.length < 2) return null;
  if (/^track\s*\d+$/i.test(title)) return null;

  const { album, year } = rec._album
    ? { album: rec._album, year: rec._year ?? null }
    : pickAlbum(rec.releases);
  const key = normKey(artistName, title);
  const builtinSongId = builtinByKey.get(key) ?? null;

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
    builtinSongId,
  };
}

async function resolveArtist(name) {
  const data = await mbFetch('/artist', {
    query: `artist:"${name.replace(/"/g, '')}"`,
    limit: 5,
  });
  const artists = data.artists || [];
  if (!artists.length) return null;

  const exact = artists.find(
    a => a.name?.toLowerCase() === name.toLowerCase(),
  );
  const pick = exact || artists[0];
  return { mbid: pick.id, name: pick.name };
}

/** Releases + embedded recordings (album/year from release). */
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

function writeChunks(tracks, artistsMap, chunkSize, target) {
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

  writeManifest(paths, tracks.length, target);
  return paths;
}

function writeManifest(chunkFiles, totalTracks, target) {
  const requires = chunkFiles
    .map((f, i) => `  require('../../assets/metadata/${f}')${i < chunkFiles.length - 1 ? ',' : ''}`)
    .join('\n');

  const ts = `/** Auto-generated by tools/ingest-musicbrainz-metadata.mjs — do not edit manually */
import type { MetadataBatchPayload } from './types';

export const METADATA_BUNDLED_VERSION = '${BUNDLED_VERSION}';
export const METADATA_BUNDLED_TOTAL_HINT = ${totalTracks};

let cachedChunks: MetadataBatchPayload[] | null = null;

export function getBundledMetadataChunks(): MetadataBatchPayload[] {
  if (!cachedChunks) {
    cachedChunks = [
${requires}
    ];
  }
  return cachedChunks;
}
`;
  writeFileSync(MANIFEST_TS, ts);
  console.log(`  manifest: ${MANIFEST_TS} (${chunkFiles.length} chunks, hint=${totalTracks})`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('MusicBrainz metadata ingest', opts);

  const builtinByKey = loadBuiltinIndex();
  const seedNames = loadSeedArtists(opts.limitArtists);

  let state = opts.resume ? loadCheckpoint() : null;
  if (!state) {
    state = {
      artistIndex: 0,
      tracks: [],
      artists: {},
      seenMbids: {},
      seenKeys: {},
      stats: { artistsOk: 0, artistsMiss: 0, requests: 0 },
    };
  }

  const artistsMap = new Map(Object.entries(state.artists).map(([k, v]) => [k, v]));

  for (let i = state.artistIndex; i < seedNames.length; i++) {
    if (state.tracks.length >= opts.target) break;

    const seedName = seedNames[i];
    process.stdout.write(`[${i + 1}/${seedNames.length}] ${seedName} … `);

    try {
      const resolved = await resolveArtist(seedName);
      if (!resolved) {
        console.log('not found');
        state.stats.artistsMiss += 1;
        state.artistIndex = i + 1;
        saveCheckpoint({ ...state, artists: Object.fromEntries(artistsMap) });
        continue;
      }

      const { mbid, name } = resolved;
      const artistId = `mba_${mbid}`;
      if (!artistsMap.has(artistId)) {
        artistsMap.set(artistId, artistRow(mbid, name));
      }

      const recordings = await fetchArtistRecordings(mbid, opts.maxPagesPerArtist);
      let added = 0;

      for (const rec of recordings) {
        if (state.tracks.length >= opts.target) break;
        if (state.seenMbids[rec.id]) continue;

        const row = trackRow(rec, name, artistId, builtinByKey);
        if (!row) continue;

        const dk = normKey(row.artistName, row.title);
        if (state.seenKeys[dk]) continue;

        state.seenMbids[rec.id] = 1;
        state.seenKeys[dk] = 1;
        state.tracks.push(row);
        added += 1;
      }

      state.stats.artistsOk += 1;
      console.log(`+${added} (total ${state.tracks.length})`);
    } catch (e) {
      console.log(`error: ${e.message}`);
      saveCheckpoint({
        ...state,
        artistIndex: i,
        artists: Object.fromEntries(artistsMap),
      });
      throw e;
    }

    state.artistIndex = i + 1;
    saveCheckpoint({
      ...state,
      artists: Object.fromEntries(artistsMap),
    });
  }

  const total = state.tracks.length;
  console.log(`\nIngested ${total} tracks from ${state.stats.artistsOk} artists (${state.stats.artistsMiss} misses)`);

  if (total < opts.target) {
    console.warn(`Warning: below target ${opts.target}. Add seed artists or raise --max-pages.`);
  }

  if (opts.dryRun) {
    console.log('Dry run — chunks not written.');
    return;
  }

  console.log('\nWriting chunks:');
  writeChunks(state.tracks, artistsMap, opts.chunkSize, opts.target);

  let totalBytes = 0;
  for (const f of readdirSync(OUT_DIR).filter(x => x.endsWith('.json'))) {
    totalBytes += readFileSync(join(OUT_DIR, f)).length;
  }
  console.log(`Total JSON size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);

  if (existsSync(CHECKPOINT_PATH)) unlinkSync(CHECKPOINT_PATH);
  console.log('Done. Restart Expo to pick up new bundledChunks.ts');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
