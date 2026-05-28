# Chords: UG → AmDm, поиск с подгрузкой, короткий UI

## Зачем

- Табы: приоритет **Ultimate Guitar** и **AmDm**, pesni.ru — только fallback.
- Поиск в базе: больше результатов (до 150 metadata), **подгрузка при скролле**.
- Меньше текста в UI (спиннер, «N найдено», короткие ошибки).

## Файлы

| Файл | Изменение |
|------|-----------|
| `tools/chord-fetch/ugFetch.mjs` | **новый** — парсер UG (js-store, ChordPro) |
| `tools/chord-fetch/amdmFetch.mjs` | `ultimate_guitar` → `ugFetch`, не 501 |
| `src/providers/onDemandChordAuto.ts` | цепочка UG → AmDm → pesni.ru |
| `src/providers/registry.ts` | страницы по 50, pesni только на 1-й странице |
| `src/metadata/metadataSearch.ts` | cap 150, offset |
| `src/screens/ChordsScreen.tsx` | `onEndReached`, короткие подписи |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Авто-таб | pesni.ru → AmDm | **UG → AmDm → pesni.ru** |
| UG в прокси | HTTP 501 | Парсер на ПК (`ugFetch.mjs`) |
| Поиск «кино» | до ~50, без скролла | 50 + **ещё при скролле**, metadata до 150 |
| Подсказки загрузки | «Ищем на…» | Спиннер / пусто |
| Ошибка таба | Длинный список источников | Одна короткая строка |

## Проверка

1. `npm run dev-proxy` на ПК, Expo Go в той же Wi‑Fi.
2. **Radiohead — Creep** — практика: сначала UG, иначе AmDm.
3. Поиск **кино** — ≥50 строк или «50+ найдено» и подгрузка внизу.
