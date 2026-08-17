import { combinedArtistTitle } from '../utils/searchNormalize';
import { scoreSongAgainstQuery } from '../utils/searchScore';
import {
  CHORD_FETCH_TIMEOUT_MS,
  isChordFetchProxyReachable,
} from './chordFetchProxy';
import { buildChordSearchProxyUrl, getEffectiveChordFetchUrl } from './chordFetchUrl';
import { getProviderSettings } from './providerSettings';
import type { ProviderId, SongSearchResult } from './types';

export type RemoteCatalogHit = {
  provider: 'amdm' | 'ultimate_guitar';
  artist: string;
  title: string;
  score: number;
  sourceUrl?: string;
};

export { isRemoteTabSearchId } from '../utils/songContent';

function stableRemoteId(provider: ProviderId, artist: string, title: string): string {
  const key = combinedArtistTitle(artist, title)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const prefix = provider === 'amdm' ? 'remote_amdm_' : 'remote_ug_';
  return `${prefix}${key || 'hit'}`;
}

export function remoteHitToSearchResult(hit: RemoteCatalogHit, query: string): SongSearchResult {
  const provider: ProviderId = hit.provider;
  const { score: textScore, kind } = scoreSongAgainstQuery(query, hit.title, hit.artist);
  const score = Math.max(hit.score, textScore) + (provider === 'ultimate_guitar' ? 2 : 0);
  const id = stableRemoteId(provider, hit.artist, hit.title);
  return {
    id,
    title: hit.title,
    artist: hit.artist,
    provider,
    score,
    matchKind: kind === 'none' ? 'remote' : kind,
    chords: '',
    attribution: {
      label: provider === 'amdm' ? 'AmDm' : 'Ultimate Guitar',
      url: hit.sourceUrl,
    },
    song: {
      id,
      title: hit.title,
      artist: hit.artist,
      chords: '',
      difficulty: 1,
      genre: provider === 'amdm' ? 'AmDm (поиск)' : 'UG (поиск)',
    },
  };
}

export type RemoteChordSearchProbe = {
  fetchUrl: string;
  searchUrl: string;
  reachable: boolean;
};

/** Probe dev-proxy / Vercel for POST /search (library AmDm/UG hits). */
export async function probeRemoteChordSearch(
  timeoutMs = 2800,
): Promise<RemoteChordSearchProbe> {
  const settings = await getProviderSettings();
  const fetchUrl = getEffectiveChordFetchUrl(settings.chordFetchProxyUrl);
  if (!fetchUrl) {
    return { fetchUrl: '', searchUrl: '', reachable: false };
  }
  const searchUrl = buildChordSearchProxyUrl(fetchUrl);
  const reachable = await isChordFetchProxyReachable(fetchUrl, timeoutMs);
  return { fetchUrl, searchUrl, reachable };
}

/**
 * Live AmDm + UG catalog search via dev-proxy / Vercel (no tab body).
 * Returns [] when proxy URL missing or unreachable.
 */
export async function searchRemoteChordCatalog(
  query: string,
  options?: { limit?: number },
): Promise<SongSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { fetchUrl: url, searchUrl, reachable } = await probeRemoteChordSearch(2800);
  if (!url || !reachable) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHORD_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(searchUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, limit: options?.limit ?? 28 }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: RemoteCatalogHit[] };
    const rows = Array.isArray(data.results) ? data.results : [];
    return rows
      .filter(r => r.title?.trim())
      .map(r => remoteHitToSearchResult(r, q))
      .slice(0, options?.limit ?? 28);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
