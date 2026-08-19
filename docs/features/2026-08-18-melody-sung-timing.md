# Melody: PLAY и распознавание по реально спетым onset/duration

## Зачем

Распознавание мелодии и PLAY были «примерно»: не тот темп, не тот такт, не все ноты, количество нот меньше, чем спето.

## Корень

- PLAY с контура растягивал каждую ноту до **200 мс** (`CONTOUR_MIN_DURATION_MS`) — восьмые и паузы ломались, такты визуально ровные.
- Кольцо кадров **220 × 55 мс ≈ 12 с** обрезало начало фразы.
- Скачки высоты ждали 2 кадра; короткие ноты (<150 мс, 2 кадра) поглощались.
- BPM считался как `60000 / median IOI` — восьмые давали ~240 вместо ~120.

## Было → стало

| Было | Стало |
|------|--------|
| Пол 200 мс на PLAY | Длительность = спетый `end − start`, без растяжения |
| Стан с равными слотами | X нот по onset (длинный промежуток → шире такт) |
| ~12 с кадров | ~50 с (900 кадров) |
| 2 кадра на любой скачок | Скачок ≥ 1.5 полутона — сразу |
| BPM = сырой IOI | Складка в диапазон ~52–184 (восьмые → доля) |

## Файлы

- `src/utils/melodyTranscription.ts`, `src/utils/pitchFrame.ts`
- `src/utils/melodyPlayback.ts`, `src/utils/melodyAnalysis.ts`
- `src/components/DualStaffView.tsx`
- `tools/verify-melody-transcription.mjs`, `tools/verify-melody-playback.mjs`

`npm run verify-melody-transcription` · `npm run verify-melody-playback`
