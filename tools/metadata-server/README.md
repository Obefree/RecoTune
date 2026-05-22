# Metadata server (dev stub)

Минимальный HTTP-сервер для синхронизации каталога RecoTune без вшитых JSON.

## Запуск

```bash
node tools/metadata-server/server.mjs
```

По умолчанию порт **8790**. Переменная `METADATA_PORT`.

## API

`GET /metadata/batch?offset=0&limit=500`

Ответ — JSON как в `assets/metadata/chunk-*.json`:

- `cursor`, `nextCursor`, `totalHint`
- `artists[]`, `tracks[]`

## В приложении

⚙ **Источники песен** → **Сервер каталога метаданных** → `http://<IP-ПК>:8790` → **Синхронизировать каталог**.

Без URL приложение импортирует встроенные `chunk-01` … `chunk-03` при первом открытии Chords.

## Продакшен

Замените stub на MusicBrainz ingestion + PostgreSQL/SQLite export; сохраните тот же контракт batch API.
