# Melody recognition workspace

## Зачем

Вкладка **Melody** — отдельное рабочее место для распознавания напетой мелодии: график высоты, последовательность нот, базовый анализ, сохранение JSON. Не дублирует тюнер и Chords.

## Файлы

| Файл | Роль |
|------|------|
| `src/screens/MelodyScreen.tsx` | Экран: mic, график, лента, анализ, save/load |
| `src/hooks/useSungNoteHistory.ts` | `pitchHistory`, `registeredEvents`, `loadSnapshot` |
| `src/components/MelodyPitchChart.tsx` | Pitch-график (compact `FrequencyChart`) |
| `src/components/FrequencyChart.tsx` | `registeredMarkers` — метки на pitch trace |
| `src/components/MelodyAnalysisPanel.tsx` | Тональность, классы нот, ритм |
| `src/utils/melodyAnalysis.ts` | KS-lite key, inter-onset rhythm |
| `src/utils/melodyStorage.ts` | `documentDirectory/melodies/melody_<ts>.json` |
| `src/utils/sungNoteDetector.ts` | `SungNote` + `midi`, `freq` |
| `src/i18n/strings.ts` | EN/RU строки Melody UI |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Melody tab | Лента нот + live pitch | + график, нумерация 1…n, анализ, сохранение |
| График | — | Pitch history + фиолетовые метки всех committed notes |
| Анализ | — | Key (major/minor lite), pitch classes, tempo label + gaps |
| Композиция | — | Save JSON, список saved, tap load |

## Метки на графике

Для каждого `registeredEvents[]` ищется ближайший по `ts` пункт в `pitchHistory`; рисуются вертикальная линия `#7c4dff55` и круг 10px на `midi` по оси Y (pitch mode).

## Сохранение

`{ id, name, notes[], key?, bpm?, createdAt }` в `melodies/melody_<timestamp>.json`.

## Не в этой итерации (roadmap)

- Полный **нотный стан** (staff)
- **Авто-аккомпанемент**
- **Экспорт минуса** / merge в Studio

Кнопки на экране: disabled «Soon».

## Связанные записи

- [2026-05-20-sung-notes-v2-tabs.md](./2026-05-20-sung-notes-v2-tabs.md) — вынос ленты с Tuner/Chords на Melody
