import type { RegisteredNoteEvent } from '../hooks/useSungNoteHistory';
import { frequencyToNote, NOTE_NAMES } from './noteUtils';

export type BasicPitchServerNote = {
  startMs: number;
  endMs: number;
  midi: number;
  amplitude?: number;
};
import {
  type PitchFrame,
  PITCH_FRAME_RING,
  freqToMidiFloat,
} from './pitchFrame';

export type TranscribedNoteSegment = {
  startMs: number;
  endMs: number;
  durationMs: number;
  midi: number;
  midiFloatMedian: number;
  freqMedian: number;
  noteName: string;
  octave: number;
  centsMean: number;
  confidenceMean: number;
  frameCount: number;
};

export type TranscriptionResult = {
  segments: TranscribedNoteSegment[];
  voicedFrameCount: number;
  /** 0–1 aggregate quality for gating PLAY */
  confidence: number;
};

const TRANSCRIPTION = {
  minRms: 0.006,
  maxYin: 0.21,
  /** Chart trace only — keeps glide visible without phantom notes on strip. */
  chartMinRms: 0.004,
  chartMaxYin: 0.24,
  pitchJumpSemitones: 0.72,
  transitionConfirmFrames: 2,
  /** Shorter so genuine fast notes survive (~2 frames at melody cadence). */
  minSegmentMs: 110,
  silenceGapMs: 220,
  /** Bridge brief dropouts between two sung regions (portamento / breath). */
  voicedBridgeGapMs: 130,
  mergeSameMidiGapMs: 130,
  mergeSameMidiMaxCents: 55,
  shortFragmentMs: 150,
  shortFragmentFrames: 2,
  shortFragmentMaxSemitones: 1.05,
  /**
   * Energy-onset split for repeated same-pitch notes (C-C-C).
   * Pitch alone cannot separate repeats; detect an amplitude release (dip below
   * `onsetReleaseRatio` × running peak) followed by a re-attack (recovery above
   * `onsetAttackRatio` × peak) and start a fresh note at the same pitch.
   */
  onsetPeakDecay: 0.9,
  onsetReleaseRatio: 0.62,
  onsetAttackRatio: 0.9,
  onsetMinRepeatMs: 90,
} as const;

/** Contour / transcription voiced gate. */
export function isVoicedFrame(f: PitchFrame): boolean {
  if (f.freq == null || f.midi == null) return false;
  if (f.freq < PITCH_FRAME_RING.freqMin || f.freq > PITCH_FRAME_RING.freqMax) return false;
  if (f.rms < TRANSCRIPTION.minRms) return false;
  if (f.yinConfidence != null && f.yinConfidence > TRANSCRIPTION.maxYin) return false;
  return true;
}

/** Melody pitch chart — slightly softer than contour (continuous trace on glides). */
export function isChartVoicedFrame(f: PitchFrame): boolean {
  if (f.freq == null || f.midi == null) return false;
  if (f.freq < PITCH_FRAME_RING.freqMin || f.freq > PITCH_FRAME_RING.freqMax) return false;
  if (f.rms < TRANSCRIPTION.chartMinRms) return false;
  if (f.yinConfidence != null && f.yinConfidence > TRANSCRIPTION.chartMaxYin) return false;
  return true;
}

function isBridgeCandidate(f: PitchFrame): boolean {
  if (f.freq == null || f.midi == null) return false;
  if (f.freq < PITCH_FRAME_RING.freqMin || f.freq > PITCH_FRAME_RING.freqMax) return false;
  return f.rms >= TRANSCRIPTION.chartMinRms;
}

/** Include short unvoiced gaps between sung regions so glides are not empty. */
function expandVoicedFrames(frames: PitchFrame[]): PitchFrame[] {
  const strictIdx: number[] = [];
  frames.forEach((f, i) => {
    if (isVoicedFrame(f)) strictIdx.push(i);
  });
  if (strictIdx.length === 0) return [];

  const keep = new Set<number>();
  for (let k = 0; k < strictIdx.length; k++) {
    const i = strictIdx[k];
    keep.add(i);
    if (k === 0) continue;
    const prevI = strictIdx[k - 1];
    const gap = frames[i].t - frames[prevI].t;
    if (gap > TRANSCRIPTION.voicedBridgeGapMs) continue;
    for (let j = prevI + 1; j < i; j++) {
      if (isBridgeCandidate(frames[j])) keep.add(j);
    }
  }

  return frames.filter((_, i) => keep.has(i));
}

