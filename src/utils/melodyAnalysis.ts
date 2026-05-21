import { NOTE_NAMES } from './noteUtils';
import type { RegisteredNoteEvent } from '../hooks/useSungNoteHistory';

/** Krumhans-Schmuckler major / minor profiles (normalized in scorer). */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface KeyEstimate {
  root: string;
  mode: 'major' | 'minor';
  label: string;
}

export type TempoLabel = 'slow' | 'medium' | 'fast';

export interface RhythmEstimate {
  tempoLabel: TempoLabel;
  bpmApprox: number | null;
  gapsMs: number[];
}

function rotateProfile(profile: number[], root: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 12; i++) out.push(profile[(i - root + 12) % 12]);
  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = 12;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den < 1e-9 ? 0 : num / den;
}

function pitchClassHistogram(events: RegisteredNoteEvent[]): number[] {
  const hist = new Array(12).fill(0);
  for (const e of events) {
    const pc = ((e.midi % 12) + 12) % 12;
    hist[pc] += 1;
  }
  return hist;
}

/** Lite Krumhans-Schmuckler: best major/minor tonic by profile correlation. */
export function estimateKey(events: RegisteredNoteEvent[]): KeyEstimate | null {
  if (events.length < 2) return null;
  const hist = pitchClassHistogram(events);
  const total = hist.reduce((s, v) => s + v, 0);
  if (total < 2) return null;

  let bestRoot = 0;
  let bestMode: 'major' | 'minor' = 'major';
  let bestScore = -Infinity;

  for (let root = 0; root < 12; root++) {
    const maj = pearson(hist, rotateProfile(MAJOR_PROFILE, root));
    const min = pearson(hist, rotateProfile(MINOR_PROFILE, root));
    if (maj > bestScore) {
      bestScore = maj;
      bestRoot = root;
      bestMode = 'major';
    }
    if (min > bestScore) {
      bestScore = min;
      bestRoot = root;
      bestMode = 'minor';
    }
  }

  const root = NOTE_NAMES[bestRoot];
  return {
    root,
    mode: bestMode,
    label: `${root} ${bestMode}`,
  };
}

export function pitchClassesPresent(events: RegisteredNoteEvent[]): string[] {
  const set = new Set<number>();
  for (const e of events) set.add(((e.midi % 12) + 12) % 12);
  return [...set].sort((a, b) => a - b).map(pc => NOTE_NAMES[pc]);
}

/** Inter-onset gaps between consecutive timestamps (ms). */
export function interOnsetGapsMs(timestamps: number[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    gaps.push(Math.max(0, timestamps[i] - timestamps[i - 1]));
  }
  return gaps;
}

export function medianInterOnsetMs(timestamps: number[]): number {
  const gaps = interOnsetGapsMs(timestamps);
  if (gaps.length === 0) return 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function estimateRhythm(events: RegisteredNoteEvent[]): RhythmEstimate | null {
  if (events.length < 2) return null;
  const gapsMs = interOnsetGapsMs(events.map(e => e.ts));
  const sorted = [...gapsMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  let tempoLabel: TempoLabel = 'medium';
  if (median >= 750) tempoLabel = 'slow';
  else if (median < 380) tempoLabel = 'fast';

  const bpmApprox = median > 80 ? Math.round(60000 / median) : null;
  return { tempoLabel, bpmApprox, gapsMs };
}
