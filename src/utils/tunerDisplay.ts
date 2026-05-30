import { freqToMidi, frequencyToNote } from './noteUtils';

const A4 = 440;
const A4_MIDI = 69;

/** RN UI refresh for needle / note / Hz (~10 Hz). */
export const TUNER_DISPLAY_UI_MS = 100;

/** Frames within ±NOTE_CONFIRM_CENTS of candidate center before note changes. */
export const NOTE_CONFIRM_FRAMES = 5;
/** Candidate must sit this close (¢) to its semitone center. */
export const NOTE_CONFIRM_CENTS = 25;
/** Minimum time on a candidate before switching note. */
export const NOTE_MIN_HOLD_MS = 80;
/** Raw must sit clearly toward the next semitone (¢ from locked center). */
export const NOTE_SWITCH_OFFSET_CENTS = 35;
/** Max display ¢ change per second (smooth needle, no overshoot past target). */
export const MAX_CENTS_PER_SEC = 140;
/** Light EMA for Hz readout only — not used for note / needle. */
export const HZ_DISPLAY_EMA = 0.28;
/** Display-only EMA for tuner chart trace (decoupled from needle). */
export const CHART_MIDI_EMA = 0.25;
/** Reject one-frame ¢ jumps larger than this (hold previous target). */
export const OUTLIER_CENTS_JUMP = 200;
export const OUTLIER_HOLD_FRAMES = 2;

export interface TunerDisplayFrame {
  name: string;
  octave: number;
  /** Rounded for ¢ text */
  cents: number;
  /** Fractional — feed TunerNeedle */
  displayCents: number;
  frequency: number;
  lockedMidi: number;
  /** Chart Y only — EMA of locked + display ¢ */
  chartDisplayMidi: number;
}

function midiToNameOctave(midi: number): { name: string; octave: number } {
  const info = frequencyToNote(A4 * 2 ** ((midi - A4_MIDI) / 12));
  return { name: info.name, octave: info.octave };
}

/**
 * Tuner-only display path: note hysteresis on raw pitch, ¢ relative to locked note,
 * rate-limited lerp (no prediction ahead of measured pitch).
 */
export class TunerPitchDisplay {
  private lockedMidi: number | null = null;
  private displayCents = 0;
  private hzDisplay: number | null = null;
  private chartMidiDisplay: number | null = null;
  private candidateMidi: number | null = null;
  private candidateFrames = 0;
  private candidateStartTs: number | null = null;
  private lastTs: number | null = null;
  private lastRawMidi: number | null = null;
  private outlierHoldFrames = 0;
  private heldTargetCents = 0;

  reset(): void {
    this.lockedMidi = null;
    this.displayCents = 0;
    this.hzDisplay = null;
    this.chartMidiDisplay = null;
    this.candidateMidi = null;
    this.candidateFrames = 0;
    this.candidateStartTs = null;
    this.lastTs = null;
    this.lastRawMidi = null;
    this.outlierHoldFrames = 0;
    this.heldTargetCents = 0;
  }

  process(rawHz: number, ts = Date.now()): TunerDisplayFrame | null {
    if (!Number.isFinite(rawHz) || rawHz < 55) return null;

    const dtMs =
      this.lastTs == null ? 55 : Math.min(120, Math.max(16, ts - this.lastTs));
    this.lastTs = ts;

    const rawMidi = freqToMidi(rawHz);
    const nearestMidi = Math.round(rawMidi);

    if (this.lastRawMidi != null) {
      const jumpCents = Math.abs((rawMidi - this.lastRawMidi) * 100);
      if (jumpCents > OUTLIER_CENTS_JUMP) {
        this.outlierHoldFrames = OUTLIER_HOLD_FRAMES;
      }
    }
    this.lastRawMidi = rawMidi;

    const outlierHold = this.outlierHoldFrames > 0;
    if (outlierHold) this.outlierHoldFrames -= 1;

    if (this.lockedMidi == null) {
      this.lockedMidi = nearestMidi;
      this.displayCents = (rawMidi - nearestMidi) * 100;
      this.heldTargetCents = this.displayCents;
    } else if (!outlierHold) {
      this.updateLockedNote(rawMidi, nearestMidi, ts);
    }

    const locked = this.lockedMidi;
    const measuredTarget = Math.max(-50, Math.min(50, (rawMidi - locked) * 100));
    if (!outlierHold) this.heldTargetCents = measuredTarget;

    this.displayCents = stepTowardTarget(
      this.displayCents,
      this.heldTargetCents,
      (MAX_CENTS_PER_SEC * dtMs) / 1000,
    );

    this.hzDisplay =
      this.hzDisplay == null
        ? rawHz
        : HZ_DISPLAY_EMA * rawHz + (1 - HZ_DISPLAY_EMA) * this.hzDisplay;

    const instantChartMidi = locked + this.displayCents / 100;
    this.chartMidiDisplay =
      this.chartMidiDisplay == null
        ? instantChartMidi
        : CHART_MIDI_EMA * instantChartMidi +
          (1 - CHART_MIDI_EMA) * this.chartMidiDisplay;

    const { name, octave } = midiToNameOctave(locked);
    const hzRounded = Math.round(this.hzDisplay * 10) / 10;
    return {
      name,
      octave,
      cents: Math.round(this.displayCents),
      displayCents: this.displayCents,
      frequency: hzRounded,
      lockedMidi: locked,
      chartDisplayMidi: this.chartMidiDisplay,
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

    const holdMs =
      this.candidateStartTs == null ? 0 : ts - this.candidateStartTs;
    if (
      this.candidateFrames >= NOTE_CONFIRM_FRAMES &&
      holdMs >= NOTE_MIN_HOLD_MS
    ) {
      this.lockedMidi = nearestMidi;
      this.candidateMidi = null;
      this.candidateFrames = 0;
      this.candidateStartTs = null;
    }
  }
}

/** Rate-limited move; never crosses target (no run-ahead). */
export function stepTowardTarget(
  current: number,
  target: number,
  maxStep: number,
): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}
