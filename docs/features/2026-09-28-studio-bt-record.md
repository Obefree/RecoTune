# Studio: запись через Bluetooth больше не даёт пустой файл

## Зачем

Выбор Bluetooth-микрофона поднимает SCO асинхронно. Прогрев минуса по A2DP сбрасывал гарнитуру, `MediaRecorder.start()` шёл в пустоту, Stop клал тихий/битый файл или ничего.

## Файлы

- `src/utils/studioAudioRouting.ts` — пауза после `setInput` для BT, пока текущий вход не совпадёт
- `src/screens/StudioScreen.tsx` — SCO после прогрева минуса; `voice_communication`; пустой файл не в сессию
- `src/screens/RecorderScreen.tsx` — то же для диктофона
- `src/utils/qualitySettings.ts`, `src/utils/playbackUri.ts`

## Было → стало

| Было | Стало |
|------|--------|
| `setInput` сразу, затем play минуса, затем REC | Прогрев минуса → SCO → REC → play |
| Пустой m4a как «дорожка» | Алерт: гарнитура не в SCO, в сессию не кладём |
| Источник Android `MIC` | Для BT — `voice_communication` |
