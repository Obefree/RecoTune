import { NOTE_NAMES } from './noteUtils';

import type { KeyEstimate } from './melodyAnalysis';

import type { QuantizedNote } from './melodyKeyQuantize';
import { medianInterOnsetMs } from './melodyAnalysis';

const PHRASE_GAP_FALLBACK_MS = 100;



export interface SuggestedChord {

  /** Display symbol, e.g. "Am", "F", "G7" */

  symbol: string;

  roman: string;

  /** Note indices covered by this chord segment */

  noteRange: [number, number];

}



/** Diatonic triads: major key — I ii iii IV V vi vii° */

const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const;

const MAJOR_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim'] as const;



/** Natural minor — i ii° III iv v VI VII */

const MINOR_ROMAN = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] as const;

const MINOR_QUALITIES = ['m', 'dim', '', 'm', 'm', '', ''] as const;



function rootIndex(root: string): number {

  const idx = NOTE_NAMES.indexOf(root);

  if (idx >= 0) return idx;

  const flatMap: Record<string, number> = {

    Db: 1,

    Eb: 3,

    Gb: 6,

    Ab: 8,

    Bb: 10,

  };

  return flatMap[root] ?? 0;

}



function diatonicTriadPcs(root: string, mode: 'major' | 'minor', degree: number): number[] {

  const r = rootIndex(root);

  const majorSteps = [0, 2, 4, 5, 7, 9, 11];

  const minorSteps = [0, 2, 3, 5, 7, 8, 10];

  const steps = mode === 'major' ? majorSteps : minorSteps;

  const d = ((degree - 1) % 7 + 7) % 7;

  const rootPc = (r + steps[d]) % 12;

  const thirdPc = (r + steps[(d + 2) % 7]) % 12;

  const fifthPc = (r + steps[(d + 4) % 7]) % 12;

  return [rootPc, thirdPc, fifthPc];

}



function chordSymbol(root: string, mode: 'major' | 'minor', degree: number): { symbol: string; roman: string } {

  const romans = mode === 'major' ? MAJOR_ROMAN : MINOR_ROMAN;

  const qualities = mode === 'major' ? MAJOR_QUALITIES : MINOR_QUALITIES;

  const d = ((degree - 1) % 7 + 7) % 7;

  const steps = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];

  const r = rootIndex(root);

  const chordRoot = NOTE_NAMES[(r + steps[d]) % 12];

  const q = qualities[d];

  const symbol = q === 'dim' ? `${chordRoot}dim` : `${chordRoot}${q}`;

  return { symbol, roman: romans[d] };

}



function scoreTriad(pcsPresent: number[], triad: number[]): number {

  let score = 0;

  for (const pc of pcsPresent) {

    if (triad.includes(pc)) score += 1;

  }

  return score;

}



/** Prefer V at cadence, I at start, vi for weak endings. */

function cadenceBonus(degree: number, mode: 'major' | 'minor', segIdx: number, segCount: number): number {

  let bonus = 0;

  if (segIdx === 0 && degree === 1) bonus += 2;

  if (segIdx === segCount - 1 && degree === 1) bonus += 3;

  if (segIdx === segCount - 1 && mode === 'major' && degree === 5) bonus += 2;

  if (segIdx === segCount - 1 && mode === 'major' && degree === 6) bonus += 1;

  return bonus;

}



function pickChordForSegment(

  notes: QuantizedNote[],

  start: number,

  end: number,

  key: KeyEstimate,

  segIdx: number,

  segCount: number,

): SuggestedChord {

  const slice = notes.slice(start, end);

  const pcs = slice.map(n => ((n.midi % 12) + 12) % 12);

  const degrees = slice.map(n => n.scaleDegree).filter(d => d > 0);



  let bestDegree = 1;

  let bestScore = -1;



  for (let deg = 1; deg <= 7; deg++) {

    const triad = diatonicTriadPcs(key.root, key.mode, deg);

    let s = scoreTriad(pcs, triad);

    s += cadenceBonus(deg, key.mode, segIdx, segCount);

    if (degrees.includes(deg)) s += 1.5;

    if (slice.length > 0) {

      const firstPc = ((slice[0].midi % 12) + 12) % 12;

      if (triad.includes(firstPc)) s += 1;

    }

    if (s > bestScore) {

      bestScore = s;

      bestDegree = deg;

    }

  }



  const { symbol, roman } = chordSymbol(key.root, key.mode, bestDegree);

  return { symbol, roman, noteRange: [start, end] };

}