function frameConfidence(f: PitchFrame): number {
  const yin = f.yinConfidence;
  const yinScore =
    yin == null ? 0.85 : Math.max(0, Math.min(1, 1 - yin / TRANSCRIPTION.maxYin));
  const rmsScore = Math.min(1, f.rms / 0.06);
  return 0.6 * yinScore + 0.4 * rmsScore;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

interface RawSegment {
  frames: PitchFrame[];
  /** Started by an energy re-attack at the same pitch (repeated note) — never merge back. */
  onsetStart?: boolean;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function withSmoothedMidi(frame: PitchFrame, midi: number): PitchFrame {
  const rounded = Math.round(midi);
  return {
    ...frame,
    midi,
    freq: midiToFreq(midi),
    cents: Math.round((midi - rounded) * 100),
  };
}

function smoothVoicedFrames(voiced: PitchFrame[]): PitchFrame[] {
  if (voiced.length < 3) return voiced;
  return voiced.map((frame, i) => {
    const start = Math.max(0, i - 1);
    const end = Math.min(voiced.length, i + 2);
    const window = voiced.slice(start, end).map(f => f.midi!).filter(m => m != null);
    return withSmoothedMidi(frame, median(window));
  });
}

function segmentDuration(seg: RawSegment): number {
  if (seg.frames.length === 0) return 0;
  return seg.frames[seg.frames.length - 1].t - seg.frames[0].t;
}

function segmentMedianMidiFloat(frames: PitchFrame[]): number {
  return median(frames.map(f => f.midi!));
}

function isConfirmedPitchMove(voiced: PitchFrame[], index: number, currentMedian: number): boolean {
  const frames: PitchFrame[] = [];
  for (let i = index; i < voiced.length && frames.length < TRANSCRIPTION.transitionConfirmFrames; i++) {
    if (i > index && voiced[i].t - voiced[i - 1].t >= TRANSCRIPTION.silenceGapMs) break;
    frames.push(voiced[i]);
  }
  if (frames.length < TRANSCRIPTION.transitionConfirmFrames) return false;
  const nextMedian = segmentMedianMidiFloat(frames);
  return Math.abs(nextMedian - currentMedian) >= TRANSCRIPTION.pitchJumpSemitones;
}

function splitRawSegments(voiced: PitchFrame[]): RawSegment[] {
  if (voiced.length === 0) return [];

  const segments: RawSegment[] = [];
  let current: PitchFrame[] = [voiced[0]];
  let currentOnset = false;
  let peak = voiced[0].rms;
  let released = false;

  for (let i = 1; i < voiced.length; i++) {
    const prev = voiced[i - 1];
    const cur = voiced[i];
    const gap = cur.t - prev.t;
    const med = segmentMedianMidiFloat(current);
    const semiJump = Math.abs(cur.midi! - med);

    peak = Math.max(cur.rms, peak * TRANSCRIPTION.onsetPeakDecay);
    if (cur.rms < peak * TRANSCRIPTION.onsetReleaseRatio) released = true;

    if (gap >= TRANSCRIPTION.silenceGapMs) {
      segments.push({ frames: current, onsetStart: currentOnset });
      current = [cur];
      currentOnset = false;
      peak = cur.rms;
      released = false;
      continue;
    }

    if (
      semiJump >= TRANSCRIPTION.pitchJumpSemitones
      && isConfirmedPitchMove(voiced, i, med)
    ) {
      segments.push({ frames: current, onsetStart: currentOnset });
      current = [cur];
      currentOnset = false;
      peak = cur.rms;
      released = false;
      continue;
    }

    // Repeated same-pitch note: amplitude dipped then re-attacked while pitch held.
    const segDurMs = cur.t - current[0].t;
    const reAttack =
      released
      && semiJump < TRANSCRIPTION.pitchJumpSemitones
      && cur.rms > peak * TRANSCRIPTION.onsetAttackRatio
      && cur.rms > prev.rms
      && segDurMs >= TRANSCRIPTION.onsetMinRepeatMs;

    if (reAttack) {
      segments.push({ frames: current, onsetStart: currentOnset });
      current = [cur];
      currentOnset = true;
      peak = cur.rms;
      released = false;
      continue;
    }

    current.push(cur);
  }

  if (current.length > 0) segments.push({ frames: current, onsetStart: currentOnset });
  return segments;
}

function mergeNearSameMidiSegments(raw: RawSegment[]): RawSegment[] {
  if (raw.length <= 1) return raw;

  const out: RawSegment[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = out[out.length - 1];
    const cur = raw[i];
    const prevMed = segmentMedianMidiFloat(prev.frames);
    const curMed = segmentMedianMidiFloat(cur.frames);
    const prevMidi = Math.round(prevMed);
    const curMidi = Math.round(curMed);
    const gap = cur.frames[0].t - prev.frames[prev.frames.length - 1].t;
    const centsDiff = Math.abs((curMed - prevMed) * 100);

    if (
      prevMidi === curMidi
      && !cur.onsetStart
      && gap < TRANSCRIPTION.mergeSameMidiGapMs
      && centsDiff < TRANSCRIPTION.mergeSameMidiMaxCents
    ) {
      out[out.length - 1] = {
        frames: [...prev.frames, ...cur.frames],
        onsetStart: prev.onsetStart,
      };
    } else {
      out.push(cur);
    }
  }
  return out;
}

function absorbShortFragments(raw: RawSegment[]): RawSegment[] {
  if (raw.length <= 1) return raw;

  const out: RawSegment[] = [];
  let i = 0;
  while (i < raw.length) {
    const cur = raw[i];
    const curMed = segmentMedianMidiFloat(cur.frames);
    const isShort =
      segmentDuration(cur) < TRANSCRIPTION.shortFragmentMs
      && cur.frames.length <= TRANSCRIPTION.shortFragmentFrames;

    if (!isShort) {
      out.push(cur);
      i++;
      continue;
    }

    const prev = out[out.length - 1];
    const next = raw[i + 1];
    const prevMed = prev ? segmentMedianMidiFloat(prev.frames) : null;
    const nextMed = next ? segmentMedianMidiFloat(next.frames) : null;

    // A short re-attacked repeat at the same pitch is a real note, not a glitch — keep it.
    if (cur.onsetStart && prevMed != null && Math.round(prevMed) === Math.round(curMed)) {
      out.push(cur);
      i++;
      continue;
    }

    if (
      prev
      && next
      && prevMed != null
      && nextMed != null
      && Math.round(prevMed) === Math.round(nextMed)
    ) {
      out[out.length - 1] = {
        frames: [...prev.frames, ...cur.frames, ...next.frames],
        onsetStart: prev.onsetStart,
      };
      i += 2;
      continue;
    }

    const prevDiff = prevMed == null ? Infinity : Math.abs(curMed - prevMed);
    const nextDiff = nextMed == null ? Infinity : Math.abs(curMed - nextMed);
    const canMergePrev = prev != null && prevDiff <= TRANSCRIPTION.shortFragmentMaxSemitones;
    const canMergeNext = next != null && nextDiff <= TRANSCRIPTION.shortFragmentMaxSemitones;

    if (canMergePrev && (!canMergeNext || prevDiff <= nextDiff)) {
      out[out.length - 1] = {
        frames: [...prev.frames, ...cur.frames],
        onsetStart: prev.onsetStart,
      };
      i++;
      continue;
    }

    if (canMergeNext) {
      out.push({ frames: [...cur.frames, ...next.frames], onsetStart: cur.onsetStart });
      i += 2;
      continue;
    }

    out.push(cur);
    i++;
  }

  return out;
}

function refineRawSegments(raw: RawSegment[]): RawSegment[] {
  return mergeNearSameMidiSegments(absorbShortFragments(mergeNearSameMidiSegments(raw)));
}

function estimateFrameStepMs(frames: PitchFrame[]): number {
  if (frames.length < 2) return 65;
  const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t).filter(g => g > 15 && g < 180);
  if (gaps.length === 0) return 65;
  return Math.max(45, Math.min(110, median(gaps)));
}

function fitSegment(frames: PitchFrame[]): TranscribedNoteSegment | null {
  if (frames.length === 0) return null;
  const startMs = frames[0].t;
  const endMs = frames[frames.length - 1].t + estimateFrameStepMs(frames);
  const durationMs = endMs - startMs;
  if (durationMs < TRANSCRIPTION.minSegmentMs && frames.length < 2) return null;

  const midiFloatMedian = segmentMedianMidiFloat(frames);
  const midi = Math.round(midiFloatMedian);
  const freqs = frames.map(f => f.freq!).filter(Boolean);
  const freqMedian = median(freqs);
  const info = frequencyToNote(freqMedian);
  const centsVals = frames.map(f => (f.midi! - midi) * 100);

  return {
    startMs,
    endMs: Math.max(endMs, startMs + TRANSCRIPTION.minSegmentMs),
    durationMs: Math.max(durationMs, TRANSCRIPTION.minSegmentMs),
    midi,
    midiFloatMedian,
    freqMedian,
    noteName: info.name,
    octave: info.octave,
    centsMean: mean(centsVals),
    confidenceMean: mean(frames.map(frameConfidence)),
    frameCount: frames.length,
  };
}

/**
 * Contour-based note extraction from pitch frame ring (MVP 1).
 */
export function transcribeFromPitchFrames(frames: PitchFrame[]): TranscriptionResult {
  const voiced = smoothVoicedFrames(expandVoicedFrames(frames));
  if (voiced.length === 0) {
    return { segments: [], voicedFrameCount: 0, confidence: 0 };
  }

  const split = refineRawSegments(splitRawSegments(voiced));
  const segments: TranscribedNoteSegment[] = [];

  for (const raw of split) {
    // Drop only true 1-frame glitches; keep genuine fast notes (≥2 frames).
    if (raw.frames.length < 2) continue;
    const seg = fitSegment(raw.frames);
    if (seg) segments.push(seg);
  }

  const confidences = segments.map(s => s.confidenceMean);
  const avgConf = confidences.length ? mean(confidences) : 0;
  const coverage = voiced.length / Math.max(frames.length, 1);
  const confidence = Math.round(avgConf * (0.7 + 0.3 * coverage) * 100) / 100;

  return {
    segments,
    voicedFrameCount: voiced.length,
    confidence,
  };
}

/** Gate PLAY / strip on transcribed segments vs classic detector. */
export function isTranscriptionConfidenceOk(result: TranscriptionResult): boolean {
  if (result.segments.length === 0) return false;
  if (result.voicedFrameCount < 3) return false;
  if (result.segments.length === 1) {
    return result.confidence >= 0.2 && result.segments[0].frameCount >= 3;
  }
  return result.confidence >= 0.25;
}

/** Hop between melodyMidi samples — keep in sync with `extractMelodyMidi` in snippetAnalyzerHtml. */
export const SNIPPET_MELODY_HOP_MS = 280;

/** Snippet / НАЙТИ hum contour (midi only) → timed segments for strip + staff. */
export function segmentsFromMelodyMidi(
  melodyMidi: number[],
  opts?: { hopMs?: number },
): TranscriptionResult {
  const hopMs = opts?.hopMs ?? SNIPPET_MELODY_HOP_MS;
  const midiNotes = melodyMidi
    .map(m => Math.round(m))
    .filter(m => m >= 36 && m <= 96);
  if (midiNotes.length === 0) {
    return { segments: [], voicedFrameCount: 0, confidence: 0 };
  }
  const noteDurMs = Math.max(120, Math.round(hopMs * 0.92));
  const segments: TranscribedNoteSegment[] = midiNotes.map((midi, i) => {
    const startMs = i * hopMs;
    const endMs = startMs + noteDurMs;
    const noteIdx = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const freqMedian = 440 * 2 ** ((midi - 69) / 12);
    return {
      startMs,
      endMs,
      durationMs: noteDurMs,
      midi,
      midiFloatMedian: midi,
      freqMedian,
      noteName: NOTE_NAMES[noteIdx],
      octave,
      centsMean: 0,
      confidenceMean: 0.55,
      frameCount: Math.max(1, Math.round(noteDurMs / 20)),
    };
  });
  const avgConf = mean(segments.map(s => s.confidenceMean));
  return {
    segments,
    voicedFrameCount: segments.length,
    confidence: Math.round(avgConf * 100) / 100,
  };
}

/** Map basic-pitch server notes → MelodyScreen segments (no fake fill). */
export function segmentsFromBasicPitchNotes(notes: BasicPitchServerNote[]): TranscriptionResult {
  if (notes.length === 0) {
    return { segments: [], voicedFrameCount: 0, confidence: 0 };
  }
  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs || a.midi - b.midi);
  const segments: TranscribedNoteSegment[] = sorted.map(n => {
    const midi = Math.round(n.midi);
    const noteIdx = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const freqMedian = 440 * 2 ** ((midi - 69) / 12);
    const durationMs = Math.max(50, n.endMs - n.startMs);
    const confidenceMean = Math.min(1, Math.max(0.35, n.amplitude ?? 0.7));
    return {
      startMs: n.startMs,
      endMs: n.endMs,
      durationMs,
      midi,
      midiFloatMedian: n.midi,
      freqMedian,
      noteName: NOTE_NAMES[noteIdx],
      octave,
      centsMean: 0,
      confidenceMean,
      frameCount: Math.max(1, Math.round(durationMs / 20)),
    };
  });
  const confidences = segments.map(s => s.confidenceMean);
  const avgConf = confidences.length ? mean(confidences) : 0;
  return {
    segments,
    voicedFrameCount: segments.length,
    confidence: Math.round(avgConf * 100) / 100,
  };
}

export function segmentsToRegisteredEvents(
  segments: TranscribedNoteSegment[],
): RegisteredNoteEvent[] {
  return segments.map(seg => ({
    name: seg.noteName,
    octave: seg.octave,
    midi: seg.midi,
    ts: seg.startMs,
    freq: seg.freqMedian,
    confidence: seg.confidenceMean,
  }));
}

/** Map raw frequency to midi float for tests / debug */
export { freqToMidiFloat };
