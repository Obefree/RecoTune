import {
  chordCacheToSongDetail,
  getChordCache,
  setChordCache,
  type ChordCachePayload,
} from '../db/chordCache';
import {
  chordProRejectionReason,
  isVerifiedChordProLyrics,
  normalizeLyricsChords,
} from '../utils/chordLyricsNormalize';
import { extractChordSequence } from '../utils/chordProgression';
import { combinedArtistTitle, normalizeSearchText } from '../utils/searchNormalize';

import {
  pesniRuGetTrack,
  pesniRuSearch,
  PesniRuError,
  type PesniRuTrackDetail,
  type PesniRuTrackSummary,
} from './pesniRuApi';
import type {
  ProviderAttribution,
  SongDetail,
  SongProvider,
  SongSearchResult,
} from './types';

export type PesniFetchStage = 'search' | 'verify' | 'cache';

export type PesniFetchProgress = (stage: PesniFetchStage, detail?: string) => void;

export const PESNI_FETCH_STAGE_LABEL: Record<PesniFetchStage, string> = {
  search: '',
  verify: '',
  cache: '',
};

export const PESNI_RU_TRACK_ID_PREFIX = 'pesni_ru_';

export function pesniRuAttribution(): ProviderAttribution {
  return {
    label: 'pesni.ru',
    url: 'https://pesni.ru/',
    licenseNote: 'Текст и аккорды через API pesni.ru (до 60 запросов/мин, без ключа).',
  };
}

/** Chord-above-lyric plain text from pesni.ru → inline ChordPro for practice. */
export function pesniRuTextToVerifiedLyrics(text: string): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const merged = normalizeLyricsChords(raw, { allowMerge: true });
  if (!isVerifiedChordProLyrics(merged)) return null;
  return merged;
}

function pesniTrackToPayload(track: PesniRuTrackDetail, sourceUrl: string): ChordCachePayload {
  const lyrics = pesniRuTextToVerifiedLyrics(track.text ?? '');
  if (!lyrics) {
    const reason = chordProRejectionReason(
      normalizeLyricsChords(track.text ?? '', { allowMerge: true }),
    );
    throw new PesniRuError(
      reason ?? 'На pesni.ru нет построчных аккордов для этой песни.',
    );
  }
  const chords = [...new Set(extractChordSequence(lyrics))].slice(0, 12).join(' ') || 'C G Am F';
  const uniqueCount = extractChordSequence(lyrics).length;
  const difficulty: 1 | 2 | 3 =
    uniqueCount <= 3 ? 1 : uniqueCount <= 5 ? 2 : 3;

  return {
    title: track.name.trim(),
    artist: track.artist?.name?.trim() || 'Unknown',
    chords,
    lyrics,
    difficulty,
    sourceUrl,
    lyricsSource: 'fetch-pesni-ru',
  };
}

function stablePesniUserId(slug: string): string {
  return `${PESNI_RU_TRACK_ID_PREFIX}${slug}`;
}

function stablePesniUserIdFromNames(artist: string, title: string, slug?: string): string {
  if (slug?.trim()) return stablePesniUserId(slug.trim());
  const key = combinedArtistTitle(artist, title)
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `custom_pesni_${key || 'song'}`;
}

export function pesniSlugFromResultId(id: string): string | null {
  if (!id.startsWith(PESNI_RU_TRACK_ID_PREFIX)) return null;
  return id.slice(PESNI_RU_TRACK_ID_PREFIX.length) || null;
}

function scorePesniTrack(track: PesniRuTrackSummary, artist: string, title: string): number {
  const wantA = normalizeSearchText(artist);
  const wantT = normalizeSearchText(title);
  const gotA = normalizeSearchText(track.artist?.name ?? '');
  const gotT = normalizeSearchText(track.name);
  let score = 0;
  if (wantT && gotT === wantT) score += 80;
  else if (wantT && (gotT.includes(wantT) || wantT.includes(gotT))) score += 45;
  if (wantA && gotA === wantA) score += 40;
  else if (wantA && (gotA.includes(wantA) || wantA.includes(gotA))) score += 25;
  return score;
}

