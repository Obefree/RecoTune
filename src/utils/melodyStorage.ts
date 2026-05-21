import * as FileSystem from 'expo-file-system/legacy';
import type { SungNote } from './sungNoteDetector';
import type { QuantizedNote } from './melodyKeyQuantize';

/** Local melody JSON — see docs/features/2026-05-21-melody-chords-staff.md */
export const MELODIES_DIR = (FileSystem.documentDirectory ?? '') + 'melodies/';

export interface SavedMelody {
  id: string;
  name: string;
  notes: SungNote[];
  key?: string;
  bpm?: number;
  chords?: string[];
  quantizedNotes?: QuantizedNote[];
  createdAt: string;
}

export interface SavedMelodyMeta {
  id: string;
  name: string;
  noteCount: number;
  key?: string;
  bpm?: number;
  createdAt: string;
  fileUri: string;
}

async function ensureDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(MELODIES_DIR, { intermediates: true });
}

export async function saveMelodyFile(data: {
  name: string;
  notes: SungNote[];
  key?: string;
  bpm?: number;
  chords?: string[];
  quantizedNotes?: QuantizedNote[];
}): Promise<SavedMelody> {
  await ensureDir();
  const id = `melody_${Date.now()}`;
  const createdAt = new Date().toISOString();
  const melody: SavedMelody = {
    id,
    name: data.name.trim() || id,
    notes: data.notes,
    key: data.key,
    bpm: data.bpm,
    chords: data.chords,
    quantizedNotes: data.quantizedNotes,
    createdAt,
  };
  const path = `${MELODIES_DIR}${id}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(melody));
  return melody;
}

export async function updateMelodyFile(
  id: string,
  patch: Partial<Pick<SavedMelody, 'chords' | 'quantizedNotes' | 'key' | 'bpm'>>,
): Promise<SavedMelody | null> {
  const existing = await loadMelodyFile(id);
  if (!existing) return null;
  const melody: SavedMelody = { ...existing, ...patch };
  const path = `${MELODIES_DIR}${id}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(melody));
  return melody;
}

export async function listSavedMelodies(): Promise<SavedMelodyMeta[]> {
  await ensureDir();
  const files = await FileSystem.readDirectoryAsync(MELODIES_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const out: SavedMelodyMeta[] = [];
  for (const file of jsonFiles) {
    const fileUri = MELODIES_DIR + file;
    try {
      const raw = await FileSystem.readAsStringAsync(fileUri);
      const m = JSON.parse(raw) as SavedMelody;
      out.push({
        id: m.id,
        name: m.name,
        noteCount: m.notes?.length ?? 0,
        key: m.key,
        bpm: m.bpm,
        createdAt: m.createdAt,
        fileUri,
      });
    } catch {
      /* skip corrupt */
    }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function loadMelodyFile(id: string): Promise<SavedMelody | null> {
  const path = `${MELODIES_DIR}${id}.json`;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as SavedMelody;
  } catch {
    return null;
  }
}