function phraseBoundaries(noteCount: number, timestamps: number[]): [number, number][] {
  if (noteCount === 0) return [];
  if (timestamps.length < 2) return [[0, noteCount]];

  const med = medianInterOnsetMs(timestamps);
  const threshold = med > 0 ? med * 1.5 : PHRASE_GAP_FALLBACK_MS;

  const segments: [number, number][] = [];

  let segStart = 0;



  for (let i = 1; i < noteCount; i++) {

    const gap = Math.max(0, timestamps[i] - timestamps[i - 1]);

    if (gap > threshold) {

      segments.push([segStart, i]);

      segStart = i;

    }

  }

  segments.push([segStart, noteCount]);

  return segments;

}



/** Split a long phrase into equal time sub-spans; map each to note index at span start. */

function subdivideByTime(

  start: number,

  end: number,

  timestamps: number[],

  parts: number,

): [number, number][] {

  if (parts <= 1 || end - start <= 1) return [[start, end]];

  const tStart = timestamps[start] ?? 0;

  const tEnd = timestamps[end - 1] ?? tStart;

  const span = Math.max(1, tEnd - tStart);

  const step = span / parts;

  const ranges: [number, number][] = [];



  for (let p = 0; p < parts; p++) {

    const targetT = tStart + p * step;

    let idx = start;

    while (idx < end - 1 && (timestamps[idx] ?? 0) < targetT) idx++;

    const nextTarget = p < parts - 1 ? tStart + (p + 1) * step : Infinity;

    let endIdx = idx + 1;

    while (endIdx < end && (timestamps[endIdx] ?? 0) < nextTarget) endIdx++;

    if (endIdx <= idx) endIdx = Math.min(idx + 1, end);

    ranges.push([idx, endIdx]);

  }



  return ranges.filter(([s, e]) => e > s);

}



function mergeAdjacentRanges(ranges: [number, number][]): [number, number][] {

  if (ranges.length <= 1) return ranges;

  const out: [number, number][] = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {

    const prev = out[out.length - 1];

    if (prev[1] === ranges[i][0]) {

      out[out.length - 1] = [prev[0], ranges[i][1]];

    } else {

      out.push(ranges[i]);

    }

  }

  return out;

}



function normalizeSegmentCount(

  ranges: [number, number][],

  timestamps: number[],

  minCount: number,

  maxCount: number,

): [number, number][] {

  let segs = mergeAdjacentRanges(ranges);

  while (segs.length > maxCount && segs.length > 1) {

    let shortest = 0;

    let shortestDur = Infinity;

    for (let i = 0; i < segs.length; i++) {

      const [s, e] = segs[i];

      const dur = (timestamps[e - 1] ?? 0) - (timestamps[s] ?? 0);

      if (dur < shortestDur) {

        shortestDur = dur;

        shortest = i;

      }

    }

    const mergeWith = shortest === 0 ? 1 : shortest - 1;

    const a = Math.min(shortest, mergeWith);

    const b = Math.max(shortest, mergeWith);

    segs = [

      ...segs.slice(0, a),

      [segs[a][0], segs[b][1]],

      ...segs.slice(b + 1),

    ];

  }



  while (segs.length < minCount && segs.length > 0) {

    let longest = 0;

    let longestDur = -1;

    for (let i = 0; i < segs.length; i++) {

      const [s, e] = segs[i];

      const dur = (timestamps[e - 1] ?? 0) - (timestamps[s] ?? 0);

      if (dur > longestDur) {

        longestDur = dur;

        longest = i;

      }

    }

    const [s, e] = segs[longest];

    const split = subdivideByTime(s, e, timestamps, 2);

    if (split.length < 2) break;

    segs = [...segs.slice(0, longest), ...split, ...segs.slice(longest + 1)];

  }



  return segs.slice(0, maxCount);

}



function buildTimeBasedRanges(noteCount: number, timestamps: number[], targetCount: number): [number, number][] {

  if (noteCount === 0) return [];

  const t0 = timestamps[0] ?? 0;

  const tLast = timestamps[noteCount - 1] ?? t0;

  const total = Math.max(1, tLast - t0);

  const count = Math.min(8, Math.max(4, Math.min(targetCount, noteCount)));

  const step = total / count;

  const ranges: [number, number][] = [];



  for (let c = 0; c < count; c++) {

    const targetT = t0 + c * step;

    let start = 0;

    while (start < noteCount - 1 && (timestamps[start] ?? 0) < targetT) start++;

    const nextT = c < count - 1 ? t0 + (c + 1) * step : Infinity;

    let end = start + 1;

    while (end < noteCount && (timestamps[end] ?? 0) < nextT) end++;

    if (end <= start) end = Math.min(start + 1, noteCount);

    ranges.push([start, end]);

  }



  return mergeAdjacentRanges(ranges);

}



/**

 * Suggest 4–8 diatonic chords covering the melody.

 * With timestamps: phrase gaps (>1.5× median) then time-normalize to target count.

 * Without timestamps: equal note-count windows (legacy fallback).

 */

