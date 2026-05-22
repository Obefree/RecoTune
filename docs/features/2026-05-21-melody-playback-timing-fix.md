# Melody PLAY: длительности и монотонные ts

## Зачем

PLAY ощущался «не как напели»: одна нота слишком короткая (~400 ms), последняя обрезалась (cap 400 ms), inter-onset gaps могли схлопываться из‑за одинаковых `Date.now()`, минимум 80 ms на все ноты.

## Файлы

- `src/utils/melodyPlayback.ts` — формулы длительности, `sungTailMsAfterOnset`, pitch history
- `src/utils/sungNoteDetector.ts` — `performance.now()` при commit
- `src/hooks/useSungNoteHistory.ts` — монотонный ts на каждый feed
- `src/components/MelodyPlayerEngine.tsx` — legato 0.92 (piano), тише аккорды, мелодия поверх
- `src/screens/MelodyScreen.tsx` — pitch history в payload, hint для одной ноты
- `src/i18n/strings.ts` — `melodyPlaySingleNoteHint`

## Было → стало

| Аспект | Было | Стало |
|--------|------|-------|
| Одна нота | 400 ms | max(800, medianGap или 1200) |
| Между нотами | gap − 35 ms, min 40 ms | gap − 25 ms, без floor (кроме повтора высоты) |
| Повтор той же высоты | min 80 ms | min 120 ms |
| Последняя нота | median×1.5, max 400 ms | max(median×1.8, 600, min(tail, 1500)) |
| Хвост последней | нет | pitch history после onset |
| ts событий | `Date.now()` / batch | `performance.now()` на feed + commit |
| BPM snap | bpm всегда в options | только при toggle «Квантовать ритм» |
| Piano | release в конце duration | release на 92% duration (legato) |
| Аккорды | gain 0.24, до мелодии | gain 0.12, после мелодии |
