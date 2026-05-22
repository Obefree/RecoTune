# Авто-прокси табов и нейтральный UI

## Зачем

Пользователь не должен вручную вводить IP ПК и видеть технические имена (AmDm, UG, URL прокси). Expo Go уже знает IP Metro — тот же компьютер, что и `dev-proxy`.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/providers/autoChordProxy.ts` | IP из `Constants.expoConfig.hostUri` / `manifest2` / legacy manifest / `linkingUrl` → `http://host:8787/fetch`, включение `amdm` |
| `src/screens/ChordsScreen.tsx` | Вызов `ensureAutoChordProxySettings` при старте библиотеки, настройках, тихой подгрузке; UI без URL и AmDm |
| `src/providers/types.ts`, `chordFetchProxy.ts`, attribution | Подписи «Табы онлайн», «Таб из интернета» |

## Было → стало

| Было | Стало |
|------|--------|
| Ручной URL `http://192.168.x.x:8787/fetch` в настройках | Автозаполнение при Expo Go (тот же host, что Metro) |
| Подписи AmDm / UG / прокси в UI | «Табы онлайн», «Подгрузить таб», подсказка без URL |
| `dev · seed minimal` в шапке | Убрано |

## Пользователь по-прежнему

На ПК в `tools/chord-fetch`: `npm run dev-proxy` (порт 8787), телефон и ПК в одной Wi‑Fi.
