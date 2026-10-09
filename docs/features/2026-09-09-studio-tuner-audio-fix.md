# Studio/табы + эталон тюнера + компактный метроном

## Зачем

После перехода на SDK 57 часть экранов падала на `expo-audio` (запись/плей до load, probe входов). Эталон струн шёл через скрытый WebView — `injectJavaScript` не считается жестом, Web Audio часто молчал. Метроном занимал отдельную карточку.

## Файлы

- `src/utils/audio.ts` — WAV-синус/клик через `expo-audio`; wait-until-loaded; `file://` URI; flatten recorder options
- `src/utils/studioAudioRouting.ts` — probe в try/finally, безопасный список входов
- `src/screens/TunerScreen.tsx`, `StudioScreen.tsx`, `MelodyScreen.tsx`, `ChordsScreen.tsx`
- `src/components/MetronomeBar.tsx` — меньше кнопки, в существующие ряды
- `src/utils/playbackUri.ts` — **не** импортировать `expo-media-library` на старте: в Go нет `ExpoMediaLibraryNext`, из‑за этого падали Studio/Media, а после связки `audio.ts` → и Tuner

## Было → стало

| Было | Стало |
|------|--------|
| Studio/Media красный экран `ExpoMediaLibraryNext` | Альбом телефона — `expo-media-library/legacy` только при Save |
| Tuner «Element type is invalid» | Тюнер открывается: media-library не грузится при импорте экрана |
| Тап по струне без звука | Тап включает петлю эталона (ещё раз — стоп) |
| Метроном — большая карточка | Компактная полоска в шапке Studio / карточке струн / ряду PLAY |

`MelodyPlayerEngine` остаётся только для PLAY мелодии, не для клика и не для струн.
