import { frequencyToNote } from './noteUtils';

export interface SungNote {
  name: string;
  octave: number;
  midi: number;
  freq: number;
  ts: number;
  /** 0–1 composite confidence at commit time */
  confidence?: number;
}

export interface SungNoteSample {
  frequency: number | null;
  signal: number;
  cents?: number;
  ts?: number;
  /** YIN CMNDF minimum (lower = more confident). Omit to skip YIN gate. */
  yinConfidence?: number;
}

export interface SungNoteDetectorOptions {
  minSignal?: number;
  /** @deprecated use minStableMs */
  minDurationMs?: number;
  minStableMs?: number;
  /** @deprecated use maxCentsVariance */
  maxCentsSpread?: number;
  maxCentsVariance?: number;
  /** Max cents spread required to commit (strict; portamento/vibrato gate) */
  maxCentsSpreadCommit?: number;
  /** When true, commit spread uses maxCentsSpreadVibrato instead of strict commit gate */
  vibratoMode?: boolean;
  maxCentsSpreadVibrato?: number;
  maxJumpSemitones?: number;
  jumpSustainMs?: number;
  /** @deprecated use repeatGapMs */
  debounceMs?: number;
  /** @deprecated use repeatGapMs */
  debounceSameMs?: number;
  debounceNewMs?: number;
  repeatGapMs?: number;
  accentSpikeRatio?: number;
  accentMinStableMs?: number;
  maxYinConfidence?: number;
  midiVoteFrames?: number;
  midiVoteRequired?: number;
  fastConfirmFrames?: number;
  fastConfirmWindowMs?: number;
  differentNoteMinFrames?: number;
  attackDerivativeRatio?: number;
  midiSlopeMaxSemitonesPerSec?: number;
  midiSlopeWindowMs?: number;
  silenceBeforeNewNoteMs?: number;
  newNoteStableAfterSilenceMs?: number;
  minVoicedDurationMs?: number;
  noiseSpreadWindowMs?: number;
  noiseCentsSpreadReject?: number;
  armedReleaseSignalRatio?: number;
  armedReleaseLowMs?: number;
  repeatMiniSilenceMs?: number;
}

interface ResolvedOptions {
  minSignal: number;
  minStableMs: number;
  maxCentsVariance: number;
  maxCentsSpreadCommit: number;
  vibratoMode: boolean;
  maxCentsSpreadVibrato: number;
  maxJumpSemitones: number;
  jumpSustainMs: number;
  debounceNewMs: number;
  repeatGapMs: number;
  accentSpikeRatio: number;
  accentMinStableMs: number;
  maxYinConfidence: number;
  midiVoteFrames: number;
  midiVoteRequired: number;
  fastConfirmFrames: number;
  fastConfirmWindowMs: number;
  differentNoteMinFrames: number;
  attackDerivativeRatio: number;
  midiSlopeMaxSemitonesPerSec: number;
  midiSlopeWindowMs: number;
  silenceBeforeNewNoteMs: number;
  newNoteStableAfterSilenceMs: number;
  minVoicedDurationMs: number;
  noiseSpreadWindowMs: number;
  noiseCentsSpreadReject: number;
  armedReleaseSignalRatio: number;
  armedReleaseLowMs: number;
  repeatMiniSilenceMs: number;
}

export interface SungNoteDetectorDebug {
  yinConfidence: number | null;
  midiVoteAgree: number;
  midiVoteRequired: number;
  lastConfidence: number | null;
  fastConfirmFrames: number;
  attackFastPath: boolean;
  inSlide: boolean;
  armedLocked: boolean;
  voicedMs: number;
}

/**
 * Default detection thresholds for sung-note onset registration.
 * v2: dual-path onset, YIN gate, midi hysteresis.
 * v2.1: anti-noise / anti-slide (portamento, breath, held-note spam).
 */
