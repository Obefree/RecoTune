import { requireOptionalNativeModule } from 'expo-modules-core';

let cached: boolean | null = null;

/** True when native ExponentAV exists (dev/standalone APK, Expo Go SDK 54). */
export function isExpoAvNativeAvailable(): boolean {
  if (cached === null) {
    cached = requireOptionalNativeModule('ExponentAV') != null;
  }
  return cached;
}
