import { useCallback, useRef, useState } from 'react';

import type { HistoryPoint } from '../components/FrequencyChart';

import {
  SungNote,
  SungNoteDetector,
  SungNoteSample,
  SungNoteDetectorDebug,
  mergeJitterNotes,
} from '../utils/sungNoteDetector';
import { frequencyToNote } from '../utils/noteUtils';
import {
  type PitchFrame,
  createPitchFrame,
  pushPitchFrameRing,
} from '../utils/pitchFrame';

const MAX_NOTES = 64;
const MAX_PITCH_HISTORY = 120;

const A4_FREQ = 440;
const A4_MIDI = 69;

/** Optional smoothed frequency for chart only; detector + pitchFrames use `frequency`. */
export interface SungNoteFeedSample extends SungNoteSample {
  chartFrequency?: number;
}

export interface RegisteredNoteEvent {
  name: string;
  octave: number;
  midi: number;
  ts: number;
  freq: number;
  confidence?: number;
}

export interface MelodySnapshot {
  notes: SungNote[];
  pitchHistory: HistoryPoint[];
  registeredEvents: RegisteredNoteEvent[];
  pitchFrames?: PitchFrame[];
}

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
}

function toRegisteredEvent(note: SungNote): RegisteredNoteEvent {
  return {
    name: note.name,
    octave: note.octave,
    midi: note.midi,
    ts: note.ts,
    freq: note.freq,
    confidence: note.confidence,
  };
}

export function useSungNoteHistory() {
  const detectorRef = useRef(new SungNoteDetector());
  const pitchFrameRingRef = useRef<PitchFrame[]>([]);

  const [notes, setNotes] = useState<SungNote[]>([]);
  const [pitchHistory, setPitchHistory] = useState<HistoryPoint[]>([]);
  const [pitchFrames, setPitchFrames] = useState<PitchFrame[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredNoteEvent[]>([]);
  const [detectorDebug, setDetectorDebug] = useState<SungNoteDetectorDebug | null>(null);

  const reset = useCallback(() => {
    detectorRef.current.reset();
    pitchFrameRingRef.current = [];
    setNotes([]);
    setPitchHistory([]);
    setPitchFrames([]);
    setRegisteredEvents([]);
    setDetectorDebug(null);
  }, []);

  const loadSnapshot = useCallback((snap: MelodySnapshot) => {
    detectorRef.current.reset();
    pitchFrameRingRef.current = snap.pitchFrames ?? [];
    setNotes(snap.notes);
    setPitchHistory(snap.pitchHistory);
    setPitchFrames(snap.pitchFrames ?? []);
    setRegisteredEvents(
      snap.registeredEvents.length > 0
        ? snap.registeredEvents
        : snap.notes.map(toRegisteredEvent),
    );
    setDetectorDebug(null);
  }, []);

  const feed = useCallback((sample: SungNoteFeedSample) => {
    const ts = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const chartFreq = sample.chartFrequency ?? sample.frequency;

    const frame = createPitchFrame({
      t: ts,
      frequency: sample.frequency,
      signal: sample.signal,
      cents: sample.cents,
      yinConfidence: sample.yinConfidence,
    });
    pitchFrameRingRef.current = pushPitchFrameRing(pitchFrameRingRef.current, frame);
    setPitchFrames(pitchFrameRingRef.current);

    if (chartFreq && chartFreq >= 55) {
      const info = frequencyToNote(chartFreq);
      const midi = freqToMidi(chartFreq);
      const pt: HistoryPoint = {
        cents: sample.cents ?? info.cents,
        freq: chartFreq,
        midi,
        note: info.name,
        octave: info.octave,
        ts,
      };
      setPitchHistory(prev => {
        const next = [...prev, pt];
        return next.length > MAX_PITCH_HISTORY ? next.slice(-MAX_PITCH_HISTORY) : next;
      });
    }

    const detected = detectorRef.current.process({ ...sample, ts });
    if (__DEV__) {
      setDetectorDebug(detectorRef.current.getDebugInfo());
    }

    if (detected) {
      setNotes(prev => {
        const merged = mergeJitterNotes([...prev, detected]);
        return merged.length > MAX_NOTES ? merged.slice(-MAX_NOTES) : merged;
      });
      setRegisteredEvents(prev => {
        const ev = toRegisteredEvent(detected);
        const merged = mergeJitterNotes([...prev, ev]);
        return merged.length > MAX_NOTES ? merged.slice(-MAX_NOTES) : merged;
      });
    }
  }, []);

  return {
    notes,
    pitchHistory,
    pitchFrames,
    registeredEvents,
    feed,
    reset,
    loadSnapshot,
    detectorDebug,
  };
}
