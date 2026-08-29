/**
 * Quick check for chordLyricsNormalize.
 * Run: node tools/verify-chord-normalize.mjs
 * (Logic lives in tools/lib/chordNormalize.mjs — a Node mirror of the TS source.)
 */

import {
  normalizeLyricsChords,
  isVerifiedChordProLyrics,
  isTabArchiveDumpLyrics,
} from './lib/chordNormalize.mjs';

const creep =
  "When you were here before\nG\nCouldn't look you in the eye";
const creepOut = normalizeLyricsChords(creep, { allowMerge: true });

const creepFeather = normalizeLyricsChords(
  'G B C Cm\nYou float like a feather\nIn a beautiful world',
  { allowMerge: true },
);
const creepChorus = normalizeLyricsChords("But I'm a creep");
const creepChorusMerge = normalizeLyricsChords("G\nBut I'm a creep", { allowMerge: true });
const creepChorusBad = normalizeLyricsChords("But [G]I'm a creep");
const creepChorusCurly = normalizeLyricsChords('But [G]I\u2019m a creep');
const creepMergeBad = normalizeLyricsChords("G\nBut [G]I'm a creep", { allowMerge: true });
const csharpLine = normalizeLyricsChords('C#\nHello world', { allowMerge: true });
const bbLine = normalizeLyricsChords('Bb\nShe loves you', { allowMerge: true });
// German/Russian H (=B) used on AmDm / pesni.ru — must be recognized as a chord.
const hmLine = normalizeLyricsChords('Hm\nМного дней грустил', { allowMerge: true });
const hRow = normalizeLyricsChords('A G Hm D\nраз два три четыре', { allowMerge: true });
const hVerified = isVerifiedChordProLyrics(
  normalizeLyricsChords('Hm\nМного дней грустил\nEm\nНе знал народ', { allowMerge: true }),
);

