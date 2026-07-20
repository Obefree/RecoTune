# Микрофон → колонки: эхо и латентность

## Зачем

Жалоба после D23: при выводе в колонку/динамик слышно **эхо** (акoustic feedback); хочется **меньше задержку**.

## Причина эха

В `TunerEngine` mode `monitor` захват mic использовал те же constraints, что и **тюнер**: `echoCancellation: false` — чтобы не портить pitch. Для passthrough в колонку это создаёт петлю «mic → Web Audio → динамик → mic» без AEC.

## Что изменили

| Область | Было | Стало |
|---------|------|--------|
| getUserMedia (только monitor) | AEC/NS/AGC выкл | `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: false`, mono `channelCount` |
| Gain passthrough | 1.0 | `MIC_MONITOR_DEFAULT_GAIN` = **0.55** (`micLiveMonitor.ts`) |
| Audio graph | gain → analyser → (parallel) destination | **Выход:** src → gain → destination; **VU:** src → analyser (analyser не в цепи выхода) |
| Analyser (meter) | fft 2048 | fft **512**, smoothing 0 |
| AudioContext | `latencyHint: 'interactive'` | без изменений (уже минимальный hint) |
| UI | подсказка маршрута | `micMonitorActiveHint` — AEC, наушники, не держать mic у динамика |

Тюнер/melody — constraints без изменений (AEC off).

## Латентность (ожидания)

- Провод / наушники: по-прежнему ~**80–150 ms** (WebView + playAndRecord); убрали лишний узел analyser с выхода — небольшой выигрыш, не IEM.
- Bluetooth: **не ниже ~200 ms** (SCO/A2DP), часто 300–700 ms — ограничение ОС/кодека, не expo-av.

## Файлы

- `src/components/TunerEngine.tsx` — monitor HTML
- `src/utils/micLiveMonitor.ts` — gain, hints
- `src/screens/RecorderScreen.tsx` — active hint

## Совет Alex

1. **Наушники проводные** — минимум эха и задержки.
2. **Колонка/BT** — AEC помогает, но не magic; отодвинь телефон от источника звука, не крути системную громкость на максимум.
3. Dev build (`npx expo run:android`), BT подключить **до** старта монитора.
