# Ultimate Guitar через ultimate-api (sidecar)

## Зачем

Табы UG в dev-proxy: поиск остаётся в Node, разбор страницы таба — через vendored [joncardasis/ultimate-api](https://github.com/joncardasis/ultimate-api) (`GET /tab?url=...`), без дублирования HTML-парсера в `ugFetch.mjs`.

## Файлы

| Путь | Роль |
|------|------|
| `tools/ultimate-api/` | Flask sidecar (upstream + `ug_modern.py` для js-store) |
| `tools/chord-fetch/ultimateApiClient.mjs` | HTTP клиент, ChordPro-строки из JSON |
| `tools/chord-fetch/ugFetch.mjs` | Поиск UG → вызов ultimate-api по URL кандидата |
| `tools/chord-fetch/dev-stack.mjs` | Один запуск: API + прокси |
| `tools/chord-fetch/package.json` | `dev-stack`, `ultimate-api` |

## Было → стало

| | Было | Стало |
|---|------|--------|
| Таб UG | Прямой HTML/js-store в `ugFetch.mjs` | `ULTIMATE_API_URL` → Flask `/tab` |
| Запуск dev | `npm run dev-proxy` | **`npm run dev-stack`** (рекомендуется для UG) |
| Ошибка без API | — | «ultimate-api не запущен…» |

## Запуск

```powershell
cd tools\ultimate-api
py -3 -m venv venv
.\venv\Scripts\pip install -r requirements.txt
cd ..\chord-fetch
npm run dev-stack
```

Проверка Creep с ПК:

```powershell
curl -s -X POST http://127.0.0.1:8787/fetch -H "Content-Type: application/json" -d "{\"provider\":\"ultimate_guitar\",\"artist\":\"Radiohead\",\"title\":\"Creep\"}"
```

## Ограничения

- **Python 3.10+** обязателен для UG.
- **Поиск** только в Node; ultimate-api не ищет по названию.
- **Cloudflare** может блокировать и поиск, и `/tab` с вашего IP (HTTP 503, короткий текст в приложении).
- Upstream-парсер `<pre class="js-tab-content">` устарел; в vendored копии приоритет **js-store** (`server/ug_modern.py`).
