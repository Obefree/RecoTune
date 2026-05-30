# Tuner: фиксированное окно графика и упрощение пайплайна

**Дата:** 2026-05-30

## Зачем

После `eaaf99f` график тюнера **дёргался** и **уезжал вправо** за экран; частота/стрелка казались «ступенчатыми» из‑за лишних слоёв сглаживания. Melody не трогаем.

## Корневые причины

| Проблема | Причина |
|----------|---------|
| Уход графика вправо | `timeAxis` + `layoutOriginTs` = момент START → X = `(now − start) × px/ms` растёт без предела; scroll cap не успевает |
| Дёрганье трассировки | `ChartFreqStabilizer('tuner')` поверх WebView median + отдельный `TunerPitchDisplay` для стрелки |
| Расхождение ¢ / ноты на графике | Точки строились от `chartFreq` stabilizer, а стрелка — от `displayCents` locked note |

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/components/FrequencyChart.tsx` | `rollingTimeWindowMs`: origin = `lastTs − window`, фиксированная ширина canvas |
| `src/utils/pitchChartHistory.ts` | `TUNER_CHART_WINDOW_MS`, опциональный `chartMidi` |
| `src/screens/TunerScreen.tsx` | убран `ChartFreqStabilizer` и `chartSessionT0`; график: raw Hz + `chartMidi` от display |
| `src/utils/tunerDisplay.ts` | быстрее rate-limit ¢ (400¢/s), Hz EMA 0.42 |
| `src/components/TunerNeedle.tsx` | чуть отзывчивее spring |
| `tools/verify-tuner-chart-window.mjs` | smoke: X не растёт за окно |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Ось X тюнера | От START сессии, без верхней границы | Скользящее окно 12 с (`TUNER_CHART_WINDOW_MS`) |
| График Hz | `ChartFreqStabilizer('tuner')` | Raw + `chartMidi` из `TunerPitchDisplay` |
| Стрелка / Hz / нота | `TunerPitchDisplay` | Без изменений пути (один слой) |
| Melody | `layoutOriginTs` + heavy stabilizer | **Без изменений** |
| ¢ в шапке | `note.cents` (round) | `displayCents` (round только в UI) |

## Проверка

1. `npm run verify-tuner-display` && `npm run verify-pitch-chart` && `npm run verify-tuner-chart`
2. **Тюнер → График**, гудок 30+ с: линия у playhead, не уезжает вправо.
3. **Стрелка**: плавное движение, тихий сигнал ловится.
4. **Melody**: запись 20 с — график как раньше.
