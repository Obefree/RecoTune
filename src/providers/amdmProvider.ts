import { fetchOnDemandChordSheet } from './chordFetchProxy';
import type { ProviderAttribution, SongDetail } from './types';

export function amdmAttribution(): ProviderAttribution {
  return {
    label: 'Таб из интернета',
    url: 'https://amdm.ru/',
    licenseNote: 'Подгрузка с AmDm через прокси на ПК (npm run dev-proxy).',
  };
}

/** Fetch one song from AmDm via configured chord-fetch proxy (not bulk). */
export async function fetchAmdmChordSheet(artist: string, title: string): Promise<SongDetail> {
  return fetchOnDemandChordSheet('amdm', artist, title, amdmAttribution);
}
