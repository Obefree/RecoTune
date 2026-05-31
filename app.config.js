/** @type {import('expo/config').ExpoConfig} */
const base = require('./app.json').expo;

/** ProGuard/R8 rules re-applied on every `expo prebuild` (android/ is gitignored). */
const RELEASE_PROGUARD = `
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
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
    },
    plugins: [
      ...(base.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraProguardRules: RELEASE_PROGUARD,
          },
        },
      ],
    ],
  },
};
