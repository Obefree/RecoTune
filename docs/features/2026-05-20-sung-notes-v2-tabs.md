# Спетые ноты v2: Melody + Media tabs

## Зачем

- Точнее и быстрее ловить ноты при «pom-pam-pam» и тихом голосе.
- Лента нот не сбрасывается при STOP / выкл микрофона — только кнопка очистки.
- Отдельная вкладка для напева; Recorder / Player / Video — одна вкладка Media.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/sungNoteDetector.ts` | Адаптивный порог сигнала, `minStableMs` 150, jump 130 ms, `debounceSameMs` / `debounceNewMs` |
| `src/components/SungNoteStrip.tsx` | Кнопка очистки (trash); ноты видны и при выкл mic |
| `src/screens/MelodyScreen.tsx` | Новый экран: mic, pitch, лента нот |
| `src/screens/MediaScreen.tsx` | Сегменты Record \| Play \| Video |
| `App.tsx` | Вкладки: Tuner, Studio, Chords, Melody, Media, AILab |
| `src/screens/TunerScreen.tsx` | Убрана лента спетых нот |
| `src/screens/ChordsScreen.tsx` | Убрана лента; нет сброса истории на mic off |
| `src/i18n/strings.ts` | `tabMelody`, `tabMedia`, `media*`, `sungNotesClear` |
| `src/screens/RecorderScreen.tsx`, `VideoScreen.tsx` | `embedded` — без двойного safe area в Media |

## Было → стало

| | Было | Стало |
|---|------|-------|
| Вкладки | Tuner, Recorder, Studio, Player, Video, Chords, AILab | Tuner, Studio, Chords, **Melody**, **Media**, AILab |
| Лента нот | Тюнер + Chords практика | Вкладка **Melody** |
| STOP / mic off | Очистка ленты | Лента остаётся; очистка — иконка корзины |
| Стабильность ноты | ~200 ms | ~150 ms (`minStableMs`) |
| Скачок >4 полутонов | sustain ~220 ms | ~130 ms |
| Debounce | ~380 ms, только повтор той же ноты | повтор ~280 ms, **новая** нота ~130 ms |
| Порог сигнала | фикс. 0.015 | база 0.012 + адаптив от пика RMS |

## Очистка ленты

Только `SungNoteStrip` → `onClear` → `reset()` в `useSungNoteHistory` на экране **Melody**.
