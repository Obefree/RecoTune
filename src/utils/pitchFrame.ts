import { freqToMidi, frequencyToNote } from './noteUtils';

/** Single pitch sample for melody contour transcription. */
export type PitchFrame = {
  t: number;
  freq: number | null;
  midi: number | null;
  cents: number | null;
  rms: number;
  yinConfidence: number | null;
};

export const PITCH_FRAME_RING = {
  /** ~50 s at melody cadence (32 ms). */
  maxFrames: 1600,
  /**
   * Melody transcription range (Hz). Must match the TunerEngine melody profile
   * (70–1200 Hz) — a narrower gate here silently drops pitches that already
   * reached the detector (low bass / high notes never become notes).
   */
  freqMin: 70,
  freqMax: 1200,
} as const;

export const freqToMidiFloat = freqToMidi;

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
