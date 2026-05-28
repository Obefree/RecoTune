# Фоновая запись v2 и ползунок перемотки

**Дата:** 2026-05-28  
**Зачем:** после `7c9e8c5` запись в Studio/Recorder всё ещё обрывалась при смене приложения; ползунок дёргался и отскакивал к началу.

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/utils/recordingAudioMode.ts` | `shouldDuckAndroid: false` |
| `src/hooks/useRecordingBackground.ts` | keep-awake, AppState active/background, guard по `isDoneRecording`, предупреждение Expo Go |
| `src/components/SeekBar.tsx` | `dx`-scrub, seek до `onScrubEnd`, шаг 100 ms |
| `src/screens/StudioScreen.tsx` | хук фона, `stoppingRecRef`, интервал статуса 100 ms |
| `src/screens/RecorderScreen.tsx` | то же + hint «запись в фоне» |
| `src/screens/PlayerScreen.tsx` | `progressUpdateIntervalMillis: 100`, позиция с шагом 0.1 с |
| `package.json` | `expo-keep-awake` |

## Было → стало

| Было | Стало |
|------|--------|
| `onScrubEnd` до `onSeek` — статус сбрасывал thumb | Сначала `await onSeek`, потом resume |
| `locationX` на move — неточный scrub | `grantX + gestureState.dx` |
| Только re-apply audio в `background` | Повтор при `active` + keep-awake на время REC |
| Duck Android при записи | `shouldDuckAndroid: false` |
| Обрыв mic без сообщения | Alert «Запись прервана» + совет dev build |
| Play all / player без интервала 100 ms | `progressUpdateIntervalMillis: 100` |

## Пересборка

- **Expo Go:** фоновый mic ограничен — при старте REC показывается предупреждение.
- **Dev build:** после `app.json` / native permissions — `npx expo run:android` или `run:ios` (не обязательно для JS-only правок SeekBar, но для фона mic — да).

## Проверка

1. **Studio:** REC → Home / другое приложение → таймер идёт, «запись в фоне» → STOP → дорожка в сессии.
2. **Recorder:** то же + воспроизведение записи.
3. **Ползунок:** Player / Recorder / Studio solo / Play all — перетащить без отскока; отпустить — позиция совпадает с воспроизведением.
4. **Expo Go:** при REC — диалог про ограничение; при убийстве mic — alert «Запись прервана».
