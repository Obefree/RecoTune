import type { QuantizedNote } from './melodyKeyQuantize';
import type { RegisteredNoteEvent } from '../hooks/useSungNoteHistory';
import { interOnsetGapsMs, medianInterOnsetMs } from './melodyAnalysis';
import {
  chordSymbolToMidiNotes,
  chordsFromAppliedSymbols,
  type SuggestedChord,
} from './melodyChords';

export interface MelodyPlayNote {
  midi: number;
  durationMs: number;
  startMs: number;
}

export interface MelodyPlayChord {
  symbol: string;
  startMs: number;
  durationMs: number;
  midiNotes: number[];
}

export interface MelodyPlaybackPayload {
  notes: MelodyPlayNote[];
  chords: MelodyPlayChord[];
  /** Which pitch source was used for notes. */
  pitchSource: 'raw' | 'quantized';
}

/** Minimal pitch history for sung-tail duration on last note. */
export interface PitchHistoryPoint {
  ts: number;
  midi?: number;
}

export interface MelodyPlaybackOptions {
  /** Detected BPM — only when quantizeRhythm is true. */
  bpmApprox?: number | null;
  /** Snap note durations to 16th grid at BPM. Default OFF — preserves sung timing. */
  quantizeRhythm?: boolean;
  /** Articulation gap subtracted between consecutive onsets (ms). Default 25. */
  noteGapMs?: number;
  /** Recent pitch frames — used for last-note tail and single-note context. */
  pitchHistory?: PitchHistoryPoint[];
}

/** Playback timing constants (also referenced by WebView engine). */
export const MELODY_PLAYBACK = {
  /** Small separation between legato notes — not a full rest. */
  ARTICULATION_GAP_MS: 25,
  /** Floor only for very fast repeated same-pitch notes. */
  MIN_SAME_PITCH_MS: 120,
  /** Merge same-pitch jitter closer than this (duplicate onset). */
  MERGE_GAP_MS: 60,
  /** Gaps above median × this are kept as user pauses (not compressed). */
  PAUSE_OUTLIER_MULT: 3,
  LAST_NOTE_HOLD_MULT: 1.8,
  LAST_NOTE_MIN_MS: 600,
  LAST_NOTE_MAX_MS: 1500,
  SINGLE_NOTE_MIN_MS: 800,
  SINGLE_NOTE_FALLBACK_MS: 1200,
  MIN_NOTES_WARNING: 3,
  /** Web Audio floor — engine only; payload may be shorter. */
  ENGINE_MIN_DURATION_MS: 40,
  /** Contour PLAY: audible floor so short segments still sound. */
  CONTOUR_MIN_DURATION_MS: 200,
  ENGINE_MAX_DURATION_MS: 4000,
  /** Piano legato: release at this fraction of scheduled duration. */
  PIANO_LEGATO_RELEASE_RATIO: 0.92,
} as const;

/**
 * Drop jitter duplicates: same MIDI and gap to previous kept onset < MERGE_GAP_MS.
 * Different pitches or wider gaps stay separate (repeated E4 · E4 · E4).
 * Returns kept events and their indices in the original array (for quantized pitch lookup).
 */
export function mergeDuplicateDetections<T extends { ts: number; midi?: number }>(
  events: T[],
): { events: T[]; indices: number[] } {
  if (events.length <= 1) {
    return { events: [...events], indices: events.map((_, i) => i) };
  }
  const out: T[] = [events[0]];
  const indices: number[] = [0];
  for (let i = 1; i < events.length; i++) {
    const prev = out[out.length - 1];
    const gap = events[i].ts - prev.ts;
    const samePitch =
      prev.midi != null
      && events[i].midi != null
      && prev.midi === events[i].midi;
    if (samePitch && gap < MELODY_PLAYBACK.MERGE_GAP_MS) continue;
    out.push(events[i]);
    indices.push(i);
  }
  return { events: out, indices };
}

/** True when fit-to-key and quantized pitch list matches event count. */
export function shouldUseQuantizedPlayback(
  fitToKey: boolean,
  quantizedNotes: QuantizedNote[],
  registeredEvents: RegisteredNoteEvent[],
): boolean {
  return fitToKey && quantizedNotes.length > 0 && quantizedNotes.length === registeredEvents.length;
}

/**
 * Ms from onset until last stable pitch frame matching the note (from pitch history tail).
 */
