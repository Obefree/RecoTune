# SeekBar scrub v2 и плавный трекер голоса

**Дата:** 2026-05-29  
**Зачем:** видео-ползунок иногда прыгал в начало при удержании/drag; график голоса в Melody всё ещё дёргался после правок 2026-05-25.

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/components/SeekBar.tsx` | refs для duration/callbacks (устранён stale closure PanResponder), `pageX` + `measureInWindow`, lock thumb до sync с position |
| `src/screens/VideoScreen.tsx` | cooldown 300 ms на `onPlaybackStatusUpdate` после scrub |
| `src/components/MelodyPitchChart.tsx` | `smoothCenterMidi` — ось Y не прыгает на каждой точке |
| `src/screens/MelodyScreen.tsx` | `chartFrequency: stable` (WebView) → график, raw остаётся для контура |
| `src/utils/pitchChartHistory.ts` | stabilizer: не сбрасывать кольцо на dropout, мягче EMA/step |
| `src/components/FrequencyChart.tsx` | `CENTER_MIDI_EMA` 0.07 для плавнее центра |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| SeekBar PanResponder | Замыкание на `duration=0` первого рендера → thumb в 0 | Актуальный `durationRef` на каждый жест |
| SeekBar координаты | `locationX` на grant, width без window offset | `pageX − measureInWindow.left`, remeasure на grant |
| SeekBar release | `localPos=null` сразу → отскок к stale position | Thumb держится до совпадения с position ±0.2 с |
| Video status | position сразу после scrub | Игнор status 300 ms после release |
| Melody график | raw → stabilizer; ось Y = median без EMA | stable → stabilizer; `smoothCenterMidi` как в Tuner |
| ChartFreqStabilizer | `reset()` на unvoiced кадр | Держит последний display, ring не обнуляется |

## Проверка

1. **Media → Видео:** воспроизвести файл, удерживать thumb и тянуть по всей длине — без прыжков в 0 и без отскока при отпускании.
2. **Melody:** START, петь/играть одну ноту 2–3 с — линия графика плавная, playhead не «прыгает» по вертикали.
3. **Melody:** медленная гамма — контур (если включён) по-прежнему видит raw onset; метки нот стабильнее.
4. **Player / Studio:** scrub без регрессии (общий SeekBar).
