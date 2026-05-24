import { useCallback, useRef, useState } from 'react';

import type { HistoryPoint } from '../components/FrequencyChart';

import {
  SungNote,
  SungNoteDetector,
  SungNoteSample,
  mergeJitterNotes,
} from '../utils/sungNoteDetector';
import { frequencyToNote } from '../utils/noteUtils';
import {
  type PitchFrame,
  createPitchFrame,
  pushPitchFrameRing,
} from '../utils/pitchFrame';
import { isVoicedFrame } from '../utils/melodyTranscription';

const CHART_MIN_INTERVAL_MS = 100;
const CHART_MIDI_EMA = 0.12;

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
  const lastChartPtMsRef = useRef(0);
  const smoothChartMidiRef = useRef<number | null>(null);

  const [notes, setNotes] = useState<SungNote[]>([]);
  const [pitchHistory, setPitchHistory] = useState<HistoryPoint[]>([]);
  const [pitchFrames, setPitchFrames] = useState<PitchFrame[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredNoteEvent[]>([]);
  const reset = useCallback(() => {
    detectorRef.current.reset();
    pitchFrameRingRef.current = [];
    lastChartPtMsRef.current = 0;
    smoothChartMidiRef.current = null;
    setNotes([]);
    setPitchHistory([]);
    setPitchFrames([]);
    setRegisteredEvents([]);
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
  }, []);

  const feed = useCallback((sample: SungNoteFeedSample) => {
    const ts = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const chartFreq = sample.chartFrequency ?? sample.frequency;
    const contourFreq = chartFreq ?? sample.frequency;

    const frame = createPitchFrame({
      t: ts,
      frequency: contourFreq,
      signal: sample.signal,
      cents: sample.cents,
      yinConfidence: sample.yinConfidence,
    });
    pitchFrameRingRef.current = pushPitchFrameRing(pitchFrameRingRef.current, frame);
    setPitchFrames(pitchFrameRingRef.current);

    if (chartFreq && chartFreq >= 55 && isVoicedFrame(frame)) {
      if (ts - lastChartPtMsRef.current >= CHART_MIN_INTERVAL_MS) {
        lastChartPtMsRef.current = ts;
        const rawMidi = freqToMidi(chartFreq);
        const prevMidi = smoothChartMidiRef.current;
        const midi =
          prevMidi == null
            ? rawMidi
            : CHART_MIDI_EMA * rawMidi + (1 - CHART_MIDI_EMA) * prevMidi;
        smoothChartMidiRef.current = midi;
        const info = frequencyToNote(chartFreq);
        const pt: HistoryPoint = {
          cents: sample.cents ?? info.cents,
          freq: chartFreq,
          midi,
          note: info.name,
          octave: info.octave,
          ts,
          voiced: true,
        };
        setPitchHistory(prev => {
          const next = [...prev, pt];
          return next.length > MAX_PITCH_HISTORY ? next.slice(-MAX_PITCH_HISTORY) : next;
        });
      }
    } else if (!chartFreq || chartFreq < 55) {
      smoothChartMidiRef.current = null;
    }

    const detected = detectorRef.current.process({ ...sample, ts });

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
  };
}
