import * as FileSystem from 'expo-file-system/legacy';
import type { AppLocale } from './strings';

export const LOCALE_FILE = (FileSystem.documentDirectory ?? '') + 'app_locale.json';

export const DEFAULT_LOCALE: AppLocale = 'en';

export async function loadAppLocale(): Promise<AppLocale> {
  try {
    const info = await FileSystem.getInfoAsync(LOCALE_FILE);
    if (info.exists) {
      const raw = JSON.parse(await FileSystem.readAsStringAsync(LOCALE_FILE));
      if (raw === 'en' || raw === 'ru') return raw;
    }
  } catch {}
  return DEFAULT_LOCALE;
}

export async function saveAppLocale(locale: AppLocale): Promise<void> {
  await FileSystem.writeAsStringAsync(LOCALE_FILE, JSON.stringify(locale));
}
