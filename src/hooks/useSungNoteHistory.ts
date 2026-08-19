import { useCallback, useRef, useState } from 'react';

import type { HistoryPoint } from '../components/FrequencyChart';

import {
  SungNote,
  SungNoteSample,
} from '../utils/sungNoteDetector';
import {
  type PitchFrame,
  createPitchFrame,
  pushPitchFrameRing,
} from '../utils/pitchFrame';
import {
  ChartFreqStabilizer,
  appendVoicedChartPoint,
  softenLastChartPoint,
} from '../utils/pitchChartHistory';

/** `frameFrequency` feeds the contour pitch-frame ring, `chartFrequency` feeds graph/UI. */
export interface SungNoteFeedSample extends SungNoteSample {
  chartFrequency?: number;
  frameFrequency?: number;
  frameCents?: number;
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
  const chartStabilizerRef = useRef(new ChartFreqStabilizer());
  const chartRecordingRef = useRef(true);
  const pitchFrameRingRef = useRef<PitchFrame[]>([]);
  const lastChartPtMsRef = useRef(0);
  const chartOriginRef = useRef<number | null>(null);

  const [notes, setNotes] = useState<SungNote[]>([]);
  const [pitchHistory, setPitchHistory] = useState<HistoryPoint[]>([]);
  /** Fixed session t0 for time-axis chart — survives buffer trim (parity with Tuner). */
  const [chartLayoutOriginTs, setChartLayoutOriginTs] = useState<number | null>(null);
  const [pitchFrames, setPitchFrames] = useState<PitchFrame[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredNoteEvent[]>([]);
  const reset = useCallback(() => {
    chartStabilizerRef.current.reset();
    chartRecordingRef.current = true;
    pitchFrameRingRef.current = [];
    lastChartPtMsRef.current = 0;
    setNotes([]);
    setPitchHistory([]);
    setPitchFrames([]);
    setRegisteredEvents([]);
    chartOriginRef.current = null;
    setChartLayoutOriginTs(null);
  }, []);

  /** Call when mic stops — clamp last trace point, block late chart append. */
  const endRecording = useCallback(() => {
    chartRecordingRef.current = false;
    chartStabilizerRef.current.reset();
    setPitchHistory(prev => softenLastChartPoint(prev));
  }, []);

  const loadSnapshot = useCallback((snap: MelodySnapshot) => {
    pitchFrameRingRef.current = snap.pitchFrames ?? [];
    setNotes(snap.notes);
    setPitchHistory(snap.pitchHistory);
    const snapT0 = snap.pitchHistory[0]?.ts ?? null;
    chartOriginRef.current = snapT0;
    setChartLayoutOriginTs(snapT0);
    setPitchFrames(snap.pitchFrames ?? []);
    setRegisteredEvents(
      snap.registeredEvents.length > 0
        ? snap.registeredEvents
        : snap.notes.map(toRegisteredEvent),
    );
  }, []);

  const beginRecording = useCallback(() => {
    chartRecordingRef.current = true;
    chartStabilizerRef.current.reset();
    lastChartPtMsRef.current = 0;
    chartOriginRef.current = null;
    setChartLayoutOriginTs(null);
    pitchFrameRingRef.current = [];
    setPitchFrames([]);
    setNotes([]);
    setPitchHistory([]);
    setRegisteredEvents([]);
  }, []);

  const feed = useCallback((sample: SungNoteFeedSample) => {
    const ts = sample.ts
      ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const frameFreq = sample.frameFrequency ?? sample.frequency;
    const chartSource =
      sample.chartFrequency ?? sample.frameFrequency ?? sample.frequency;

    const frame = createPitchFrame({
      t: ts,
      frequency: frameFreq,
      signal: sample.signal,
      cents: sample.frameCents ?? sample.cents,
      yinConfidence: sample.yinConfidence,
    });
    pitchFrameRingRef.current = pushPitchFrameRing(pitchFrameRingRef.current, frame);
    setPitchFrames(pitchFrameRingRef.current);

    const stabilizedChart =
      chartSource != null && chartSource >= 55
        ? chartStabilizerRef.current.process(chartSource)
        : null;

    if (stabilizedChart != null && chartRecordingRef.current) {
      setPitchHistory(prev => {
        const result = appendVoicedChartPoint(prev, {
          chartFreq: stabilizedChart,
          frame,
          lastPtMs: lastChartPtMsRef.current,
          cents: sample.cents,
        });
        if (result) {
          lastChartPtMsRef.current = result.lastPtMs;
          const firstTs = result.history[0]?.ts;
          if (firstTs != null && chartOriginRef.current == null) {
            chartOriginRef.current = firstTs;
            setChartLayoutOriginTs(firstTs);
          }
          return result.history;
        }
        return prev;
      });
    }
  }, []);

  const getPitchFrames = useCallback(() => pitchFrameRingRef.current, []);

  return {
    notes,
    pitchHistory,
    chartLayoutOriginTs,
    pitchFrames,
    registeredEvents,
    feed,
    reset,
    beginRecording,
    endRecording,
    loadSnapshot,
    getPitchFrames,
  };
}
