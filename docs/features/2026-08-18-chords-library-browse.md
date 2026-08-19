# Chords: быстрый поиск + списки по исполнителям и песням

## Зачем

Поиск в «БАЗЕ ПЕСЕН» был долгим; каталог — плоский A–Я по названию (~2600). Трудно найти песню по исполнителю.

## Корень

Каждый ввод (debounce 90 мс) гонял `searchProviders` с `includeRemote: false`, но всё равно:

1. `listSongs()` = `SELECT *` с полными текстами + `resolveLyricsText` на каждую строку.
2. Скан MusicBrainz chunks (~5200).
3. HTTP remote chord catalog и pesni.ru.

## Было → стало

| Было | Стало |
|------|--------|
| Список только по названию | Пиллы **Исполнители** (по умолчанию) и **Песни**; тап исполнителя → его композиции, «← имя» назад |
| Поиск тащил тексты + сеть | SQLite-каталог без lyrics; сеть/metadata только если `includeRemote !== false` |
| Debounce 90 мс | 280 мс |
| Фильтр ТАБЫ требовал загруженный ChordPro | `has_tab` в SQL (`length(lyrics) > 80`) → `chordProVerified` на строке списка |

Практика по-прежнему грузит полный текст через `getSongById` (D8, без заглушек).

## Файлы

- `src/db/songLibrary.ts` — `listSongs()` без lyrics
- `src/db/searchSongsSmart.ts` — rank по title/artist/chords
- `src/providers/registry.ts` — local-only путь
- `src/utils/songContent.ts` — `hasCatalogTab`
- `src/utils/songMatch.ts` — catalog match по флагу таба
- `src/screens/ChordsScreen.tsx` — browse UI, back: поиск → исполнитель → закрыть
