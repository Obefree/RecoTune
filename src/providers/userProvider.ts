import { searchSongsSmart } from '../db/searchSongsSmart';
import { listUserSongs, upsertUserSong } from '../db/songLibrary';
import type { SongProvider, SongDetail, SongSearchResult, ProviderAttribution } from './types';
import type { SongEntry } from '../data/songDatabase';

export const userProvider: SongProvider = {
  id: 'user',
  label: 'Мои песни',
  requiresNetwork: false,
  async search(query, limit = 50) {
    const hits = await searchSongsSmart(query, { limit, source: 'user' });
    return hits.map(h => ({
      id: h.id,
      title: h.title,
      artist: h.artist,
      provider: 'user' as const,
      score: h.score,
      matchKind: h.matchKind,
      chords: h.chords,
      song: h,
      attribution: attribution(),
    }));
  },
  async fetchById(id) {
    const songs = await listUserSongs();
    const song = songs.find(s => s.id === id);
    if (!song) return null;
    return { ...song, provider: 'user', attribution: attribution() };
  },
  attribution,
};

function attribution(): ProviderAttribution {
  return { label: 'Локальная библиотека пользователя', licenseNote: 'SQLite, offline' };
}

export async function saveUserSongFromEntry(song: SongEntry): Promise<void> {
  await upsertUserSong(song);
}
