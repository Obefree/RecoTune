import { frequencyToNote } from './noteUtils';

export interface SungNote {
  name: string;
  octave: number;
  midi: number;
  freq: number;
  ts: number;
}

export interface SungNoteSample {
  frequency: number | null;
  signal: number;
  cents?: number;
  ts?: number;
}

export interface SungNoteDetectorOptions {
  /** Base RMS threshold; effective threshold adapts down with recent peak */
  minSignal?: number;
  /** @deprecated use minStableMs */
  minDurationMs?: number;
  minStableMs?: number;
  /** @deprecated use maxCentsVariance */
  maxCentsSpread?: number;
  maxCentsVariance?: number;
  maxJumpSemitones?: number;
  jumpSustainMs?: number;
  /** @deprecated use debounceSameMs */
  debounceMs?: number;
  debounceSameMs?: number;
  debounceNewMs?: number;
}

interface ResolvedOptions {
  minSignal: number;
  minStableMs: number;
  maxCentsVariance: number;
  maxJumpSemitones: number;
  jumpSustainMs: number;
  debounceSameMs: number;
  debounceNewMs: number;
}

/**
 * Default detection thresholds for sung-note onset registration.
 * Tuned for melody capture: slightly permissive RMS, stable debounce on repeats.
 */
export const SUNG_NOTE_DETECTOR_DEFAULTS = {
  /** Base RMS gate before adaptive scaling */
  minSignal: 0.01,
  /** How long pitch must stay stable before registering (ms) */
  minStableMs: 120,
  /** Max cents spread within one candidate before reset */
  maxCentsVariance: 28,
  /** Semitone jump treated as new note candidate */
  maxJumpSemitones: 4,
  /** Sustained jump duration before accepting large interval (ms) */
  jumpSustainMs: 130,
  /** Min gap before re-registering the same MIDI note (ms) */
  debounceSameMs: 280,
  /** Min gap before registering a different note (ms) */
  debounceNewMs: 130,
  /** Adaptive threshold = signalPeak * ratio (lower → more sensitive) */
  adaptivePeakRatio: 0.28,
  /** Floor for adaptive RMS threshold */
  adaptiveFloor: 0.007,
  /** Peak decay when signal absent (per sample) */
  peakDecay: 0.99,
  /** Peak rise blend when signal present */
  peakRise: 0.992,
} as const;

const DEFAULTS: ResolvedOptions = {
  minSignal: SUNG_NOTE_DETECTOR_DEFAULTS.minSignal,
  minStableMs: SUNG_NOTE_DETECTOR_DEFAULTS.minStableMs,
  maxCentsVariance: SUNG_NOTE_DETECTOR_DEFAULTS.maxCentsVariance,
  maxJumpSemitones: SUNG_NOTE_DETECTOR_DEFAULTS.maxJumpSemitones,
  jumpSustainMs: SUNG_NOTE_DETECTOR_DEFAULTS.jumpSustainMs,
  debounceSameMs: SUNG_NOTE_DETECTOR_DEFAULTS.debounceSameMs,
  debounceNewMs: SUNG_NOTE_DETECTOR_DEFAULTS.debounceNewMs,
};

function resolveOptions(options?: SungNoteDetectorOptions): ResolvedOptions {
  const o = options ?? {};
  return {
    minSignal: o.minSignal ?? DEFAULTS.minSignal,
    minStableMs: o.minStableMs ?? o.minDurationMs ?? DEFAULTS.minStableMs,
    maxCentsVariance: o.maxCentsVariance ?? o.maxCentsSpread ?? DEFAULTS.maxCentsVariance,
    maxJumpSemitones: o.maxJumpSemitones ?? DEFAULTS.maxJumpSemitones,
    jumpSustainMs: o.jumpSustainMs ?? DEFAULTS.jumpSustainMs,
    debounceSameMs: o.debounceSameMs ?? o.debounceMs ?? DEFAULTS.debounceSameMs,
    debounceNewMs: o.debounceNewMs ?? DEFAULTS.debounceNewMs,
  };
}

const A4_HZ = 440;
const A4_MIDI = 69;

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_HZ) + A4_MIDI;
}

