# Android 14+: краш при registerReceiver (RemoteException)

## Зачем

На Android 14+ (targetSdk 34) приложение падало при старте или при первом аудио/lock-screen с `RemoteException` → `registerReceiverWithFeature` / `SecurityException`: не указан флаг `RECEIVER_EXPORTED` / `RECEIVER_NOT_EXPORTED`.

## Причина

С Android 14 динамическая регистрация `BroadcastReceiver` требует явного флага экспорта. В RecoTune два нативных модуля регистрировали ресиверы по-старому:

| Модуль | Когда срабатывает | Файл |
|--------|-------------------|------|
| `react-native-music-control` | `initMediaRemoteControls()` в `App.tsx` при старте → `MusicControlModule.init()` | `MusicControlModule.java:204` |
| `expo-av` | загрузка `AVManager` (любой таб с `Audio` / тюнер / Studio) | `AVManager.java:136` |

Стек из скриншота (`MessageQueueThreadHandler` → `BroadcastController.registerReceiverWithFeatureTraced`) типичен для этого класса ошибок.

RN 0.81 / Expo SDK 54 уже патчат DevSupport; **сторонние** модули — нет.

## Фикс

`patch-package` + `postinstall`:

- `patches/react-native-music-control+1.4.1.patch` — `ContextCompat.registerReceiver(..., RECEIVER_NOT_EXPORTED)`
- `patches/expo-av+16.0.8.patch` — то же для `ACTION_AUDIO_BECOMING_NOISY`

Флаг `RECEIVER_NOT_EXPORTED`: ресиверы только внутри приложения (уведомление media control, отключение наушников).

## Файлы

| Файл | Изменение |
|------|-----------|
| `package.json` | `patch-package` devDep, `"postinstall": "patch-package"` |
| `patches/*.patch` | патчи двух модулей |

## Было → стало

| | Было | Стало |
|---|------|--------|
| Старт APK на Android 14+ | Краш при init media control / expo-av | Старт без SecurityException |
| `registerReceiver` | без флага (API &lt; 34) | `ContextCompat.registerReceiver` + `RECEIVER_NOT_EXPORTED` |

## Пересборка

```bat
cd RecoTune
npm install
npm run prebuild:android:clean
npm run build:android:release
```

После `npm install` `postinstall` автоматически накатывает патчи.

## Связанное

- Layout fix e25715a (таб-бар) — уже в `main`, отдельная проблема.
- Expo SDK 54 / `expo-audio` migration — отдельный backlog; патч `expo-av` актуален пока модуль в зависимостях.
