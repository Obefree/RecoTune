# Фоновое воспроизведение и кнопки наушников

## Зачем

Плеер и прослушивание записей должны продолжаться при свёрнутом приложении; кнопки наушников / lock screen — play/pause, следующий/предыдущий трек или ±10 с.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/playbackAudioMode.ts` | Единый `staysActiveInBackground` + режим сессии для воспроизведения |
| `src/utils/mediaRemoteControls.ts` | `react-native-music-control`: lock screen, headset, регистрация обработчиков |
| `src/hooks/useMediaRemoteControls.ts` | Хук для экранов |
| `src/screens/PlayerScreen.tsx` | Фон + очередь (next/prev) |
| `src/screens/RecorderScreen.tsx` | Фон + список записей (next/prev), ±10 с на lock skip |
| `src/screens/StudioScreen.tsx` | Solo (дорожки) и Play all (pause, ±10 с, scrub) |
| `App.tsx` | `initMediaRemoteControls()` при старте |
| `app.json` | `UIBackgroundModes: audio`, Android FGS permissions |
| `package.json` | `react-native-music-control` |

## Было → стало

| | Было | Стало |
|---|------|--------|
| Фон | Только Player выставлял `staysActiveInBackground` | Все playback-пути через `applyPlaybackAudioMode()` |
| iOS plist | Без `UIBackgroundModes` | `audio` в `infoPlist` |
| Lock screen / BT | Нет | MusicControl + метаданные трека |
| Player next/prev | Только в UI | + headset / notification |
| Recorder | Без фона и remote | Соседние записи next/prev, ±10 с |
| Studio | Без remote | Solo: дорожки next/prev; Play all: pause, ±10 с |

## Сборка

| Среда | Фон (`staysActiveInBackground`) | Lock screen / наушники |
|-------|----------------------------------|-------------------------|
| **Expo Go** | Да, где поддерживает `expo-av` | Нет — модуль не подключается |
| **Dev build** (`npx expo run:ios` / `run:android`) | Да | Да, через `react-native-music-control` |

В Expo Go приложение не падает: `mediaRemoteControls.ts` пропускает нативный модуль (`ExecutionEnvironment.StoreClient`). Полные remote controls — только после `expo run:*`.

После смены `app.json` — пересобрать нативный проект.

## Ограничения

- При уходе с вкладки Player/Recorder звук по-прежнему останавливается (`useFocusEffect` → `killSound`) — фон работает при **свёрнутом** приложении, пока вкладка была активна.
- Studio Play all: нет next/prev по дорожкам, только ±10 с и pause.
- Два одновременных плеера (Player + Studio) — активен последний зарегистрированный remote owner.
