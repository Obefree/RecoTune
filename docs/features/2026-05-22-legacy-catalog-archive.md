# Архив legacy-каталога (536) и минимальный seed

**Дата:** 2026-05-22

## Зачем

Старый встроенный каталог (~536 песен) содержал много строк **только с прогрессией** и тексты низкого качества. По умолчанию в практику и SQLite seed попадали все 536 — плохой UX и раздувание БД.

## Что сделано

| Было | Стало |
|------|--------|
| `SONGS` = 536 в `songDatabase.ts` | Активный seed: **32** песни с ChordPro-текстом (`builtinSongsSeed.ts`) |
| Полный список в JS-бандле | Архив: `assets/archive/legacy-songs-536.json` + snapshot `tools/legacySongDatabase.snapshot.ts` |
| Авто-upsert всех builtin при каждом bump seed | При смене `BUILTIN_SEED_VERSION` — **purge** builtin не из seed (если архив не импортирован) |
| — | Опционально: **Настройки → Импорт архивного каталога (536)** |

## Файлы

- `src/data/builtinSongsSeed.ts` — активный seed
- `src/data/songDatabase.ts` — типы + `SONGS` = seed
- `assets/archive/legacy-songs-536.json`, `README.md`
- `src/db/songLibrary.ts` — `BUILTIN_SEED_VERSION = 2026-05-22-3-minimal`, purge
- `src/db/legacyArchiveImport.ts` — импорт из JSON
- `tools/export-legacy-catalog.ts` — регенерация архива/seed
- `src/screens/ChordsScreen.tsx` — убраны `build: chord-v3` из UI, фикс строки поиска

## Проверка

1. Chords → НАЙТИ → Каталог: поле поиска и «×» на ширине ~320dp, без уезда вправо.
2. База песен: ~32 builtin (+ свои), не 536, пока не импортирован архив.
3. Настройки → импорт 536 → счётчик песен растёт, повторный импорт disabled.