export function sungTailMsAfterOnset(
  onsetTs: number,
  onsetMidi: number,
  pitchHistory: PitchHistoryPoint[],
): number | null {
  if (pitchHistory.length === 0) return null;

  let lastMatchTs: number | null = null;
  for (const p of pitchHistory) {
    if (p.ts < onsetTs - 30) continue;
    const midi = p.midi != null ? Math.round(p.midi) : null;
    if (midi != null && Math.abs(midi - onsetMidi) <= 1) {
      lastMatchTs = p.ts;
    }
  }

  if (lastMatchTs == null || lastMatchTs <= onsetTs) return null;
  return lastMatchTs - onsetTs;
}

function singleNoteDurationMs(medianGap: number, pitchHistory: PitchHistoryPoint[], onsetTs: number, midi: number): number {
  const tail = sungTailMsAfterOnset(onsetTs, midi, pitchHistory);
  const fromMedian = medianGap > 0 ? medianGap : MELODY_PLAYBACK.SINGLE_NOTE_FALLBACK_MS;
  const base = Math.max(MELODY_PLAYBACK.SINGLE_NOTE_MIN_MS, fromMedian);
  if (tail != null && tail > base) {
    return Math.min(tail, MELODY_PLAYBACK.LAST_NOTE_MAX_MS);
  }
  return base;
}

function lastNoteDurationMs(
  medianGap: number,
  gapAfterLast: number | null,
): number {
  const fromMedian = medianGap > 0 ? medianGap * MELODY_PLAYBACK.LAST_NOTE_HOLD_MULT : 0;
  const fromTail = gapAfterLast != null ? Math.min(gapAfterLast, MELODY_PLAYBACK.LAST_NOTE_MAX_MS) : 0;
  return Math.max(
    fromMedian,
    MELODY_PLAYBACK.LAST_NOTE_MIN_MS,
    fromTail,
  );
}

/**
 * Rhythm algorithm (default: preserve sung timing):
 * 1. Anchor: startMs[i] = ts[i] - ts[0]
 * 2. durationMs[i] = ts[i+1] - ts[i] - articulationGap (min 120 ms only for same-pitch repeats)
 * 3. Last note: max(median×1.8, 600, min(sung tail, 1500))
 * 4. Single note: max(800, medianGap or 1200)
 * 5. BPM grid snap only when options.quantizeRhythm === true
 */
function durationFromSungTiming(
  index: number,
  count: number,
  timestamps: number[],
  midis: number[],
  noteGapMs: number,
  medianGap: number,
  pitchHistory: PitchHistoryPoint[],
): number {
  if (count === 1) {
    return singleNoteDurationMs(medianGap, pitchHistory, timestamps[0] ?? 0, midis[0] ?? 0);
  }

  if (index < count - 1) {
    const rawGap = Math.max(0, timestamps[index + 1] - timestamps[index]);
    let dur = Math.max(0, rawGap - noteGapMs);
    const samePitch = midis[index] === midis[index + 1];
    if (samePitch && dur < MELODY_PLAYBACK.MIN_SAME_PITCH_MS) {
      dur = MELODY_PLAYBACK.MIN_SAME_PITCH_MS;
    }
    return dur;
  }

  const lastTs = timestamps[index] ?? 0;
  const lastMidi = midis[index] ?? 0;
  const gapAfterLast = sungTailMsAfterOnset(lastTs, lastMidi, pitchHistory);
  return lastNoteDurationMs(medianGap, gapAfterLast);
}

/** Optional: snap durations toward nearest 16th at BPM; startMs unchanged. */
function applyBpmDurationSnap(
  notes: MelodyPlayNote[],
  bpmApprox: number | null | undefined,
): MelodyPlayNote[] {
  if (!bpmApprox || bpmApprox <= 0 || notes.length === 0) return notes;
  const sixteenthMs = 60000 / bpmApprox / 4;
  if (sixteenthMs < 40) return notes;

  return notes.map(n => {
    const snapped = Math.round(n.durationMs / sixteenthMs) * sixteenthMs;
    return {
      ...n,
      durationMs: Math.max(MELODY_PLAYBACK.ENGINE_MIN_DURATION_MS, snapped),
    };
  });
}

