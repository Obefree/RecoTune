# Chords: phone UX, расширение офлайн pesni, масштаб практики

**Дата:** 2026-07-20  
**Зачем:** телефон без ПК — понятная подгрузка табов, не блокировать старт приложения на большом pesni-архиве, путь к **~1200** verified офлайн-табам (D22). Политика **D8** без изменений.

## Что сделано

| Файл | Изменение |
|------|-----------|
| `package.json` | `ingest-pesni-chords`: `--target=1200 --per-artist=12 --resume`; `:fresh` без resume |
| `tools/ingest-pesni-chordpro.mjs` | `BUNDLE_VERSION=2`; ingest не пропускает артиста после первого прохода (можно добирать треки); только verified ChordPro |
| `src/db/pesniArchiveImport.ts` | meta `version:count` → переимпорт при росте бандла; батчи по 48 + yield (меньше ANR на телефоне) |
| `src/db/songLibrary.ts` | pesni-импорт **в фоне** после быстрого init; `getPesniArchiveImportPromise()`; `CHORD_LIBRARY_BUILD` → `chord-v5-pesni1200` |
| `src/screens/ChordsScreen.tsx` | toast «Импорт офлайн-табов…»; спиннер + этапы fetch в пустой практике; прогресс auto-fetch с pesni без прокси; ошибки до 120 символов |
| `src/providers/pesniRuProvider.ts` | русские подписи этапов pesni (поиск / verify / cache) |
| `src/providers/onDemandChordAuto.ts` | честные сообщения: нет прокси → «AmDm/UG — только с ПК…» |
| `src/utils/songContent.ts` | `bundledOfflineVerifiedTabCount()`; динамический `PROGRESSION_ONLY_HINT` |

## Было → стало

| | Было | Стало |
|---|------|-------|
| Старт приложения | ждал полный pesni SQLite import | UI готов раньше; импорт в фоне + toast при открытии «База» |
| Офлайн hint | «~330» захардкожено | **~332** сейчас (32 seed + **300** в бандле); после ingest → до **~1232** |
| Ingest default | 300 / 8 треков на артиста | **1200 / 12**, resume по checkpoint |
| Пустая практика при fetch | только текст hint | **ActivityIndicator** + подпись этапа |
| Ошибка auto-chain | часто «Не найдено» | различие «нет прокси» vs «нет на pesni» |

## D8 (no stubs)

Ingest и импорт по-прежнему фильтруют `isVerifiedChordProLyrics`; progression-only и metadata не попадают в практику как таб.

## Ingest (ПК, долго)

```bash
npm run ingest-pesni-chords          # resume → assets/archive/pesni-chordpro.json
npm run ingest-pesni-chords:fresh    # с нуля
```

Checkpoint: `tools/.pesni-ingest-checkpoint.json` (gitignore). После ingest закоммитить обновлённый JSON отдельно (большой файл).

## Проверка

```bash
npm run verify-chord-normalize
npm run verify-chord-transpose
npm run verify-chord-layout
npx tsc --noEmit
```

На телефоне: metadata-песня без таба → спиннер + «pesni.ru: …»; фильтр «ТАБЫ» растёт после фонового импорта.
