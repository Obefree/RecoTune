import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

/** Keep mic + optional backing playback alive when app is backgrounded. */
export async function applyRecordingBackgroundAudioMode(options?: {
  playThroughEarpieceAndroid?: boolean;
}): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: options?.playThroughEarpieceAndroid ?? false,
    });
  } catch {
    // Session may already be configured; recording can still work.
  }
}
