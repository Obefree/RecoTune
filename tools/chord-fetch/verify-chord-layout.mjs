/**
 * Offline checks for the shared chords-over-lyrics → inline ChordPro converter.
 * Run: node tools/chord-fetch/verify-chord-layout.mjs
 */
import {
  isChordRowLine,
  plainChordSheetToChordPro,
  splitSectionLabel,
} from './chordLayout.mjs';

const tests = [];
const t = (name, pass) => tests.push([name, pass]);

// Chord row classification.
t('chord row: C G Am', isChordRowLine('C       G        Am'));
t('chord row: fret position Dm(V)', isChordRowLine('Dm(V) C(III) Bb(VI) A(V)'));
t('not chord row: lyric', !isChordRowLine('Сколько лет прошло, провода'));
t('not chord row: empty', !isChordRowLine('   '));

// Column alignment — chord lands above the syllable at its column, not piled up front.
const basic = plainChordSheetToChordPro('C       G        Am\nHello darling world');
t('basic single line', basic.length === 1);
t('basic keeps all chords', /\[C\]/.test(basic[0]) && /\[G\]/.test(basic[0]) && /\[Am\]/.test(basic[0]));
t('basic not piled at front', !/^\[C\]\[G\]\[Am\]/.test(basic[0]));

// AmDm section label glued to first chord row.
const label = splitSectionLabel('[Куплет]:C                  G         Dsus2          Em');
t('split section label', Boolean(label) && label.label === 'Куплет:' && isChordRowLine(label.rest));
const sec = plainChordSheetToChordPro(
  '[Куплет]:C                  G         Dsus2          Em\nСколько лет прошло, все о том же гудят провода,',
);
t('label on its own line', sec[0] === 'Куплет:');
t('lyric under label gets chords', /\[C\]Сколько/.test(sec[1]) && /\[Em\]/.test(sec[1]));

// Fret-position notation keeps the bare chord.
const fret = plainChordSheetToChordPro('Dm(V) C(III) Bb(VI) A(V)    Dm\nЯ искала тебя годами долгими');
t('fret position chords inline', /\[Dm\]Я/.test(fret[0]) && /\[Bb\]/.test(fret[0]) && !/\(V\)/.test(fret[0]));

// Chord-only intro stays a chord-only line.
const intro = plainChordSheetToChordPro('Am  C  G\n\nAm          F\nBut I am a creep');
t('chord only intro', intro[0] === '[Am] [C] [G]');
t('intro then lyric merged', intro.some(l => /\[Am\]But I am a c\[F\]reep/.test(l)));

let failed = 0;
for (const [name, pass] of tests) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name);
  if (!pass) failed++;
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
