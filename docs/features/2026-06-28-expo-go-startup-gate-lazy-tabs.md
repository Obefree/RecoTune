# Expo Go: gate вместо синего экрана + lazy tabs

Дата: 2026-06-28

## Симптом

Metro + QR OK, бандл грузится долго, затем **синий/красный экран** в Expo Go.
`expo export` и `tsc` чистые — рантайм-краш при инициализации модулей.

## Причины (две, обе уже встречались)

| # | Ошибка | Когда | Фикс |
| --- | --- | --- | --- |
| 1 | `expo-font` 55.x vs SDK 54 | Ionicons на первом кадре | `expo-font ~14.0.12` (коммит 49cd6de) |
| 2 | `native module 'ExponentAV' doesn't exist` | Expo Go **SDK 55+** (expo-av убран из Go; в SDK 54 ещё есть) | Gate + lazy tabs (этот коммит) |

`App.tsx` статически тянул `TunerScreen` → `import { Audio } from 'expo-av'` →
`ExponentAV.js` делает `requireNativeModule('ExponentAV')` **синхронно** при загрузке графа.

## Фикс

1. `src/utils/expoAvAvailable.ts` — `requireOptionalNativeModule('ExponentAV')` до импорта экранов.
2. Если модуля нет → `ExpoAvRequiredScreen` (честный текст + шаги dev build), **без** fake-табов.
3. Если есть → табы через `React.lazy()` + `Suspense`, expo-av грузится только после проверки.
4. `RecoTune.bat` / `Desktop\RecoTune.bat`: `npx expo start -c`, порт **8081**, **без** `--offline` по умолчанию.

## Было → стало

| | Было | Стало |
| --- | --- | --- |
| Expo Go SDK 55+ | Синий экран `ExponentAV doesn't exist` | Экран с инструкцией dev build |
| Expo Go SDK 54 | Должен стартовать (expo-av + font 14.x) | То же + lazy tabs |
| Bat | `--offline -c --port 8088` | `-c` на 8081 |

## Файлы

- `App.tsx`, `src/utils/expoAvAvailable.ts`, `src/screens/ExpoAvRequiredScreen.tsx`
- `RecoTune.bat`, `Desktop\RecoTune.bat`
