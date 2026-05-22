import { searchSongsSmart } from '../db/searchSongsSmart';
import type { SongProvider, SongSearchResult, ProviderAttribution } from './types';

export const builtinProvider: SongProvider = {
  id: 'builtin',
  label: 'Встроенный каталог',
  requiresNetwork: false,
  async search(query, limit = 50) {
    const hits = await searchSongsSmart(query, { limit, source: 'builtin' });
    return hits.map(h => ({
      id: h.id,
      title: h.title,
      artist: h.artist,
      provider: 'builtin' as const,
      score: h.score,
      matchKind: h.matchKind,
      chords: h.chords,
      song: h,
      attribution: attribution(),
    }));
  },
  attribution,
};

function attribution(): ProviderAttribution {
  return { label: 'RecoTune встроенный каталог', licenseNote: 'Offline, seeded from app bundle' };
}
