import * as FileSystem from 'expo-file-system/legacy';
import type { AudioSnippetMeta } from './types';

export const RECOGNITION_SNIPPETS_DIR =
  (FileSystem.documentDirectory ?? '') + 'recognition_snippets/';

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
