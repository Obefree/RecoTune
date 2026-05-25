import type { HistoryPoint } from '../components/FrequencyChart';
import { frequencyToNote } from './noteUtils';
import type { PitchFrame } from './pitchFrame';
import { isChartVoicedFrame } from './melodyTranscription';

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

/** ~4 semitones — reject harmonic jumps (aligned with TunerEngine melody profile). */
const CHART_JUMP_RATIO = 1.26;
const CHART_JUMP_BLEND = 0.42;
const CHART_EMA_ALPHA = 0.22;
/** Max vertical step per chart sample (~100 ms). */
const CHART_MAX_CENTS_STEP = 42;
const CHART_FREQ_RING = 5;

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clampCentsStep(prevHz: number, nextHz: number): number {
  const prevMidi = freqToMidi(prevHz);
  const maxSemi = CHART_MAX_CENTS_STEP / 100;
  const lo = prevMidi - maxSemi;
  const hi = prevMidi + maxSemi;
  const clampedMidi = Math.min(Math.max(freqToMidi(nextHz), lo), hi);
  return 440 * Math.pow(2, (clampedMidi - A4_MIDI) / 12);
}

/**
 * Display-path stabilizer for Melody chart (median + outlier blend + EMA + per-point cap).
 * Raw pitch still goes to detector / pitchFrames.
 */
export class ChartFreqStabilizer {
  private ring: number[] = [];
  private lastStable: number | null = null;
  private display: number | null = null;

  reset(): void {
    this.ring = [];
    this.lastStable = null;
    this.display = null;
  }

  process(rawHz: number): number {
    if (!Number.isFinite(rawHz) || rawHz < 55) {
      this.reset();
      return rawHz;
    }

    this.ring.push(rawHz);
    if (this.ring.length > CHART_FREQ_RING) this.ring.shift();

    let m = this.ring.length >= 3 ? median(this.ring) : rawHz;
    if (this.lastStable != null) {
      const lo = this.lastStable / CHART_JUMP_RATIO;
      const hi = this.lastStable * CHART_JUMP_RATIO;
      if (m < lo || m > hi) {
        m = CHART_JUMP_BLEND * m + (1 - CHART_JUMP_BLEND) * this.lastStable;
      }
    }
    this.lastStable = m;

    const prevDisplay = this.display;
    let next =
      prevDisplay == null
        ? m
        : CHART_EMA_ALPHA * m + (1 - CHART_EMA_ALPHA) * prevDisplay;

    if (prevDisplay != null) {
      next = clampCentsStep(prevDisplay, next);
    }
    this.display = next;
    return next;
  }
}

/** Remove stop-time spike on the last sample (do not add a bogus final frame). */
export function softenLastChartPoint(history: HistoryPoint[]): HistoryPoint[] {
  if (history.length < 2) return history;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const jumpSemi = Math.abs(last.midi - prev.midi);
  if (jumpSemi <= 0.65) return history;

  const info = frequencyToNote(prev.freq);
  const softened: HistoryPoint = {
    ...last,
    freq: prev.freq,
    midi: prev.midi,
    cents: prev.cents,
    note: info.name,
    octave: info.octave,
  };
  return [...history.slice(0, -1), softened];
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
  const voiced =
    voicedGate === 'tuner' ? isTunerVoicedFrame(frame) : isChartVoicedFrame(frame);
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
