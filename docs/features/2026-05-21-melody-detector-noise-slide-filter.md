# Melody: anti-noise / anti-slide фильтры детектора

**Дата:** 2026-05-21  
**Зачем:** Точные ноты при пении, но без ложных срабатываний на дыхание, шум и портаменто между высотами («вычистить адекватно но точно»).

## Файлы

- `src/utils/sungNoteDetector.ts` — фильтры v2.1, константы с комментариями
- `src/screens/MelodyScreen.tsx` — подсказка пользователю
- `src/i18n/strings.ts` — `melodySingDetectionHint` RU/EN

## Фильтры (что делают)

| # | Фильтр | Суть |
|---|--------|------|
| 1 | **Cents stability gate** | Перед commit: spread ≤ **22¢** (strict). `vibratoMode` OFF по умолчанию; ON → до 38¢ |
| 2 | **Midi slope limit** | \|Δmidi\| > **8 st/s** за 80 ms → сброс кандидата («in slide»), commit только на ровной высоте |
| 3 | **Attack after silence** | После тишины ≥100 ms: первый onset — **атака RMS** или **140 ms** стабильно с низким spread |
| 4 | **Min voiced duration** | Накопленно ≥**100 ms** voiced, не 2 кадра; fast-path: атака + spread ≤ commit gate |
| 5 | **Breath / noise** | При сильном сигнале, но spread >**40¢** за 60 ms — кадр игнорируется (дыхание/шипение при «хорошем» YIN) |
| 6 | **Armed lock** | После commit тот же midi заблокирован, пока signal < **0.5×** порога **или** **80 ms** ниже порога — хвост слива не = новая нота |
| 7 | **Repeat same note** | `repeatGapMs` 150 ms + **re-attack** (RMS spike / accent) **или** mini-silence **40 ms** — «та-та» да, удержание нет |
| 8 | **Константы** | `SUNG_NOTE_DETECTOR_DEFAULTS` — комментарии noise / slide / note |

## Было → стало

| Аспект | v2 | v2.1 |
|--------|-----|------|
| Commit spread | до 28¢ tracking | commit ≤ **22¢** strict |
| Портаменто | частично jump sustain | slope **8 st/s** + armed lock |
| Дыхание | только YIN | YIN + **хаос cents** 60 ms |
| Повтор ноты | repeatGap + accent | + mini-silence **40 ms** |
| После паузы | сразу stability path | attack **или** 140 ms flat |
| UI | — | «Чёткие атаки; без слива между нотами» |

## Как петь для лучшего результата

1. **Чёткая атака** на каждую ноту (стаккато, «та») — срабатывает attack fast-path и повторы.
2. **Не сливайте** соседние высоты портаменто — между нотами короткая пауза или скачок атаки.
3. **Короткая тишина** (≥100 ms) перед фразой помогает отсечь дыхание и хвосты.
4. Для **та-та** на одной высоте — лёгкий провал громкости (~40 ms) или акцент.
5. Длинные ноты — держите **ровный тон** ≥120 ms, spread в пределах ~20¢.
6. В dev: chip **SLD** = slide (pitch ещё ползёт), **ARM** = lock после ноты.

## Константы (ключевые)

- `maxCentsSpreadCommit: 22`, `maxCentsVariance: 28` (tracking)
- `midiSlopeMaxSemitonesPerSec: 8`, `midiSlopeWindowMs: 80`
- `silenceBeforeNewNoteMs: 100`, `newNoteStableAfterSilenceMs: 140`
- `minVoicedDurationMs: 100`, `noiseCentsSpreadReject: 40`
- `armedReleaseSignalRatio: 0.5`, `armedReleaseLowMs: 80`
- `repeatMiniSilenceMs: 40`

## Проверка

1. Melody → START → гамма стаккато — нет лишних нот на сливах.
2. «Та-та» одна высота — две ноты в ленте; удержание — одна.
3. `npx tsc --noEmit` — без ошибок.