export const SUNG_NOTE_DETECTOR_DEFAULTS = {
  /** Base RMS gate before adaptive scaling — breath/noise floor */
  minSignal: 0.01,

  /** How long pitch must stay stable before registering (ms) — sustained note */
  minStableMs: 120,

  /** Shorter stability on attack / accent re-attack — staccato note */
  accentMinStableMs: 80,

  /** RMS / rolling average ratio treated as accented re-attack — ta-ta repeat */
  accentSpikeRatio: 1.4,

  /**
   * Max cents spread while tracking a candidate (wider than commit gate).
   * Exceeding ~1.6× resets candidate — slide/portamento in progress.
   */
  maxCentsVariance: 28,

  /**
   * Strict spread gate before commit — rejects vibrato/portamento wide swings.
   * vibratoMode OFF uses this; ON uses maxCentsSpreadVibrato.
   */
  maxCentsSpreadCommit: 22,

  /** Wider commit spread when vibratoMode enabled (legato vibrato) */
  maxCentsSpreadVibrato: 38,

  /** Semitone jump treated as new note candidate */
  maxJumpSemitones: 4,

  /** Sustained jump duration before accepting large interval (ms) */
  jumpSustainMs: 130,

  /** Min gap before re-registering the same pitch — same note held vs ta-ta */
  repeatGapMs: 150,

  /** Min gap before registering a different pitch (ms) */
  debounceNewMs: 90,

  /** YIN CMNDF ceiling — pitch ignored above (noisy/breath false voicing) */
  maxYinConfidence: 0.18,

  midiVoteFrames: 4,
  midiVoteRequired: 3,
  fastConfirmFrames: 2,
  fastConfirmWindowMs: 40,
  differentNoteMinFrames: 2,

  /** Signal rise vs avg → attack fast path */
  attackDerivativeRatio: 0.35,

  /**
   * Max |midi| derivative (semitones/sec) over midiSlopeWindowMs.
   * Above → in slide; reset candidate until pitch flat.
   */
  midiSlopeMaxSemitonesPerSec: 8,

  /** Window for midi slope / noise cents spread (ms) */
  midiSlopeWindowMs: 80,

  /** Silence duration before next onset counts as "new note after gap" (ms) */
  silenceBeforeNewNoteMs: 100,

  /**
   * After silence, first commit needs attack OR this much stable low-spread (ms).
   * Prevents breath/portamento tail registering as onset.
   */
  newNoteStableAfterSilenceMs: 140,

  /** Cumulative voiced time required before commit (ms) — not just 2 frames */
  minVoicedDurationMs: 100,

  /** Short window for breath/noise cents chaos (ms) */
  noiseSpreadWindowMs: 60,

  /**
   * Reject frame when signal present but cents jump wildly (breath/hiss).
   * Works with good YIN but non-harmonic energy.
   */
  noiseCentsSpreadReject: 40,

  /**
   * After commit, same midi locked until signal < ratio×threshold
   * OR armedReleaseLowMs sustained below threshold — trailing slide filter.
   */
  armedReleaseSignalRatio: 0.5,

  armedReleaseLowMs: 80,

  /** Brief signal dip between same-note repeats (ms) — ta-ta vs hold */
  repeatMiniSilenceMs: 40,

  jitterMergeMs: 60,
  differentMidiKeepMs: 200,
  signalAvgRise: 0.94,
  adaptivePeakRatio: 0.28,
  adaptiveFloor: 0.007,
  peakDecay: 0.99,
  peakRise: 0.992,
} as const;

