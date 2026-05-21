import { useCallback, useRef, useState } from 'react';
import type { HistoryPoint } from '../components/FrequencyChart';
import {
  SungNote,
  SungNoteDetector,
  SungNoteSample,
} from '../utils/sungNoteDetector';
import { frequencyToNote } from '../utils/noteUtils';

const MAX_NOTES = 64;
const MAX_PITCH_HISTORY = 120;

const A4_FREQ = 440;
const A4_MIDI = 69;

export interface RegisteredNoteEvent {
  name: string;
  octave: number;
  midi: number;
  ts: number;
  freq: number;
}

export interface MelodySnapshot {
  notes: SungNote[];
  pitchHistory: HistoryPoint[];
  registeredEvents: RegisteredNoteEvent[];
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
  };
}

export function useSungNoteHistory() {
  const detectorRef = useRef(new SungNoteDetector());
  const [notes, setNotes] = useState<SungNote[]>([]);
  const [pitchHistory, setPitchHistory] = useState<HistoryPoint[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredNoteEvent[]>([]);

  const reset = useCallback(() => {
    detectorRef.current.reset();
    setNotes([]);
    setPitchHistory([]);
    setRegisteredEvents([]);
  }, []);

  const loadSnapshot = useCallback((snap: MelodySnapshot) => {
    detectorRef.current.reset();
    setNotes(snap.notes);
    setPitchHistory(snap.pitchHistory);
    setRegisteredEvents(
      snap.registeredEvents.length > 0
        ? snap.registeredEvents
        : snap.notes.map(toRegisteredEvent),
    );
  }, []);

  const feed = useCallback((sample: SungNoteSample) => {
    const ts = sample.ts ?? Date.now();

    if (sample.frequency && sample.frequency >= 55) {
      const info = frequencyToNote(sample.frequency);
      const midi = freqToMidi(sample.frequency);
      const pt: HistoryPoint = {
        cents: sample.cents ?? info.cents,
        freq: sample.frequency,
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
    if (detected) {
      setNotes(prev => {
        const next = [...prev, detected];
        return next.length > MAX_NOTES ? next.slice(-MAX_NOTES) : next;
      });
      setRegisteredEvents(prev => {
        const ev = toRegisteredEvent(detected);
        const next = [...prev, ev];
        return next.length > MAX_NOTES ? next.slice(-MAX_NOTES) : next;
      });
    }
  }, []);

  return {
    notes,
    pitchHistory,
    registeredEvents,
    feed,
    reset,
    loadSnapshot,
  };
}
