# Creep chorus: runtime normalize + curly apostrophe

## Зачем

После `b182c52` на устройстве оставалось **But [G]I'm a creep** — seed и unit-тесты были ок, но:

1. **Кэш SQLite** (legacy 536 / старый builtin) не перезаписывался, если `builtin_seed_version` уже совпадал.
2. **Типографский апостроф** `I'm` (U+2019) не матчился regex `I'm` (ASCII) → `repositionMisplacedInlineChords` не срабатывал.
3. **Merge** `G` + строка с уже вшитым `[G]I'm` давал `[G][G]creep`.
4. Нормализация была только в `loadSongForPractice`, не в `resolveLyricsText` / identify / enrich.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/utils/chordLyricsNormalize.ts` | апострофы, merge без двойного `[G]`, `lastWordHasInlineChord` |
| `src/utils/songContent.ts` | `normalizeLyricsChords` в `resolveLyricsText` (все пути показа) |
| `src/db/songLibrary.ts` | `repairBuiltinLyricsInDb` на старте, `BUILTIN_SEED_VERSION` bump |
| `src/screens/ChordsScreen.tsx` | `practiceLyricsDisplay` + `ChordLyricsLine` — нормализация и аккорды не только в начале строки |
| `tools/verify-chord-normalize.mjs` | curly apostrophe, merge+inline, C#/Bb |

## Проверка

```bash
npm run verify-chord-normalize
```

Переустановка не нужна: достаточно **обновить сборку** и **переоткрыть Creep** (SQLite починится при старте + на показе).
