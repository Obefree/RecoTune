import { requireOptionalNativeModule } from 'expo-modules-core';

let cached: boolean | null = null;

/** True when native ExpoAudio exists (Expo Go SDK 57, dev/standalone APK). */
export function isExpoAvNativeAvailable(): boolean {
  if (cached === null) {
    cached =
      requireOptionalNativeModule('ExpoAudio') != null
      || requireOptionalNativeModule('ExponentAV') != null;
  }
  return cached;
}