const DEFAULTS: ResolvedOptions = {
  minSignal: SUNG_NOTE_DETECTOR_DEFAULTS.minSignal,
  minStableMs: SUNG_NOTE_DETECTOR_DEFAULTS.minStableMs,
  maxCentsVariance: SUNG_NOTE_DETECTOR_DEFAULTS.maxCentsVariance,
  maxCentsSpreadCommit: SUNG_NOTE_DETECTOR_DEFAULTS.maxCentsSpreadCommit,
  vibratoMode: false,
  maxCentsSpreadVibrato: SUNG_NOTE_DETECTOR_DEFAULTS.maxCentsSpreadVibrato,
  maxJumpSemitones: SUNG_NOTE_DETECTOR_DEFAULTS.maxJumpSemitones,
  jumpSustainMs: SUNG_NOTE_DETECTOR_DEFAULTS.jumpSustainMs,
  debounceNewMs: SUNG_NOTE_DETECTOR_DEFAULTS.debounceNewMs,
  repeatGapMs: SUNG_NOTE_DETECTOR_DEFAULTS.repeatGapMs,
  accentSpikeRatio: SUNG_NOTE_DETECTOR_DEFAULTS.accentSpikeRatio,
  accentMinStableMs: SUNG_NOTE_DETECTOR_DEFAULTS.accentMinStableMs,
  maxYinConfidence: SUNG_NOTE_DETECTOR_DEFAULTS.maxYinConfidence,
  midiVoteFrames: SUNG_NOTE_DETECTOR_DEFAULTS.midiVoteFrames,
  midiVoteRequired: SUNG_NOTE_DETECTOR_DEFAULTS.midiVoteRequired,
  fastConfirmFrames: SUNG_NOTE_DETECTOR_DEFAULTS.fastConfirmFrames,
  fastConfirmWindowMs: SUNG_NOTE_DETECTOR_DEFAULTS.fastConfirmWindowMs,
  differentNoteMinFrames: SUNG_NOTE_DETECTOR_DEFAULTS.differentNoteMinFrames,
  attackDerivativeRatio: SUNG_NOTE_DETECTOR_DEFAULTS.attackDerivativeRatio,
  midiSlopeMaxSemitonesPerSec: SUNG_NOTE_DETECTOR_DEFAULTS.midiSlopeMaxSemitonesPerSec,
  midiSlopeWindowMs: SUNG_NOTE_DETECTOR_DEFAULTS.midiSlopeWindowMs,
  silenceBeforeNewNoteMs: SUNG_NOTE_DETECTOR_DEFAULTS.silenceBeforeNewNoteMs,
  newNoteStableAfterSilenceMs: SUNG_NOTE_DETECTOR_DEFAULTS.newNoteStableAfterSilenceMs,
  minVoicedDurationMs: SUNG_NOTE_DETECTOR_DEFAULTS.minVoicedDurationMs,
  noiseSpreadWindowMs: SUNG_NOTE_DETECTOR_DEFAULTS.noiseSpreadWindowMs,
  noiseCentsSpreadReject: SUNG_NOTE_DETECTOR_DEFAULTS.noiseCentsSpreadReject,
  armedReleaseSignalRatio: SUNG_NOTE_DETECTOR_DEFAULTS.armedReleaseSignalRatio,
  armedReleaseLowMs: SUNG_NOTE_DETECTOR_DEFAULTS.armedReleaseLowMs,
  repeatMiniSilenceMs: SUNG_NOTE_DETECTOR_DEFAULTS.repeatMiniSilenceMs,
};

function resolveOptions(options?: SungNoteDetectorOptions): ResolvedOptions {
  const o = options ?? {};
  const repeatGap =
    o.repeatGapMs ?? o.debounceSameMs ?? o.debounceMs ?? DEFAULTS.repeatGapMs;
  return {
    minSignal: o.minSignal ?? DEFAULTS.minSignal,
    minStableMs: o.minStableMs ?? o.minDurationMs ?? DEFAULTS.minStableMs,
    maxCentsVariance: o.maxCentsVariance ?? o.maxCentsSpread ?? DEFAULTS.maxCentsVariance,
    maxCentsSpreadCommit: o.maxCentsSpreadCommit ?? DEFAULTS.maxCentsSpreadCommit,
    vibratoMode: o.vibratoMode ?? DEFAULTS.vibratoMode,
    maxCentsSpreadVibrato: o.maxCentsSpreadVibrato ?? DEFAULTS.maxCentsSpreadVibrato,
    maxJumpSemitones: o.maxJumpSemitones ?? DEFAULTS.maxJumpSemitones,
    jumpSustainMs: o.jumpSustainMs ?? DEFAULTS.jumpSustainMs,
    debounceNewMs: o.debounceNewMs ?? DEFAULTS.debounceNewMs,
    repeatGapMs: repeatGap,
    accentSpikeRatio: o.accentSpikeRatio ?? DEFAULTS.accentSpikeRatio,
    accentMinStableMs: o.accentMinStableMs ?? DEFAULTS.accentMinStableMs,
    maxYinConfidence: o.maxYinConfidence ?? DEFAULTS.maxYinConfidence,
    midiVoteFrames: o.midiVoteFrames ?? DEFAULTS.midiVoteFrames,
    midiVoteRequired: o.midiVoteRequired ?? DEFAULTS.midiVoteRequired,
    fastConfirmFrames: o.fastConfirmFrames ?? DEFAULTS.fastConfirmFrames,
    fastConfirmWindowMs: o.fastConfirmWindowMs ?? DEFAULTS.fastConfirmWindowMs,
    differentNoteMinFrames: o.differentNoteMinFrames ?? DEFAULTS.differentNoteMinFrames,
    attackDerivativeRatio: o.attackDerivativeRatio ?? DEFAULTS.attackDerivativeRatio,
    midiSlopeMaxSemitonesPerSec:
      o.midiSlopeMaxSemitonesPerSec ?? DEFAULTS.midiSlopeMaxSemitonesPerSec,
    midiSlopeWindowMs: o.midiSlopeWindowMs ?? DEFAULTS.midiSlopeWindowMs,
    silenceBeforeNewNoteMs: o.silenceBeforeNewNoteMs ?? DEFAULTS.silenceBeforeNewNoteMs,
    newNoteStableAfterSilenceMs:
      o.newNoteStableAfterSilenceMs ?? DEFAULTS.newNoteStableAfterSilenceMs,
    minVoicedDurationMs: o.minVoicedDurationMs ?? DEFAULTS.minVoicedDurationMs,
    noiseSpreadWindowMs: o.noiseSpreadWindowMs ?? DEFAULTS.noiseSpreadWindowMs,
    noiseCentsSpreadReject: o.noiseCentsSpreadReject ?? DEFAULTS.noiseCentsSpreadReject,
    armedReleaseSignalRatio:
      o.armedReleaseSignalRatio ?? DEFAULTS.armedReleaseSignalRatio,
    armedReleaseLowMs: o.armedReleaseLowMs ?? DEFAULTS.armedReleaseLowMs,
    repeatMiniSilenceMs: o.repeatMiniSilenceMs ?? DEFAULTS.repeatMiniSilenceMs,
  };
}

