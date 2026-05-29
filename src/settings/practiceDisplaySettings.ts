import * as FileSystem from 'expo-file-system/legacy';

const SETTINGS_FILE = (FileSystem.documentDirectory ?? '') + 'practice_display_settings.json';

export type PracticeDisplaySettings = {
  /** 0.75 … 1.75 — pinch / A± for lyrics + chord chips */
  lyricsZoom: number;
  /** Per-song transpose semitones (song id → offset) */
  transposeBySongId: Record<string, number>;
};

const DEFAULTS: PracticeDisplaySettings = {
  lyricsZoom: 1,
  transposeBySongId: {},
};

let cache: PracticeDisplaySettings | null = null;

async function loadRaw(): Promise<PracticeDisplaySettings> {
  try {
    const info = await FileSystem.getInfoAsync(SETTINGS_FILE);
    if (!info.exists) return { ...DEFAULTS };
    const raw = JSON.parse(await FileSystem.readAsStringAsync(SETTINGS_FILE)) as Partial<PracticeDisplaySettings>;
    return {
      lyricsZoom:
        typeof raw.lyricsZoom === 'number' && raw.lyricsZoom >= 0.7 && raw.lyricsZoom <= 1.9
          ? raw.lyricsZoom
          : DEFAULTS.lyricsZoom,
      transposeBySongId:
        raw.transposeBySongId && typeof raw.transposeBySongId === 'object'
          ? { ...raw.transposeBySongId }
          : {},
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function getPracticeDisplaySettings(): Promise<PracticeDisplaySettings> {
  if (!cache) cache = await loadRaw();
  return cache;
}

export async function savePracticeDisplaySettings(
  patch: Partial<PracticeDisplaySettings>,
): Promise<PracticeDisplaySettings> {
  const prev = await getPracticeDisplaySettings();
  cache = {
    lyricsZoom: patch.lyricsZoom ?? prev.lyricsZoom,
    transposeBySongId: patch.transposeBySongId ?? prev.transposeBySongId,
  };
  await FileSystem.writeAsStringAsync(SETTINGS_FILE, JSON.stringify(cache));
  return cache;
}

export async function setPracticeLyricsZoom(zoom: number): Promise<number> {
  const clamped = Math.min(1.9, Math.max(0.75, zoom));
  await savePracticeDisplaySettings({ lyricsZoom: clamped });
  return clamped;
}

export async function getSongTranspose(songId: string): Promise<number> {
  const s = await getPracticeDisplaySettings();
  return s.transposeBySongId[songId] ?? 0;
}

export async function setSongTranspose(songId: string, semitones: number): Promise<void> {
  const s = await getPracticeDisplaySettings();
  const next = { ...s.transposeBySongId };
  if (!semitones) delete next[songId];
  else next[songId] = semitones;
  await savePracticeDisplaySettings({ transposeBySongId: next });
}
