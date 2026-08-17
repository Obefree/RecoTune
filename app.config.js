/** @type {import('expo/config').ExpoConfig} */
const base = require('./app.json').expo;

/** ProGuard/R8 rules re-applied on every `expo prebuild` (android/ is gitignored). */
const RELEASE_PROGUARD = `
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class expo.modules.av.** { *; }
-keep class com.google.android.exoplayer2.** { *; }
-keep class org.chromium.** { *; }
-dontwarn com.google.android.exoplayer2.**
`.trim();

module.exports = {
  expo: {
    ...base,
    version: '1.0.1',
    extra: {
      ...(base.extra ?? {}),
      /** VPS stem server base URL (Demucs/basic-pitch); set EXPO_PUBLIC_STEM_SERVER_URL at build time. */
      stemServerUrl: process.env.EXPO_PUBLIC_STEM_SERVER_URL?.trim() || '',
      chordFetchUrl: process.env.EXPO_PUBLIC_CHORD_FETCH_URL?.trim() || '',
      /** Same URL — app reads extra.chordFetchApiUrl (legacy key). */
      chordFetchApiUrl:
        process.env.EXPO_PUBLIC_CHORD_FETCH_URL?.trim()
        || (typeof base.extra?.chordFetchApiUrl === 'string' ? base.extra.chordFetchApiUrl : ''),
    },
    plugins: [
      ...(base.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: {
            // Local dev/VPS proxies (chord-fetch, stems) are plain http — SDK 54 dropped
            // the top-level android.usesCleartextTraffic config key, so it lives here.
            usesCleartextTraffic: true,
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraProguardRules: RELEASE_PROGUARD,
          },
        },
      ],
    ],
  },
};
