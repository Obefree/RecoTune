# AI Lab: Demucs на ПК + честные подписи DSP

**Дата:** 2026-05-31  
**Приоритет исследования:** P1 (сепарация) + P3 (UX)

## Зачем

Офлайн WebView в AI Lab — **DSP-демо** (фильтры, центр-канал), не нейросеть. Нужен честный путь «качество на ПК» через Demucs и явные подписи в UI.

## Файлы

| Область | Пути |
|---------|------|
| Сервер | `tools/stem-separate/` — `dev-proxy-server.mjs`, `demucs_run.py`, `requirements.txt`, `README.md` |
| Клиент | `src/providers/stemSeparateUrl.ts`, `stemSeparateClient.ts` |
| UI | `src/screens/AILabScreen.tsx` |
| npm | `stems:dev`, `test-stem-separate` в корневом `package.json` |

## Было → стало

| Было | Стало |
|------|--------|
| Только WebView DSP, подпись «офлайн-сепарация» | Переключатель **DSP (демо)** / **Нейросеть (ПК)** |
| Нет сервера | `POST :8788/separate`, `GET /health` с `demucs: true/false` |
| Ошибки Demucs не различались | `503 DEMUCS_NOT_INSTALLED`, без фейковых дорожек |
| «ВСЕ 5» всегда 5 полос | На нейросети **ОБА** = вокал + минус (Demucs two-stems) |

## Запуск на ПК

```powershell
cd tools\stem-separate
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
cd ..\..
npm run stems:dev
npm run test-stem-separate
```

В приложении: AI Lab → ДОРОЖКИ → **Нейросеть (ПК)** (если зелёная строка «Сервер: …»).

## P2 дальше

`GET /transcribe` → 501; мелодия — basic-pitch batch (отдельная задача).