function scoreSearchHit(track: PesniRuTrackSummary, query: string): number {
  const q = normalizeSearchText(query);
  const title = normalizeSearchText(track.name);
  const artist = normalizeSearchText(track.artist?.name ?? '');
  const combined = normalizeSearchText(`${track.artist?.name ?? ''} ${track.name}`);
  let score = 20;
  if (q && title === q) score += 70;
  else if (q && title.includes(q)) score += 40;
  if (q && combined.includes(q)) score += 25;
  if (q && artist.includes(q)) score += 15;
  return score;
}

async function resolveBestTrackSlug(
  artist: string,
  title: string,
  slugHint?: string,
): Promise<string> {
  if (slugHint?.trim()) return slugHint.trim();

  const queries = [
    combinedArtistTitle(artist, title),
    title.trim(),
    artist.trim() ? `${artist.trim()} ${title.trim()}` : title.trim(),
  ].filter((q, i, arr) => q.length >= 2 && arr.indexOf(q) === i);

  let best: { slug: string; score: number } | null = null;

  for (const q of queries) {
    const { tracks } = await pesniRuSearch(q, { type: 'tracks', limit: 15 });
    for (const t of tracks ?? []) {
      const score = scorePesniTrack(t, artist, title);
      if (!best || score > best.score) best = { slug: t.slug, score };
    }
    if (best && best.score >= 100) break;
  }

  if (!best?.slug) {
    throw new PesniRuError('Песня не найдена на pesni.ru — проверьте исполнителя и название.');
  }
  return best.slug;
}

export async function fetchPesniRuTrackBySlug(
  slug: string,
  onProgress?: PesniFetchProgress,
): Promise<SongDetail> {
  onProgress?.('search', slug);
  const track = await pesniRuGetTrack(slug);
  const sourceUrl = `https://pesni.ru/songs/${slug}`;
  onProgress?.('verify');
  const payload = pesniTrackToPayload(track, sourceUrl);
  const id = stablePesniUserId(slug);
  onProgress?.('cache');
  await setChordCache('pesni_ru', payload.artist, payload.title, payload);
  return chordCacheToSongDetail(payload, 'pesni_ru', id, {
    ...pesniRuAttribution(),
    url: sourceUrl,
  });
}

/** On-demand full tab from pesni.ru (HTTPS, no PC proxy). */
export async function fetchPesniRuChordSheet(
  artist: string,
  title: string,
  onProgress?: PesniFetchProgress,
  slugHint?: string,
): Promise<SongDetail> {
  const cached = await getChordCache('pesni_ru', artist, title);
  if (cached?.lyrics && isVerifiedChordProLyrics(cached.lyrics)) {
    const id = stablePesniUserIdFromNames(artist, title, slugHint);
    return chordCacheToSongDetail(cached, 'pesni_ru', id, pesniRuAttribution());
  }

  onProgress?.('search');
  const slug = await resolveBestTrackSlug(artist, title, slugHint);
  return fetchPesniRuTrackBySlug(slug, onProgress);
}

export const pesniRuProvider: SongProvider = {
  id: 'pesni_ru',
  label: 'pesni.ru',
  requiresNetwork: true,
  async search(query, limit = 20) {
    const q = query.trim();
    if (q.length < 2) return [];
    const cap = Math.min(limit, 50);
    const { tracks } = await pesniRuSearch(q, { type: 'all', limit: cap });
    const out: SongSearchResult[] = [];
    for (const t of tracks ?? []) {
      const score = scoreSearchHit(t, q);
      out.push({
        id: stablePesniUserId(t.slug),
        title: t.name.trim(),
        artist: t.artist?.name?.trim() || 'Unknown',
        provider: 'pesni_ru',
        score,
        matchKind: score >= 70 ? 'exact' : 'fuzzy',
        attribution: pesniRuAttribution(),
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, cap);
  },
  async fetchById(id) {
    const slug = pesniSlugFromResultId(id);
    if (!slug) return null;
    try {
      return await fetchPesniRuTrackBySlug(slug);
    } catch {
      return null;
    }
  },
  attribution: pesniRuAttribution,
};

export function pesniRuErrorMessage(e: unknown): string {
  if (e instanceof PesniRuError) return e.message;
  return 'Подгрузка с pesni.ru не удалась.';
}