export class SungNoteDetector {
  private opts: ResolvedOptions;
  private candidateStart: number | null = null;
  private candidateMidi: number | null = null;
  private candidateCents: number[] = [];
  private lastRegistered: { midi: number; ts: number } | null = null;
  private armedMidi: number | null = null;
  private jumpStart: number | null = null;
  private jumpMidi: number | null = null;
  private signalPeak = 0.01;

  constructor(options?: SungNoteDetectorOptions) {
    this.opts = resolveOptions(options);
  }

  reset(): void {
    this.candidateStart = null;
    this.candidateMidi = null;
    this.candidateCents = [];
    this.lastRegistered = null;
    this.armedMidi = null;
    this.jumpStart = null;
    this.jumpMidi = null;
    this.signalPeak = 0.01;
  }

  private signalThreshold(signal: number): number {
    if (signal > 0) {
      this.signalPeak = Math.max(
        this.signalPeak * SUNG_NOTE_DETECTOR_DEFAULTS.peakRise,
        signal,
      );
    } else {
      this.signalPeak *= SUNG_NOTE_DETECTOR_DEFAULTS.peakDecay;
    }

    const adaptive = this.signalPeak * SUNG_NOTE_DETECTOR_DEFAULTS.adaptivePeakRatio;
    return Math.min(
      this.opts.minSignal,
      Math.max(SUNG_NOTE_DETECTOR_DEFAULTS.adaptiveFloor, adaptive),
    );
  }

  process(sample: SungNoteSample): SungNote | null {
    const ts = sample.ts ?? Date.now();
    const { frequency, signal } = sample;

    const threshold = this.signalThreshold(signal);

    if (!frequency || frequency < 55 || signal < threshold) {
      this.clearCandidate();
      this.armedMidi = null;
      return null;
    }

    const info = frequencyToNote(frequency);
    const midi = Math.round(freqToMidi(frequency));
    const cents = sample.cents ?? info.cents;

    if (this.armedMidi != null && midi !== this.armedMidi) {
      this.armedMidi = null;
    }

    if (this.candidateMidi != null && this.candidateStart != null) {
      const semiDiff = Math.abs(midi - this.candidateMidi);

      if (semiDiff <= 1 && Math.abs(cents) <= this.opts.maxCentsVariance + 8) {
        this.candidateCents.push(cents);
        this.jumpStart = null;
        this.jumpMidi = null;

        if (this.spread(this.candidateCents) > this.opts.maxCentsVariance * 1.6) {
          this.startCandidate(midi, cents, ts);
          return null;
        }

        if (ts - this.candidateStart >= this.opts.minStableMs) {
          return this.tryRegister(info.name, info.octave, midi, ts, frequency);
        }
        return null;
      }

      if (semiDiff > this.opts.maxJumpSemitones) {
        if (this.jumpMidi === midi) {
          if (this.jumpStart != null && ts - this.jumpStart >= this.opts.jumpSustainMs) {
            this.startCandidate(midi, cents, ts);
          }
        } else {
          this.jumpMidi = midi;
          this.jumpStart = ts;
        }
        return null;
      }

      this.startCandidate(midi, cents, ts);
      return null;
    }

    this.startCandidate(midi, cents, ts);
    return null;
  }

  private startCandidate(midi: number, cents: number, ts: number): void {
    this.candidateMidi = midi;
    this.candidateStart = ts;
    this.candidateCents = [cents];
    this.jumpStart = null;
    this.jumpMidi = null;
  }

  private clearCandidate(): void {
    this.candidateStart = null;
    this.candidateMidi = null;
    this.candidateCents = [];
    this.jumpStart = null;
    this.jumpMidi = null;
  }

  private spread(cents: number[]): number {
    if (cents.length < 2) return 0;
    return Math.max(...cents) - Math.min(...cents);
  }

  private tryRegister(
    name: string,
    octave: number,
    midi: number,
    ts: number,
    freq: number,
  ): SungNote | null {
    if (this.armedMidi === midi) return null;

    if (this.lastRegistered) {
      const sameNote = this.lastRegistered.midi === midi;
      const gap = ts - this.lastRegistered.ts;
      const minGap = sameNote ? this.opts.debounceSameMs : this.opts.debounceNewMs;
      if (gap < minGap) return null;
    }

    this.armedMidi = midi;
    this.lastRegistered = { midi, ts };
    this.clearCandidate();
    return { name, octave, midi, freq, ts };
  }
}
