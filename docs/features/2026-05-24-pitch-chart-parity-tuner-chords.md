# Pitch-графики: единые фиксы Melody → Tuner / Chords

**Дата:** 2026-05-24

## Зачем

После серии фиксов Melody (`cae90e3`, `453e529`, `55a9fc4`) график высоты там стабилен: playhead, ось времени, voiced-only точки, throttle 100 ms. Тюнер (режим «График») и Chords / Практика («Голос») использовали старую логику — разгон по X, лишние точки между нотами.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/pitchChartHistory.ts` | **новый** — `appendVoicedChartPoint`, общий throttle + voiced gate |
| `src/hooks/useSungNoteHistory.ts` | делегирует в `appendVoicedChartPoint` |
| `src/screens/TunerScreen.tsx` | график: `timeAxis`, `defaultHZoom={2}`, voiced throttle; **стрелка/EMA без изменений** |
| `src/screens/ChordsScreen.tsx` | практика: EMA 0.20, voiced throttle, `maxHistoryPoints={120}`, сегменты контура |
| `src/components/FrequencyChart.tsx` | `segmentOverlays`, `xOfTime` (Chords contour blocks) |

## Было → стало

| Экран | Было | Стало |
|-------|------|--------|
| **Tuner → График** | каждый pitch-кадр (~12 Hz), index-based X | voiced + 100 ms, `timeAxis`, playhead как Melody |
| **Chords → Голос** | EMA 0.28, каждый update, 80 точек | EMA 0.20, voiced + 100 ms, 120 точек, `timeAxis` |
| **Melody** | уже ок | общий helper, без смены поведения |

**Не трогали:** логику YIN/EMA **стрелки** тюнера, `SungNoteDetector`, профиль `TunerEngine` для needle.

## Проверка

1. **Тюнер** → START → переключить «График» → играть ноту 20+ с: линия у playhead (~58%), без разгона вправо; стрелка ¢ как раньше.
2. **Chords → Практика** → Mic → панель «Голос»: плавная линия, фиолетовые блоки сегментов, playhead стабилен.
3. **Melody** → регрессии нет: график и распознавание как до правки.
