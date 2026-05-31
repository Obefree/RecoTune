import * as FileSystem from 'expo-file-system/legacy';

export const STUDIO_SESSIONS_FILE =
  (FileSystem.documentDirectory ?? '') + 'studio_sessions.json';
export const STUDIO_AUDIO_DIR = (FileSystem.documentDirectory ?? '') + 'studio/';

export interface StudioTrack {
  id: string;
  uri: string;
  label: string;
  color: string;
  offsetMs?: number;
  gain?: number;
}

export interface StudioSession {
  id: string;
  name: string;
  createdAt: number;
  tracks: StudioTrack[];
}

const TRACK_COLORS = [
  '#7c4dff', '#00e676', '#ff5252', '#ffeb3b',
  '#40c4ff', '#ff6d00', '#ea80fc', '#69f0ae',
];

export type StudioStemImport = { uri: string; label: string; color?: string };

async function loadSessions(): Promise<StudioSession[]> {
  try {
    const info = await FileSystem.getInfoAsync(STUDIO_SESSIONS_FILE);
    if (!info.exists) return [];
    return JSON.parse(await FileSystem.readAsStringAsync(STUDIO_SESSIONS_FILE)) as StudioSession[];
  } catch {
    return [];
  }
}

async function saveSessions(data: StudioSession[]): Promise<void> {
  await FileSystem.writeAsStringAsync(STUDIO_SESSIONS_FILE, JSON.stringify(data));
}

/** Copy stem/cache WAV into studio/ and append tracks to active or new session. */
export async function importStemsToStudio(
  stems: StudioStemImport[],
  sessionName = 'Demucs',
): Promise<{ sessionId: string; trackCount: number }> {
  if (!stems.length) throw new Error('Нет дорожек для импорта');
  await FileSystem.makeDirectoryAsync(STUDIO_AUDIO_DIR, { intermediates: true });

  const sessions = await loadSessions();
  let session = sessions.find(s => s.name === sessionName) ?? sessions[0];
  if (!session) {
    session = {
      id: `s_${Date.now()}`,
      name: sessionName,
      createdAt: Date.now(),
      tracks: [],
    };
    sessions.unshift(session);
  }

  const batchTs = Date.now();
  for (let i = 0; i < stems.length; i++) {
    const stem = stems[i];
    const info = await FileSystem.getInfoAsync(stem.uri);
    if (!info.exists) continue;
    const dst = `${STUDIO_AUDIO_DIR}stem_${batchTs}_${i}.wav`;
    await FileSystem.copyAsync({ from: stem.uri, to: dst });
    const idx = session.tracks.length;
    session.tracks.push({
      id: `t_${batchTs}_${i}`,
      uri: dst,
      label: stem.label,
      color: stem.color ?? TRACK_COLORS[idx % TRACK_COLORS.length],
      offsetMs: idx > 0 ? 0 : 0,
      gain: 1,
    });
  }

  const next = sessions.map(s => (s.id === session!.id ? session! : s));
  await saveSessions(next);
  return { sessionId: session.id, trackCount: stems.length };
}
