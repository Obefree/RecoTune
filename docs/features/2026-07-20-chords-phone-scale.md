# Chords: масштаб офлайн-табов на телефоне (pesni bundle + UX)

**Дата:** 2026-07-20  
**Зачем:** на телефоне нужно **гораздо больше** реальных verified-табов без заглушек (D8); metadata ~5200 по-прежнему без таба в APK.

## Ingest pesni.ru

| | Было (D21) | Стало |
|---|------------|-------|
| Bundled verified ChordPro | 300 | **1113** |
| Bundle version | 1 | **2** (`version:count` в `schema_meta`) |
| Офлайн full tabs (seed + bundle) | ~332 | **~1145** |
| Размер `pesni-chordpro.json` | ~0.9 MB | **~3.0 MB** |

- **Аудит ingest:** лимит API 60/min соблюдается (`RATE_MS=1200`, retry на 429). Фильтры: `pesniRuTextToVerifiedLyrics`, `isQualityTab`, каверы, tab-dump titles, dedupe по slug/key.
- **Фикс resume:** убран skip по `doneArtists` — при `--target` выше можно добрать до 12 табов с артиста (раньше застревали на 300).
- **Команда для Alex (продолжить/обновить):**  
  `npm run ingest-pesni-chords`  
  (resume checkpoint, target 1200, per-artist 12). Свежий прогон с нуля: `npm run ingest-pesni-chords:fresh` (удалить `tools/.pesni-ingest-checkpoint.json`).

## Приложение

| Файл | Изменение |
|------|-----------|
| `src/db/pesniArchiveImport.ts` | meta `2:1113`, батчи по 48 в transaction + yield |
| `src/db/songLibrary.ts` | pesni-импорт **в фоне** после открытия БД; toast «Импорт…» |
| `src/utils/songContent.ts` | hint с динамическим ~N офлайн; phone vs ПК |
| `src/providers/pesniRuProvider.ts` | русские стадии прогресса pesni |
| `src/providers/onDemandChordAuto.ts` | честные ошибки цепочки (ПК vs pesni) |
| `src/screens/ChordsScreen.tsx` | прогресс auto-fetch в пустой практике; pesni-first progress без прокси |
| `tools/ingest-pesni-chordpro.mjs` | bundle v2, без блокировки doneArtists |
| `package.json` | `ingest-pesni-chords` / `:fresh` → target 1200 |

## Phone vs ПК

| Источник | Телефон | ПК / VPS |
|----------|---------|----------|
| **~1145 офлайн табов** (фильтр «ТАБЫ») | да | да |
| **metadata ~5200** | поиск; таб auto-fetch | то же |
| **pesni.ru on-demand** | да, кэш `chord_cache` 7 дней | да |
| **AmDm / Ultimate Guitar** | нет (нужен прокси) | `npm start` :8787 или `EXPO_PUBLIC_CHORD_FETCH_URL` |
| **Stem / basic-pitch** | нет | :8788 |

## Проверка

- `npm run verify-chord-normalize` / `verify-chord-transpose` / `verify-chord-layout`
- `npx tsc --noEmit`
- Фильтр «ТАБЫ» → ~1100+ с «текст ✓»
- Metadata-песня без таба → индикатор «pesni.ru: поиск…» → таб или честная ошибка