interface TimedMidi {
  midi: number;
  ts: number;
}

interface TimedCents {
  cents: number;
  ts: number;
}

const A4_HZ = 440;
const A4_MIDI = 69;

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_HZ) + A4_MIDI;
}

function monotonicNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function midiAgrees(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1;
}

/** Drop same-midi jitter duplicates; never collapse different midi within keep window. */
export function mergeJitterNotes<T extends { ts: number; midi: number }>(notes: T[]): T[] {
  if (notes.length <= 1) return [...notes];
  const out: T[] = [notes[0]];
  for (let i = 1; i < notes.length; i++) {
    const prev = out[out.length - 1];
    const cur = notes[i];
    const gap = cur.ts - prev.ts;
    if (cur.midi === prev.midi && gap < SUNG_NOTE_DETECTOR_DEFAULTS.jitterMergeMs) {
      continue;
    }
    out.push(cur);
  }
  return out;
}

export class SungNoteDetector {
  private opts: ResolvedOptions;

  private candidateStart: number | null = null;
  private candidateMidi: number | null = null;
  private candidateCents: number[] = [];
  private candidateAccent = false;
  private candidateFreq = 440;
  private candidateAfterSilence = false;

  private lastRegistered: { midi: number; ts: number } | null = null;

  private armedMidi: number | null = null;
  private lowSignalSince: number | null = null;

  private jumpStart: number | null = null;
  private jumpMidi: number | null = null;

  private signalPeak = 0.01;
  private signalAvg = 0.01;
  private prevSignal = 0;

  private midiVoteRing: number[] = [];
  private midiSlopeRing: TimedMidi[] = [];
  private centsNoiseRing: TimedCents[] = [];

  private confirmMidi: number | null = null;
  private confirmStart: number | null = null;
  private confirmFrameCount = 0;

  private differentNoteFrames = 0;
  private lastSeenMidi: number | null = null;

  private lastYin: number | null = null;
  private lastConfidence: number | null = null;
  private attackFastPath = false;
  private inSlide = false;

  private silenceSince: number | null = null;
  /** Set when gap ≥ silenceBeforeNewNoteMs; cleared on commit */
  private silenceQualified = false;
  private voicedMsAccum = 0;
  private lastVoicedTs: number | null = null;

  private repeatMiniSilenceReady = false;
  private miniSilenceAccumMs = 0;
  private lastSampleTs = 0;

  constructor(options?: SungNoteDetectorOptions) {
    this.opts = resolveOptions(options);
  }

