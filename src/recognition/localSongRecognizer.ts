import { listSongs } from '../db/songLibrary';
import { searchSongsSmart } from '../db/searchSongsSmart';
import { findBestSongMatch } from '../utils/songMatch';
import type { MatchKind } from '../utils/searchScore';
import { scoreChordProgression } from './chordFingerprint';
import { saveRecognitionSnippet } from './snippets';
import type {
  RecognitionSignals,
  RecognizeCandidate,
  RecognizeOutcome,
  SongRecognizer,
} from './types';

const SNIPPET_SAVED_MSG =
  'Запись сохранена на устройстве. Распознавание по звуку без облака — в разработке; пока ищите в каталоге или введите название.';

function candidateFromSong(
  song: Awaited<ReturnType<typeof searchSongsSmart>>[0],
  score: number,
  reasons: RecognizeCandidate['reasons'],
): RecognizeCandidate {
  return { song, score, reasons };
}

async function rankBySignals(signals: RecognitionSignals): Promise<RecognizeCandidate[]> {
  const query =
    signals.textQuery?.trim() ||
    [signals.artist, signals.title].filter(Boolean).join(' ').trim();
  const map = new Map<string, RecognizeCandidate>();

  function merge(c: RecognizeCandidate) {
    const prev = map.get(c.song.id);
    if (!prev || c.score > prev.score) {
      map.set(c.song.id, {
        ...c,
        reasons: [...new Set([...(prev?.reasons ?? []), ...c.reasons])],
      });
    }
  }

  if (query) {
    const hits = await searchSongsSmart(query, { limit: 25 });
    for (const h of hits) {
      merge(candidateFromSong(h, h.score, ['text']));
    }
    if (signals.artist && signals.title) {
      const all = await listSongs();
      const best = findBestSongMatch(signals.artist, signals.title, all, 70);
      if (best) {
        merge(candidateFromSong(
          { ...best, score: 95, matchKind: 'exact' as MatchKind },
          95,
          ['text'],
        ));
      }
    }
  }

  if (signals.chordProgression?.trim()) {
    const all = await listSongs();
    for (const s of all) {
      const cs = scoreChordProgression(signals.chordProgression, s.chords);
      if (cs >= 35) {
        merge(candidateFromSong(
          { ...s, score: cs, matchKind: 'fuzzy' },
          cs,
          ['chords'],
        ));
      }
    }
  }

  if (signals.bpm != null && signals.bpm > 0) {
    const all = await listSongs();
    for (const s of all) {
      if (!s.bpm) continue;
      const diff = Math.abs(s.bpm - signals.bpm);
      if (diff <= 8) {
        merge(candidateFromSong(
          { ...s, score: 60 - diff, matchKind: 'fuzzy' },
          60 - diff,
          ['tempo'],
        ));
      }
    }
  }

  if (signals.melodyMidi?.length) {
    // Hook: сравнение с сохранёнными мелодиями — позже (Melody tab export).
  }

  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export const localSongRecognizer: SongRecognizer = {
  async recognize(signals) {
    const candidates = await rankBySignals(signals);
    if (candidates.length > 0) {
      return { status: 'match', candidates };
    }
    return {
      status: 'no_match',
      message: 'В каталоге ничего не найдено. Добавьте песню вручную или импортируйте ChordPro.',
    };
  },

  async recognizeFromRecording(uri, options) {
    const snippet = await saveRecognitionSnippet(uri, options);
    const candidates = await rankBySignals({});
    if (candidates.length > 0) {
      return { status: 'match', candidates, snippet };
    }
    return {
      status: 'snippet_saved',
      snippet,
      message: SNIPPET_SAVED_MSG,
    };
  },
};
