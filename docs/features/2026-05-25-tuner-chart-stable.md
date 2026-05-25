# Tuner: стабильный график нот (без скачков)

**Дата:** 2026-05-25

## Зачем

После parity с Melody (`5b7d288`, `timeAxis`, playhead, voiced 100 ms) режим **«График»** в тюнере дёргался по X/Y: при обрезке буфера пересчитывался `t0` первой точки, трассу «уводило»; центр оси нот и Melody-gate отсекали часть кадров. **Стрелка ¢** должна остаться на прежнем EMA.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/components/FrequencyChart.tsx` | `layoutOriginTs`, `smoothCenterMidi`, `scrollFollow`; ось X от старта сессии |
| `src/utils/pitchChartHistory.ts` | `voicedGate: 'tuner'`, `isTunerVoicedFrame` |
| `src/screens/TunerScreen.tsx` | отдельный EMA графика, `chartSessionT0`, `defaultHZoom={1}` |

## Было → стало

| Было | Стало |
|------|--------|
| `t0 = pts[0].ts` — сдвиг всей кривой при slice | `layoutOriginTs` с START — абсолютные X стабильны |
| Точки графика = EMA стрелки, Melody `isVoicedFrame` | График: EMA 0.10 + мягкий tuner gate |
| `defaultHZoom={2}` как Melody | `defaultHZoom={1}` для тюнера |
| Центр Y = мгновенная медиана | `smoothCenterMidi` (EMA 0.1) в режиме нот |
| Стрелка / ¢ | **без изменений** (`emaAlphaFreq` / `emaAlphaCents`) |

Нижний ряд струн — в [2026-05-25-tuner-strings-row-restore.md](./2026-05-25-tuner-strings-row-restore.md).

## Проверка

1. **Тюнер** → START → **График** → держать **5-ю струну A** ~20 с: линия у playhead (~58%), без горизонтальных рывков и «убегания» вверх/вниз.
2. Переключить **¢ / ноты** — оба режима плавные.
3. **Стрелка**: та же струна, ¢ совпадают с ожиданием (± несколько центов).
4. Внизу экрана — ряд струн E…e с подсветкой ближайшей.
