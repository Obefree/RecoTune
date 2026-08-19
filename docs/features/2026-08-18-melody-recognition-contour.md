# Melody: распознавание контура (не PLAY)

## Зачем

Жалоба: распознавание мелодии плохое — не тот темп/такт, не все ноты, количество «примерно». Это ломалось **до** PLAY.

## Корень

1. Время кадра ставилось в RN (`performance.now()`), а WebView шлёт пачками → несколько высот с одним timestamp → сегменты сливаются, темп/такт вранье.
2. START не чистил кольцо кадров → второй напев дописывался к первому.
3. Медиана на 3 кадрах **до** разреза съедала 1–2-кадровые ноты гаммы.
4. Hop 55 мс + FFT 4096 (~85 мс) размазывали быстрые ноты; YIN на напеве часто брал октаву вверх (H2).

## Было → стало

| Было | Стало |
|------|--------|
| `t` = момент приёма в RN | `t` = `audioContext.currentTime` в движке |
| START оставлял старые кадры | START чистит кольцо |
| 3-кадровая медиана всегда | скачок ≥ 0.72 полутона не сглаживается |
| melody hop 55 / FFT 4096 | hop **32** / FFT **2048** |
| H2 как фундаментал | если f>520 и YIN на 2τ ок — берём октаву вниз |
| STOP только глушил mic | STOP сразу транскрибирует в контур |

## Файлы

- `src/components/TunerEngine.tsx`
- `src/hooks/useSungNoteHistory.ts`
- `src/screens/MelodyScreen.tsx`
- `src/utils/melodyTranscription.ts`, `src/utils/pitchFrame.ts`
- `tools/verify-melody-transcription.mjs`

`npm run verify-melody-transcription`
