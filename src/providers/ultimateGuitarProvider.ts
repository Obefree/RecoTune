import { fetchOnDemandChordSheet } from './chordFetchProxy';
import type { ProviderAttribution, SongDetail } from './types';

export function ultimateGuitarAttribution(): ProviderAttribution {
  return {
    label: 'Доп. источник (скоро)',
    url: 'https://www.ultimate-guitar.com/',
    licenseNote: 'Пока недоступен в приложении.',
  };
}

/** Fetch one song from Ultimate Guitar via configured chord-fetch proxy (not bulk). */
export async function fetchUltimateGuitarChordSheet(
  artist: string,
  title: string,
): Promise<SongDetail> {
  return fetchOnDemandChordSheet('ultimate_guitar', artist, title, ultimateGuitarAttribution);
}
