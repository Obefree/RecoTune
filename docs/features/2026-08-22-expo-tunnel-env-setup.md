# Dev / Cloud env: Expo tunnel + environment.json

**Дата:** 2026-08-22

## Зачем

Cloud Agent запускается без `.cursor/environment.json` в репозитории — среда каждый раз поднимается из dashboard-managed конфига. Цель: зафиксировать конфиг в репозитории, добавить туннель для Expo Go с любого IP.

## Какие файлы

- `.cursor/environment.json` — конфиг окружения (npm ci, два терминала: chord-proxy + expo на 8081, порты 8081/8787).
- `scripts/print-expo-go-url.mjs` — читает Metro manifest, печатает `exp://` URL.
- `package.json` — добавлены скрипты `start:tunnel` и `expo:url`; devDep `@expo/ngrok@^4.1.3`.

## Было → стало

| Аспект | Было | Стало |
|--------|------|-------|
| `environment.json` | отсутствовал в репо | `.cursor/environment.json`: `npm ci`, терминалы `chord-proxy` + `expo` (без `--offline`) |
| Expo Go URL | только `exp://127.0.0.1:8081` (локальный) | `npm run expo:url` → печатает актуальный `exp://` с tunnel-хостом |
| Туннель | не настроен | `npm run start:tunnel` запускает expo с `@expo/ngrok` |
| `scripts/` | нет | `scripts/print-expo-go-url.mjs` |
