import type { HistoryPoint } from '../components/FrequencyChart';
import { freqToMidi, frequencyToNote } from './noteUtils';
import type { PitchFrame } from './pitchFrame';
import { isChartVoicedFrame } from './melodyTranscription';

/** Matches `CHART_SAMPLE_INTERVAL_MS` in FrequencyChart and Melody hook. */
export const PITCH_CHART_MIN_INTERVAL_MS = 100;
export const PITCH_CHART_MAX_POINTS = 120;
/** Tuner live chart: fixed viewport width on wall-clock axis (matches ~max points). */
export const TUNER_CHART_WINDOW_MS = PITCH_CHART_MAX_POINTS * PITCH_CHART_MIN_INTERVAL_MS;

export type ChartVoicedGate = 'melody' | 'tuner';

/** Tuner chart gate — softer than Melody transcription, aligned with tuner WebView rms. */
export function isTunerVoicedFrame(frame: PitchFrame): boolean {
  return frame.freq != null && frame.freq >= 55 && frame.rms >= 0.0025;
}

const A4_FREQ = 440;
const A4_MIDI = 69;

export interface ChartStabilizerConfig {
  jumpRatio: number;
  jumpBlend: number;
  emaAlpha: number;
  maxCentsStep: number;
  ringSize: number;
}

/** Melody chart trace only — tuner chart uses raw Hz + TunerPitchDisplay. */
export const MELODY_CHART_STABILIZER: ChartStabilizerConfig = {
  jumpRatio: 1.26,
  jumpBlend: 0.42,
  emaAlpha: 0.22,
  maxCentsStep: 32,
  ringSize: 7,
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clampCentsStep(prevHz: number, nextHz: number, maxCentsStep: number): number {
  const prevMidi = freqToMidi(prevHz);
  const maxSemi = maxCentsStep / 100;
  const lo = prevMidi - maxSemi;
  const hi = prevMidi + maxSemi;
  const clampedMidi = Math.min(Math.max(freqToMidi(nextHz), lo), hi);
  return 440 * Math.pow(2, (clampedMidi - A4_MIDI) / 12);
}

/**
 * Display-path stabilizer for Melody pitch charts (median + outlier blend + EMA + per-point cap).
 * Tuner tab does not use this — see {@link TunerPitchDisplay} + rolling window chart.
 */
export class ChartFreqStabilizer {
  private readonly cfg = MELODY_CHART_STABILIZER;
  private ring: number[] = [];
  private lastStable: number | null = null;
  private display: number | null = null;

  reset(): void {
    this.ring = [];
    this.lastStable = null;
    this.display = null;
  }

  process(rawHz: number): number | null {
    const { jumpRatio, jumpBlend, emaAlpha, maxCentsStep, ringSize } = this.cfg;

    if (!Number.isFinite(rawHz) || rawHz < 55) {
      return this.display;
    }

    this.ring.push(rawHz);
    if (this.ring.length > ringSize) this.ring.shift();

    let m = this.ring.length >= 3 ? median(this.ring) : rawHz;
    if (this.lastStable != null) {
      const lo = this.lastStable / jumpRatio;
      const hi = this.lastStable * jumpRatio;
      if (m < lo || m > hi) {
        m = jumpBlend * m + (1 - jumpBlend) * this.lastStable;
      }
    }
    this.lastStable = m;

    const prevDisplay = this.display;
    let next =
      prevDisplay == null
        ? m
        : emaAlpha * m + (1 - emaAlpha) * prevDisplay;

    if (prevDisplay != null) {
      next = clampCentsStep(prevDisplay, next, maxCentsStep);
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
    /** When set, pitch trace Y uses this instead of midi(chartFreq). */
    chartMidi?: number;
    maxPoints?: number;
    voicedGate?: ChartVoicedGate;
  },
): { history: HistoryPoint[]; lastPtMs: number } | null {
  const {
    chartFreq,
    frame,
    lastPtMs,
    cents,
    chartMidi,
    maxPoints = PITCH_CHART_MAX_POINTS,
    voicedGate = 'melody',
  } = opts;
  const ts = frame.t;
  const voiced =
    voicedGate === 'tuner' ? isTunerVoicedFrame(frame) : isChartVoicedFrame(frame);
  if (chartFreq < 55 || !voiced) return null;
  if (ts - lastPtMs < PITCH_CHART_MIN_INTERVAL_MS) return null;

  const midi = chartMidi ?? freqToMidi(chartFreq);
  const info = frequencyToNote(
    chartMidi != null ? A4_FREQ * 2 ** ((midi - A4_MIDI) / 12) : chartFreq,
  );
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
