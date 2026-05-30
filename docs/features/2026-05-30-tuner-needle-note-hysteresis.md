# Tuner: плавная стрелка без «убегания» ноты

## Зачем

После cd0574a тюнер оставался **дёрганым** (ступеньки ¢ каждый кадр) и **нота/стрелка убегали вперёд** при скачке высоты — отдельный EMA по частоте и по центам + имя ноты от сглаженной Hz.

## Причина «убегания»

| Слой | Проблема |
|------|----------|
| `TunerScreen` | Два EMA: `freq` и `cents` расходятся; `frequencyToNote(smoothedHz)` меняет букву раньше, чем ¢ догоняют сырой pitch |
| Центы | `Math.round` на каждом кадре → ступеньки; spring стрелки гонит к уже устаревшей цели |
| График тюнера | Лёгкий `CHART_EMA` вместо `TUNER_CHART_STABILIZER` — не главный баг, но путь не был отделён явно |
| Melody | `ChartFreqStabilizer('melody')` + `smoothCenterMidi` — **не трогали** |

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/tunerDisplay.ts` | **Новый:** гистерезис ноты на raw Hz, ¢ относительно locked MIDI, rate-limited lerp без overshoot |
| `src/screens/TunerScreen.tsx` | `TunerPitchDisplay` + `ChartFreqStabilizer('tuner')`; стрелка на `displayCents` |
| `src/components/TunerEngine.tsx` | Профиль tuner: ring 3, быстрее принять реальный скачок (blend 0.72) |
| `src/components/TunerNeedle.tsx` | Чуть отзывчивее spring под дробные ¢ |
| `tools/verify-tuner-display.mjs` | Smoke: гистерезис + нет run-ahead |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Имя ноты | `round(midi(EMA(raw)))` | Locked note + 2 кадра подтверждения, порог 38¢ к соседу |
| Стрелка ¢ | EMA + round | Target от raw к locked note; max 280¢/s; дробный `displayCents` |
| Hz на экране | Тот же EMA что и нота | Отдельный лёгкий EMA только для числа Hz |
| График тюнера | `CHART_EMA_ALPHA` 0.16 | `ChartFreqStabilizer('tuner')` на raw |
| Melody | — | Без изменений |

## Проверка

1. `node tools/verify-tuner-display.mjs`
2. `node tools/verify-pitch-chart-history.mjs`
3. **Тюнер / гитара:** тихий гудок — SIG и стрелка; плавное движение без скачков по 1¢ на кадр.
4. **Соседняя струна / скачок:** буква не перескакивает на полтона раньше звука; стрелка не уходит дальше реальной высоты.
5. **Melody:** график по-прежнему плавный (тяжёлый stabilizer).
