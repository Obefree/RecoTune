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

export interface MelodyPlaybackOptions {
  /** Detected BPM — used only when quantizeRhythm is true. */
  bpmApprox?: number | null;
  /** Snap note durations to 16th grid at BPM. Default OFF — preserves sung timing. */
  quantizeRhythm?: boolean;
  /** Articulation gap subtracted between consecutive onsets (ms). Default 35. */
  noteGapMs?: number;
}

/** Playback timing constants (also referenced by WebView engine). */
export const MELODY_PLAYBACK = {
  /** Small separation between legato notes — not a full rest. */
  ARTICULATION_GAP_MS: 35,
  /** Floor for very fast repeated same-pitch notes. */
  MIN_SAME_PITCH_MS: 80,
  /** Merge detections closer than this (duplicate onset). */
  MERGE_GAP_MS: 50,
  /** Gaps above median × this are kept as user pauses (not compressed). */
  PAUSE_OUTLIER_MULT: 3,
  LAST_NOTE_HOLD_MULT: 1.5,
  LAST_NOTE_MAX_MS: 400,
  DEFAULT_SINGLE_MS: 400,
  MIN_NOTES_WARNING: 3,
  /** Web Audio floor — engine only; payload may be shorter. */
  ENGINE_MIN_DURATION_MS: 40,
  ENGINE_MAX_DURATION_MS: 4000,
} as const;

/**
 * Drop duplicate detections: if gap to previous onset < MERGE_GAP_MS, skip event.
 * Returns kept events and their indices in the original array (for quantized pitch lookup).
 */
export function mergeDuplicateDetections<T extends { ts: number }>(
  events: T[],
): { events: T[]; indices: number[] } {
  if (events.length <= 1) {
    return { events: [...events], indices: events.map((_, i) => i) };
  }
  const out: T[] = [events[0]];
  const indices: number[] = [0];
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].ts - out[out.length - 1].ts;
    if (gap < MELODY_PLAYBACK.MERGE_GAP_MS) continue;
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
 * Rhythm algorithm (default: preserve sung timing):
 * 1. Anchor: startMs[i] = ts[i] - ts[0]
 * 2. durationMs[i] = ts[i+1] - ts[i] - articulationGap (last: median×1.5 capped at 400ms)
 * 3. Min 80ms only for same-pitch repeats; no 250–1200ms clamp
 * 4. Pauses (gap > 3× median) pass through unchanged via real timestamps
 * 5. BPM grid snap only when options.quantizeRhythm === true
 */
function durationFromSungTiming(
  index: number,
  count: number,
  timestamps: number[],
  midis: number[],
  noteGapMs: number,
  medianGap: number,
): number {
  if (count === 1) {
    return MELODY_PLAYBACK.DEFAULT_SINGLE_MS;
  }

  if (index < count - 1) {
    const rawGap = Math.max(0, timestamps[index + 1] - timestamps[index]);
    let dur = Math.max(MELODY_PLAYBACK.ENGINE_MIN_DURATION_MS, rawGap - noteGapMs);
    const samePitch = midis[index] === midis[index + 1];
    if (samePitch && dur < MELODY_PLAYBACK.MIN_SAME_PITCH_MS) {
      dur = MELODY_PLAYBACK.MIN_SAME_PITCH_MS;
    }
    return dur;
  }

  const holdBase = medianGap > 0
    ? medianGap * MELODY_PLAYBACK.LAST_NOTE_HOLD_MULT
    : MELODY_PLAYBACK.DEFAULT_SINGLE_MS;
  return Math.min(
    MELODY_PLAYBACK.LAST_NOTE_MAX_MS,
    Math.max(MELODY_PLAYBACK.MIN_SAME_PITCH_MS, holdBase),
  );
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
  const gaps = interOnsetGapsMs(timestamps.slice(0, n));
  const medianGap = medianInterOnsetMs(
    timestamps.slice(0, n).filter((_, i) => i === 0 || (gaps[i - 1] ?? 0) >= MELODY_PLAYBACK.MERGE_GAP_MS),
  ) || medianInterOnsetMs(timestamps.slice(0, n));

  const out: MelodyPlayNote[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      midi: midis[i],
      durationMs: durationFromSungTiming(i, n, timestamps, midis, noteGapMs, medianGap),
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
    notes.reduce((max, n) => Math.max(max, n.startMs + n.durationMs), 0) || 400;

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
  return total || MELODY_PLAYBACK.DEFAULT_SINGLE_MS;
}

/**
 * Maps each playback note index to staff (registered event) indices.
 * Merged detections share one playback slot but multiple staff glyphs.
 */
export function staffIndicesPerPlaybackNote(
  registeredEvents: RegisteredNoteEvent[],
): number[][] {
  if (registeredEvents.length === 0) return [];
  const groups: number[][] = [[0]];
  for (let i = 1; i < registeredEvents.length; i++) {
    const lastKept = groups[groups.length - 1][groups[groups.length - 1].length - 1];
    const gap = registeredEvents[i].ts - registeredEvents[lastKept].ts;
    if (gap < MELODY_PLAYBACK.MERGE_GAP_MS) {
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
  const groups = staffIndicesPerPlaybackNote(registeredEvents);
  const fallback = { startMs: 0, durationMs: MELODY_PLAYBACK.DEFAULT_SINGLE_MS };
  return Array.from({ length: staffNoteCount }, (_, staffIdx) => {
    const playIdx = groups.findIndex(g => g.includes(staffIdx));
    if (playIdx < 0 || !playbackNotes[playIdx]) return fallback;
    return {
      startMs: playbackNotes[playIdx].startMs,
      durationMs: playbackNotes[playIdx].durationMs,
    };
  });
}
