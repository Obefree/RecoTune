# Chords: поиск первым, каталог метаданных, on-demand таб

**Дата:** 2026-05-22  
**Зачем:** вкладка Chords открывается на каталоге/поиске (не LIVE/практика); масштабируемый офлайн-поиск по метаданным; полные аккорды только по запросу (KB metadata-first).

## Файлы

| Путь | Роль |
|------|------|
| `src/screens/ChordsScreen.tsx` | default `identify`, autofocus, browse при пустом запросе, sync UI |
| `src/metadata/metadataDb.ts` | SQLite `metadata_*`, поиск, `metadataTrackToSongEntry` |
| `src/metadata/metadataSync.ts` | batch sync (bundled chunks / server URL) |
| `src/metadata/types.ts` | типы batch |
| `src/db/songLibrary.ts` | schema v4, `chord-v3` |
| `src/providers/registry.ts` | metadata → builtin merge в `searchProviders` |
| `src/providers/providerSettings.ts` | `metadataSyncBaseUrl` |
| `src/utils/songContent.ts` | бейдж `метаданные` |
| `assets/metadata/chunk-01..03.json` | ~529 треков demo |
| `tools/generate-metadata-chunks.mjs` | пересборка chunks |
| `tools/metadata-server/` | dev GET `/metadata/batch` |

## Было → стало

| Было | Стало |
|------|--------|
| Chords открывался на **Практика** | Старт: **НАЙТИ → Каталог**, фокус в строке поиска |
| Поиск только ~536 builtin SQLite | **metadata_tracks** первыми + fallback builtin/user |
| Пустой запрос в НАЙТИ → пусто | Browse top-40 из `searchProviders('')` |
| Нет batch-каталога | 3 JSON chunk + опциональный server sync |
| Тап по песне без таба → результат НАЙТИ | **Практика** + sheet «Загрузить полный таб» (AmDm/UG) |

## Тест

1. Expo Go → вкладка **Chords** → сразу **НАЙТИ**, вкладка **Каталог**, курсор в поле поиска, `build: chord-v3`.
2. Пустой запрос — список треков; подпись «N треков (метаданные) + …».
3. Поиск `кино`, `лет` — «Группа крови» / Let It Be.
4. Тап по строке с бейджем **метаданные** → практика → «Загрузить полный таб» (прокси).
5. ⚙ → URL `http://<PC>:8790` → **Синхронизировать каталог** (stub: `node tools/metadata-server/server.mjs`).

## Дальше (нужен реальный сервер)

- MusicBrainz ingestion, миллионы треков, пагинация batch API.
- Связка `builtin_song_id` при обогащении каталога.
- Фоновая дельта-синхронизация без блокировки UI.
