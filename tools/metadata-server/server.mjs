/**
 * Dev stub: GET /metadata/batch?offset=&limit=
 * Serves bundled chunk JSON from assets/metadata (copy chunks here or symlink).
 *
 *   node tools/metadata-server/server.mjs
 *   # → http://127.0.0.1:8790/metadata/batch?offset=0&limit=500
 */
import http from 'http';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const chunksDir = join(__dirname, '../../assets/metadata');
const PORT = Number(process.env.METADATA_PORT || 8790);

const files = readdirSync(chunksDir)
  .filter(f => f.startsWith('chunk-') && f.endsWith('.json'))
  .sort();

const chunks = files.map(f => JSON.parse(readFileSync(join(chunksDir, f), 'utf8')));

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname !== '/metadata/batch') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(2000, parseInt(url.searchParams.get('limit') ?? '500', 10) || 500);
  const batch = chunks[offset] ?? { artists: [], tracks: [], cursor: offset, nextCursor: null };

  const slice = {
    ...batch,
    cursor: offset,
    nextCursor: offset + 1 < chunks.length ? offset + 1 : null,
    tracks: (batch.tracks ?? []).slice(0, limit),
  };

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(slice));
});

server.listen(PORT, () => {
  console.log(`Metadata stub: http://127.0.0.1:${PORT}/metadata/batch?offset=0&limit=500 (${chunks.length} chunks)`);
});
