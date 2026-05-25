import { useCallback, useRef, useState } from 'react';

import type { HistoryPoint } from '../components/FrequencyChart';

import {
  SungNote,
  SungNoteDetector,
  SungNoteSample,
  mergeJitterNotes,
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

const MAX_NOTES = 64;

/** `frequency` feeds classic detector, `frameFrequency` feeds contour, `chartFrequency` feeds graph/UI. */
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
  const detectorRef = useRef(
    new SungNoteDetector({
      midiSlopeMaxSemitonesPerSec: 12,
      maxYinConfidence: 0.2,
    }),
  );
  const chartStabilizerRef = useRef(new ChartFreqStabilizer());
  const chartRecordingRef = useRef(true);
  const pitchFrameRingRef = useRef<PitchFrame[]>([]);
  const lastChartPtMsRef = useRef(0);

  const [notes, setNotes] = useState<SungNote[]>([]);
  const [pitchHistory, setPitchHistory] = useState<HistoryPoint[]>([]);
  const [pitchFrames, setPitchFrames] = useState<PitchFrame[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredNoteEvent[]>([]);
  const reset = useCallback(() => {
    detectorRef.current.reset();
    chartStabilizerRef.current.reset();
    chartRecordingRef.current = true;
    pitchFrameRingRef.current = [];
    lastChartPtMsRef.current = 0;
    setNotes([]);
    setPitchHistory([]);
    setPitchFrames([]);
    setRegisteredEvents([]);
  }, []);

  /** Call when mic stops — clamp last trace point, block late chart append. */
  const endRecording = useCallback(() => {
    chartRecordingRef.current = false;
    chartStabilizerRef.current.reset();
    setPitchHistory(prev => softenLastChartPoint(prev));
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

  const beginRecording = useCallback(() => {
    chartRecordingRef.current = true;
    chartStabilizerRef.current.reset();
    lastChartPtMsRef.current = 0;
  }, []);

  const feed = useCallback((sample: SungNoteFeedSample) => {
    const ts = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const chartSource = sample.chartFrequency ?? sample.frequency;
    const frameFreq = sample.frameFrequency ?? sample.frequency;

    const frame = createPitchFrame({
      t: ts,
      frequency: frameFreq,
      signal: sample.signal,
      cents: sample.frameCents ?? sample.cents,
      yinConfidence: sample.yinConfidence,
    });
    pitchFrameRingRef.current = pushPitchFrameRing(pitchFrameRingRef.current, frame);
    setPitchFrames(pitchFrameRingRef.current);

    if (chartSource == null || chartSource < 55) {
      chartStabilizerRef.current.reset();
    }

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
          return result.history;
        }
        return prev;
      });
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
    beginRecording,
    endRecording,
    loadSnapshot,
  };
}
