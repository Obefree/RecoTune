# Фикс краша воспроизведения в release APK

## Зачем

На release-сборке (arm64, minify) приложение падало при solo / Play all в Studio и могло не играть локальные `studio/track_*.m4a`.

## Причины

| | Описание |
|---|----------|
| **MediaControl** | `react-native-music-control`: `enableBackgroundMode` / `setNowPlaying` без try/catch — нативный краш при старте playback, когда хук регистрирует remote controls |
| **Audio mode** | Перед playback вызывался `applyStudioAudioMode` (режим записи / `allowsRecordingIOS: true` в manual) → конфликт с `applyPlaybackAudioMode` |
| **URI** | Пути из `documentDirectory` без явного `file://` — на release Android `expo-av` может не открыть файл |

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/mediaRemoteControls.ts` | try/catch на init и все native-вызовы; отключение модуля при ошибке |
| `src/hooks/useMediaRemoteControls.ts` | try/catch вокруг register/publish |
| `src/utils/playbackAudioMode.ts` | try/catch на `setAudioModeAsync` |
| `src/utils/playbackUri.ts` | `normalizePlaybackUri`, `assertPlaybackFileExists` |
| `src/screens/StudioScreen.tsx` | playback только через `applyPlaybackAudioMode`; нормализация URI |
| `src/screens/RecorderScreen.tsx`, `PlayerScreen.tsx` | нормализация URI перед `createAsync` |

## Было → стало

| | Было | Стало |
|---|------|--------|
| Studio solo/playAll | `applyStudioAudioMode` → `applyPlaybackAudioMode` | Только `applyPlaybackAudioMode` |
| MediaControl init | Без защиты | Ошибка → no-op, воспроизведение продолжается |
| Локальный файл | `{ uri: track.uri }` как сохранён | `file://` + проверка существования |

## Сборка

Пересобрать release: `build-apk-release.bat`. Lock screen / наушники работают, если MediaControl инициализировался; иначе — только in-app playback без краша.
