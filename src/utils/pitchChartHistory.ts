import type { HistoryPoint } from '../components/FrequencyChart';
import { frequencyToNote } from './noteUtils';
import type { PitchFrame } from './pitchFrame';
import { isVoicedFrame } from './melodyTranscription';

/** Matches `CHART_SAMPLE_INTERVAL_MS` in FrequencyChart and Melody hook. */
export const PITCH_CHART_MIN_INTERVAL_MS = 100;
export const PITCH_CHART_MAX_POINTS = 120;

export type ChartVoicedGate = 'melody' | 'tuner';

/** Tuner: keep trace while needle uses the same mic path (less strict than Melody transcription). */
export function isTunerVoicedFrame(frame: PitchFrame): boolean {
  return frame.freq != null && frame.freq >= 55 && frame.rms >= 0.004;
}

const A4_FREQ = 440;
const A4_MIDI = 69;

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
}

/** Append a voiced chart point at most every 100 ms (Melody/Tuner/Chords practice). */
export function appendVoicedChartPoint(
  prev: HistoryPoint[],
  opts: {
    chartFreq: number;
    frame: PitchFrame;
    lastPtMs: number;
    cents?: number;
    maxPoints?: number;
    voicedGate?: ChartVoicedGate;
  },
): { history: HistoryPoint[]; lastPtMs: number } | null {
  const {
    chartFreq,
    frame,
    lastPtMs,
    cents,
    maxPoints = PITCH_CHART_MAX_POINTS,
    voicedGate = 'melody',
  } = opts;
  const ts = frame.t;
  const voiced = voicedGate === 'tuner' ? isTunerVoicedFrame(frame) : isVoicedFrame(frame);
  if (chartFreq < 55 || !voiced) return null;
  if (ts - lastPtMs < PITCH_CHART_MIN_INTERVAL_MS) return null;

  const midi = freqToMidi(chartFreq);
  const info = frequencyToNote(chartFreq);
  const pt: HistoryPoint = {
    cents: cents ?? info.cents,
    freq: chartFreq,
    midi,
    note: info.name,
    octave: info.octave,
    ts,
    voiced: true,
  };
  const next = [...prev, pt];
  return {
    history: next.length > maxPoints ? next.slice(-maxPoints) : next,
    lastPtMs: ts,
  };
}
