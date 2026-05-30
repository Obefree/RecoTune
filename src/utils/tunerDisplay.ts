import { freqToMidi, frequencyToNote } from './noteUtils';

const A4 = 440;
const A4_MIDI = 69;

/** Frames with consistent neighbor before note letter changes. */
const NOTE_CONFIRM_FRAMES = 2;
/** Raw must sit clearly toward the next semitone (¢ from locked center). */
const NOTE_SWITCH_OFFSET_CENTS = 38;
/** Max display ¢ change per second (smooth needle, no overshoot past target). */
const MAX_CENTS_PER_SEC = 400;
/** Light EMA for Hz readout only — not used for note / needle. */
const HZ_DISPLAY_EMA = 0.42;

export interface TunerDisplayFrame {
  name: string;
  octave: number;
  /** Rounded for ¢ text */
  cents: number;
  /** Fractional — feed TunerNeedle */
  displayCents: number;
  frequency: number;
  lockedMidi: number;
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
  private candidateMidi: number | null = null;
  private candidateFrames = 0;
  private lastTs: number | null = null;

  reset(): void {
    this.lockedMidi = null;
    this.displayCents = 0;
    this.hzDisplay = null;
    this.candidateMidi = null;
    this.candidateFrames = 0;
    this.lastTs = null;
  }

  process(rawHz: number, ts = Date.now()): TunerDisplayFrame | null {
    if (!Number.isFinite(rawHz) || rawHz < 55) return null;

    const dtMs =
      this.lastTs == null ? 55 : Math.min(120, Math.max(16, ts - this.lastTs));
    this.lastTs = ts;

    const rawMidi = freqToMidi(rawHz);
    const nearestMidi = Math.round(rawMidi);

    if (this.lockedMidi == null) {
      this.lockedMidi = nearestMidi;
      this.displayCents = (rawMidi - nearestMidi) * 100;
    } else {
      this.updateLockedNote(rawMidi, nearestMidi);
    }

    const locked = this.lockedMidi;
    const targetCents = Math.max(-50, Math.min(50, (rawMidi - locked) * 100));
    this.displayCents = stepTowardTarget(
      this.displayCents,
      targetCents,
      (MAX_CENTS_PER_SEC * dtMs) / 1000,
    );

    this.hzDisplay =
      this.hzDisplay == null
        ? rawHz
        : HZ_DISPLAY_EMA * rawHz + (1 - HZ_DISPLAY_EMA) * this.hzDisplay;

    const { name, octave } = midiToNameOctave(locked);
    return {
      name,
      octave,
      cents: Math.round(this.displayCents),
      displayCents: this.displayCents,
      frequency: this.hzDisplay,
      lockedMidi: locked,
    };
  }

  private updateLockedNote(rawMidi: number, nearestMidi: number): void {
    const locked = this.lockedMidi!;
    const offsetFromLocked = (rawMidi - locked) * 100;

    if (nearestMidi === locked) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      return;
    }

    const towardNeighbor =
      Math.abs(offsetFromLocked) >= NOTE_SWITCH_OFFSET_CENTS &&
      Math.sign(offsetFromLocked) === Math.sign(nearestMidi - locked);

    if (!towardNeighbor) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      return;
    }

    if (this.candidateMidi === nearestMidi) {
      this.candidateFrames += 1;
    } else {
      this.candidateMidi = nearestMidi;
      this.candidateFrames = 1;
    }

    if (this.candidateFrames >= NOTE_CONFIRM_FRAMES) {
      this.lockedMidi = nearestMidi;
      this.displayCents = (rawMidi - nearestMidi) * 100;
      this.candidateMidi = null;
      this.candidateFrames = 0;
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
