# Сервер базы аккордов

Данные лежат в **`server/data/songs.json`** (файл в `.gitignore`, в git только пример).

## Запуск

```bash
cp server/data/songs.example.json server/data/songs.json
# отредактируйте songs.json — массив объектов как в приложении (id, title, artist, chords, …, lyrics)
npm run chords-server
```

Переменные:

| Переменная | Значение |
|------------|----------|
| `CHORDS_DATA_FILE` | Абсолютный или относительный путь к JSON (по умолчанию `server/data/songs.json`) |
| `PORT` | Порт (по умолчанию `8787`) |
| `CHORDS_API_TOKEN` | Если задан — для `GET /api/v1/catalog` и `GET /api/v1/songs/:id` нужен заголовок `Authorization: Bearer …` |
| `CORS_ALLOW_ORIGIN` | Заголовок CORS (по умолчанию `*`) |

## API

- `GET /health` — проверка процесса и пути к файлу данных.
- `GET /api/v1/catalog` — список песен **без поля `lyrics`** (флаг `hasLyrics` показывает, есть ли текст в полной выдаче).
- `GET /api/v1/songs/:id` — полная песня, включая `lyrics`.
- `POST /api/v1/reload` — сброс кэша после правки файла на диске (при включённом токене — с тем же `Authorization`).

## Приложение Expo

В корне проекта (не коммитить с секретами):

```bash
EXPO_PUBLIC_CHORDS_API_URL=http://ВАШ_IP:8787
# опционально, если задали CHORDS_API_TOKEN на сервере:
EXPO_PUBLIC_CHORDS_API_TOKEN=ваш_токен
```

Expo подхватывает `EXPO_PUBLIC_*` из `.env` при `expo start`. Для HTTPS на телефоне используйте reverse-proxy с сертификатом.
