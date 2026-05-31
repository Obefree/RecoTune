# P6: НАЙТИ подсказки (этап B) + Studio routing

**Дата:** 2026-05-31

## Зачем

После P1–P5: честное «НАЙТИ» без облака давало только alert при слабом совпадении. Нужны **направляющие подсказки** (этап B roadmap) и **стабильнее маршрут звука** Studio/Recorder при возврате на вкладку.

## Файлы

| Область | Файлы |
|---------|--------|
| Анализ записи | `src/recognition/snippetAnalyzerHtml.ts`, `snippetAnalyzerBridge.ts`, `recordingSignals.ts` |
| Ранжирование | `src/recognition/localSongRecognizer.ts`, `types.ts` |
| UI НАЙТИ | `src/screens/ChordsScreen.tsx` |
| Studio routing | `src/utils/studioAudioRouting.ts`, `StudioScreen.tsx`, `RecorderScreen.tsx` |
| Сборка | `app.config.js`, `docs/BUILD-ANDROID.md` |

## Было → стало

| Было | Стало |
|------|--------|
| `snippet_saved` — только Alert, без кандидатов | До 6 **слабых** кандидатов + сводка BPM/тональность/напев; тап → открыть песню (не авто-match) |
| Поиск кандидатов только SQLite library | + `searchMetadataCatalog` при текстовом запросе / имени файла |
| Snippet analyzer: BPM + chroma | + `melodyMidi` (локальный pitch-track, до 24 нот) |
| Studio routing только при mount | При **focus** вкладки: `revalidateStudioRoutingOnFocus` — re-apply mode; BT/AUX → `system` если устройство отключено |
| Env для APK не документирован | `EXPO_PUBLIC_CHORD_FETCH_URL`, `EXPO_PUBLIC_STEM_SERVER_URL` в BUILD-ANDROID + `expo.extra` |

## Политика

- Без заглушек: подсказки явно помечены «не авто-распознавание».
- Авто-выбор песни — только прежний порог `isConfidentTopMatch`.

## Как проверить

1. **НАЙТИ → Запись:** напеть/сыграть 10 с известную песню из каталога — при слабом score: alert + блок «Подсказки по записи» (BPM/key, список).
2. **Файл** `Artist - Title.mp3` — подсказки по имени + metadata catalog.
3. **Studio:** manual BT → отключить BT → вернуться на Studio — выход сбрасывается на «Система», запись/прослушивание без зависшего маршрута.
4. Release doc: `docs/BUILD-ANDROID.md` — таблица env.
