/**
 * Song content gate + catalog match checks (D8).
 * Run: node tools/verify-song-content.mjs
 */
import {
  isVerifiedChordProLyrics,
  isTabArchiveDumpLyrics,
} from './lib/chordNormalize.mjs';
import pesni from '../assets/archive/pesni-chordpro.json' with { type: 'json' };

function normalizeSongText(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

function scoreMatch(artist, title, song) {
  const na = normalizeSongText(artist);
  const nt = normalizeSongText(title);
  const sa = normalizeSongText(song.artist);
  const st = normalizeSongText(song.title);
  if (!nt || !st) return 0;
  let score = 0;
  if (nt === st) score += 100;
  else if (st.includes(nt) || nt.includes(st)) score += 70;
  else {
    const minLen = Math.min(nt.length, st.length);
    if (minLen >= 4 && (st.startsWith(nt.slice(0, minLen)) || nt.startsWith(st.slice(0, minLen)))) {
      score += 40;
    }
  }
  if (na && sa) {
    if (na === sa) score += 50;
    else if (sa.includes(na) || na.includes(sa)) score += 30;
  } else if (!na || na === 'unknown') score += 10;
  return score;
}

function findBestSongMatch(artist, title, songs, minScore = 90) {
  let best = null;
  let bestScore = 0;
  for (const s of songs) {
    const sc = scoreMatch(artist, title, s);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return bestScore >= minScore ? { song: best, score: bestScore } : null;
}

function findVerifiedCatalogMatch(artist, title, songs, minScore = 130) {
  const verified = songs.filter(s => isVerifiedChordProLyrics(s.lyrics));
  const hit = findBestSongMatch(artist, title, verified, minScore);
  if (!hit) return null;
  const { song: match } = hit;
  const nt = normalizeSongText(title);
  const st = normalizeSongText(match.title);
  if (nt && st && nt !== st && !st.includes(nt) && !nt.includes(st)) return null;
  const na = normalizeSongText(artist);
  const sa = normalizeSongText(match.artist);
  if (na && sa && na !== sa && !sa.includes(na) && !na.includes(sa)) return null;
  return hit;
}

const fixYouLyrics = `When you try your best but you don't [C]succeed
When you get what you [Em]want but not what you [Am]need
When you feel so tired but you can't [F]sleep
Stuck in [C]reverse [Em] [Am] [F]

[C]Lights will guide you [Em]home
[Am]And ignite your [F]bones`;

const ghostDump = pesni.songs.find(s => s.id === 'pesni_ru_a-ghost');

const tests = [
  ['Fix You lyrics verified', isVerifiedChordProLyrics(fixYouLyrics)],
  ['pesni ghost dump rejected', !isVerifiedChordProLyrics(ghostDump?.lyrics ?? '')],
  ['isTabArchiveDumpLyrics ghost', isTabArchiveDumpLyrics(ghostDump?.lyrics ?? '') === true],
];

const catalog = [
  { id: 'meta_fix', title: 'Fix You', artist: 'Coldplay', chords: '', lyrics: '' },
  { id: 's015', title: 'Fix You', artist: 'Coldplay', chords: 'C Em Am F', lyrics: fixYouLyrics },
  ...pesni.songs.filter(s => /coldplay/i.test(s.artist)),
];

const loose = findBestSongMatch('Coldplay', 'Fix You', catalog);
const strict = findVerifiedCatalogMatch('Coldplay', 'Fix You', catalog);
tests.push(['Fix You strict match is s015', strict?.song?.id === 's015']);
tests.push(['Fix You strict score 150', strict?.score === 150]);
if (loose && loose.song.id !== 's015') {
  tests.push(['loose match may differ from strict', true]);
}

const pesniStillVerified = pesni.songs.filter(s => isVerifiedChordProLyrics(s.lyrics)).length;
tests.push(['pesni bundle rejects tab dumps', pesniStillVerified < pesni.songs.length]);

let failed = 0;
for (const [name, ok] of tests) {
  console.log(ok ? 'OK' : 'FAIL', name);
  if (!ok) failed++;
}
console.log(`\npesni verified after gate: ${pesniStillVerified}/${pesni.songs.length}`);
if (strict && strict.song.id !== 's015') {
  console.log('WRONG Fix You match:', strict.song.id, strict.song.title);
}
process.exit(failed ? 1 : 0);
