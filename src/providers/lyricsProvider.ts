import { normalizeSearchText } from '../utils/searchNormalize';
import type { SongProvider, SongSearchResult, ProviderAttribution } from './types';

/**
 * Metadata-only stub: suggests lyrics.ovh lookup (no chord sheets).
 * Does not scrape UG or other ToS-risky sites.
 */
export const lyricsProvider: SongProvider = {
  id: 'lyrics',
  label: 'Текст (lyrics.ovh)',
  requiresNetwork: true,
  async search(query, limit = 5) {
    const q = query.trim();
    if (!q || q.length < 2) return [];
    const parts = q.split(/\s*[-–—]\s*|\s+/);
    const title = parts.length > 1 ? parts.slice(1).join(' ') : q;
    const artist = parts.length > 1 ? parts[0] : 'Unknown';
    return [{
      id: `lyrics_meta_${normalizeSearchText(q).slice(0, 40)}`,
      title: title.trim() || q,
      artist: artist.trim() || 'Unknown',
      provider: 'lyrics' as const,
      score: 15,
      attribution: attribution(),
    }].slice(0, limit);
  },
  attribution,
};

function attribution(): ProviderAttribution {
  return {
    label: 'lyrics.ovh',
    url: 'https://lyrics.ovh/',
    licenseNote: 'Только текст при открытии песни; аккорды не предоставляет',
  };
}
