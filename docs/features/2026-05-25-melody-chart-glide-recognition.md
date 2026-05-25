# Melody: плавный график и распознавание на глиссандо

## Зачем

При записи в Melody трассировка прыгала по вертикали, последняя точка дёргалась при STOP, а между нотами контур «молчал» — казалось, что распознавание только по дискретным нотам.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/pitchChartHistory.ts` | `ChartFreqStabilizer`, `softenLastChartPoint`, график через `isChartVoicedFrame` |
| `src/hooks/useSungNoteHistory.ts` | стабилизатор, `beginRecording` / `endRecording`, мягче детектор (slope 12 st/s) |
| `src/utils/melodyTranscription.ts` | `isChartVoicedFrame`, `expandVoicedFrames`, мягче RMS/YIN, bridge 130 ms |
| `src/screens/MelodyScreen.tsx` | STOP → `endChartRecording`, START → `beginChartRecording` |
| `src/components/MelodyPitchChart.tsx` | `scrollFollow={active}` — без рывка скролла после STOP |

**Не трогали:** `TunerEngine` (стрелка ¢), needle EMA в `TunerScreen`.

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Точки графика | EMA 0.20 в экране + жёсткий `isVoicedFrame` | Медиана + outlier blend + EMA + cap 42¢/точку; отдельный chart-gate |
| STOP | возможна поздняя точка / скачок playhead | `endRecording`: без новых точек, сглаживание последней |
| Контур | только строго voiced кадры | Короткие провалы ≤130 ms между voiced заполняются |
| Классика | slope 8 st/s | 12 st/s на Melody hook |

## Как проверить

1. Melody → START, медленное глиссандо между двумя нотами (≈2–3 с): линия без вертикальных скачков > ~полутона, сегменты контура появляются (не пустота между нотами).
2. STOP: последняя точка не улетает; скролл не дёргается.
3. Тюнер → стрелка и режим «График» — без регрессии (отдельный gate/EMA).
