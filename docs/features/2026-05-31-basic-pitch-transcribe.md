# Melody: транскрипция из файла (basic-pitch, P2)

## Зачем

Распознавание мелодии из записанного аудио на ПК (Spotify basic-pitch), без Whisper и без поддельных нот. Дополняет live-микрофон на вкладке Melody.

## Файлы

| Область | Файлы |
|---------|--------|
| Сервер | `tools/stem-separate/basic_pitch_run.py`, `dev-proxy-server.mjs` |
| Клиент | `stemSeparateUrl.ts`, `stemSeparateClient.ts`, `melodyTranscription.ts` |
| UI | `MelodyScreen.tsx` — кнопка «Из файла» |
| npm | `test-stem-transcribe` |

## Было → стало

| Было | Стало |
|------|--------|
| `GET /transcribe` → 501 | `POST /transcribe` + base64 WAV, ответ `notes[]` |
| `/health` только `demucs` | + `basic_pitch`, `basicPitchError` |
| Melody только микрофон | «Из файла» → ПК → лента, нотоносец, PLAY |
| Нет сервера | Честное сообщение: только START (микрофон) |

## Проверка

```bash
npm run stems:dev
npm run test-stem-separate
npm run test-stem-transcribe   # нужен pip install basic-pitch
```

В приложении: Melody → **Из файла** → выбрать аудио → PLAY.