export function suggestMelodyChords(

  notes: QuantizedNote[],

  key: KeyEstimate | null,

  targetCount = 6,

  timestamps?: number[],

): SuggestedChord[] {

  if (!key || notes.length === 0) return [];



  const count = Math.min(8, Math.max(4, Math.min(targetCount, notes.length)));

  let ranges: [number, number][];



  if (timestamps && timestamps.length === notes.length && timestamps.length >= 2) {

    const phrases = phraseBoundaries(notes.length, timestamps);

    ranges = normalizeSegmentCount(phrases, timestamps, count, 8);

    if (ranges.length < 4) {

      const timeRanges = buildTimeBasedRanges(notes.length, timestamps, count);

      ranges = normalizeSegmentCount(timeRanges, timestamps, 4, 8);

    }

  } else {

    const notesPerSeg = Math.max(1, Math.ceil(notes.length / count));

    ranges = [];

    for (let i = 0; i < notes.length; i += notesPerSeg) {

      ranges.push([i, Math.min(i + notesPerSeg, notes.length)]);

    }

  }



  return ranges.map(([start, end], idx) =>

    pickChordForSegment(notes, start, end, key, idx, ranges.length),

  );

}



export function chordStripText(chords: SuggestedChord[], withRoman = false): string {

  return chords

    .map(c => (withRoman ? `${c.symbol} (${c.roman})` : c.symbol))

    .join(' · ');

}



export function chordSymbols(chords: SuggestedChord[]): string[] {

  return chords.map(c => c.symbol);

}



/** Validate symbols against basic catalog naming (major/minor/dim only). */

export function normalizeChordSymbol(symbol: string): string {

  return symbol.replace(/♯/g, '#').replace(/♭/g, 'b');

}



/** Suffix → semitone intervals (matches basicChordCatalog / ChordsScreen). */

const CHORD_INTERVALS: Record<string, number[]> = {

  '': [0, 4, 7],

  m: [0, 3, 7],

  '7': [0, 4, 7, 10],

  maj7: [0, 4, 7, 11],

  m7: [0, 3, 7, 10],

  dim: [0, 3, 6],

  aug: [0, 4, 8],

  sus2: [0, 2, 7],

  sus4: [0, 5, 7],

};



function parseChordRoot(symbol: string): { rootIdx: number; suffix: string } | null {

  const s = normalizeChordSymbol(symbol.trim());

  if (!s) return null;

  for (let len = 2; len >= 1; len--) {

    const candidate = s.slice(0, len);

    const idx = NOTE_NAMES.indexOf(candidate);

    if (idx >= 0) {

      const suffix = s.slice(len);

      return { rootIdx: idx, suffix };

    }

  }

  const flatMap: Record<string, number> = {

    Db: 1,

    Eb: 3,

    Gb: 6,

    Ab: 8,

    Bb: 10,

  };

  for (let len = 2; len >= 1; len--) {

    const candidate = s.slice(0, len);

    if (flatMap[candidate] != null) {

      return { rootIdx: flatMap[candidate], suffix: s.slice(len) };

    }

  }

  return null;

}



/** Block chord MIDI (root+3rd+5th[+7th]) in comfortable octave for pad. */

export function chordSymbolToMidiNotes(symbol: string, baseMidi = 48): number[] {

  const parsed = parseChordRoot(symbol);

  if (!parsed) return [];

  const intervals = CHORD_INTERVALS[parsed.suffix] ?? CHORD_INTERVALS[''];

  const rootMidi = baseMidi + (((parsed.rootIdx - (baseMidi % 12)) + 12) % 12);

  return intervals.map(iv => rootMidi + iv);

}



/** Rebuild segment ranges when only symbol list was saved. Uses time spans when timestamps given. */

export function chordsFromAppliedSymbols(

  symbols: string[],

  noteCount: number,

  timestamps?: number[],

): SuggestedChord[] {

  if (symbols.length === 0 || noteCount === 0) return [];



  if (timestamps && timestamps.length === noteCount && noteCount >= 2) {

    const ranges = buildTimeBasedRanges(noteCount, timestamps, symbols.length);

    return symbols.map((symbol, i) => {

      const [start, end] = ranges[i] ?? [0, noteCount];

      return { symbol, roman: '', noteRange: [start, end] as [number, number] };

    });

  }



  const perSeg = Math.max(1, Math.ceil(noteCount / symbols.length));

  return symbols.map((symbol, i) => {

    const start = i * perSeg;

    const end = i === symbols.length - 1 ? noteCount : Math.min(start + perSeg, noteCount);

    return { symbol, roman: '', noteRange: [start, end] as [number, number] };

  });

}


