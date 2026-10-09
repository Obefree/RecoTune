# Chords: без фейкового legacy, A-ha с настоящим табом

## Зачем

В базе A-ha была одна песня — seed `80s02` Take On Me с чередованием A–D, не таб. Legacy 536 попадал в офлайн-каталог как «verified», хотя это упрощённые/выдуманные аккорды. Исполнители дробились по написанию (`A-ha` / `Aha`, `The Beatles` / `Beatles`).

## Файлы

- `tools/build-offline-catalog.mjs` — только pesni + overlay + local, без 536; склейка артистов по ключу
- `src/utils/artistName.ts` — ключ без пунктуации, `the` prefix
- `src/db/songLibrary.ts` — в списке не тащим leftover 536; pesni/parsed бьют seed
- `tools/chord-fetch/amdmFetch.mjs` — alias `aha` → `a-ha`
- каталог пересобран: **3609** песен / **223** исполнителя; A-ha **8** с AmDm

## Было → стало

| Было | Стало |
|------|--------|
| A-ha: 1 песня, A D A D | 8 песен, Take On Me = Bm E F#m D с AmDm |
| 62 legacy id в каталоге | catalog без `80s02` и остального 536 |
| A-ha и Aha / The Beatles и Beatles — разные папки | один исполнитель |
| Дедеуп: seed побеждал pesni | pesni/parsed побеждают seed |
