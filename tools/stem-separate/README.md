# Stem separation (Demucs) + melody transcription (basic-pitch)

Локальный HTTP-сервер для **нейросетевого** разделения вокал/минус (AI Lab) и **транскрипции мелодии из файла** (Melody tab).

| Порт | Сервис |
|------|--------|
| **8788** | stem-separate (`POST /separate`, `POST /transcribe`) |
| 8787 | chord-fetch (отдельно) |

## Быстрый старт (Windows)

```powershell
cd C:\Users\lev\Documents\GitHub\RecoTune\tools\stem-separate
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
cd ..\..
npm run stems:dev
```

Только мелодия (без Demucs/torch):

```powershell
pip install basic-pitch
```

В другом терминале:

```powershell
curl http://127.0.0.1:8788/health
npm run test-stem-separate
npm run test-stem-separate -- --separate
npm run test-stem-transcribe
```

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `STEM_SEPARATE_PORT` | `8788` | Порт HTTP |
| `STEM_PYTHON` | `python` / `python3` | Интерпретатор с demucs / basic-pitch |
| `STEM_DEMUCS_TIMEOUT_SEC` | `900` | Таймаут Demucs (Python) |
| `STEM_TRANSCRIBE_TIMEOUT_MS` | `600000` | Таймаут POST /transcribe (Node) |
| `STEM_MAX_UPLOAD_BYTES` | 80 МБ | Лимит загрузки |

В приложении: `EXPO_PUBLIC_STEM_URL=http://IP-ПК:8788/separate` (опционально; в Expo Go обычно подставляется IP Metro автоматически).

## API

### `GET /health`

```json
{
  "ok": true,
  "version": "2026-05-31-demucs-basicpitch-v1",
  "demucs": true,
  "basic_pitch": true,
  "python": "C:\\...\\python.exe"
}
```

Если `demucs: false` — в `demucsError` причина. Если `basic_pitch: false` — в `basicPitchError`.

### `POST /separate`

```json
{
  "audioBase64": "<base64>",
  "mode": "vocals" | "minus" | "all",
  "filename": "track.wav"
}
```

Ответ 200:

```json
{
  "ok": true,
  "engine": "demucs",
  "stems": [{ "id": "minus", "label": "Минус", "color": "#ff5252", "b64": "...", "sizeKb": 1234 }]
}
```

Ошибки: `503` + `DEMUCS_NOT_INSTALLED`, `500` + `DEMUCS_FAILED`, `413` TOO_LARGE.

### `POST /transcribe`

```json
{
  "audioBase64": "<base64>",
  "filename": "melody.wav"
}
```

Ответ 200:

```json
{
  "ok": true,
  "engine": "basic-pitch",
  "noteCount": 42,
  "notes": [{ "startMs": 120, "endMs": 380, "midi": 64, "amplitude": 0.71 }]
}
```

Ошибки: `503` + `BASIC_PITCH_NOT_INSTALLED`, `422` + `NO_NOTES`, `500` + `BASIC_PITCH_FAILED`.

## Windows — заметки

- Первый запуск Demucs/basic-pitch скачивает веса — нужен интернет.
- GPU необязателен; на CPU дольше.
- Если `python` не в PATH: `set STEM_PYTHON=C:\Users\you\...\venv\Scripts\python.exe` перед `npm run stems:dev`.
- Брандмауэр: разрешите входящие на порт **8788** в той же Wi‑Fi сети, что телефон с Expo Go.

## Честная политика

Сервер **не** отдаёт фейковые дорожки и **не** подставляет ноты: без Demucs — `503` на `/separate`; без basic-pitch — `503` на `/transcribe`. В приложении **DSP (демо)** остаётся офлайн; **Нейросеть (ПК)** и **Из файла** (Melody) — только при живом `/health`.
