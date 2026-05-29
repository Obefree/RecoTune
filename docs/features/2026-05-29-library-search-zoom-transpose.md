# База: живой поиск AmDm/UG, pinch-zoom и транспонирование

**Дата:** 2026-05-29

## Зачем

1. В базе не находились песни, которые есть на AmDm/UG (Bob Dylan, Мельница) — только bundled metadata.
2. В практике строки аккордов/текста наезжали друг на друга — нужен масштаб пальцами.
3. Нужна смена тональности по полутонам с пересчётом аккордов в ChordPro.

## Файлы

| Область | Файлы |
|---------|--------|
| Прокси | `tools/chord-fetch/chordSearch.mjs`, `ugFetch.mjs` (`searchUgByQuery`), `dev-proxy-server.mjs` POST `/search`, `api/search-chords.mjs` |
| Поиск в приложении | `src/providers/remoteChordSearch.ts`, `src/providers/registry.ts`, `src/providers/chordFetchUrl.ts` |
| Транспонирование | `src/utils/chordTranspose.ts`, `tools/verify-chord-transpose.mjs` |
| Практика UI | `src/screens/ChordsScreen.tsx`, `src/settings/practiceDisplaySettings.ts` |
| Контент | `src/utils/songContent.ts`, `src/library/persistProviderSong.ts` |

## Было → стало

| Тема | Было | Стало |
|------|------|--------|
| Поиск в базе | SQLite + bundled chunks (cap ~150) | + при `q≥2` и доступном прокси: POST `/search` → AmDm + UG, merge с dedupe; без прокси — как раньше |
| ID онлайн-хитов | — | `remote_amdm_*` / `remote_ug_*`, бейдж «метаданные», on-demand fetch при выборе |
| Масштаб текста | Фиксированные 16/14 px | Pinch на блоке текста + A−/A+ (75–190%), сохранение в `practice_display_settings.json` |
| Тональность | Нет | −½ / +½, метка (+2, −1…), «ориг.», сдвиг `[Am]` в отображении; offset на песню в settings |

## Проверка

1. `npm run chords:dev` (или `dev-proxy` на :8787).
2. База: «Bob Dylan», «Мельница», «Dylan» — в списке появляются AmDm/UG (подпись провайдера).
3. Практика с verified ChordPro: pinch увеличивает текст; A± работает; автопрокрутка не ломается.
4. −½/+½ меняет аккорды в тексте и в чипах прогрессии; «ориг.» сбрасывает.
5. `node tools/verify-chord-transpose.mjs`
