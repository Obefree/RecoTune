# Parsed chord DB on PC + Vercel

**Дата:** 2026-08-17 · **Файлы:** `parsedChordStore.mjs`, `amdmFetch.mjs`, `chordSearch.mjs`, `api/fetch-chords.mjs`

## Зачем

Раздавать уже спарсенные ChordPro с ПК и с Vercel, без повторного скрапа на каждую песню.

## Было → стало

| Было | Стало |
|------|--------|
| Каждый fetch шёл на AmDm (медленно) | Сначала lookup: pesni bundle (~1113) + overlay с ПК |
| Новые парсы пропадали | Пишутся в `tools/chord-fetch/data/parsed-chords.local.json` |
| Vercel только live scrape | Тот же store (pesni в репо + `proxy-parsed-chords.json` после `npm run chord-db:publish`) |
| Overlay только на ПК/Vercel | Тот же snapshot **в APK**: `importPesniChordProArchive` кладёт pesni + overlay в SQLite (`parsed_*`), без прокси |
| Ingest pesni останавливался на ~1200 | `npm run ingest-pesni-chords` → target 5000, `--from-start`, бандл пишется после каждого артиста |
| Каталог 5200 без ChordPro | `npm run chord-db:ingest-amdm` и `npm run chord-db:ingest-ug` — дыры каталога. UG: **только Chords** (`type=300`, URL `-chords-`), одна версия на песню (рейтинг × голоса), артист и название должны совпасть с каталогом (без Harry Secombe / интервью) |

APK обновлять **поверх** (не uninstall). Expo Go — `RecoTune.bat`, JS живой. APK — новая сборка поверх того же пакета.
