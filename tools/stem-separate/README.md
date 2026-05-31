# Stem separation (Demucs) — dev proxy

Локальный HTTP-сервер для **нейросетевого** разделения вокал/минус в AI Lab (RecoTune).

| Порт | Сервис |
|------|--------|
| **8788** | stem-separate (`POST /separate`) |
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

В другом терминале:

```powershell
curl http://127.0.0.1:8788/health
npm run test-stem-separate
npm run test-stem-separate -- --separate
```

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `STEM_SEPARATE_PORT` | `8788` | Порт HTTP |
| `STEM_PYTHON` | `python` / `python3` | Интерпретатор с установленным demucs |
| `STEM_DEMUCS_TIMEOUT_SEC` | `900` | Таймаут Demucs (Python) |
| `STEM_MAX_UPLOAD_BYTES` | 80 МБ | Лимит загрузки |

В приложении: `EXPO_PUBLIC_STEM_URL=http://IP-ПК:8788/separate` (опционально; в Expo Go обычно подставляется IP Metro автоматически).

## API

### `GET /health`

```json
{
  "ok": true,
  "version": "2026-05-31-demucs-v1",
  "demucs": true,
  "python": "C:\\...\\python.exe"
}
```

Если `demucs: false` — в `demucsError` причина (нет Python, не установлен пакет).

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

### `GET /transcribe`

Заглушка P2 (basic-pitch) → `501 NOT_IMPLEMENTED`.

## Windows — заметки

- Первый запуск Demucs скачивает веса (~сотни МБ) — нужен интернет.
- GPU необязателен; на CPU 3‑минутный трек может занять несколько минут.
- Если `python` не в PATH: `set STEM_PYTHON=C:\Users\you\...\venv\Scripts\python.exe` перед `npm run stems:dev`.
- Брандмауэр: разрешите входящие на порт **8788** в той же Wi‑Fi сети, что телефон с Expo Go.
- На CPU тяжёлые файлы (>20 МБ) — предупреждение уже есть в приложении.

## Честная политика

Сервер **не** отдаёт фейковые дорожки: без Demucs — `503` и понятный текст. В приложении режим **DSP (демо)** остаётся офлайн WebView; **Нейросеть (ПК)** — только при живом `/health` с `demucs: true`.
