# Chords: кнопки базы и зависание всего

## Зачем

После открытия базы и при поиске приложение на секунды замирало — пиллы «Исполнители»/«Песни» и крестик не нажимались, потому что JS-поток был занят.

## Корень

Каждый ввод в поиске (даже `includeRemote: false`) гонял `searchProviders` → `searchSongsSmart` по всем ~2569 песням (fuzzy). Пока это считалось, не работало ничего. Плюс вкладка Chords тянула metadata-чанки и шарды текстов в граф импорта.

## Было → стало

| Было | Стало |
|------|--------|
| Поиск базы = умный скор по всему каталогу + спиннер | Только `filterSongsQuick` по уже загруженному индексу |
| `bundledChunks` парсил 3 JSON при импорте Chords | `getBundledMetadataChunks()` при синке/поиске metadata |
| `offlineCatalog` импортировал 16 шардов текстов | Шард `require` только при открытии песни |
| Пиллы под списком / мёртвые на время freeze | Pressable + непрозрачная шапка; freeze убран |

## Файлы

- `src/screens/ChordsScreen.tsx`
- `src/catalog/offlineCatalog.ts`
- `src/metadata/bundledChunks.ts`, `metadataSync.ts`, `metadataSearch.ts`

Metro reload, не новый APK.
