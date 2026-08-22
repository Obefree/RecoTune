# Честный таб vs. только текст (без фейковой склейки)

## Зачем

PR «auto-overlay chords» клеил прогрессию каталога на каждую строку lyrics.ovh
(`annotateLyricsWithChords`) и параллельно смотрел lyrics сначала по id, потом
по artist+title. Id каталога (`s014`) почти никогда не совпадает с id словаря
(`sn02`), а при совпадении (`s001`) чужой таб мог победить. Fetch из identify
ещё и писал в практику — два назначения, один ответ.

## Файлы

- `src/data/lyricsDatabase.ts` — `hasChordMarkers`, `resolvedLyrics`, artist+title первым
- `src/screens/ChordsScreen.tsx` — нет overlay, раздельный fetch, stale-guard, «В Практику»
- `tools/lyrics-chain.test.mjs` — цепочка lookup/merge без RN

## Было → стало

| Было | Стало |
| --- | --- |
| Прогрессия `Am F C G` ставилась в начало каждой строки lyrics.ovh как `[Am]…` | lyrics.ovh остаётся текстом; метка «ТОЛЬКО ТЕКСТ», аккорды только в шапке |
| `findLyrics` сначала по id | сначала artist+title, id — запасной путь |
| Словарь перезаписывал inline-таб | fill-only: verified `[Chord]` не трогаем |
| Identify fetch писал ещё и в `practiceLyrics` | dest `identify` \| `practice`, generation token отменяет устаревший ответ |
| «В Практику» только менял вкладку | переносит таб/текст и аккорды из каталога, если песня есть в базе |
