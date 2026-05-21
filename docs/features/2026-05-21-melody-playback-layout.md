# Melody: playback, compact header, chart scroll

## Зачем

На вкладке **Мелодия**: START был внизу экрана (не виден), график плохо листался внутри вертикального скролла, не было прослушивания записанной последовательности.

## Файлы

- `src/screens/MelodyScreen.tsx` — шапка: нота + START/PLAY; инструмент; `ScrollView` из gesture-handler
- `src/components/MelodyPlayerEngine.tsx` — Web Audio: `playMelody` / `stopMelody`
- `src/utils/melodyPlayback.ts` — длительности из `ts`, quantized vs raw
- `src/components/FrequencyChart.tsx` — `failOffsetY` для pan внутри скролла; `maxHistoryPoints`
- `src/components/MelodyPitchChart.tsx` — 120 точек, высота 176
- `src/components/MelodyAnalysisPanel.tsx`, `SimpleStaffView.tsx` — компактнее
- `src/i18n/strings.ts` — `melodyPlay`, `melodyStopPlayback`, instrument
- `src/utils/playbackAudioMode.ts` — перед PLAY

## Было → стало

| Было | Стало |
|------|-------|
| START внизу под длинным скроллом | START + PLAY в верхней строке рядом с нотой |
| Нет воспроизведения мелодии | PLAY: WebView-синтез (piano / sine), стоп по STOP или повторному PLAY |
| График 80 точек, pan конфликтовал со ScrollView | До 120 точек; pan с `failOffsetY`; GH `ScrollView` |
| Крупные аккорды / стан | Меньшие чипы аккордов; стан max ~180px |

## PLAY

1. Ноты: `quantizedNotes` если **Fit to key**, иначе `registeredEvents`.
2. Длительность: интервал до следующей ноты (200–1500 ms), одна нота — 400 ms.
3. Перед стартом: `applyPlaybackAudioMode()`.
