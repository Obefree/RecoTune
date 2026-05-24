# Melody: нота «убегает» вперёд по графику

**Дата:** 2026-05-24

## Зачем

После [2026-05-24-melody-chart-chords-ux.md](./2026-05-24-melody-chart-chords-ux.md) (`cae90e3`) текущая нота на графике Melody стабильно оказывалась **правее playhead** — «мчится вперёд», хуже чем неделю назад.

## Причина

| Фактор | Эффект |
|--------|--------|
| `SCROLL_FOLLOW_MAX_STEP = 9` | Скролл догонял хвост максимум на 9 px за обновление |
| Новая точка каждые 100 ms | `lastEndX` +≥14 px (`MIN_CELL_W` при clustered layout) |
| Итог | `lastEndX - hScroll` рос быстрее якоря → точка визуально уезжала вправо |
| `DISPLAY_EMA 0.07` + `CHART_MIDI_EMA` | Двойное сглаживание по высоте (не главная причина «вперёд», но лишняя задержка) |

Playhead-якорь и voiced-only throttle сами по себе ок; ломал именно **отставание скролла от прироста X**.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/components/FrequencyChart.tsx` | Мгновенный follow scroll (без cap); playhead 58%; центр Y без EMA |
| `src/screens/MelodyScreen.tsx` | `DISPLAY_EMA` 0.20 (как в pitch-graph fix 2026-05-22) |
| `src/hooks/useSungNoteHistory.ts` | Оставлены voiced gate + 100 ms throttle; убран второй MIDI EMA |

## Было → стало

| Было (`cae90e3`) | Стало |
|------------------|--------|
| Скролл ≤9 px/кадр | Сразу `lastEndX - anchor` при follow |
| Playhead 57% | ~58% (чуть правее центра) |
| EMA 0.07 + midi EMA 0.12 | Один слой EMA 0.20 на частоте |
| Центр графика EMA 0.1 | Медиана последних кадров без дрейфа |

**Не трогали:** `TunerEngine`, детектор, `isVoicedFrame`, throttle точек.

## Проверка

1. Melody → START → медленная гамма: последняя точка/бабл держится у playhead (~58% ширины), не у правого края.
2. Длинное пение 10+ с: нота не «убегает» вперёд со временем.
3. Pinch/pan влево — follow отключается; «к началу» возвращает в начало.
4. Тюнер — без регрессии (общий `FrequencyChart`, follow только при `followEndRef`).
