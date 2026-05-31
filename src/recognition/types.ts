import type { SongEntry } from '../data/songDatabase';

/** Сигналы для локального распознавания (расширяемые). */
export type RecognitionSignalKind =
  | 'text'
  | 'melody'
  | 'tempo'
  | 'chords'
  | 'voice'
  | 'language'
  | 'style'
  | 'instruments';

export interface RecognitionSignals {
  /** Исполнитель + название или произвольный запрос */
  textQuery?: string;
  artist?: string;
  title?: string;
  /** MIDI-номера напетой последовательности (вкладка Melody) */
  melodyMidi?: number[];
  bpm?: number;
  /** 12-bin chroma 0…1 from snippet WebView analysis */
  chromaVector?: number[];
  /** e.g. "G major" from chroma profile */
  estimatedKey?: string;
  /** Строка аккордов, например из LIVE или практики */
  chordProgression?: string;
  language?: string;
  genre?: string;
}

export interface AudioSnippetMeta {
  id: string;
  uri: string;
  durationSec: number;
  createdAt: string;
  source: 'mic' | 'file';
}

export interface RecognizeCandidate {
  song: SongEntry;
  score: number;
  reasons: RecognitionSignalKind[];
}

export type RecognizeOutcome =
  | { status: 'match'; candidates: RecognizeCandidate[]; snippet?: AudioSnippetMeta }
  | { status: 'snippet_saved'; snippet: AudioSnippetMeta; message: string }
  | { status: 'no_match'; message: string; snippet?: AudioSnippetMeta };

export interface SongRecognizer {
  recognize(signals: RecognitionSignals): Promise<RecognizeOutcome>;
  recognizeFromRecording(
    uri: string,
    options: { durationSec: number; source: 'mic' | 'file' },
  ): Promise<RecognizeOutcome>;
}

/** Результат «НАЙТИ» для UI (текст, аккорды каталога, lyrics.ovh). */
export interface IdentifyTrackResult {
  artist: string;
  title: string;
  album?: string;
  release_date?: string;
  song_link?: string;
}