/** Build playback sequence: quantized pitches only when fit-to-key and counts match. */
export function buildMelodyPlaybackNotes(
  fitToKey: boolean,
  quantizedNotes: QuantizedNote[],
  registeredEvents: RegisteredNoteEvent[],
  options?: MelodyPlaybackOptions,
): { notes: MelodyPlayNote[]; pitchSource: 'raw' | 'quantized' } {
  if (registeredEvents.length === 0) return { notes: [], pitchSource: 'raw' };

  const { events: merged, indices } = mergeDuplicateDetections(registeredEvents);
  const useQuantized = shouldUseQuantizedPlayback(fitToKey, quantizedNotes, registeredEvents);

  const midis = useQuantized
    ? indices.map(i => quantizedNotes[i].midi)
    : merged.map(e => e.midi);

  const timestamps = merged.map(e => e.ts);
  const n = Math.min(midis.length, timestamps.length);
  if (n === 0) return { notes: [], pitchSource: 'raw' };

  const t0 = timestamps[0] ?? 0;
  const noteGapMs = options?.noteGapMs ?? MELODY_PLAYBACK.ARTICULATION_GAP_MS;
  const pitchHistory = options?.pitchHistory ?? [];
  const gaps = interOnsetGapsMs(timestamps.slice(0, n));
  const medianGap = medianInterOnsetMs(
    timestamps.slice(0, n).filter((_, i) => i === 0 || (gaps[i - 1] ?? 0) >= MELODY_PLAYBACK.MERGE_GAP_MS),
  ) || medianInterOnsetMs(timestamps.slice(0, n));

  const out: MelodyPlayNote[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      midi: midis[i],
      durationMs: durationFromSungTiming(i, n, timestamps, midis, noteGapMs, medianGap, pitchHistory),
      startMs: Math.max(0, timestamps[i] - t0),
    });
  }

  const withRhythm = options?.quantizeRhythm
    ? applyBpmDurationSnap(out, options.bpmApprox)
    : out;

  return {
    notes: withRhythm,
    pitchSource: useQuantized ? 'quantized' : 'raw',
  };
}

/** Chords span from segment start time until next chord onset (from note startMs). */
export function buildMelodyPlaybackChords(
  notes: MelodyPlayNote[],
  chordSegments: SuggestedChord[],
): MelodyPlayChord[] {
  if (notes.length === 0 || chordSegments.length === 0) return [];

  const melodyEnd =
    notes.reduce((max, n) => Math.max(max, n.startMs + n.durationMs), 0) || MELODY_PLAYBACK.SINGLE_NOTE_FALLBACK_MS;

  return chordSegments.map((seg, idx) => {
    const startIdx = Math.min(seg.noteRange[0], notes.length - 1);
    const nextStart =
      idx < chordSegments.length - 1
        ? chordSegments[idx + 1].noteRange[0]
        : notes.length;

    const startMs = notes[startIdx]?.startMs ?? 0;
    const endMs =
      nextStart < notes.length
        ? (notes[nextStart]?.startMs ?? melodyEnd)
        : melodyEnd;

    const durationMs = Math.max(MELODY_PLAYBACK.ENGINE_MIN_DURATION_MS, endMs - startMs);

    return {
      symbol: seg.symbol,
      startMs,
      durationMs,
      midiNotes: chordSymbolToMidiNotes(seg.symbol, 48),
    };
  });
}

export interface MelodyPlaybackSegment {
  startMs: number;
  endMs: number;
  midi: number;
}

/**
 * PLAY from contour transcription: uses segment start/end (sung duration), not onset gaps.
 */
export function buildMelodyPlaybackNotesFromSegments(
  segments: MelodyPlaybackSegment[],
  options?: MelodyPlaybackOptions,
): { notes: MelodyPlayNote[]; pitchSource: 'raw' | 'quantized' } {
  if (segments.length === 0) return { notes: [], pitchSource: 'raw' };

  const t0 = segments[0].startMs;
  const noteGapMs = options?.noteGapMs ?? MELODY_PLAYBACK.ARTICULATION_GAP_MS;
  const out: MelodyPlayNote[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const next = segments[i + 1];
    const segmentEnd = next ? Math.min(seg.endMs, next.startMs) : seg.endMs;
    const rawDur = Math.max(
      MELODY_PLAYBACK.CONTOUR_MIN_DURATION_MS,
      MELODY_PLAYBACK.ENGINE_MIN_DURATION_MS,
      segmentEnd - seg.startMs - (next ? noteGapMs : 0),
    );
    const samePitch = next != null && next.midi === seg.midi;
    const dur =
      samePitch && rawDur < MELODY_PLAYBACK.MIN_SAME_PITCH_MS
        ? MELODY_PLAYBACK.MIN_SAME_PITCH_MS
        : rawDur;

    out.push({
      midi: seg.midi,
      startMs: Math.max(0, seg.startMs - t0),
      durationMs: dur,
    });
  }

  const withRhythm = options?.quantizeRhythm
    ? applyBpmDurationSnap(out, options.bpmApprox)
    : out;

  return { notes: withRhythm, pitchSource: 'raw' };
}

