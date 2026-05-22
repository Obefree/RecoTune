import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { SongEntry } from '../data/songDatabase';
import { listUserSongs, upsertUserSong, getFavoriteIds } from '../db/songLibrary';
import { chordProToSongEntry, parseChordProText } from '../utils/chordProParse';

export const LIBRARY_BACKUP_VERSION = 1;

export type LibraryBackup = {
  version: number;
  exportedAt: string;
  songs: SongEntry[];
  favoriteIds: string[];
};

export async function exportLibraryBackup(): Promise<LibraryBackup> {
  const [songs, favoriteIds] = await Promise.all([
    listUserSongs(),
    getFavoriteIds(),
  ]);
  return {
    version: LIBRARY_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    songs,
    favoriteIds: [...favoriteIds],
  };
}

export async function writeBackupToCache(backup: LibraryBackup): Promise<string> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  const path = `${dir}recotune_library_backup_${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2));
  return path;
}

export async function shareLibraryBackup(): Promise<void> {
  const backup = await exportLibraryBackup();
  const path = await writeBackupToCache(backup);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing not available');
  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'RecoTune library backup',
  });
}

export type ImportBackupResult = { imported: number; skipped: number };

export async function importLibraryBackupJson(raw: string): Promise<ImportBackupResult> {
  const data = JSON.parse(raw) as LibraryBackup;
  if (!data.songs || !Array.isArray(data.songs)) throw new Error('Invalid backup format');
  let imported = 0;
  let skipped = 0;
  for (const song of data.songs) {
    if (!song.title?.trim() || !song.chords?.trim()) {
      skipped++;
      continue;
    }
    const entry: SongEntry = {
      ...song,
      id: song.id?.startsWith('custom_') ? song.id : `custom_${Date.now()}_${imported}`,
    };
    await upsertUserSong(entry);
    imported++;
  }
  return { imported, skipped };
}

export type ChordProBatchResult = { imported: number; failed: number; titles: string[] };

export async function importChordProFilesFromUris(
  assets: { uri: string; name?: string }[],
): Promise<ChordProBatchResult> {
  let imported = 0;
  let failed = 0;
  const titles: string[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    try {
      const raw = await FileSystem.readAsStringAsync(asset.uri);
      const fallbackTitle = asset.name?.replace(/\.(cho|txt|chordpro|pro|md)$/i, '') ?? 'Без названия';
      const parsed = parseChordProText(raw, fallbackTitle);
      const song = chordProToSongEntry(parsed, `custom_${Date.now()}_${i}`);
      await upsertUserSong(song);
      imported++;
      titles.push(song.title);
    } catch {
      failed++;
    }
  }
  return { imported, failed, titles };
}
