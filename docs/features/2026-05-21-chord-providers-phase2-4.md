# Chord library: провайдеры, умный поиск, импорт/экспорт (Phase 2–4)

## Зачем

Единая библиотека песен не должна зависеть только от Ultimate Guitar: несколько легальных источников, офлайн SQLite, сохранение после НАЙТИ, умный поиск с опечатками.

## Файлы

| Путь | Роль |
|------|------|
| `src/providers/types.ts` | `ProviderId`, `SongSearchResult`, `SongDetail` |
| `src/providers/registry.ts` | `searchProviders()` — merge + dedupe |
| `src/providers/*.ts` | builtin, user, audd, lyrics, chordpro_url |
| `src/providers/providerSettings.ts` | toggles + ChordPro URL (documentDirectory JSON) |
| `src/db/searchSongsSmart.ts` | `searchSongsSmart()` — rank builtin+user |
| `src/utils/searchNormalize.ts` | normalize, Cyrillic→Latin optional |
| `src/utils/searchScore.ts` | Levenshtein, exact/prefix/contains/fuzzy |
| `src/utils/chordProParse.ts` | ChordPro parse shared |
| `src/library/importExport.ts` | JSON backup, batch ChordPro |
| `src/screens/ChordsScreen.tsx` | UI: badges, settings, save from FIND, smart search bar |

## Умный поиск (`searchSongsSmart`)

| Было | Стало |
|------|--------|
| `includes()` по title/artist в ChordsScreen | Нормализация (lower, punctuation, RU→LAT), токены, Levenshtein |
| Один порядок списка | Ранг: exact > prefix > contains > fuzzy |
| Только локальный filter | `searchProviders()` + SQLite builtin/user; remote по настройкам |

## Провайдеры

| ID | Сеть | API ключ | Что даёт |
|----|------|----------|----------|
| `builtin` | Нет | — | Seed-каталог SQLite |
| `user` | Нет | — | Мои песни SQLite |
| `chordpro_import` | Нет | — | Импорт файлов → user (batch DocumentPicker) |
| `chordpro_url` | Да | — | Fetch raw URL из настроек (gist/GitHub raw) |
| `audd` | Да | `EXPO_PUBLIC_AUDD_TOKEN` | НАЙТИ + обогащение аккордами из каталога |
| `lyrics` | Да | — | Stub metadata; текст через lyrics.ovh при открытии |

**Не делаем:** скрапинг Ultimate Guitar.

## Phase 3 — НАЙТИ

- Кнопка **«Сохранить в библиотеку»** после распознавания (аккорды из match / `[Chord]` в тексте).
- Модалка **Источники** (⚙ в библиотеке): включение провайдеров, ChordPro URL, импорт JSON-бэкапа.
- Офлайн: все сохранённые user/builtin в SQLite.

## Phase 4 — Import / export

- **Экспорт:** share JSON (`shareLibraryBackup`) — user songs + favoriteIds.
- **Импорт:** один JSON-бэкап; ChordPro **multiple** files → batch в user songs.

## Как проверить

1. Библиотека → поиск `битлз let` / опечатка `let it bi` — находит Let It Be.
2. НАЙТИ (mic/file) → «Сохранить в библиотеку» → появляется в «Мои» с бейджем.
3. ⚙ → вставить raw ChordPro URL → поиск по названию из файла.
4. ИМПОРТ (несколько .cho) / share экспорт JSON.
