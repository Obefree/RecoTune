export interface NoteInfo {
  name: string;
  octave: number;
  frequency: number;
  cents: number;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface StringDef {
  string: number;
  note: string;
  frequency: number;
}

export interface Tuning {
  id: string;
  label: string;
  instrument: string;
  strings: StringDef[];
}

export const TUNINGS: Tuning[] = [
  {
    id: 'guitar_standard',
    label: 'Standard',
    instrument: 'Guitar',
    strings: [
      { string: 6, note: 'E2', frequency: 82.41 },
      { string: 5, note: 'A2', frequency: 110.00 },
      { string: 4, note: 'D3', frequency: 146.83 },
      { string: 3, note: 'G3', frequency: 196.00 },
      { string: 2, note: 'B3', frequency: 246.94 },
      { string: 1, note: 'E4', frequency: 329.63 },
    ],
  },
  {
    id: 'guitar_drop_d',
    label: 'Drop D',
    instrument: 'Guitar',
    strings: [
      { string: 6, note: 'D2', frequency: 73.42 },
      { string: 5, note: 'A2', frequency: 110.00 },
      { string: 4, note: 'D3', frequency: 146.83 },
      { string: 3, note: 'G3', frequency: 196.00 },
      { string: 2, note: 'B3', frequency: 246.94 },
      { string: 1, note: 'E4', frequency: 329.63 },
    ],
  },
  {
    id: 'guitar_open_g',
    label: 'Open G',
    instrument: 'Guitar',
    strings: [
      { string: 6, note: 'D2', frequency: 73.42 },
      { string: 5, note: 'G2', frequency: 98.00 },
      { string: 4, note: 'D3', frequency: 146.83 },
      { string: 3, note: 'G3', frequency: 196.00 },
      { string: 2, note: 'B3', frequency: 246.94 },
      { string: 1, note: 'D4', frequency: 293.66 },
    ],
  },
  {
    id: 'guitar_open_d',
    label: 'Open D',
    instrument: 'Guitar',
    strings: [
      { string: 6, note: 'D2', frequency: 73.42 },
      { string: 5, note: 'A2', frequency: 110.00 },
      { string: 4, note: 'D3', frequency: 146.83 },
      { string: 3, note: 'F#3', frequency: 185.00 },
      { string: 2, note: 'A3', frequency: 220.00 },
      { string: 1, note: 'D4', frequency: 293.66 },
    ],
  },
  {
    id: 'guitar_dadgad',
    label: 'DADGAD',
    instrument: 'Guitar',
    strings: [
      { string: 6, note: 'D2', frequency: 73.42 },
      { string: 5, note: 'A2', frequency: 110.00 },
      { string: 4, note: 'D3', frequency: 146.83 },
      { string: 3, note: 'G3', frequency: 196.00 },
      { string: 2, note: 'A3', frequency: 220.00 },
      { string: 1, note: 'D4', frequency: 293.66 },
    ],
  },
  {
    id: 'guitar_12string',
    label: '12-String',
    instrument: 'Guitar',
    strings: [
      { string: 6, note: 'E2',  frequency: 82.41 },
      { string: 12, note: 'E3', frequency: 164.81 },
      { string: 5, note: 'A2',  frequency: 110.00 },
      { string: 11, note: 'A3', frequency: 220.00 },
      { string: 4, note: 'D3',  frequency: 146.83 },
      { string: 10, note: 'D4', frequency: 293.66 },
      { string: 3, note: 'G3',  frequency: 196.00 },
      { string: 9, note: 'G4',  frequency: 392.00 },
      { string: 2, note: 'B3',  frequency: 246.94 },
      { string: 8, note: 'B3',  frequency: 246.94 },
      { string: 1, note: 'E4',  frequency: 329.63 },
      { string: 7, note: 'E4',  frequency: 329.63 },
    ],
  },
  {
    id: 'guitar_7string',
    label: '7-String',
    instrument: 'Guitar 7',
    strings: [
      { string: 7, note: 'B1', frequency: 61.74 },
      { string: 6, note: 'E2', frequency: 82.41 },
      { string: 5, note: 'A2', frequency: 110.00 },
      { string: 4, note: 'D3', frequency: 146.83 },
      { string: 3, note: 'G3', frequency: 196.00 },
      { string: 2, note: 'B3', frequency: 246.94 },
      { string: 1, note: 'E4', frequency: 329.63 },
    ],
  },
  {
    id: 'ukulele_standard',
    label: 'Standard',
    instrument: 'Ukulele',
    strings: [
      { string: 4, note: 'G4', frequency: 392.00 },
      { string: 3, note: 'C4', frequency: 261.63 },
      { string: 2, note: 'E4', frequency: 329.63 },
      { string: 1, note: 'A4', frequency: 440.00 },
    ],
  },
  {
    id: 'ukulele_low_g',
    label: 'Low G',
    instrument: 'Ukulele',
    strings: [
      { string: 4, note: 'G3', frequency: 196.00 },
      { string: 3, note: 'C4', frequency: 261.63 },
      { string: 2, note: 'E4', frequency: 329.63 },
      { string: 1, note: 'A4', frequency: 440.00 },
    ],
  },
  {
    id: 'ukulele_baritone',
    label: 'Baritone',
    instrument: 'Ukulele',
    strings: [
      { string: 4, note: 'D3', frequency: 146.83 },
      { string: 3, note: 'G3', frequency: 196.00 },
      { string: 2, note: 'B3', frequency: 246.94 },
      { string: 1, note: 'E4', frequency: 329.63 },
    ],
  },
  {
    id: 'mandolin_standard',
    label: 'Standard',
    instrument: 'Mandolin',
    strings: [
      { string: 4, note: 'G3', frequency: 196.00 },
      { string: 3, note: 'D4', frequency: 293.66 },
      { string: 2, note: 'A4', frequency: 440.00 },
      { string: 1, note: 'E5', frequency: 659.25 },
    ],
  },
  {
    id: 'bass_standard',
    label: 'Standard',
    instrument: 'Bass',
    strings: [
      { string: 4, note: 'E1', frequency: 41.20 },
      { string: 3, note: 'A1', frequency: 55.00 },
      { string: 2, note: 'D2', frequency: 73.42 },
      { string: 1, note: 'G2', frequency: 98.00 },
    ],
  },
  {
    id: 'bass_5string',
    label: '5-String',
    instrument: 'Bass',
    strings: [
      { string: 5, note: 'B0', frequency: 30.87 },
      { string: 4, note: 'E1', frequency: 41.20 },
      { string: 3, note: 'A1', frequency: 55.00 },
      { string: 2, note: 'D2', frequency: 73.42 },
      { string: 1, note: 'G2', frequency: 98.00 },
    ],
  },
  {
    id: 'bass_drop_d',
    label: 'Drop D',
    instrument: 'Bass',
    strings: [
      { string: 4, note: 'D1', frequency: 36.71 },
      { string: 3, note: 'A1', frequency: 55.00 },
      { string: 2, note: 'D2', frequency: 73.42 },
      { string: 1, note: 'G2', frequency: 98.00 },
    ],
  },
];

export const INSTRUMENTS = [...new Set(TUNINGS.map(t => t.instrument))];

export function getTuningsForInstrument(instrument: string): Tuning[] {
  return TUNINGS.filter(t => t.instrument === instrument);
}

const A4_FREQ = 440;
const A4_MIDI = 69;

export function frequencyToNote(frequency: number): NoteInfo {
  const midi        = 12 * Math.log2(frequency / A4_FREQ) + A4_MIDI;
  const roundedMidi = Math.round(midi);
  const cents       = Math.round((midi - roundedMidi) * 100);
  const noteIndex   = ((roundedMidi % 12) + 12) % 12;
  const octave      = Math.floor(roundedMidi / 12) - 1;
  const name        = NOTE_NAMES[noteIndex];
  const targetFreq  = A4_FREQ * Math.pow(2, (roundedMidi - A4_MIDI) / 12);
  return { name, octave, frequency: targetFreq, cents };
}

export interface NearestStringMatch {
  stringDef: StringDef;
  /** Отклонение от строя струны (с учётом октавы) */
  cents: number;
  distance: number;
}

export function centsFromTargetHz(frequency: number, targetHz: number): number {
  return Math.round(1200 * Math.log2(frequency / targetHz));
}

/** Центы до ноты струны; октава подбирается ближайшая (G4 при цели G3 → около 0¢). */
export function centsToStringTarget(frequency: number, targetHz: number): number {
  const midiTarget = 12 * Math.log2(targetHz / A4_FREQ) + A4_MIDI;
  const midiPlayed = 12 * Math.log2(frequency / A4_FREQ) + A4_MIDI;
  const octShift = Math.round((midiPlayed - midiTarget) / 12);
  const adjustedHz = targetHz * Math.pow(2, octShift);
  return centsFromTargetHz(frequency, adjustedHz);
}

export function findNearestString(frequency: number, strings: StringDef[]): NearestStringMatch | null {
  if (!Number.isFinite(frequency) || frequency <= 0 || strings.length === 0) return null;
  let best: NearestStringMatch | null = null;
  for (const s of strings) {
    const cents = centsToStringTarget(frequency, s.frequency);
    const distance = Math.abs(cents);
    if (!best || distance < best.distance) {
      best = { stringDef: s, cents, distance };
    }
  }
  return best;
}

/** Не перескакивать на соседнюю струну, пока новая не ближе на margin ¢ */
export function findNearestStringWithHysteresis(
  frequency: number,
  strings: StringDef[],
  lockedString: number | null,
  marginCents = 28,
): NearestStringMatch | null {
  const fresh = findNearestString(frequency, strings);
  if (!fresh || lockedString == null) return fresh;
  const prevDef = strings.find(s => s.string === lockedString);
  if (!prevDef) return fresh;
  const prevDist = Math.abs(centsToStringTarget(frequency, prevDef.frequency));
  if (prevDist <= fresh.distance + marginCents) {
    return {
      stringDef: prevDef,
      cents: centsToStringTarget(frequency, prevDef.frequency),
      distance: prevDist,
    };
  }
  return fresh;
}

export function centsToColor(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= 5)  return '#00e676';
  if (abs <= 15) return '#ffeb3b';
  return '#ff5252';
}

// kept for backward compat
export const GUITAR_STRINGS = TUNINGS[0].strings;