const tests = [
  ['creep no [e]', !/\[e\]/i.test(creepOut)],
  ['creep has [G]', /\[G\]/i.test(creepOut)],
  ['creep single G line', creepOut.includes("[G]Couldn't") && !/\[G\]look/i.test(creepOut)],
  ['paren Am', normalizeLyricsChords('(Am) over you') === '[Am] over you'],
  [
    'chord line',
    (() => {
      const o = normalizeLyricsChords('G B C\nHello world', { allowMerge: true });
      return o.includes('[G]Hello') && !/\[e\]/.test(o);
    })(),
  ],
  ['Cant', !normalizeLyricsChords("Can't stop").includes('[C]')],
  ['feather no [a]', !/\[a\]/i.test(creepFeather)],
  ['feather chord line', /\[G\].*\[Cm\]/.test(creepFeather.split('\n')[0])],
  ['chorus no [a]', !/\[a\]/i.test(creepChorus)],
  [
    'creep chorus merge',
    creepChorusMerge === "But I'm a [G]creep" && !/\[G\]I'm/i.test(creepChorusMerge),
  ],
  [
    'creep chorus reposition',
    creepChorusBad === "But I'm a [G]creep" && !/\[G\]I'm/i.test(creepChorusBad),
  ],
  [
    'strip [a] creep line',
    normalizeLyricsChords('But [G]I\'m [a] creep') === "But I'm a [G]creep",
  ],
  [
    'creep curly apostrophe',
    creepChorusCurly === "But I'm a [G]creep" && !/\[G\]I/i.test(creepChorusCurly),
  ],
  [
    'creep merge bad inline',
    creepMergeBad === "But I'm a [G]creep" && !/\[G\]\[G\]/i.test(creepMergeBad),
  ],
  ['C# chord line', csharpLine.includes('[C#]Hello') && !/\[C\]#/i.test(csharpLine)],
  ['Bb chord line', bbLine.includes('[Bb]She') && !/\[B\]b/i.test(bbLine)],
  [
    'A chord line',
    (() => {
      const merged = normalizeLyricsChords('A\nVerse', { allowMerge: true });
      const row = normalizeLyricsChords('A D E', { allowMerge: true });
      return merged.includes('[A]Verse') && /\[A\].*\[D\].*\[E\]/.test(row) && !/\[a\]/.test(row);
    })(),
  ],
  [
    'keep [A] bracket',
    normalizeLyricsChords('[A]Hello') === '[A]Hello',
  ],
  [
    'feather article lowercase',
    !/\[a\]/i.test(normalizeLyricsChords('like a feather', { allowMerge: true })),
  ],
  ['H7 stays a chord', normalizeLyricsChords('[H7]слово другое') === '[H7]слово другое'],
  ['Hm7/5- stays a chord', normalizeLyricsChords('[Hm7/5-]слово другое') === '[Hm7/5-]слово другое'],
  ['A7sus4 stays a chord', normalizeLyricsChords('[A7sus4]слово другое') === '[A7sus4]слово другое'],
  ['D6sus2 stays a chord', normalizeLyricsChords('[D6sus2]слово другое') === '[D6sus2]слово другое'],
  ['Dmadd9 stays a chord', normalizeLyricsChords('[Dmadd9]слово другое') === '[Dmadd9]слово другое'],
  ['Em11 stays a chord', normalizeLyricsChords('[Em11]слово другое') === '[Em11]слово другое'],
  ['Fdim9 stays a chord', normalizeLyricsChords('[Fdim9]слово другое') === '[Fdim9]слово другое'],
  ['Dsus9 stays a chord', normalizeLyricsChords('[Dsus9]слово другое') === '[Dsus9]слово другое'],
  ['E79 stays a chord', normalizeLyricsChords('[E79]слово другое') === '[E79]слово другое'],
  ['Cmaj7 stays a chord', normalizeLyricsChords('[Cmaj7]слово другое') === '[Cmaj7]слово другое'],
  ['Am/G stays a chord', normalizeLyricsChords('[Am/G]слово другое') === '[Am/G]слово другое'],
  ['Dm(V) stays a chord', normalizeLyricsChords('[Dm(V)]слово другое') === '[Dm(V)]слово другое'],
  ['G1 is not a chord', normalizeLyricsChords('[G1]слово другое') === 'G1слово другое'],
  ['A320 is not a chord', normalizeLyricsChords('[A320]слово другое') === 'A320слово другое'],
  ['H chord line', hmLine.includes('[Hm]Много')],
  ['H in chord row', /\[A\].*\[G\].*\[Hm\].*\[D\]/.test(hRow.split('\n')[0])],
  ['H tab verifies', hVerified === true],
  [
    'column merge spaced pesni',
    (() => {
      const o = normalizeLyricsChords(
        '[Am]                         [E]\nЯ буду сильным без ваших долбаных машин',
      );
      return (
        /\[Am\]Я/.test(o) &&
        /\[E\]/.test(o) &&
        !o.split('\n').some(l => /^\s*\[Am\]\s+\[E\]\s*$/.test(l))
      );
    })(),
  ],
  [
    'spread when fewer chords than words',
    (() => {
      const o = normalizeLyricsChords(
        'Am E\nЯ буду сильным без ваших долбаных машин',
        { allowMerge: true },
      );
      return /\[Am\]Я/.test(o) && /\[E\]машин/.test(o);
    })(),
  ],
  [
    'Hm7/5- chord row merges',
    (() => {
      const o = normalizeLyricsChords('Hm7/5- Am\nТёмная ночь и тишина', { allowMerge: true });
      return /\[Hm7\/5-\]/.test(o) && /\[Am\]/.test(o) && o.split('\n').length === 1;
    })(),
  ],
  ['[Chorus] is not a chord marker', !isVerifiedChordProLyrics('[Chorus] hello there\n[Verse] more words here')],
  ['real chords still verify', isVerifiedChordProLyrics('[Am]hello there friend\n[G]more lyric words')],
  ['tab dump PLEASE NOTE rejected', !isVerifiedChordProLyrics('#----------------PLEASE NOTE----------------\nBand: X\nSong: [A] Y\nLine one\nLine two')],
  ['tab dump Band:/Song: rejected', !isVerifiedChordProLyrics('Band: Coldplay\nSong: Ghost\n[A] one two\n[B] three four')],
  ['isTabArchiveDumpLyrics', isTabArchiveDumpLyrics('#---PLEASE NOTE---\ninterpretation') === true],
];

console.log('Output:\n' + creepOut + '\n');
console.log('Feather:\n' + creepFeather + '\n');
let failed = 0;
for (const [name, pass] of tests) {
  console.log((pass ? 'PASS' : 'FAIL') + ' ' + name);
  if (!pass) failed++;
}
process.exit(failed ? 1 : 0);
