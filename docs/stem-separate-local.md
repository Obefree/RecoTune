# Stem separation (Demucs) — локальный прокси

Краткая ссылка из корня репозитория. Подробности: [tools/stem-separate/README.md](../tools/stem-separate/README.md).

## Команды

```bash
npm run stems:dev              # HTTP :8788
npm run test-stem-separate     # GET /health
npm run test-stem-separate -- --separate   # POST /separate (нужен Demucs)
```

## Переменные

- `EXPO_PUBLIC_STEM_URL` — полный URL `http://IP:8788/separate` (опционально)
- `STEM_PYTHON` — путь к Python с demucs (Windows)
- `STEM_SEPARATE_PORT` — порт (по умолчанию 8788)

## В приложении

AI Lab → вкладка **ДОРОЖКИ** → **Нейросеть (ПК)**. Без сервера доступен только **DSP (демо)**.
