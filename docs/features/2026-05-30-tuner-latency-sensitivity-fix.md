# Tuner: отзывчивость и тихий сигнал (отделение от Melody)

## Зачем

После правок графика Melody (`ChartFreqStabilizer`, `smoothCenterMidi`, общий `TunerEngine`) тюнер стал **дёрганым, с задержкой** и **не реагировал на тихий**, но слышимый звук.

## Причина

| Слой | Проблема |
|------|----------|
| `TunerScreen` | EMA стрелки снижен с ~0.20 до 0.14 (c51cd2f) + сглаживание уже стабилизированного `msg.frequency` вместо `rawFrequency` |
| `TunerEngine` (tuner) | `ring: 9`, `frameMs: 80`, `rmsGate: 0.006` — лишняя задержка и отсечка тихого |
| `pitchChartHistory` | Один набор констант `ChartFreqStabilizer` для Melody; на графике тюнера — `smoothCenterMidi` + медленный chart EMA |
| Melody commits 4c7420f / 203a79c / 26031f4 | Затронули **общий** util и WebView-контракт; тюнер не должен наследовать melody chart path для стрелки |

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/pitchChartHistory.ts` | `MELODY_CHART_STABILIZER` / `TUNER_CHART_STABILIZER`, конструктор `ChartFreqStabilizer(mode)`; `isTunerVoicedFrame` rms 0.0025 |
| `src/screens/TunerScreen.tsx` | EMA стрелки 0.22/0.18; needle на `rawFrequency`; без `smoothCenterMidi` на графике |
| `src/components/TunerEngine.tsx` | Профиль tuner: rms 0.0035, ring 5, frame 55 ms, мягче jump |
| `tools/verify-pitch-chart-history.mjs` | Smoke: gate + tuner быстрее melody stabilizer |

**Не трогали:** `useSungNoteHistory` (melody stabilizer по умолчанию `'melody'`), контур транскрипции.

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Стрелка ¢ | EMA 0.14, вход = WebView median×2 | EMA 0.22, вход = `rawFrequency` + один RN EMA |
| WebView tuner | ring 9, 80 ms, rms 0.006 | ring 5, 55 ms, rms 0.0035 |
| Chart stabilizer | Один профиль | Melody тяжёлый; tuner chart — лёгкий preset (если подключат) |
| График тюнера | `smoothCenterMidi` | Без лишнего сглаживания центра |

## Проверка

1. `node tools/verify-pitch-chart-history.mjs`
2. **Тихий гудок** у микрофона — SIG / стрелка появляются раньше, чем до правки.
3. **Быстрая смена высоты** (bend / соседняя струна) — стрелка догоняет за ~200–400 ms, без «залипания».
4. **Melody** — график по-прежнему плавный (тяжёлый stabilizer + `smoothCenterMidi`).
