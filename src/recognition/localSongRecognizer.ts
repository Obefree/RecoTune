import { listSongs } from '../db/songLibrary';
import { searchSongsSmart } from '../db/searchSongsSmart';
import { findBestSongMatch } from '../utils/songMatch';
import type { MatchKind } from '../utils/searchScore';
import { scoreChordProgression } from './chordFingerprint';
import {
  scoreChromaAgainstKey,
  scoreKeyMatch,
} from './chromaMatch';
import { extractSignalsFromRecording } from './recordingSignals';
import { saveRecognitionSnippet } from './snippets';
import type {
  RecognitionSignals,
  RecognizeCandidate,
  RecognizeOutcome,
  SongRecognizer,
} from './types';
const MIN_AUTO_MATCH_SCORE = 72;
const MIN_LEAD_OVER_SECOND = 12;

const SNIPPET_SAVED_BASE =
  'Распознавание по звуку (без облака) — в разработке. Запись сохранена на устройстве.';

function candidateFromSong(
  song: Awaited<ReturnType<typeof searchSongsSmart>>[0],
  score: number,
  reasons: RecognizeCandidate['reasons'],
): RecognizeCandidate {
  return { song, score, reasons };
}

function hasStrongSignal(c: RecognizeCandidate): boolean {
  if (c.reasons.includes('text') && c.score >= 78) return true;
  if (c.reasons.includes('chords') && c.score >= 48) return true;
  if (c.reasons.includes('tempo') && c.score >= 54) return true;
  if (
    c.reasons.includes('melody')
    && c.reasons.includes('tempo')
    && c.score >= MIN_AUTO_MATCH_SCORE
  ) {
    return true;
  }
  return false;
}

function scoreSongByAudioSignals(
  signals: RecognitionSignals,
  song: Awaited<ReturnType<typeof listSongs>>[0],
): number {
  let score = 0;
  if (signals.bpm != null && signals.bpm > 0 && song.bpm) {
    const diff = Math.abs(song.bpm - signals.bpm);
    if (diff <= 4) score += 58 - diff * 4;
    else if (diff <= 8) score += 28;
  }
  if (signals.estimatedKey && song.key) {
    score += Math.round(scoreKeyMatch(signals.estimatedKey, song.key) * 0.5);
  }
  if (signals.chromaVector?.length === 12 && signals.estimatedKey) {
    score += Math.round(scoreChromaAgainstKey(signals.chromaVector, signals.estimatedKey) * 0.35);
  }
  return score;
}

function isConfidentTopMatch(candidates: RecognizeCandidate[]): boolean {
  if (!candidates.length || !hasStrongSignal(candidates[0])) return false;
  if (candidates[0].score < MIN_AUTO_MATCH_SCORE) return false;
  const second = candidates[1]?.score ?? 0;
  return candidates[0].score - second >= MIN_LEAD_OVER_SECOND;
}

function snippetSavedMessage(
  signals: RecognitionSignals,
  hadWeakCandidates: boolean,
): string {
  if (signals.textQuery?.trim()) {
    return `${SNIPPET_SAVED_BASE}\n\nПодсказка из имени файла: «${signals.textQuery.trim()}» — откройте «База песен» или введите вручную.`;
  }
  if (hadWeakCandidates) {
    return `${SNIPPET_SAVED_BASE}\n\nВ каталоге есть похожие записи, но уверенного совпадения по звуку нет — уточните поиск вручную.`;
  }
  return `${SNIPPET_SAVED_BASE}\n\nИщите в каталоге или введите название вручную.`;
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

  const hasAudioHints =
    (signals.bpm != null && signals.bpm > 0)
    || (signals.chromaVector?.length === 12)
    || Boolean(signals.estimatedKey);

  if (hasAudioHints) {
    const all = await listSongs();
    for (const s of all) {
      const audioScore = scoreSongByAudioSignals(signals, s);
      if (audioScore < 40) continue;
      const reasons: RecognizeCandidate['reasons'] = [];
      if (signals.bpm && s.bpm && Math.abs(s.bpm - signals.bpm) <= 8) reasons.push('tempo');
      if (
        signals.estimatedKey
        && s.key
        && scoreKeyMatch(signals.estimatedKey, s.key) >= 48
      ) {
        reasons.push('melody');
      }
      if (!reasons.length) continue;
      merge(candidateFromSong(
        { ...s, score: audioScore, matchKind: 'fuzzy' },
        audioScore,
        reasons,
      ));
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
    const signals = await extractSignalsFromRecording(uri, options);
    const candidates = await rankBySignals(signals);

    if (isConfidentTopMatch(candidates)) {
      return { status: 'match', candidates, snippet };
    }

    return {
      status: 'snippet_saved',
      snippet,
      message: snippetSavedMessage(signals, candidates.length > 0),
    };
  },
};
