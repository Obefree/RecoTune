import * as FileSystem from 'expo-file-system/legacy';

const PHONE_AUDIO_ALBUM = 'RecoTune';

/**
 * Copy audio into the phone media library (Music / RecoTune).
 * Survives RecoTune uninstall. App sandbox copy is unchanged.
 * SDK 57: default `expo-media-library` is Next (`ExpoMediaLibraryNext`) — not in Expo Go.
 * Legacy module is in Go; load it only when saving so Tuner/Studio don't crash on import.
 */
export async function saveAudioToPhoneLibrary(
  localUri: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const MediaLibrary = await import('expo-media-library/legacy');
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

/** Local paths from documentDirectory need a scheme for expo-audio on release Android. */
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

const EMPTY_RECORDING_BYTES = 2048;

/** MediaRecorder often leaves a header-only file when BT SCO never connected. */
export async function assertFreshRecordingFile(
  uri: string,
  opts?: { bluetooth?: boolean },
): Promise<{ ok: true; uri: string } | { ok: false; reason: string }> {
  const normalized = normalizePlaybackUri(uri);
  try {
    const info = await FileSystem.getInfoAsync(normalized);
    if (!info.exists) {
      return { ok: false, reason: 'Файл записи не создался.' };
    }
    const size = 'size' in info && typeof info.size === 'number' ? info.size : undefined;
    if (typeof size === 'number' && size < EMPTY_RECORDING_BYTES) {
      return {
        ok: false,
        reason: opts?.bluetooth
          ? 'Bluetooth-микрофон не дал звука (гарнитура не успела перейти в SCO). Подождите пару секунд или пишите на микрофон телефона, слушая минус в наушниках.'
          : 'Файл записи пустой.',
      };
    }
    return { ok: true, uri: normalized };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
