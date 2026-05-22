/**
 * Build assets/metadata/legacy/chunk-*.json from songDatabase (demo only).
 *
 * Does NOT touch MusicBrainz chunks in assets/metadata/chunk-*.json.
 * Production catalog: node tools/ingest-musicbrainz-metadata.mjs
 *
 * Run: node tools/generate-metadata-chunks.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const songDbPath = join(root, 'src/data/songDatabase.ts');
const outDir = join(root, 'assets/metadata/legacy');

const raw = readFileSync(songDbPath, 'utf8');
const entryRe = /\{\s*id:'([^']+)',\s*title:'([^']*)',\s*artist:'([^']*)'/g;
const songs = [];
let m;
while ((m = entryRe.exec(raw)) !== null) {
  songs.push({ id: m[1], title: m[2], artist: m[3] });
}

const EXTRA = [
  ['Кино', 'Группа крови', 'Группа крови', 1988, 283000],
  ['Кино', 'Звезда по имени Солнце', 'Звезда по имени Солнце', 1989, 225000],
  ['Баста', 'Сансара', 'Сансара', 2015, 240000],
  ['Земфира', 'Искала', '14 недель греха', 2000, 252000],
  ['Сплин', 'Выхода нет', 'Раздвоение личности', 2001, 278000],
  ['Би-2', 'Полковнику никто не пишет', 'Иномарки', 2006, 265000],
  ['Ленинград', 'Экспонат', 'Вояж', 2015, 198000],
  ['Мумий Тролль', 'Владивосток 2000', 'Морская', 2001, 210000],
  ['Ария', 'Штиль', 'Химера', 2001, 328000],
  ['ДДТ', 'Что такое осень', 'Актриса', 1991, 295000],
  ['Radiohead', 'Creep', 'Pablo Honey', 1993, 238000],
  ['Nirvana', 'Smells Like Teen Spirit', 'Nevermind', 1991, 301000],
  ['Queen', 'Bohemian Rhapsody', 'A Night at the Opera', 1975, 355000],
  ['Led Zeppelin', 'Stairway to Heaven', 'Led Zeppelin IV', 1971, 482000],
  ['Pink Floyd', 'Comfortably Numb', 'The Wall', 1979, 382000],
  ['AC/DC', 'Back In Black', 'Back In Black', 1980, 255000],
  ['Metallica', 'Nothing Else Matters', 'Metallica', 1991, 388000],
  ['Coldplay', 'Yellow', 'Parachutes', 2000, 266000],
  ['Adele', 'Rolling in the Deep', '21', 2010, 228000],
  ['Billie Eilish', 'bad guy', 'When We All Fall Asleep', 2019, 194000],
];

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'x';
}

function buildTracks(slice, offsetBase) {
  const artists = new Map();
  const tracks = [];

  for (let i = 0; i < slice.length; i++) {
    const s = slice[i];
    const artistId = `a_${slug(s.artist)}`;
    if (!artists.has(artistId)) {
      artists.set(artistId, { id: artistId, name: s.artist, sortName: s.artist, mbid: null, searchText: '' });
    }
    const tid = `t_${offsetBase + i}`;
    tracks.push({
      id: tid,
      artistId,
      artistName: s.artist,
      title: s.title,
      album: s.album ?? null,
      year: s.year ?? null,
      durationMs: s.durationMs ?? null,
      mbid: null,
      searchText: '',
      builtinSongId: s.id ?? null,
    });
  }

  return { artists: [...artists.values()], tracks };
}

mkdirSync(outDir, { recursive: true });

const chunkSize = Math.ceil(songs.length / 2);
const chunks = [
  songs.slice(0, chunkSize).map(s => ({ ...s, album: null, year: null, durationMs: null })),
  songs.slice(chunkSize).map(s => ({ ...s, album: null, year: null, durationMs: null })),
  EXTRA.map(([artist, title, album, year, durationMs]) => ({
    artist,
    title,
    album,
    year,
    durationMs,
    id: null,
  })),
];

chunks.forEach((slice, idx) => {
  const { artists, tracks } = buildTracks(slice, idx * 10000);
  const payload = {
    cursor: idx,
    nextCursor: idx + 1 < chunks.length ? idx + 1 : null,
    totalHint: songs.length + EXTRA.length,
    source: 'legacy-songdatabase',
    artists,
    tracks,
  };
  const path = join(outDir, `chunk-0${idx + 1}.json`);
  writeFileSync(path, JSON.stringify(payload));
  console.log(path, 'tracks:', tracks.length, 'artists:', artists.length);
});

console.log('Total builtin parsed:', songs.length);
