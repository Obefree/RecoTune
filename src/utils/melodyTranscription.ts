import type { RegisteredNoteEvent } from '../hooks/useSungNoteHistory';
import { frequencyToNote } from './noteUtils';
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
  minRms: 0.008,
  maxYin: 0.18,
  stableCents: 45,
  pitchJumpSemitones: 0.65,
  minSegmentMs: 165,
  silenceGapMs: 185,
  mergeSameMidiGapMs: 42,
  mergeSameMidiMaxCents: 28,
} as const;

function isVoicedFrame(f: PitchFrame): boolean {
  if (f.freq == null || f.midi == null) return false;
  if (f.freq < PITCH_FRAME_RING.freqMin || f.freq > PITCH_FRAME_RING.freqMax) return false;
  if (f.rms < TRANSCRIPTION.minRms) return false;
  if (f.yinConfidence != null && f.yinConfidence > TRANSCRIPTION.maxYin) return false;
  return true;
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
}

function midiSpreadCents(frames: PitchFrame[]): number {
  const midis = frames.map(f => f.midi!).filter(m => m != null);
  if (midis.length < 2) return 0;
  const med = median(midis);
  const cents = midis.map(m => (m - med) * 100);
  return Math.max(...cents) - Math.min(...cents);
}

function segmentMedianMidiFloat(frames: PitchFrame[]): number {
  return median(frames.map(f => f.midi!));
}

function splitRawSegments(voiced: PitchFrame[]): RawSegment[] {
  if (voiced.length === 0) return [];

  const segments: RawSegment[] = [];
  let current: PitchFrame[] = [voiced[0]];

  for (let i = 1; i < voiced.length; i++) {
    const prev = voiced[i - 1];
    const cur = voiced[i];
    const gap = cur.t - prev.t;
    const med = segmentMedianMidiFloat(current);
    const semiJump = Math.abs(cur.midi! - med);

    if (gap >= TRANSCRIPTION.silenceGapMs) {
      segments.push({ frames: current });
      current = [cur];
      continue;
    }

    if (semiJump >= TRANSCRIPTION.pitchJumpSemitones) {
      segments.push({ frames: current });
      current = [cur];
      continue;
    }

    const spread = midiSpreadCents([...current, cur]);
    if (spread > TRANSCRIPTION.stableCents) {
      segments.push({ frames: current });
      current = [cur];
      continue;
    }

    current.push(cur);
  }

  if (current.length > 0) segments.push({ frames: current });
  return segments;
}

function mergeMicroSegments(raw: RawSegment[]): RawSegment[] {
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
      && gap < TRANSCRIPTION.mergeSameMidiGapMs
      && centsDiff < TRANSCRIPTION.mergeSameMidiMaxCents
    ) {
      out[out.length - 1] = {
        frames: [...prev.frames, ...cur.frames],
      };
    } else {
      out.push(cur);
    }
  }
  return out;
}

function fitSegment(frames: PitchFrame[]): TranscribedNoteSegment | null {
  if (frames.length === 0) return null;
  const startMs = frames[0].t;
  const endMs = frames[frames.length - 1].t;
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
  const voiced = frames.filter(isVoicedFrame);
  if (voiced.length === 0) {
    return { segments: [], voicedFrameCount: 0, confidence: 0 };
  }

  const split = mergeMicroSegments(splitRawSegments(voiced));
  const segments: TranscribedNoteSegment[] = [];

  for (const raw of split) {
    const dur = raw.frames[raw.frames.length - 1].t - raw.frames[0].t;
    if (dur < TRANSCRIPTION.minSegmentMs && raw.frames.length < 3) continue;
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