  reset(): void {
    this.candidateStart = null;
    this.candidateMidi = null;
    this.candidateCents = [];
    this.candidateAccent = false;
    this.candidateFreq = 440;
    this.candidateAfterSilence = false;
    this.lastRegistered = null;
    this.armedMidi = null;
    this.lowSignalSince = null;
    this.jumpStart = null;
    this.jumpMidi = null;
    this.signalPeak = 0.01;
    this.signalAvg = 0.01;
    this.prevSignal = 0;
    this.midiVoteRing = [];
    this.midiSlopeRing = [];
    this.centsNoiseRing = [];
    this.confirmMidi = null;
    this.confirmStart = null;
    this.confirmFrameCount = 0;
    this.differentNoteFrames = 0;
    this.lastSeenMidi = null;
    this.lastYin = null;
    this.lastConfidence = null;
    this.attackFastPath = false;
    this.inSlide = false;
    this.silenceSince = null;
    this.silenceQualified = false;
    this.voicedMsAccum = 0;
    this.lastVoicedTs = null;
    this.repeatMiniSilenceReady = false;
    this.miniSilenceAccumMs = 0;
    this.lastSampleTs = 0;
  }

  getDebugInfo(): SungNoteDetectorDebug {
    return {
      yinConfidence: this.lastYin,
      midiVoteAgree: this.countMidiVote(this.candidateMidi ?? this.lastSeenMidi ?? 0),
      midiVoteRequired: this.opts.midiVoteRequired,
      lastConfidence: this.lastConfidence,
      fastConfirmFrames: this.confirmFrameCount,
      attackFastPath: this.attackFastPath,
      inSlide: this.inSlide,
      armedLocked: this.armedMidi != null,
      voicedMs: this.voicedMsAccum,
    };
  }

  private updateSignalStats(signal: number): void {
    if (signal > 0) {
      this.signalPeak = Math.max(
        this.signalPeak * SUNG_NOTE_DETECTOR_DEFAULTS.peakRise,
        signal,
      );
      this.signalAvg =
        this.signalAvg * SUNG_NOTE_DETECTOR_DEFAULTS.signalAvgRise
        + signal * (1 - SUNG_NOTE_DETECTOR_DEFAULTS.signalAvgRise);
    } else {
      this.signalPeak *= SUNG_NOTE_DETECTOR_DEFAULTS.peakDecay;
    }
  }

  private signalThreshold(): number {
    const adaptive = this.signalPeak * SUNG_NOTE_DETECTOR_DEFAULTS.adaptivePeakRatio;
    return Math.min(
      this.opts.minSignal,
      Math.max(SUNG_NOTE_DETECTOR_DEFAULTS.adaptiveFloor, adaptive),
    );
  }

  private armedReleaseThreshold(threshold: number): number {
    return threshold * this.opts.armedReleaseSignalRatio;
  }

  private pushMidiVote(midi: number): void {
    this.midiVoteRing.push(midi);
    while (this.midiVoteRing.length > this.opts.midiVoteFrames) {
      this.midiVoteRing.shift();
    }
  }

  private countMidiVote(midi: number): number {
    if (this.midiVoteRing.length === 0) return 0;
    return this.midiVoteRing.filter(m => midiAgrees(m, midi)).length;
  }

  private midiVotePasses(midi: number): boolean {
    if (this.midiVoteRing.length < this.opts.midiVoteFrames) return true;
    return this.countMidiVote(midi) >= this.opts.midiVoteRequired;
  }

  private pruneTimedRing<T extends { ts: number }>(ring: T[], ts: number, windowMs: number): T[] {
    const cutoff = ts - windowMs;
    while (ring.length > 0 && ring[0].ts < cutoff) {
      ring.shift();
    }
    return ring;
  }

  private pushMidiSlope(midi: number, ts: number): void {
    this.midiSlopeRing.push({ midi, ts });
    this.pruneTimedRing(this.midiSlopeRing, ts, this.opts.midiSlopeWindowMs);
  }

  private pushCentsNoise(cents: number, ts: number): void {
    this.centsNoiseRing.push({ cents, ts });
    this.pruneTimedRing(this.centsNoiseRing, ts, this.opts.noiseSpreadWindowMs);
  }

