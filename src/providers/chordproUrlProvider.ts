import { chordProToSongEntry, parseChordProText } from '../utils/chordProParse';
import { normalizeSearchText } from '../utils/searchNormalize';
import { scoreSongAgainstQuery } from '../utils/searchScore';
import { getProviderSettings } from './providerSettings';
import type { SongProvider, SongDetail, SongSearchResult, ProviderAttribution } from './types';

let cachedFetch: { url: string; detail: SongDetail; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

/** Fetch public ChordPro/plain text from user-configured raw URL (no UG scrape). */
export async function fetchChordProFromUrl(url: string): Promise<SongDetail | null> {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;

  if (cachedFetch && cachedFetch.url === trimmed && Date.now() - cachedFetch.at < CACHE_MS) {
    return cachedFetch.detail;
  }

  try {
    const res = await fetch(trimmed, { headers: { Accept: 'text/plain,*/*' } });
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw || raw.length < 10) return null;
    const parsed = parseChordProText(raw);
    const entry = chordProToSongEntry(parsed, `chordpro_url_${Date.now()}`);
    const detail: SongDetail = {
      ...entry,
      provider: 'chordpro_url',
      attribution: attribution(),
    };
    cachedFetch = { url: trimmed, detail, at: Date.now() };
    return detail;
  } catch {
    return null;
  }
}

export const chordproUrlProvider: SongProvider = {
  id: 'chordpro_url',
  label: 'ChordPro по URL',
  requiresNetwork: true,
  async search(query) {
    const settings = await getProviderSettings();
    const url = settings.chordProUrl.trim();
    if (!url) return [];

    const detail = await fetchChordProFromUrl(url);
    if (!detail) return [];

    const { score, kind } = scoreSongAgainstQuery(query, detail.title, detail.artist);
    if (!query.trim()) {
      return [toSearchResult(detail, 50, kind)];
    }
    if (score <= 0) return [];
    return [toSearchResult(detail, score, kind)];
  },
  async fetchById(id) {
    if (!id.startsWith('chordpro_url_')) return null;
    const settings = await getProviderSettings();
    return fetchChordProFromUrl(settings.chordProUrl);
  },
  attribution,
};

function toSearchResult(detail: SongDetail, score: number, matchKind: string): SongSearchResult {
  return {
    id: detail.id,
    title: detail.title,
    artist: detail.artist,
    provider: 'chordpro_url',
    score,
    matchKind,
    chords: detail.chords,
    song: detail,
    attribution: attribution(),
  };
}

function attribution(): ProviderAttribution {
  return {
    label: 'ChordPro URL',
    licenseNote: 'Пользователь указывает raw URL (gist, GitHub raw). Без Ultimate Guitar.',
  };
}
