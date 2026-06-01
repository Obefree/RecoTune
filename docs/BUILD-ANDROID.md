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
| Chord proxy in APK | `tools/chord-fetch` is blocked in `metro.config.js`; release app uses HTTP(S) proxy URL from settings only |

## Optional env (release / EAS)

Set before `expo prebuild` or in EAS secrets. Values are copied into `app.config.js` → `expo.extra`.

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_CHORD_FETCH_URL` | Fixed chord-fetch proxy on phone-only builds (e.g. `https://your-pc:8787`). Without it: Metro LAN auto in dev; **pesni.ru** on device if enabled in Chords ⚙. |
| `EXPO_PUBLIC_STEM_SERVER_URL` | Hosted Demucs/basic-pitch base URL (e.g. `https://stems.example.com` → `/separate`, `/transcribe`). Also in `expo.extra.stemServerUrl`. Dev fallback: Metro LAN `:8788`. Legacy full URL: `EXPO_PUBLIC_STEM_URL`. |

**Phone-only tabs without PC:** Chords → ⚙ → enable **pesni.ru** (on-demand HTTPS, 60 req/min). AmDm/UG need `npm start` / proxy or `EXPO_PUBLIC_CHORD_FETCH_URL`.

## Play Store (AAB)

```bat
cd android
gradlew.bat bundleRelease -PreactNativeArchitectures=arm64-v8a
```

Output: `android\app\build\outputs\bundle\release\app-release.aab`. Signing with a release keystore is required for Play Console (currently release builds use the debug keystore for local installs).

## Release checklist (light)

- Bump `version` in `app.config.js` (overrides `app.json`; current **1.0.1** after P7).
- Optional env: `EXPO_PUBLIC_CHORD_FETCH_URL`, `EXPO_PUBLIC_STEM_SERVER_URL`.
- `npm run build:android:release` → smoke (audio on device, volume up, silent mode off):
  1. **Melody** — ноты на нотоносце → кнопка **PLAY** (синтез, WebView).
  2. **Studio** — сессия с дорожкой → solo ▶ или **Play all**.
  3. **Media → Player** — запись из Recorder → ▶.
  4. **Media → Video** — выбрать файл → тап по центру / ▶.
  5. Tuner / Chords НАЙТИ / AI Lab — по необходимости.

Первое воспроизведение после установки: нажмите **PLAY** / ▶ на экране (жест разблокирует Web Audio и expo-av session).
