# Expo Cloud Agent Environment Setup

**Дата:** 2026-08-17

## Зачем

Cloud Agent для RecoTune запускался без `.cursor/environment.json`, из-за чего новые агенты стартовали без установленных `node_modules` и без запущенного сервера Expo. Разработчик не мог сразу подключиться с телефона через Expo Go.

## Что изменилось

| Было | Стало |
|------|-------|
| Нет `.cursor/environment.json` | Есть `.cursor/environment.json` с `install` и `terminals` |
| `npm install` не запускался автоматически | `npm ci` выполняется при каждом старте агента |
| Expo сервер не запускался | Expo Metro server запускается на порту 8081 в терминале `expo` |
| Нет туннельного запуска | `npm run start:tunnel` — запуск с ngrok-туннелем для внешней сети |
| Нет хелпера для URL | `npm run expo:url` — печатает `exp://…` для Expo Go |

## Файлы

- `.cursor/environment.json` — конфигурация Cloud Agent окружения
- `scripts/print-expo-go-url.mjs` — утилита для получения `exp://` URL
- `package.json` — добавлены скрипты `start:tunnel`, `expo:url`; `@expo/ngrok` в devDependencies

## Детали

`.cursor/environment.json`:
```json
{
  "name": "RecoTune Expo",
  "install": "npm ci",
  "terminals": [
    { "name": "expo", "command": "npx expo start --port 8081" }
  ],
  "ports": [8081]
}
```

Для туннельного режима (подключение с телефона через мобильный интернет):
```bash
npm run start:tunnel
# затем в другом терминале:
npm run expo:url
```
