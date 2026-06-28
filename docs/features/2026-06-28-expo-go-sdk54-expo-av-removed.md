# Expo Go SDK 54 больше не запускает RecoTune (expo-av удалён из Expo Go)

Дата: 2026-06-28

## Симптом

Через десктопный `RecoTune.bat` (Expo Go): QR показывается, Metro работает, бандл
скачивается, дальше **долгая загрузка** и **синий/красный экран ошибки** на телефоне.
Бандл (`expo export`) и `tsc` при этом чистые — это **рантайм-краш при старте**, не бандлинг и не сеть.

## Причина (root cause)

В **Expo SDK 54 Expo удалил `expo-av` из приложения Expo Go**.
Подтверждение: страница v54-доков `expo-av` помечена `Android, iOS, tvOS, Web`
**без** бейджа «Included in Expo Go» (у `expo-audio`/`expo-video` бейдж есть);
официальный changelog: «`expo-av` ... will be removed in SDK 55 ... last SDK release
where it will be a part of the SDK».

RecoTune использует `expo-av` в ядре аудио (13 файлов): Tuner, Studio, Media,
Recorder, Video, маршрутизация записи. `expo-av/build/ExponentAV.js` на верхнем уровне
делает `requireNativeModule('ExponentAV')`, который **бросает синхронно**, если нативного
модуля нет. `App.tsx` статически импортирует `TunerScreen` (первый таб → `import { Audio } from 'expo-av'`),
поэтому исключение летит ещё при выполнении графа модулей — сразу после загрузки бандла:

```
Invariant Violation: Your JavaScript code tried to access a native module that doesn't exist.
(native module 'ExponentAV' doesn't exist)
```

Это **отдельная** причина от фикса 2026-06-27 (`expo-font` 55 → 14.x): тот убрал
краш на шрифтах, но `expo-av` в Expo Go SDK 54 остаётся непреодолимым блокером.

## Что это значит

В Expo Go на SDK 54 RecoTune **не загрузится в принципе** — падает до первого кадра.
Чинится не батником. Реальных путей два.

## Решение

### A. Рекомендуется — dev build вместо Expo Go (та же live-JS итерация)

Debug-сборка RecoTune содержит нативный `expo-av` и так же тянет JS из Metro по LAN —
тот же «один клик», но со всеми нативными модулями (и `react-native-music-control`).

1. Один раз: `build-apk.bat` → `android\app\build\outputs\apk\debug\app-debug.apk`
2. Поставить `app-debug.apk` на телефон.
3. Запускать `RecoTune.bat` (Metro), открыть RecoTune на телефоне (та же Wi-Fi) —
   dev build цепляется к Metro на 8081 автоматически.

### B. Альтернатива — миграция `expo-av` → `expo-audio` + `expo-video`

`expo-audio`/`expo-video` **есть** в Expo Go SDK 54. После миграции Expo Go снова работает.
Объём большой (запись с метрингом для тюнера, мультитрек Studio, Video-компонент) и
требует проверки на устройстве — поэтому в этой правке не делалось.

## Изменения

| Было → стало | Файл |
|---|---|
| Батник запускал `expo start --offline -c --port 8088` под Expo Go; маркеры chord-v3; обещал «открыть в Expo Go» | `RecoTune.bat` (репо) и `Desktop\RecoTune.bat` |
| Стало: честно про SDK 54 + Expo Go, инструкция на dev build, `npx expo start -c` на дефолтном порту 8081, чистка stale-порта, подсказка про `--offline` для VPN | там же |

Код приложения не менялся (миграция `expo-av` — отдельной задачей по варианту B).
