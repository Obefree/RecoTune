# Melody: повторы одной ноты (акцент, PLAY, лента)

## Зачем

При пении одной высоты подряд с акцентом (E4·E4·E4) вторая и следующие атаки не всегда попадали в последовательность и PLAY: слишком длинный debounce на ту же ноту, слияние близких onset без учёта высоты, `armedMidi` блокировал re-attack без паузы.

## Файлы

- `src/utils/sungNoteDetector.ts` — `repeatGapMs`, accent RMS, `SUNG_NOTE_DETECTOR_DEFAULTS`
- `src/utils/melodyPlayback.ts` — merge только same-pitch jitter < 80 ms
- `src/screens/MelodyScreen.tsx` — лента из `registeredEvents` (каждый onset отдельно)

## Было → стало

| Аспект | Было | Стало |
|--------|------|-------|
| Повтор той же высоты | `debounceSameMs` 280 ms | `repeatGapMs` 200 ms после commit; новая нота — `debounceNewMs` 130 ms |
| Акцент re-attack | всегда `minStableMs` 120 ms | RMS > 1.4× rolling avg → `accentMinStableMs` 80 ms, сброс `armedMidi` |
| Merge в PLAY | любой gap < 50 ms | только **та же** MIDI и gap < 80 ms (jitter) |
| PLAY / стан | мог схлопывать близкие onset | каждый зарегистрированный onset — отдельная нота в PLAY |
| Лента | `sungNotes` | `registeredEvents` — E4 · E4 · E4 без схлопывания |

## Константы (`SUNG_NOTE_DETECTOR_DEFAULTS`)

- `repeatGapMs: 200` — минимум между повторами одной высоты
- `debounceNewMs: 130` — между разными нотами
- `accentMinStableMs: 80`, `accentSpikeRatio: 1.4` — быстрый onset при акценте
- `signalAvgRise: 0.94` — EMA для rolling RMS
