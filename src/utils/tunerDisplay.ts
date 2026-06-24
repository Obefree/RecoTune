import { freqToMidi, frequencyToNote } from './noteUtils';

const A4 = 440;
const A4_MIDI = 69;

/** RN UI refresh for needle / note / Hz (~12 Hz). */
export const TUNER_DISPLAY_UI_MS = 80;

/** Frames within ±NOTE_CONFIRM_CENTS of candidate center before note changes. */
export const NOTE_CONFIRM_FRAMES = 4;
/** Candidate must sit this close (¢) to its semitone center. */
export const NOTE_CONFIRM_CENTS = 28;
/** Minimum time on a candidate before switching note. */
export const NOTE_MIN_HOLD_MS = 70;
/** Raw must sit clearly toward the next semitone (¢ from locked center). */
export const NOTE_SWITCH_OFFSET_CENTS = 33;
/** Light EMA for Hz readout only — not used for note / needle. */
export const HZ_DISPLAY_EMA = 0.25;
/** Display-only EMA for tuner chart trace (decoupled from needle). */
export const CHART_MIDI_EMA = 0.3;
/** A single-frame pitch jump beyond this (¢) is treated as an octave/harmonic glitch. */
export const OUTLIER_CENTS_JUMP = 200;

/**
 * 1€ filter (Casiez, Roussel, Vogel 2012) parameters, tuned in the semitone domain.
 * Low `minCutoff` → rock-steady reading while a string is held; `beta` lets the
 * cutoff open up on a genuine pitch change so the needle still tracks fast.
 */
export const EURO_MIN_CUTOFF = 0.6;
export const EURO_BETA = 0.9;
export const EURO_D_CUTOFF = 1.0;

/**
 * YIN CMNDF minimum gate (lower = more confident). Frames above this are treated as
 * unreliable: we hold the last reading instead of letting the needle chase noise.
 * Quiet-but-clean plucks still pass — rms gating lives in the WebView, not here.
 */
export const CONFIDENCE_MAX_YIN = 0.18;

export interface TunerDisplayFrame {
  name: string;
  octave: number;
  /** Rounded for ¢ text */
  cents: number;
  /** Fractional — feed TunerNeedle */
  displayCents: number;
  frequency: number;
  lockedMidi: number;
  /** Chart Y only — EMA of smoothed pitch */
  chartDisplayMidi: number;
}

function midiToNameOctave(midi: number): { name: string; octave: number } {
  const info = frequencyToNote(A4 * 2 ** ((midi - A4_MIDI) / 12));
  return { name: info.name, octave: info.octave };
}

function alpha(cutoff: number, dtSec: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtSec);
}

/**
 * Adaptive low-pass: heavy smoothing when the value is steady, light smoothing when
 * it moves quickly. One filter replaces the old rate-limiter + EMA + spring stack,
 * which was the root cause of the "crawls then jerks" needle.
 */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;

  constructor(
    private minCutoff = EURO_MIN_CUTOFF,
    private beta = EURO_BETA,
    private dCutoff = EURO_D_CUTOFF,
  ) {}

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
  }

  filter(x: number, dtSec: number): number {
    if (this.xPrev == null) {
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }
    const dt = dtSec > 0 ? dtSec : 0.055;
    const dx = (x - this.xPrev) / dt;
    const edx = this.dxPrev + alpha(this.dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const xHat = this.xPrev + alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = xHat;
    this.dxPrev = edx;
    return xHat;
  }
}

/**
 * Tuner-only display path: note hysteresis (stable note name) plus an adaptive 1€
 * filter on pitch (smooth, responsive needle without run-ahead). Confidence gating
 * holds the reading on noisy/uncertain frames.
 */
export class TunerPitchDisplay {
  private lockedMidi: number | null = null;
  private smoothMidi: number | null = null;
  private displayCents = 0;
  private hzDisplay: number | null = null;
  private chartMidiDisplay: number | null = null;
  private candidateMidi: number | null = null;
  private candidateFrames = 0;
  private candidateStartTs: number | null = null;
  private lastTs: number | null = null;
  private lastRawMidi: number | null = null;
  private readonly euro = new OneEuroFilter();

