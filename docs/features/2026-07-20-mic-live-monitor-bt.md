# Микрофон → колонки (live monitor)

## Зачем

Режим «беспроводной микрофон»: голос с телефона сразу слышен в подключённых колонках / BT-наушниках / AUX — для репетиции, вокала в зал, мониторинга без записи.

## Ограничения (честно, D14 / D23)

| Тема | Факт |
|------|------|
| Выход BT/AUX/колонка | expo-av **не** переключает устройство по имени — маршрут задаёт **ОС**. Подключи BT/AUX **до** «Микрофон → колонки». |
| «Трубка» / «Динамик» | Только `playThroughEarpieceAndroid` (верхний vs нижний динамик Android). |
| Задержка | Web Audio passthrough в WebView: провод ~80–150 ms, BT часто **200–700 ms** (SCO/A2DP), не in-ear monitor. |
| Источник микрофона | Захват **WebView** (обычно встроенный mic телефона). BT-mic через `setPreferredDevice` — в **записи** Studio/Recorder (expo-av), не в мониторе (один mic на процесс). |
| Expo Go | SDK 55+ без ExponentAV — вкладка Media с expo-av недоступна; **dev/release build** (`npx expo run:android`). |

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/micLiveMonitor.ts` | `applyMicMonitorAudioMode` (playAndRecord через `recordingAudioMode`), подсказки, константы латентности |
| `src/components/TunerEngine.tsx` | режим `monitor`: mic → gain → destination + VU meter |
| `src/screens/RecorderScreen.tsx` | компактная кнопка «Микрофон → колонки», общие настройки маршрута из quality modal |

## Было → стало

| Было | Стало |
|------|--------|
| Нет live passthrough | Media → Recorder: toggle монитора, одна audio-сессия expo-av + WebView passthrough |
| — | Запись и монитор взаимоисключающие; при уходе с экрана монитор стоп |

## Как пользоваться (Alex)

1. Подключить BT-колонку или AUX, в настройках качества (шестерёнка) при необходимости выбрать выход «Система» / «Bluetooth» (пресет задержки не влияет на монитор).
2. **Микрофон → колонки** → говорить; уровень — полоска под кнопкой.
3. Для минимальной задержки: проводные наушники/колонка, dev build, без параллельной записи.
