import type { SongEntry } from '../data/songDatabase';



export type ProviderId =

  | 'builtin'

  | 'user'

  | 'chordpro_import'

  | 'chordpro_url'

  | 'lyrics'

  | 'amdm'

  | 'ultimate_guitar';

/** On-demand chord fetch (explicit user tap + proxy; not bulk search). */
export type OnDemandChordProviderId = 'amdm' | 'ultimate_guitar';



export interface ProviderAttribution {

  label: string;

  url?: string;

  licenseNote?: string;

}



export interface SongSearchResult {

  id: string;

  title: string;

  artist: string;

  provider: ProviderId;

  score: number;

  matchKind?: string;

  chords?: string;

  attribution?: ProviderAttribution;

  /** Populated for local SQLite hits */

  song?: SongEntry;

}



export interface SongDetail extends SongEntry {

  provider: ProviderId;

  attribution?: ProviderAttribution;

}



export interface SongProvider {

  id: ProviderId;

  label: string;

  /** Local providers work offline */

  requiresNetwork: boolean;

  search(query: string, limit?: number): Promise<SongSearchResult[]>;

  fetchById?(id: string): Promise<SongDetail | null>;

  attribution(): ProviderAttribution;

}



export const PROVIDER_BADGE_COLORS: Record<ProviderId, string> = {

  builtin: '#00e676',

  user: '#7c4dff',

  chordpro_import: '#ff9800',

  chordpro_url: '#ff9800',

  lyrics: '#888',

  amdm: '#42a5f5',

  ultimate_guitar: '#ef5350',

};



export const PROVIDER_LABELS: Record<ProviderId, string> = {

  builtin: 'Каталог',

  user: 'Мои',

  chordpro_import: 'ChordPro',

  chordpro_url: 'URL',

  lyrics: 'Текст',

  amdm: 'Табы онлайн',

  ultimate_guitar: 'Доп. источник (скоро)',

};


