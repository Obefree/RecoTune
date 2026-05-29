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
