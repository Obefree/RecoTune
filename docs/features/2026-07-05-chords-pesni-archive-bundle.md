# Chords: офлайн-база +300 verified табов (pesni.ru archive bundle)

**Дата:** 2026-07-05  
**Зачем:** жалоба #3 — поиск находит песни, но почти без аккордов (только названия/метаданные).

## Корень проблемы

| Фактор | Что происходит |
|--------|----------------|
| Каталог D7 | ~5200 треков MusicBrainz — **metadata-only** (`meta_*`), без табов в APK |
| Legacy seed | ~32 verified ChordPro в `builtinSongsSeed.ts`, не 536 |
| D8 verified gate | без fake/stub — progression-only и metadata не показываются как таб |
| AmDm/UG | скрап только через **ПК-прокси** `:8787`; без него auto-fetch пустой |
| pesni.ru runtime | тихий backup с телефона работал, но **не был в офлайн-поиске** |

## Что сделано

| Файл | Изменение |
|------|-----------|
| `tools/ingest-pesni-chordpro.mjs` | ingest 300 verified ChordPro с pesni.ru API → `assets/archive/pesni-chordpro.json` (тот же `isVerifiedChordProLyrics`, без stubs) |
| `tools/lib/chordNormalize.mjs` | Node-зеркало normalize/verify — общий код для ingest и `verify-chord-normalize` |
| `src/db/pesniArchiveImport.ts` | импорт архива в SQLite при `initSongLibrary`, версия в `schema_meta` |
| `src/db/songLibrary.ts` | вызов импорта; `pesni_ru_*` не удаляются при purge; `CHORD_LIBRARY_BUILD` → `chord-v4-pesni300` |
| `src/utils/songContent.ts` | `PROGRESSION_ONLY_HINT` — честно про metadata vs ~330 офлайн-табов vs ПК/pesni |
| `src/screens/ChordsScreen.tsx` | toast при первом импорте pesni-архива |
| `package.json` | `npm run ingest-pesni-chords` |

## Было → стало

| | Было | Стало |
|---|------|-------|
| Офлайн full tabs | ~32 (seed) | **~332** (32 seed + **300** pesni bundle) |
| Поиск «Кино» / рус. рок | в основном metadata, пустая практика | сотни pesni.ru табов **сразу в SQLite**, бейдж «текст ✓», фильтр «ТАБЫ» |
| Metadata 5200 | как было | как было — таб по-прежнему on-demand (AmDm→UG→pesni) |
| Phone-only без ПК | только runtime pesni backup по тапу | **300 табов офлайн** + auto pesni при выборе metadata-песни |

## Что нужно ПК / сервер

- **AmDm / Ultimate Guitar** — `npm start` или `EXPO_PUBLIC_CHORD_FETCH_URL` (VPS backlog)
- **5200 metadata** — таб не в бандле; auto-подгрузка при выборе или кнопка «Подгрузить таб»
- **Расширить офлайн-базу:** `npm run ingest-pesni-chords` (checkpoint в `tools/.pesni-ingest-checkpoint.json`, gitignore)

## Проверка

- `npm run verify-chord-normalize` / `verify-chord-transpose` / `verify-chord-layout`
- `npx tsc --noEmit`
- Фильтр «ТАБЫ» в базе → ~330 песен с «текст ✓»
- Metadata-песня без офлайн-таба → честный hint + auto-fetch (pesni с телефона)
