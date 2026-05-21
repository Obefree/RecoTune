# Melody PLAY: ритм по спетому темпу

## Зачем

PLAY звучал «не в темп» — ноты растягивались/сжимались из‑за жёсткого clamp 250–1200 ms, BPM snap к 1/16 и равномерного gap 50 ms. Аккорды делились по количеству нот, а не по времени/фразам.

## Файлы

- `src/utils/melodyPlayback.ts` — anchor timeline, длительности из inter-onset gaps, merge дублей, quantizeRhythm OFF по умолчанию
- `src/utils/melodyChords.ts` — сегменты по паузам (>1.5× median) и равным time windows
- `src/utils/melodyAnalysis.ts` — `interOnsetGapsMs`, `medianInterOnsetMs`
- `src/components/MelodyPlayerEngine.tsx` — снят clamp 250–1200 ms в Web Audio
- `src/screens/MelodyScreen.tsx` — hint, toggle «Квантовать ритм»
- `src/i18n/strings.ts` — новые строки

## Было → стало

| Аспект | Было | Стало |
|--------|------|-------|
| Старт ноты | ts − t0 (OK) | без изменений |
| Длительность | gap − 50 ms, clamp 250–1200 ms | gap − 35 ms articulation, без жёсткого clamp |
| BPM | snap к 1/16 всегда | только при toggle «Квантовать ритм» |
| Быстрые ноты | минимум 250 ms | минимум 80 ms для повтора той же высоты |
| Дубли детектора | нет | merge если gap < 50 ms |
| Паузы | искажались clamp/snap | сохраняются (реальные ts) |
| Аккорды | равные окна по числу нот | фразы по паузам + time windows |
| WebView engine | min 250 ms / max 1200 ms | min 40 ms / max 4000 ms |

## Алгоритм (кратко)

1. `startMs[i] = event[i].ts - event[0].ts`
2. `durationMs[i] = event[i+1].ts - event[i].ts - 35` (последняя: median×1.5, max 400 ms)
3. Опционально BPM grid — только если пользователь включил «Квантовать ритм»