  private midiSlopeTooSteep(ts: number): boolean {
    this.pruneTimedRing(this.midiSlopeRing, ts, this.opts.midiSlopeWindowMs);
    if (this.midiSlopeRing.length < 2) return false;
    const first = this.midiSlopeRing[0];
    const last = this.midiSlopeRing[this.midiSlopeRing.length - 1];
    const dtSec = (last.ts - first.ts) / 1000;
    if (dtSec < 0.008) return false;
    const slope = Math.abs(last.midi - first.midi) / dtSec;
    return slope > this.opts.midiSlopeMaxSemitonesPerSec;
  }

  private noiseCentsChaos(): boolean {
    if (this.centsNoiseRing.length < 2) return false;
    const cents = this.centsNoiseRing.map(p => p.cents);
    return this.spread(cents) > this.opts.noiseCentsSpreadReject;
  }

  private maxCentsSpreadForCommit(): number {
    return this.opts.vibratoMode
      ? this.opts.maxCentsSpreadVibrato
      : this.opts.maxCentsSpreadCommit;
  }

  private isAccentReattack(midi: number, signal: number, ts: number): boolean {
    if (!this.lastRegistered || this.lastRegistered.midi !== midi) return false;
    if (ts - this.lastRegistered.ts < this.opts.repeatGapMs) return false;
    if (this.signalAvg <= 0) return false;
    return signal >= this.signalAvg * this.opts.accentSpikeRatio;
  }

  private isAttackSpike(signal: number): boolean {
    const delta = signal - this.prevSignal;
    return (
      delta > 0
      && this.signalAvg > 0
      && delta >= this.signalAvg * this.opts.attackDerivativeRatio
    );
  }

  private effectiveMinStableMs(accent: boolean, attack: boolean): number {
    return accent || attack ? this.opts.accentMinStableMs : this.opts.minStableMs;
  }

  private updateConfirmPath(midi: number, ts: number): void {
    if (
      this.confirmMidi === midi
      && this.confirmStart != null
      && ts - this.confirmStart <= this.opts.fastConfirmWindowMs
    ) {
      this.confirmFrameCount += 1;
    } else {
      this.confirmMidi = midi;
      this.confirmStart = ts;
      this.confirmFrameCount = 1;
    }
  }

  private fastConfirmReady(midi: number, ts: number): boolean {
    return (
      this.confirmMidi === midi
      && this.confirmStart != null
      && ts - this.confirmStart <= this.opts.fastConfirmWindowMs
      && this.confirmFrameCount >= this.opts.fastConfirmFrames
    );
  }

  private updateDifferentNoteFrames(midi: number): void {
    if (this.lastRegistered && this.lastRegistered.midi !== midi) {
      if (this.lastSeenMidi === midi) {
        this.differentNoteFrames += 1;
      } else {
        this.differentNoteFrames = 1;
      }
    } else {
      this.differentNoteFrames = 0;
    }
    this.lastSeenMidi = midi;
  }

  private differentNoteStable(midi: number): boolean {
    if (!this.lastRegistered || this.lastRegistered.midi === midi) return true;
    return this.differentNoteFrames >= this.opts.differentNoteMinFrames;
  }

  private computeConfidence(midi: number, yin: number | null): number {
    const vote = this.countMidiVote(midi) / this.opts.midiVoteFrames;
    const yinScore = yin == null
      ? 0.85
      : Math.max(0, Math.min(1, 1 - yin / this.opts.maxYinConfidence));
    const confirmScore = Math.min(1, this.confirmFrameCount / this.opts.fastConfirmFrames);
    return Math.round((0.45 * yinScore + 0.35 * vote + 0.2 * confirmScore) * 100) / 100;
  }

