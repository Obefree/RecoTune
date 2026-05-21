import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

/** Audio session for music playback (Player, Recorder preview, Studio solo/playAll). */
export async function applyPlaybackAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // Non-fatal: playback may still work with the current session mode.
  }
}
