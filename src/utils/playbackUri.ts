import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

const PHONE_AUDIO_ALBUM = 'RecoTune';

/**
 * Copy audio into the phone media library (Music / RecoTune).
 * Survives RecoTune uninstall. App sandbox copy is unchanged.
 */
export async function saveAudioToPhoneLibrary(
  localUri: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    let perm = await MediaLibrary.requestPermissionsAsync(true, ['audio']);
    if (!perm.granted) {
      perm = await MediaLibrary.requestPermissionsAsync(true);
    }
    if (!perm.granted) {
      return { ok: false, error: 'Нет доступа к памяти телефона' };
    }
    const uri = await assertPlaybackFileExists(localUri);
    const asset = await MediaLibrary.createAssetAsync(uri);
    try {
      const album = await MediaLibrary.getAlbumAsync(PHONE_AUDIO_ALBUM);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(PHONE_AUDIO_ALBUM, asset, false);
      }
    } catch {
      /* asset already in shared storage even if album fails */
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

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