  private updateSilenceTracking(signal: number, threshold: number, ts: number): void {
    const releaseThr = this.armedReleaseThreshold(threshold);
    const isLow = signal < threshold;
    const isArmedLow = signal < releaseThr;

    if (isLow) {
      if (this.silenceSince == null) this.silenceSince = ts;
      if (ts - this.silenceSince >= this.opts.silenceBeforeNewNoteMs) {
        this.silenceQualified = true;
      }
      if (this.lowSignalSince == null) this.lowSignalSince = ts;
      const dt = ts - (this.lastSampleTs || ts);
      if (dt > 0 && dt < 120) {
        this.miniSilenceAccumMs += dt;
      }
    } else {
      this.silenceSince = null;
      if (!isArmedLow) {
        this.lowSignalSince = null;
      }
      this.miniSilenceAccumMs = 0;
    }

    if (
      this.miniSilenceAccumMs >= this.opts.repeatMiniSilenceMs
      && this.lastRegistered != null
    ) {
      this.repeatMiniSilenceReady = true;
    }

    if (this.armedMidi != null) {
      if (isArmedLow && this.lowSignalSince != null) {
        if (ts - this.lowSignalSince >= this.opts.armedReleaseLowMs) {
          this.armedMidi = null;
          this.lowSignalSince = null;
        }
      } else if (!isArmedLow) {
        this.lowSignalSince = null;
      }
    }
  }

  private accumulateVoiced(ts: number): void {
    if (this.lastVoicedTs != null) {
      const dt = ts - this.lastVoicedTs;
      if (dt > 0 && dt < 150) {
        this.voicedMsAccum += dt;
      }
    }
    this.lastVoicedTs = ts;
  }

  private voicedDurationReady(attack: boolean): boolean {
    const spread = this.spread(this.candidateCents);
    const fastPath = attack && spread <= this.maxCentsSpreadForCommit();
    return this.voicedMsAccum >= this.opts.minVoicedDurationMs || fastPath;
  }

  private commitSpreadOk(): boolean {
    return this.spread(this.candidateCents) <= this.maxCentsSpreadForCommit();
  }

  private afterSilenceOnsetOk(ts: number, attack: boolean): boolean {
    if (!this.candidateAfterSilence) return true;
    if (attack) return true;
    const stableMs = ts - (this.candidateStart ?? ts);
    return (
      stableMs >= this.opts.newNoteStableAfterSilenceMs
      && this.commitSpreadOk()
    );
  }

  private repeatSameNoteOk(midi: number, signal: number, ts: number, attack: boolean): boolean {
    if (!this.lastRegistered || this.lastRegistered.midi !== midi) return true;
    const gap = ts - this.lastRegistered.ts;
    if (gap < this.opts.repeatGapMs) return false;
    const reAttack = attack || this.isAccentReattack(midi, signal, ts);
    return reAttack || this.repeatMiniSilenceReady;
  }

  private resetVoicedAccum(): void {
    this.voicedMsAccum = 0;
    this.lastVoicedTs = null;
  }

