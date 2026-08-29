# Chords: индекс каталога + живые кнопки меню

## Зачем

Каталог зависал при открытии: `require(pesni-chordpro.json)` тащил все тексты в JS, импорт в SQLite блокировал UI. Пиллы «Исполнители» / «Песни» и крестик поиска не нажимались — список накрывал шапку. Поиск был пустой, пока не уйдёшь на другую вкладку и не вернёшься.

## Было → стало

| Было | Стало |
|------|--------|
| Один JSON со всеми текстами при старте | `assets/catalog/index.json` (исполнители + песни) и шарды текстов |
| Выбор песни ждал полный импорт | `getSongById` → индекс → один шард ChordPro |
| Пиллы не переключали вид, если в поиске был текст | «Исполнители» / «Песни» сбрасывают поиск и сразу меняют список |
| Крестик не ловил тап | Отдельный `Pressable` над списком |
| Поиск только через async `searchProviders` | Сразу `filterSongsQuick` по уже загруженному индексу |

## Файлы

- `tools/build-offline-catalog.mjs` — сборка индекса и шардов
- `assets/catalog/index.json`, `assets/catalog/lyrics/*.json`
- `src/catalog/offlineCatalog.ts`, `src/catalog/lyricsShardLoaders.ts`
- `src/db/songLibrary.ts`, `src/db/pesniArchiveImport.ts`
- `src/screens/ChordsScreen.tsx`

После нового ingest: `npm run build-catalog`.
