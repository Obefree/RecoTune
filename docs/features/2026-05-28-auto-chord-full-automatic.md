# Полностью автоматическая подгрузка табов

## Зачем

Пользователь не хочет вручную настраивать ⚙, запускать dev-proxy или выбирать источник. Нужен сценарий «открыл приложение → выбрал песню → таб подгрузился».

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/providers/onDemandChordAuto.ts` | GET /health probe (~3.5 с), цепочка AmDm → UG → pesni.ru; короткое «Не найдено» |
| `src/providers/chordFetchProxy.ts` | `isChordFetchProxyReachable`, `quiet` для POST без длинных ошибок |
| `src/providers/chordFetchUrl.ts` | обновлён hint, `CHORD_FETCH_DEV_PROXY_CMD` → `npm run chords:dev` |
| `src/providers/providerSettings.ts` | комментарий: pesni — silent fallback в auto |
| `App.tsx` | `ensureAutoChordProxySettings()` при старте |
| `src/screens/ChordsScreen.tsx` | упрощён ⚙, расширенные настройки свёрнуты |
| `tools/chord-fetch/chords-dev.mjs` | **новый** — проверка :5000/:8787, spawn dev-stack |
| `package.json` | `chords:dev`, `npm start` поднимает stack автоматически |

## Было → стало

| Было | Стало |
|------|--------|
| Ручной «Подставить авто» в ⚙ | URL прокси подставляется при старте (Metro / env) |
| `npm run dev-proxy` вручную | `npm start` или `npm run chords:dev` поднимает stack |
| pesni.ru только если включён | В режиме **авто** — тихий последний fallback с телефона |
| Долгий hang при недоступном прокси | Probe /health ~3.5 с → сразу pesni.ru |
| Длинные ошибки про dev-proxy | Спиннер + «Не найдено» |

## Ограничения

AmDm и Ultimate Guitar по-прежнему требуют прокси (ПК или деплой `EXPO_PUBLIC_CHORD_FETCH_URL`). Без сервера работает только pesni.ru — честно, без заглушек.