  process(sample: SungNoteSample): SungNote | null {
    const ts = sample.ts ?? monotonicNow();
    const dt = this.lastSampleTs > 0 ? ts - this.lastSampleTs : 0;
    this.lastSampleTs = ts;

    const { frequency, signal } = sample;
    const yin = sample.yinConfidence ?? null;
    this.lastYin = yin;

    this.updateSignalStats(signal);
    const threshold = this.signalThreshold();
    const attack = this.isAttackSpike(signal);
    this.attackFastPath = attack;
    this.prevSignal = signal;

    this.updateSilenceTracking(signal, threshold, ts);

    if (!frequency || frequency < 55 || signal < threshold) {
      this.clearCandidate();
      this.confirmMidi = null;
      this.confirmFrameCount = 0;
      this.inSlide = false;
      this.midiSlopeRing = [];
      this.centsNoiseRing = [];
      return null;
    }

    if (yin != null && yin > this.opts.maxYinConfidence) {
      this.clearCandidate();
      return null;
    }

    const info = frequencyToNote(frequency);
    const midi = Math.round(freqToMidi(frequency));
    const cents = sample.cents ?? info.cents;

    this.pushMidiSlope(midi, ts);
    this.pushCentsNoise(cents, ts);

    if (this.noiseCentsChaos()) {
      this.clearCandidate();
      return null;
    }

    if (this.midiSlopeTooSteep(ts)) {
      this.inSlide = true;
      this.clearCandidate();
      return null;
    }
    this.inSlide = false;

    this.pushMidiVote(midi);
    this.updateConfirmPath(midi, ts);
    this.updateDifferentNoteFrames(midi);

    if (!this.midiVotePasses(midi)) {
      return null;
    }

    if (this.armedMidi != null && midi !== this.armedMidi) {
      this.armedMidi = null;
      this.lowSignalSince = null;
    }

    const accentRepeat = this.isAccentReattack(midi, signal, ts);
    if (accentRepeat && this.armedMidi === midi) {
      this.armedMidi = null;
      this.startCandidate(midi, cents, ts, true, frequency, this.silenceQualified);
    }

    if (this.candidateMidi != null && this.candidateStart != null) {
      const semiDiff = Math.abs(midi - this.candidateMidi);

      if (semiDiff <= 1 && Math.abs(cents) <= this.opts.maxCentsVariance + 8) {
        this.candidateCents.push(cents);
        this.candidateFreq = frequency;
        this.jumpStart = null;
        this.jumpMidi = null;
        this.accumulateVoiced(ts);

        if (this.spread(this.candidateCents) > this.opts.maxCentsVariance * 1.6) {
          this.startCandidate(midi, cents, ts, accentRepeat || attack, frequency, this.silenceQualified);
          return null;
        }

        const stableMs = this.effectiveMinStableMs(this.candidateAccent, attack);
        const stabilityReady = ts - this.candidateStart >= stableMs;
        const fastReady = this.fastConfirmReady(midi, ts);

        if ((stabilityReady || fastReady) && this.differentNoteStable(midi)) {
          if (!this.commitSpreadOk()) return null;
          if (!this.voicedDurationReady(attack)) return null;
          if (!this.afterSilenceOnsetOk(ts, attack)) return null;
          if (!this.repeatSameNoteOk(midi, signal, ts, attack)) return null;
          return this.tryRegister(
            info.name,
            info.octave,
            midi,
            ts,
            this.candidateFreq,
            signal,
            attack,
          );
        }
        return null;
      }

      if (semiDiff > this.opts.maxJumpSemitones) {
        if (this.jumpMidi === midi) {
          if (this.jumpStart != null && ts - this.jumpStart >= this.opts.jumpSustainMs) {
            this.startCandidate(midi, cents, ts, false, frequency, this.silenceQualified);
          }
        } else {
          this.jumpMidi = midi;
          this.jumpStart = ts;
        }
        return null;
      }

      this.startCandidate(midi, cents, ts, accentRepeat || attack, frequency, this.silenceQualified);
      return null;
    }

    this.startCandidate(midi, cents, ts, accentRepeat || attack, frequency, this.silenceQualified);
    return null;
  }

  private startCandidate(
    midi: number,
    cents: number,
    ts: number,
    accent: boolean,
    freq: number,
    afterSilence: boolean,
  ): void {
    this.candidateMidi = midi;
    this.candidateStart = ts;
    this.candidateCents = [cents];
    this.candidateAccent = accent;
    this.candidateFreq = freq;
    this.candidateAfterSilence = afterSilence;
    this.jumpStart = null;
    this.jumpMidi = null;
    this.resetVoicedAccum();
    this.accumulateVoiced(ts);
  }

  private clearCandidate(): void {
    this.candidateStart = null;
    this.candidateMidi = null;
    this.candidateCents = [];
    this.candidateAccent = false;
    this.candidateAfterSilence = false;
    this.jumpStart = null;
    this.jumpMidi = null;
    this.resetVoicedAccum();
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
    signal: number,
    attack: boolean,
  ): SungNote | null {
    if (this.armedMidi === midi) return null;

    if (this.lastRegistered) {
      const sameNote = this.lastRegistered.midi === midi;
      const gap = ts - this.lastRegistered.ts;
      if (sameNote) {
        if (gap < this.opts.repeatGapMs) return null;
        if (!this.repeatSameNoteOk(midi, signal, ts, attack)) return null;
      } else {
        if (gap < this.opts.debounceNewMs) return null;
        if (!this.differentNoteStable(midi)) return null;
      }
    }

    const confidence = this.computeConfidence(midi, this.lastYin);
    this.lastConfidence = confidence;
    const commitTs = monotonicNow();

    this.armedMidi = midi;
    this.lowSignalSince = null;
    this.lastRegistered = { midi, ts: commitTs };
    this.repeatMiniSilenceReady = false;
    this.miniSilenceAccumMs = 0;
    this.silenceQualified = false;
    this.clearCandidate();
    this.confirmFrameCount = 0;
    return { name, octave, midi, freq, ts: commitTs, confidence };
  }
}
