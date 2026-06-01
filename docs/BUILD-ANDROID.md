# Android APK (local release)

RecoTune is an **Expo prebuild** app: native `android/` is generated locally and **not** committed (see `.gitignore`).

## Prerequisites

- Node.js + `npm install` in repo root
- [Android Studio](https://developer.android.com/studio) with SDK at `%LOCALAPPDATA%\Android\Sdk`
- JBR from Android Studio (used as `JAVA_HOME` by the `.bat` scripts)

## Release APK (recommended)

From repo root on Windows:

```bat
build-apk-release.bat
```

Or:

```bat
npm run build:android:release
```

**Output:** `android\app\build\outputs\apk\release\app-release.apk` (arm64-v8a, R8 minify). A timestamped copy is placed in `dist\`.

### What the script does

1. `npm install`
2. `npx expo prebuild --platform android` if `android\gradlew.bat` is missing
3. Stops Gradle, deletes `android\app\build` (avoids Windows `mergeReleaseResources` / `AccessDenied` on stale intermediates)
4. `gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a`

### Manual steps (same result)

```bat
npm install
npx expo prebuild --platform android
cd android
gradlew.bat --stop
rd /s /q app\build
gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

## Debug APK (emulator / universal, ~160 MB)

```bat
build-apk.bat
```

or `npm run build:android:debug`.

## After changing `app.json` / native plugins

Regenerate native project:

```bat
npx expo prebuild --platform android --clean
```

Release Gradle flags (minify, shrink, ProGuard keeps) are set via `expo-build-properties` in `app.config.js`.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `android\gradlew.bat` missing | Run `npx expo prebuild --platform android` |
| `mergeReleaseResources` / `AccessDenied` / cannot delete `app\build` | Close Android Studio, stop emulators, run `gradlew --stop`, delete `android\app\build`, retry `build-apk-release.bat` |
| `JAVA_HOME` invalid | Install Android Studio; script searches `%ProgramFiles%\Android\Android Studio*\jbr` |
| CMake path length warning | Prefer shorter clone path (e.g. `C:\dev\RecoTune`) or `subst R: C:\Users\...\RecoTune` |
| `ContextCompat.RECEIVER_NOT_EXPORTED` / `compileReleaseJavaWithJavac` in `react-native-music-control` | Patch `patches/react-native-music-control+1.4.1.patch`: `registerReceiver` with `Context.RECEIVER_NOT_EXPORTED` on API 33+ (do not use `ContextCompat.RECEIVER_NOT_EXPORTED` with the module's old `androidx.core:1.0.2`). Re-run `npm install`. |
| Chord proxy in APK | `tools/chord-fetch` is blocked in `metro.config.js`; release app uses HTTP(S) proxy URL from settings only |

## Optional env (release / EAS)

Set before `expo prebuild` or in EAS secrets. Values are copied into `app.config.js` Ã¢â€ â€™ `expo.extra`.

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_CHORD_FETCH_URL` | Fixed chord-fetch proxy on phone-only builds (e.g. `https://your-pc:8787`). Without it: Metro LAN auto in dev; **pesni.ru** on device if enabled in Chords Ã¢Å¡â„¢. |
| `EXPO_PUBLIC_STEM_SERVER_URL` | Hosted Demucs/basic-pitch base URL (e.g. `https://stems.example.com` Ã¢â€ â€™ `/separate`, `/transcribe`). Also in `expo.extra.stemServerUrl`. Dev fallback: Metro LAN `:8788`. Legacy full URL: `EXPO_PUBLIC_STEM_URL`. |

**Phone-only tabs without PC:** Chords Ã¢â€ â€™ Ã¢Å¡â„¢ Ã¢â€ â€™ enable **pesni.ru** (on-demand HTTPS, 60 req/min). AmDm/UG need `npm start` / proxy or `EXPO_PUBLIC_CHORD_FETCH_URL`.

## Play Store (AAB)

```bat
cd android
gradlew.bat bundleRelease -PreactNativeArchitectures=arm64-v8a
```

Output: `android\app\build\outputs\bundle\release\app-release.aab`. Signing with a release keystore is required for Play Console (currently release builds use the debug keystore for local installs).

## Release checklist (light)

- Bump `version` in `app.config.js` (overrides `app.json`; current **1.0.1** after P7).
- Optional env: `EXPO_PUBLIC_CHORD_FETCH_URL`, `EXPO_PUBLIC_STEM_SERVER_URL`.
- `npm run build:android:release` Ã¢â€ â€™ smoke (audio on device, volume up, silent mode off):
  1. **Melody** Ã¢â‚¬â€ ÃÂ½ÃÂ¾Ã‘â€šÃ‘â€¹ ÃÂ½ÃÂ° ÃÂ½ÃÂ¾Ã‘â€šÃÂ¾ÃÂ½ÃÂ¾Ã‘ÂÃ‘â€ ÃÂµ Ã¢â€ â€™ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ° **PLAY** (Ã‘ÂÃÂ¸ÃÂ½Ã‘â€šÃÂµÃÂ·, WebView).
  2. **Studio** Ã¢â‚¬â€ Ã‘ÂÃÂµÃ‘ÂÃ‘ÂÃÂ¸Ã‘Â Ã‘Â ÃÂ´ÃÂ¾Ã‘â‚¬ÃÂ¾ÃÂ¶ÃÂºÃÂ¾ÃÂ¹ Ã¢â€ â€™ solo Ã¢â€“Â¶ ÃÂ¸ÃÂ»ÃÂ¸ **Play all**.
  3. **Media Ã¢â€ â€™ Player** Ã¢â‚¬â€ ÃÂ·ÃÂ°ÃÂ¿ÃÂ¸Ã‘ÂÃ‘Å’ ÃÂ¸ÃÂ· Recorder Ã¢â€ â€™ Ã¢â€“Â¶.
  4. **Media Ã¢â€ â€™ Video** Ã¢â‚¬â€ ÃÂ²Ã‘â€¹ÃÂ±Ã‘â‚¬ÃÂ°Ã‘â€šÃ‘Å’ Ã‘â€žÃÂ°ÃÂ¹ÃÂ» Ã¢â€ â€™ Ã‘â€šÃÂ°ÃÂ¿ ÃÂ¿ÃÂ¾ Ã‘â€ ÃÂµÃÂ½Ã‘â€šÃ‘â‚¬Ã‘Æ’ / Ã¢â€“Â¶.
  5. Tuner / Chords ÃÂÃÂÃâ„¢ÃÂ¢ÃËœ / AI Lab Ã¢â‚¬â€ ÃÂ¿ÃÂ¾ ÃÂ½ÃÂµÃÂ¾ÃÂ±Ã‘â€¦ÃÂ¾ÃÂ´ÃÂ¸ÃÂ¼ÃÂ¾Ã‘ÂÃ‘â€šÃÂ¸.

ÃÅ¸ÃÂµÃ‘â‚¬ÃÂ²ÃÂ¾ÃÂµ ÃÂ²ÃÂ¾Ã‘ÂÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂ¸ÃÂ·ÃÂ²ÃÂµÃÂ´ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ¿ÃÂ¾Ã‘ÂÃÂ»ÃÂµ Ã‘Æ’Ã‘ÂÃ‘â€šÃÂ°ÃÂ½ÃÂ¾ÃÂ²ÃÂºÃÂ¸: ÃÂ½ÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸Ã‘â€šÃÂµ **PLAY** / Ã¢â€“Â¶ ÃÂ½ÃÂ° Ã‘ÂÃÂºÃ‘â‚¬ÃÂ°ÃÂ½ÃÂµ (ÃÂ¶ÃÂµÃ‘ÂÃ‘â€š Ã‘â‚¬ÃÂ°ÃÂ·ÃÂ±ÃÂ»ÃÂ¾ÃÂºÃÂ¸Ã‘â‚¬Ã‘Æ’ÃÂµÃ‘â€š Web Audio ÃÂ¸ expo-av session).
