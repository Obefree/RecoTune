import { setMappedAudioModeAsync } from './playbackAudioMode';

/** Keep mic + optional backing playback alive when app is backgrounded. */
export async function applyRecordingBackgroundAudioMode(options?: {
  playThroughEarpieceAndroid?: boolean;
}): Promise<void> {
  try {
    await setMappedAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionMode: 'doNotMix',
      playThroughEarpieceAndroid: options?.playThroughEarpieceAndroid ?? false,
    });
  } catch {
    // Session may already be configured; recording can still work.
  }
}
