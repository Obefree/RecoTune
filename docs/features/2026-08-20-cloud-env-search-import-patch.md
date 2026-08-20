# Cloud Agent env: чистая установка + починка поиска аккордов

**Дата:** 2026-08-20

## Зачем

Настройка окружения RecoTune для Cloud Agent (headless VM) выявила две проблемы, ломавшие end-to-end запуск:

1. `npm install` завершался с ненулевым кодом — `patch-package` не мог применить устаревший патч `react-native-music-control`.
2. `POST /search` у chord-fetch прокси (и того же кода на Vercel) падал с `searchUgByQuery is not defined`, когда провайдеры включали `ultimate_guitar` (это дефолт).

## Какие файлы

- `patches/react-native-music-control+1.4.1.patch` — перегенерирован.
- `tools/chord-fetch/chordSearch.mjs` — добавлен недостающий импорт.

## Было → стало

| Место | Было | Стало |
|-------|------|-------|
| `patches/react-native-music-control+1.4.1.patch` | Первый hunk (`import androidx.core.content.ContextCompat;`) уже присутствует в опубликованном `react-native-music-control@1.4.1`, поэтому весь патч отклонялся → `postinstall`/`npm install` падал | Патч содержит только актуальный hunk (`registerReceiver` с `RECEIVER_NOT_EXPORTED` для SDK 33+); применяется чисто, `npm install` идемпотентен и завершается кодом 0 |
| `tools/chord-fetch/chordSearch.mjs` | `searchUgByQuery(q)` вызывался без импорта → `ReferenceError`, любой `/search` с дефолтными провайдерами (`amdm` + `ultimate_guitar`) возвращал `{ "error": "searchUgByQuery is not defined" }` | Добавлен `import { searchUgByQuery } from './ugFetch.mjs';`; функция уже экспортировалась из `ugFetch.mjs` — поиск отрабатывает end-to-end |

## Проверка

- `npm install` дважды подряд → exit 0, оба патча (`expo-av`, `react-native-music-control`) применяются.
- Все `npm run verify-*` (11 скриптов) — OK.
- Прокси `:8787`: `GET /health` (2621 песен в parsed-store), `POST /fetch` (реальный ChordPro), `POST /search` с дефолтными провайдерами — результаты без краша.
- `npm run test-chord-fetch` против `:8787` — 3/3 кейса 200.
