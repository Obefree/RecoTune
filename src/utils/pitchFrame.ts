import { frequencyToNote } from './noteUtils';

const A4_FREQ = 440;
const A4_MIDI = 69;

/** Single pitch sample for melody contour transcription (~12 Hz). */
export type PitchFrame = {
  t: number;
  freq: number | null;
  midi: number | null;
  cents: number | null;
  rms: number;
  yinConfidence: number | null;
};

export const PITCH_FRAME_RING = {
  /** ~12 s at ~12 Hz */
  maxFrames: 144,
  /** Melody transcription vocal range (Hz) */
  freqMin: 80,
  freqMax: 1000,
} as const;

export function freqToMidiFloat(freq: number): number {
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
}

export function createPitchFrame(input: {
  t: number;
  frequency: number | null;
  signal: number;
  cents?: number;
  yinConfidence?: number | null;
}): PitchFrame {
  const { frequency, signal, t, yinConfidence } = input;
  if (!frequency || frequency < 55) {
    return {
      t,
      freq: null,
      midi: null,
      cents: null,
      rms: signal,
      yinConfidence: yinConfidence ?? null,
    };
  }
  const info = frequencyToNote(frequency);
  const midi = freqToMidiFloat(frequency);
  return {
    t,
    freq: frequency,
    midi,
    cents: input.cents ?? info.cents,
    rms: signal,
    yinConfidence: yinConfidence ?? null,
  };
}

export function pushPitchFrameRing(ring: PitchFrame[], frame: PitchFrame): PitchFrame[] {
  const next = [...ring, frame];
  if (next.length > PITCH_FRAME_RING.maxFrames) {
    return next.slice(-PITCH_FRAME_RING.maxFrames);
  }
  return next;
}
