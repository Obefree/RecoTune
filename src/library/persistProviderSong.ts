import { upsertUserSong } from '../db/songLibrary';
import type { SongEntry } from '../data/songDatabase';
import type { ProviderId } from '../providers/types';
import { combinedArtistTitle } from '../utils/searchNormalize';

function stableChordProUserId(title: string, artist: string): string {
  const key = combinedArtistTitle(artist, title)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `custom_chordpro_${key || Date.now()}`;
}

/** Ephemeral ChordPro URL hits → stable row in SQLite user songs. */
export async function ensureSongInUserLibrary(
  song: SongEntry,
  provider?: ProviderId,
): Promise<SongEntry> {
  const fromChordProUrl =
    provider === 'chordpro_url' || song.id.startsWith('chordpro_url_');
  const fromOnDemand =
    provider === 'amdm' ||
    provider === 'pesni_ru' ||
    provider === 'ultimate_guitar' ||
    song.id.startsWith('custom_amdm_') ||
    song.id.startsWith('pesni_ru_') ||
    song.id.startsWith('custom_pesni_') ||
    song.id.startsWith('custom_ug_') ||
    song.id.startsWith('remote_amdm_') ||
    song.id.startsWith('remote_ug_');

  if (!fromChordProUrl && !fromOnDemand) return song;

  const id = fromOnDemand ? song.id : stableChordProUserId(song.title, song.artist);
  const persisted: SongEntry = {
    ...song,
    id,
    genre:
      song.genre && song.genre !== 'Импорт'
        ? song.genre
        : provider === 'amdm'
          ? 'fetch-amdm'
          : provider === 'ultimate_guitar'
            ? 'fetch-ug'
            : provider === 'pesni_ru'
              ? 'fetch-pesni-ru'
              : 'ChordPro',
  };
  await upsertUserSong(persisted);
  return persisted;
}
