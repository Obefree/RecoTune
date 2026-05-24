# Melody график + Chords подгрузка (UX batch)

**Дата:** 2026-05-24  
**Зачем:** дёрганая линия высоты, промежуточные «ноты» на графике, табы не грузятся без обратной связи, playhead у правого края.

## Причины

| Симптом | Причина |
|---------|---------|
| График «мчится» | 12 Hz точки + мгновенный auto-scroll на каждый кадр; EMA 0.14 |
| Лишние точки между нотами | В `pitchHistory` попадали все voiced кадры YIN, в т.ч. слайды |
| Табы «виснут» | `fetch` без таймаута; 4 варианта artist/title **последовательно**; индикатор скрывался при тексте lyrics.ovh |
| Playhead справа | Следование за `lastEndX` без ограничения шага скролла |

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/screens/MelodyScreen.tsx` | DISPLAY_EMA 0.07 (только UI/график; сырой pitch → детектор) |
| `src/hooks/useSungNoteHistory.ts` | voiced gate (`isVoicedFrame`), throttle 100 ms, EMA midi для графика |
| `src/components/FrequencyChart.tsx` | playhead 57%, cap scroll step, EMA центра; не рисуем `voiced: false` |
| `src/utils/melodyTranscription.ts` | export `isVoicedFrame` |
| `src/providers/chordFetchProxy.ts` | timeout 15 s, `Promise.any` по вариантам запроса |
| `src/screens/ChordsScreen.tsx` | AmDm первым; lyrics 6 s cap; спиннер всегда при загрузке |

## Было → стало

| Было | Стало |
|------|--------|
| Каждый pitch-кадр на графике | Только voiced + ≤10 Hz |
| Scroll прыжком за хвостом | Шаг ≤9 px, якорь ~57% ширины |
| Fetch без лимита | 15 с + понятная ошибка |
| 4×15 с последовательно | Параллельно, первый успех |
| Спиннер только без lyrics | «Подгрузка таба… до 15 с» всегда |

## График Melody

- **Детектор и контур** — по-прежнему сырой pitch (~12 Hz).
- **Линия графика** — сглаженная частота + voiced + реже точки; слайды между нотами не рисуются.

## Chords (настройка)

Без Vercel/dev-proxy табы с AmDm не появятся — см. [2026-05-23-chord-search-fetch-reliability.md](./2026-05-23-chord-search-fetch-reliability.md).

1. Deploy RecoTune → `EXPO_PUBLIC_CHORD_FETCH_URL=https://<project>.vercel.app/api/fetch-chords`
2. Или на ПК: `cd tools/chord-fetch && npm run dev-proxy` (Expo Go, та же Wi‑Fi)
3. ⚙ Источники → AmDm включён

## Проверка

1. Melody: медленная гамма — плавная линия, playhead левее центра.
2. Melody: слайд между нотами — нет «лесенки» промежуточных точек.
3. Chords: выбрать песню без таба — спиннер ≤15 с, затем таб или подсказка.
4. Тюнер: стрелка/частота без регрессии (TunerEngine не трогали).
