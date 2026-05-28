import {
  fetchOnDemandChordSheet,
  type ChordFetchProgress,
} from './chordFetchProxy';
import type { ProviderAttribution, SongDetail } from './types';

export function ultimateGuitarAttribution(): ProviderAttribution {
  return {
    label: 'Ultimate Guitar',
    url: 'https://www.ultimate-guitar.com/',
    licenseNote: 'Подгрузка через прокси на ПК (npm run dev-proxy).',
  };
}

/** Fetch one song from Ultimate Guitar via configured chord-fetch proxy (not bulk). */
export async function fetchUltimateGuitarChordSheet(
  artist: string,
  title: string,
  onProgress?: ChordFetchProgress,
): Promise<SongDetail> {
  return fetchOnDemandChordSheet(
    'ultimate_guitar',
    artist,
    title,
    ultimateGuitarAttribution,
    onProgress,
  );
}