  reset(): void {
    this.lockedMidi = null;
    this.smoothMidi = null;
    this.displayCents = 0;
    this.hzDisplay = null;
    this.chartMidiDisplay = null;
    this.candidateMidi = null;
    this.candidateFrames = 0;
    this.candidateStartTs = null;
    this.lastTs = null;
    this.lastRawMidi = null;
    this.euro.reset();
  }

  /**
   * @param rawHz   detector frequency (Hz)
   * @param yinConfidence CMNDF minimum (lower = better); undefined = trust frame
   */
  process(rawHz: number, ts = Date.now(), yinConfidence?: number): TunerDisplayFrame | null {
    if (!Number.isFinite(rawHz) || rawHz < 28) return null;

    // Confidence gate: ignore unreliable frames but keep showing the held reading.
    if (yinConfidence != null && yinConfidence > CONFIDENCE_MAX_YIN) {
      return this.lockedMidi == null ? null : this.snapshot();
    }

    const dtMs = this.lastTs == null ? 55 : Math.min(160, Math.max(16, ts - this.lastTs));
    this.lastTs = ts;
    const dtSec = dtMs / 1000;

    const rawMidi = freqToMidi(rawHz);

    // Single-frame octave/harmonic glitch: skip this sample (hold), don't poison filter.
    if (this.lastRawMidi != null) {
      const jumpCents = Math.abs((rawMidi - this.lastRawMidi) * 100);
      if (jumpCents > OUTLIER_CENTS_JUMP) {
        this.lastRawMidi = rawMidi;
        return this.lockedMidi == null ? null : this.snapshot();
      }
    }
    this.lastRawMidi = rawMidi;

    const nearestMidi = Math.round(rawMidi);
    this.smoothMidi = this.euro.filter(rawMidi, dtSec);

    if (this.lockedMidi == null) {
      this.lockedMidi = nearestMidi;
    } else {
      this.updateLockedNote(rawMidi, nearestMidi, ts);
    }

    const locked = this.lockedMidi;
    this.displayCents = Math.max(-50, Math.min(50, (this.smoothMidi - locked) * 100));

    this.hzDisplay =
      this.hzDisplay == null
        ? rawHz
        : HZ_DISPLAY_EMA * rawHz + (1 - HZ_DISPLAY_EMA) * this.hzDisplay;

    const instantChartMidi = this.smoothMidi;
    this.chartMidiDisplay =
      this.chartMidiDisplay == null
        ? instantChartMidi
        : CHART_MIDI_EMA * instantChartMidi + (1 - CHART_MIDI_EMA) * this.chartMidiDisplay;

    return this.snapshot();
  }

  private snapshot(): TunerDisplayFrame {
    const locked = this.lockedMidi!;
    const { name, octave } = midiToNameOctave(locked);
    const hz = this.hzDisplay ?? A4 * 2 ** ((locked - A4_MIDI) / 12);
    return {
      name,
      octave,
      cents: Math.round(this.displayCents),
      displayCents: this.displayCents,
      frequency: Math.round(hz * 10) / 10,
      lockedMidi: locked,
      chartDisplayMidi: this.chartMidiDisplay ?? locked,
    };
  }

  private updateLockedNote(rawMidi: number, nearestMidi: number, ts: number): void {
    const locked = this.lockedMidi!;
    const offsetFromLocked = (rawMidi - locked) * 100;
    const centsOnCandidate = (rawMidi - nearestMidi) * 100;

    if (nearestMidi === locked) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      this.candidateStartTs = null;
      return;
    }

    const towardNeighbor =
      Math.abs(offsetFromLocked) >= NOTE_SWITCH_OFFSET_CENTS &&
      Math.sign(offsetFromLocked) === Math.sign(nearestMidi - locked);

    if (!towardNeighbor || Math.abs(centsOnCandidate) > NOTE_CONFIRM_CENTS) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      this.candidateStartTs = null;
      return;
    }

    if (this.candidateMidi === nearestMidi) {
      this.candidateFrames += 1;
    } else {
      this.candidateMidi = nearestMidi;
      this.candidateFrames = 1;
      this.candidateStartTs = ts;
    }

    const holdMs = this.candidateStartTs == null ? 0 : ts - this.candidateStartTs;
    if (this.candidateFrames >= NOTE_CONFIRM_FRAMES && holdMs >= NOTE_MIN_HOLD_MS) {
      this.lockedMidi = nearestMidi;
      this.candidateMidi = null;
      this.candidateFrames = 0;
      this.candidateStartTs = null;
    }
  }
}
