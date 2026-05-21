import { NOTE_NAMES } from './noteUtils';
import type { KeyEstimate } from './melodyAnalysis';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export interface QuantizeInput {
  name: string;
  octave: number;
  midi: number;
}

export interface QuantizedNote extends QuantizeInput {
  /** Original label before snap, e.g. "F#4" */
  originalLabel: string;
  adjusted: boolean;
  /** e.g. "F#4 → G4" when changed */
  changeLabel?: string;
  scaleDegree: number;
}

function noteLabel(name: string, octave: number): string {
  return `${name}${octave}`;
}

function parseKeyLabel(label: string): KeyEstimate | null {
  const m = label.trim().match(/^([A-Ga-g][#b]?)\s+(major|minor)$/i);
  if (!m) return null;
  const rootRaw = m[1];
  const root =
    rootRaw.length === 1
      ? rootRaw.toUpperCase()
      : rootRaw[0].toUpperCase() + rootRaw.slice(1);
  const mode = m[2].toLowerCase() as 'major' | 'minor';
  return { root, mode, label: `${root} ${mode}` };
}

export function keyFromEstimate(est: KeyEstimate | null, fallbackLabel?: string): KeyEstimate | null {
  if (est) return est;
  if (fallbackLabel) return parseKeyLabel(fallbackLabel);
  return null;
}

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

function scalePitchClasses(root: string, mode: 'major' | 'minor'): number[] {
  const r = rootIndex(root);
  const intervals = mode === 'major' ? MAJOR_SCALE : NATURAL_MINOR_SCALE;
  return intervals.map(i => (r + i) % 12);
}

/** Nearest scale pitch class (wraps chromatically). */
function nearestScalePc(pc: number, scale: number[]): number {
  let best = scale[0];
  let bestDist = 99;
  for (const s of scale) {
    let d = Math.abs(pc - s);
    d = Math.min(d, 12 - d);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

function scaleDegreeForPc(pc: number, scale: number[]): number {
  const idx = scale.indexOf(pc);
  return idx >= 0 ? idx + 1 : 0;
}

function midiToParts(midi: number): { name: string; octave: number } {
  const noteIndex = ((Math.round(midi) % 12) + 12) % 12;
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return { name: NOTE_NAMES[noteIndex], octave };
}

/**
 * Snap each sung note to the nearest scale degree in the detected key.
 * Keeps octave unless the snap crosses more than 6 semitones (then shifts octave).
 */
export function quantizeNotesToKey(
  notes: QuantizeInput[],
  key: KeyEstimate | null,
): QuantizedNote[] {
  if (!key || notes.length === 0) return [];

  const scale = scalePitchClasses(key.root, key.mode);

  return notes.map(n => {
    const originalLabel = noteLabel(n.name, n.octave);
    const pc = ((n.midi % 12) + 12) % 12;
    const targetPc = nearestScalePc(pc, scale);

    let adjustedMidi = n.midi + (targetPc - pc);
    if (targetPc - pc > 6) adjustedMidi -= 12;
    if (targetPc - pc < -6) adjustedMidi += 12;
    adjustedMidi = Math.round(adjustedMidi);

    const parts = midiToParts(adjustedMidi);
    const adjusted = adjustedMidi !== Math.round(n.midi);
    const newLabel = noteLabel(parts.name, parts.octave);

    return {
      name: parts.name,
      octave: parts.octave,
      midi: adjustedMidi,
      originalLabel,
      adjusted,
      changeLabel: adjusted ? `${originalLabel} → ${newLabel}` : undefined,
      scaleDegree: scaleDegreeForPc(targetPc, scale),
    };
  });
}

export function quantizeLabels(notes: QuantizedNote[]): string {
  return notes.map(n => noteLabel(n.name, n.octave)).join(' · ');
}

export function quantizeChanges(notes: QuantizedNote[]): string[] {
  return notes.filter(n => n.adjusted && n.changeLabel).map(n => n.changeLabel!);
}

/** Raw notes as staff-ready items (no snap). */
export function asStaffNotes(notes: QuantizeInput[]): QuantizedNote[] {
  return notes.map(n => ({
    ...n,
    originalLabel: noteLabel(n.name, n.octave),
    adjusted: false,
    scaleDegree: 0,
  }));
}

/** Scale degrees for chord logic without changing pitch. */
export function annotateScaleDegrees(
  notes: QuantizeInput[],
  key: KeyEstimate | null,
): QuantizedNote[] {
  if (!key || notes.length === 0) return asStaffNotes(notes);
  const scale = scalePitchClasses(key.root, key.mode);
  return notes.map(n => {
    const pc = ((n.midi % 12) + 12) % 12;
    const targetPc = nearestScalePc(pc, scale);
    return {
      ...n,
      originalLabel: noteLabel(n.name, n.octave),
      adjusted: false,
      scaleDegree: scaleDegreeForPc(targetPc, scale),
    };
  });
}
