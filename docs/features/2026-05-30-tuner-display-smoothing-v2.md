# Tuner: плавная стрелка, стабильная нота, график v2

## Зачем

После Choona-pipeline (raw Hz → `TunerPitchDisplay`) стрелка, цифры Hz и имя ноты всё ещё дёргались кадр-в-кадр — тюнер непригоден для настройки основного тона.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/tunerDisplay.ts` | Жёстче гистерезис ноты, outlier hold, медленнее ¢/Hz, EMA для chart midi |
| `src/screens/TunerScreen.tsx` | UI throttle 100 ms; график на `chartDisplayMidi` |
| `src/components/TunerNeedle.tsx` | Мягче spring (меньше дёрганье поверх сглаженных ¢) |
| `tools/verify-tuner-display.mjs` | Параметры и тест outlier |

Melody / `ChartFreqStabilizer` / WebView `melody` profile — без изменений.

## Было → стало

| Параметр | Было | Стало |
|----------|------|--------|
| Подтверждение ноты | 2 кадра, offset 38¢ | 5 кадров в ±25¢ от центра + ≥80 ms |
| Скорость стрелки | 400 ¢/s | 140 ¢/s |
| Hz EMA | α 0.42 | α 0.28, округление 0.1 Hz |
| Outlier | нет | скачок >200¢ → держим target 2 кадра |
| UI refresh | каждый pitch (~18 Hz) | 100 ms (~10 Hz) needle/note/Hz |
| График midi | `locked + displayCents` | + EMA α 0.25 (`chartDisplayMidi`) |
| Needle spring | damping 20, stiffness 92 | 28 / 68 |

## Ожидание на устройстве

- Стрелка плывёт к цели, без «бешеных» скачков на шуме.
- Буква ноты меняется только после устойчивого тона (≈0.3–0.5 с на соседнюю ноту).
- Hz и ¢ обновляются ~10 раз/с, читаемо.
- Линия графика чуть сглажена, без тройного стека фильтров.
