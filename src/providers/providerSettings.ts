import * as FileSystem from 'expo-file-system/legacy';
import type { ProviderId } from './types';

const SETTINGS_FILE = (FileSystem.documentDirectory ?? '') + 'chord_provider_settings.json';

export type ProviderSettings = {
  enabled: Record<ProviderId, boolean>;
  /** Raw URL to ChordPro / plain text (gist, raw GitHub, etc.) */
  chordProUrl: string;
  /**
   * Optional POST endpoint: `{ provider, artist, title }` → ChordPro or JSON `{ chordPro?, text? }`.
   * No HTML scraper in the app — proxy runs on your machine / private server.
   */
  chordFetchProxyUrl: string;
  /** User typed/saved chordFetchProxyUrl in ⚙ (keeps Vercel over Metro auto). */
  chordFetchProxyUserSet?: boolean;
  /** Optional GET …/metadata/batch?offset=&limit= for large catalog sync */
  metadataSyncBaseUrl: string;
  /** Import all bundled metadata into SQLite in background (power users / offline FTS). */
  metadataFullIndexOffline: boolean;
  /** User opted in to restore ~536 legacy builtin songs from assets archive. */
  legacyArchiveImported: boolean;
  /** Legacy: dev proxy URL hint dismissed (auto-fill via autoChordProxy). */
  devProxyUrlHintDismissed?: boolean;
  /**
   * On-demand tab chain: `auto` = AmDm → Ultimate Guitar → pesni.ru (phone fallback).
   * pesni.ru in search — only if `enabled.pesni_ru`; in auto chain — always last fallback.
   */
  onDemandChordSource: 'auto' | 'ultimate_guitar' | 'pesni_ru' | 'amdm';
};

const DEFAULTS: ProviderSettings = {
  enabled: {
    builtin: true,
    user: true,
    chordpro_import: true,
    chordpro_url: true,
    lyrics: true,
    amdm: true,
    pesni_ru: false,
    ultimate_guitar: true,
    github: true,
  },
  onDemandChordSource: 'auto',
  chordProUrl: '',
  chordFetchProxyUrl: '',
  metadataSyncBaseUrl: '',
  metadataFullIndexOffline: false,
  legacyArchiveImported: false,
};

let cache: ProviderSettings | null = null;

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return JSON.parse(await FileSystem.readAsStringAsync(path)) as T;
  } catch { /* ignore */ }
  return fallback;
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  if (cache) return cache;
  const raw = await loadJson<Partial<ProviderSettings>>(SETTINGS_FILE, {});
  cache = {
    enabled: { ...DEFAULTS.enabled, ...raw.enabled },
    chordProUrl: raw.chordProUrl ?? '',
    chordFetchProxyUrl: raw.chordFetchProxyUrl ?? '',
    chordFetchProxyUserSet: raw.chordFetchProxyUserSet === true,
    metadataSyncBaseUrl: raw.metadataSyncBaseUrl ?? '',
    metadataFullIndexOffline: raw.metadataFullIndexOffline === true,
    legacyArchiveImported: raw.legacyArchiveImported === true,
    devProxyUrlHintDismissed: raw.devProxyUrlHintDismissed === true,
    onDemandChordSource:
      raw.onDemandChordSource === 'amdm'
        ? 'amdm'
        : raw.onDemandChordSource === 'pesni_ru'
          ? 'pesni_ru'
          : raw.onDemandChordSource === 'ultimate_guitar'
            ? 'ultimate_guitar'
            : 'auto',
  };
  return cache;
}

export async function saveProviderSettings(next: ProviderSettings): Promise<void> {
  cache = next;
  await FileSystem.writeAsStringAsync(SETTINGS_FILE, JSON.stringify(next, null, 2));
}

export async function isProviderEnabled(id: ProviderId): Promise<boolean> {
  const s = await getProviderSettings();
  return s.enabled[id] !== false;
}
