# Melody: качество PLAY и надёжность детекции

**Дата:** 2026-05-21  
**Зачем:** PLAY звучал «криво» (ритм, длительности, аккорды), детектор периодически пропускал ноты.

## Файлы

- `src/utils/melodyPlayback.ts` — длительности из inter-onset gaps, gap 50 ms, BPM snap, `pitchSource`
- `src/components/MelodyPlayerEngine.tsx` — ADSR пиано, абсолютный `startMs`, тише аккорды
- `src/utils/sungNoteDetector.ts` — пороги, `SUNG_NOTE_DETECTOR_DEFAULTS`
- `src/screens/MelodyScreen.tsx` — источник PLAY (raw/quantized), предупреждения, превью «как спели»
- `src/i18n/strings.ts` — строки UI

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Длительности | clamp 200–1500 ms, без gap | gap 50 ms между нотами, 250–1200 ms, последняя длиннее (×1.6 + 450 ms) |
| Старты | относительно t₀ | anchor + абсолютный `startMs` от первой ноты = 0, без cumulative drift |
| BPM | не использовался | `bpmApprox` → hold последней ноты + snap к 1/16 доле |
| Квантизация PLAY | если `fitToKey` и есть quantized | только если counts совпадают, иначе raw + warning |
| Пиано | attack+release | ADSR (attack/decay/sustain/release), A4=440, triangle+f harmonics |
| Аккорды | громко (gain ~0.38), min 200 ms | тише (gain 0.24), до границы следующего сегмента |
| Детектор | minSignal 0.012, stable 150 ms | 0.010 / 120 ms, adaptive ratio 0.28, floor 0.007 |
| UI | одна строка quantized | dual preview + подпись PLAY + warning при <3 нот |

## Константы детектора (`SUNG_NOTE_DETECTOR_DEFAULTS`)

- `minSignal` 0.01, `minStableMs` 120
- `debounceSameMs` 280, `debounceNewMs` 130
- `adaptivePeakRatio` 0.28, `adaptiveFloor` 0.007

## Как проверить

1. Melody → START → напой 5–8 нот с паузами → PLAY: ритм близок к пению, ноты не «слипаются».
2. Включить «В тональность» — PLAY по квантизованным pitch; под блоком видно «КАК СПЕЛИ».
3. Выключить fit-to-key — PLAY по сырой записи, подпись «PLAY: как спели».
4. Мало нот (<3) — жёлтое предупреждение.
5. `npx tsc --noEmit` — без ошибок.
