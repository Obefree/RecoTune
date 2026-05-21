import * as FileSystem from 'expo-file-system/legacy';

/** Local paths from documentDirectory need a scheme for expo-av on release Android. */
export function normalizePlaybackUri(uri: string): string {
  if (!uri) return uri;
  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }
  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }
  return uri;
}

export async function assertPlaybackFileExists(uri: string): Promise<string> {
  const normalized = normalizePlaybackUri(uri);
  const info = await FileSystem.getInfoAsync(normalized);
  if (!info.exists) {
    throw new Error(`Audio file not found: ${normalized}`);
  }
  return normalized;
}
