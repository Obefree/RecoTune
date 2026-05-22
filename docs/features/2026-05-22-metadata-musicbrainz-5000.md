# Metadata catalog: MusicBrainz ≥5000 tracks (D7)

**Зачем:** офлайн каталог Chords — **≥5000 реальных** записей (artist, title, album, year, duration, mbid), до ~10 MB bundled JSON; без фейковых заглушек и без аккордов в metadata.

## Файлы

| Путь | Назначение |
|------|------------|
| `data/seed-artists-mb.json` | ~80 seed-артистов RU+EN |
| `tools/ingest-musicbrainz-metadata.mjs` | Ingestion MB ws/2, 1 req/s, checkpoint |
| `tools/verify-metadata-search.mjs` | Smoke Latin/Cyrillic по `search_text` |
| `src/metadata/bundledChunks.ts` | Metro `require()` всех chunk-*.json (генерируется ingest) |
| `src/metadata/metadataSync.ts` | Импорт через `BUNDLED_METADATA_CHUNKS` |
| `assets/metadata/chunk-*.json` | Bundled batches (~1–2 MB каждый) |
| `assets/metadata/manifest.json` | Сводка после ingest |
| `tools/generate-metadata-chunks.mjs` | Только **legacy** demo → `assets/metadata/legacy/` |

## Было → стало

| Было | Стало |
|------|--------|
| ~529 demo tracks из songDatabase в chunk-01…03 | MusicBrainz recordings, dedupe artist+title, mbid |
| Hardcoded 3 `require()` в metadataSync | `bundledChunks.ts` со всеми chunk-NN |
| `generate-metadata-chunks` перезаписывал chunk-01…03 | Пишет в `legacy/`, не трогает MB chunks |

## Ingestion

```bash
cd RecoTune
npm run ingest-metadata
# smoke:
node tools/ingest-musicbrainz-metadata.mjs --target=500 --limit-artists=5 --max-pages=3
# resume после обрыва:
node tools/ingest-musicbrainz-metadata.mjs --resume --target=5000
```

Опции: `--target=5000`, `--limit-artists=80`, `--max-pages=12`, `--chunk-size=1750`.

User-Agent: `RecoTune/1.0 (contact: dev@local)`.

## Синхронизация в приложении

1. Открыть **Chords** → каталог подтянет bundled chunks при первом запуске (`ensureBundledMetadataSeed`).
2. Либо ⚙ → очистить URL сервера → **«Синхронизировать каталог»** (повторный импорт всех chunk).
3. Поиск: `searchProviders` → `metadata_tracks` (кириллица/латиница через `search_text`).

Сервер (опционально): `node tools/metadata-server/server.mjs` + URL в настройках.

## Проверка

```bash
npm run verify-metadata-search
```