export function buildMelodyPlaybackPayloadFromSegments(
  segments: MelodyPlaybackSegment[],
  fitToKey: boolean,
  quantizedNotes: QuantizedNote[],
  segmentCountForQuantize: number,
  chordSegments: SuggestedChord[] | null,
  options?: MelodyPlaybackOptions,
): MelodyPlaybackPayload {
  let midis = segments.map(s => s.midi);
  let pitchSource: 'raw' | 'quantized' = 'raw';

  if (
    fitToKey
    && quantizedNotes.length > 0
    && quantizedNotes.length === segmentCountForQuantize
  ) {
    midis = quantizedNotes.map(q => q.midi);
    pitchSource = 'quantized';
  }

  const timed: MelodyPlaybackSegment[] = segments.map((s, i) => ({
    ...s,
    midi: midis[i] ?? s.midi,
  }));

  const { notes } = buildMelodyPlaybackNotesFromSegments(timed, options);
  const chords =
    chordSegments && chordSegments.length > 0
      ? buildMelodyPlaybackChords(notes, chordSegments)
      : [];
  return { notes, chords, pitchSource };
}

export function buildMelodyPlaybackPayload(
  fitToKey: boolean,
  quantizedNotes: QuantizedNote[],
  registeredEvents: RegisteredNoteEvent[],
  chordSegments: SuggestedChord[] | null,
  options?: MelodyPlaybackOptions,
): MelodyPlaybackPayload {
  const { notes, pitchSource } = buildMelodyPlaybackNotes(
    fitToKey,
    quantizedNotes,
    registeredEvents,
    options,
  );
  const chords =
    chordSegments && chordSegments.length > 0
      ? buildMelodyPlaybackChords(notes, chordSegments)
      : [];
  return { notes, chords, pitchSource };
}

/** Applied chord symbols without full SuggestedChord metadata. */
export function chordSegmentsForPlayback(
  symbols: string[] | null,
  suggested: SuggestedChord[],
  noteCount: number,
  timestamps?: number[],
): SuggestedChord[] {
  if (suggested.length > 0) return suggested;
  if (symbols?.length) return chordsFromAppliedSymbols(symbols, noteCount, timestamps);
  return [];
}

/** Wall-clock length of a playback sequence (notes + chords). */
export function getMelodyPlaybackTotalMs(
  notes: MelodyPlayNote[],
  chords: MelodyPlayChord[] = [],
): number {
  let total = 0;
  for (const n of notes) {
    total = Math.max(total, n.startMs + n.durationMs);
  }
  for (const c of chords) {
    total = Math.max(total, c.startMs + c.durationMs);
  }
  return total || MELODY_PLAYBACK.SINGLE_NOTE_FALLBACK_MS;
}

/**
 * Maps each playback note index to staff (registered event) indices.
 * Only same-pitch jitter duplicates share one playback slot.
 */
export function staffIndicesPerPlaybackNote(
  registeredEvents: RegisteredNoteEvent[],
): number[][] {
  if (registeredEvents.length === 0) return [];
  const groups: number[][] = [[0]];
  for (let i = 1; i < registeredEvents.length; i++) {
    const lastKept = groups[groups.length - 1][groups[groups.length - 1].length - 1];
    const gap = registeredEvents[i].ts - registeredEvents[lastKept].ts;
    const samePitch = registeredEvents[i].midi === registeredEvents[lastKept].midi;
    if (samePitch && gap < MELODY_PLAYBACK.MERGE_GAP_MS) {
      groups[groups.length - 1].push(i);
    } else {
      groups.push([i]);
    }
  }
  return groups;
}

/** Per-staff-note timing aligned with index-based staff X layout. */
export function buildStaffPlaybackTimings(
  staffNoteCount: number,
  playbackNotes: MelodyPlayNote[],
  registeredEvents: RegisteredNoteEvent[],
): { startMs: number; durationMs: number }[] {
  // Contour path: staff notes, playback notes and segments are 1:1 — align by
  // index so the playhead + durations match the recognized notes exactly.
  // (The jitter grouping below only applies when playback merged duplicates,
  // i.e. the loaded-snapshot path where counts differ.)
  if (staffNoteCount === playbackNotes.length) {
    return playbackNotes.map(n => ({ startMs: n.startMs, durationMs: n.durationMs }));
  }

  const groups = staffIndicesPerPlaybackNote(registeredEvents);
  const fallbackDur = playbackNotes.length === 1 && playbackNotes[0]
    ? playbackNotes[0].durationMs
    : MELODY_PLAYBACK.SINGLE_NOTE_FALLBACK_MS;
  const fallback = { startMs: 0, durationMs: fallbackDur };
  return Array.from({ length: staffNoteCount }, (_, staffIdx) => {
    const playIdx = groups.findIndex(g => g.includes(staffIdx));
    if (playIdx < 0 || !playbackNotes[playIdx]) return fallback;
    return {
      startMs: playbackNotes[playIdx].startMs,
      durationMs: playbackNotes[playIdx].durationMs,
    };
  });
}
