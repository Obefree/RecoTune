import { setAudioModeAsync } from 'expo-audio';

export type LegacyAudioMode = {
  allowsRecordingIOS?: boolean;
  allowsRecording?: boolean;
  playsInSilentModeIOS?: boolean;
  playsInSilentMode?: boolean;
  staysActiveInBackground?: boolean;
  shouldPlayInBackground?: boolean;
  interruptionModeIOS?: number;
  interruptionModeAndroid?: number;
  interruptionMode?: 'doNotMix' | 'duckOthers' | 'mixWithOthers' | number;
  shouldDuckAndroid?: boolean;
  playThroughEarpieceAndroid?: boolean;
  shouldRouteThroughEarpiece?: boolean;
};

function interruptionOf(mode: LegacyAudioMode): 'doNotMix' | 'duckOthers' | 'mixWithOthers' {
  const v = mode.interruptionMode ?? mode.interruptionModeIOS ?? mode.interruptionModeAndroid;
  if (v === 'duckOthers' || v === 2) return 'duckOthers';
  if (v === 'mixWithOthers' || v === 0) return 'mixWithOthers';
  return 'doNotMix';
}

/** Map expo-av session keys onto expo-audio setAudioModeAsync. */
export async function setMappedAudioModeAsync(mode: LegacyAudioMode): Promise<void> {
  const allowsRecording = mode.allowsRecording ?? mode.allowsRecordingIOS ?? false;
  await setAudioModeAsync({
    allowsRecording,
    playsInSilentMode: mode.playsInSilentMode ?? mode.playsInSilentModeIOS ?? true,
    shouldPlayInBackground: mode.shouldPlayInBackground ?? mode.staysActiveInBackground ?? false,
    interruptionMode: interruptionOf(mode),
    shouldRouteThroughEarpiece: mode.shouldRouteThroughEarpiece ?? mode.playThroughEarpieceAndroid ?? false,
    allowsBackgroundRecording: allowsRecording,
  });
}

/** Audio session for music playback (Player, Recorder preview, Studio solo/playAll). */
export async function applyPlaybackAudioMode(): Promise<void> {
  try {
    await setMappedAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionMode: 'doNotMix',
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // Non-fatal: playback may still work with the current session mode.
  }
}
