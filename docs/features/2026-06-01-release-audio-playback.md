# Release APK: воспроизведение звука

## Зачем

На release (`assembleRelease`, R8/minify) на телефоне не было слышно PLAY в Melody, solo/Play all в Studio, Player/Video — при том что debug мог работать.

## Причины

| | Описание |
|---|----------|
| **Web Audio** | `AudioContext` в hidden WebView на Android release часто в `suspended`; `injectJavaScript` не считается user-gesture — нужен `resume()` после тапа в RN |
| **ProGuard** | Минимальные keep-правила не покрывали `expo.modules.av` / ExoPlayer |
| **Video** | Не вызывался `applyPlaybackAudioMode` перед стартом |

Ранее (2026-05-20): краш MediaControl, `file://` для expo-av, Studio без `applyStudioAudioMode` перед playback — см. [2026-05-20-playback-crash-fix.md](./2026-05-20-playback-crash-fix.md).

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/components/MelodyPlayerEngine.tsx` | `unlockWebAudio`, `resume()` перед schedule; unlock+play в inject; `androidLayerType`, off-screen WebView |
| `app.config.js` | ProGuard keep: `expo.modules.av`, ExoPlayer |
| `src/screens/VideoScreen.tsx` | `applyPlaybackAudioMode` при выборе ролика и ▶ |
| `src/screens/ChordsScreen.tsx` | `ctx.resume()` после создания AudioContext (практика/мик) |
| `docs/BUILD-ANDROID.md` | чеклист smoke audio |

## Было → стало

| | Было | Стало |
|---|------|--------|
| Melody PLAY | `new AudioContext()` без resume | resume + pre-unlock на тап |
| Release minify | keep только Reanimated | + expo-av, ExoPlayer |
| Video | только `shouldPlay` | + playback audio session |

## Проверка на устройстве

```bat
npm run build:android:release
```

Установить `android\app\build\outputs\apk\release\app-release.apk` (или копию из `dist\`).

1. **Melody** — есть ноты → **PLAY** (слышен синтез).
2. **Studio** — дорожка с файлом → solo ▶.
3. **Media → Player** — ▶ записи.
4. **Media → Video** — выбрать видео → ▶.

Первый звук: обязательно тап по кнопке воспроизведения на экране (не автостарт при открытии таба).
