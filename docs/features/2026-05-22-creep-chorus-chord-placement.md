# Creep chorus: chord before I'm → on creep

## Зачем

В Radiohead «Creep» в практике оставалась строка **But [G]I'm a creep** — аккорд перед сокращением `I'm`, а не на слове *creep* (как в табах и после merge строки `G` над текстом).

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/chordLyricsNormalize.ts` | `repositionMisplacedInlineChords`, merge одной chord-строки для connector-led фраз (`But…`) на последнее слово |
| `tools/verify-chord-normalize.mjs` | тесты merge/reposition + зеркало логики |
| `src/data/builtinSongsSeed.ts` | `But I'm a [G]creep` (оба припева) |
| `src/db/songLibrary.ts` | `BUILTIN_SEED_VERSION` → re-upsert builtin в SQLite |

## Было → стало

| Вход | Было | Стало |
|------|------|-------|
| `But [G]I'm a creep` | `[G]` перед I'm | `But I'm a [G]creep` |
| `G\nBut I'm a creep` | `[G]But I'm a creep` (или префикс на всю строку) | `But I'm a [G]creep` |
| `[G]But I'm a creep` | аккорд в начале connector-строки | `But I'm a [G]creep` |
| `G\nCouldn't look you in the eye` | без изменений | `[G]Couldn't…` (как раньше) |

Нормализация при открытии песни: `loadSongForPractice` → `normalizeLyricsChords` (кэш SQLite с плохим текстом тоже чинится на показе).

## Проверка

```bash
npm run verify-chord-normalize
```

Открыть Creep в Практике — нет `[G]I'm`, аккорд на *creep*.
