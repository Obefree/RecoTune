import * as FileSystem from 'expo-file-system/legacy';
import type { AudioSnippetMeta } from './types';

export const RECOGNITION_SNIPPETS_DIR =
  (FileSystem.documentDirectory ?? '') + 'recognition_snippets/';

export type RecognitionSnippetFile = {
  uri: string;
  name: string;
  modifiedAt: number;
};

/** Newest first — for Melody «Напев» import from НАЙТИ recordings. */
export async function listRecognitionSnippetFiles(): Promise<RecognitionSnippetFile[]> {
  const dir = RECOGNITION_SNIPPETS_DIR;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return [];

  const names = await FileSystem.readDirectoryAsync(dir);
  const rows: RecognitionSnippetFile[] = [];
  for (const name of names) {
    const uri = `${dir}${name}`;
    const fi = await FileSystem.getInfoAsync(uri);
    if (!fi.exists) continue;
    rows.push({
      uri,
      name,
      modifiedAt: fi.modificationTime ?? 0,
    });
  }
  rows.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return rows;
}

export async function saveRecognitionSnippet(
  sourceUri: string,
  options: { durationSec: number; source: 'mic' | 'file' },
): Promise<AudioSnippetMeta> {
  await FileSystem.makeDirectoryAsync(RECOGNITION_SNIPPETS_DIR, { intermediates: true });
  const id = `rec_${Date.now()}`;
  const ext = options.source === 'file' ? '.audio' : '.m4a';
  const dest = `${RECOGNITION_SNIPPETS_DIR}${id}${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return {
    id,
    uri: dest,
    durationSec: options.durationSec,
    createdAt: new Date().toISOString(),
    source: options.source,
  };
}
