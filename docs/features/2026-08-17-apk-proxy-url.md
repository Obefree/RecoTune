# APK: тот же прокси, что в Expo Go

**Дата:** 2026-08-17 · **Файлы:** `ChordsScreen.tsx`, `chordFetchUrl.ts`, `app.config.js`

## Зачем

Expo Go подставляет `:8787` с Metro. Release APK Metro не видит — URL надо сохранить вручную или зашить HTTPS.

## Было → стало

| Было | Стало |
|------|--------|
| Поле URL спрятано в advanced | Поле в блоке «Прокси на ПК», сохраняется на диск (`chordFetchProxyUserSet`) |
| `extra.chordFetchUrl` в сборке, приложение читало `chordFetchApiUrl` | Оба ключа, env `EXPO_PUBLIC_CHORD_FETCH_URL` попадает в APK |

Expo Go и APK — **разные** песочницы: URL из Go сам в APK не переносится.

**Держать сервер:** `RecoTune.bat` (прокси detached на `:8787`). ПК в сети, окно можно свернуть. Для телефона вне дома — HTTPS (Vercel `api/fetch-chords` или VPS с `dev-proxy-server.mjs`), тот же URL в ⚙.
