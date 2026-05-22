# UX batch: 7 отчётов пользователя (2026-05-22)

**Зачем:** убрать dev-оверлеи, починить поиск/аккорды/НАЙТИ/сглаживание/мелодию без лишних настроек.

## Файлы

| Область | Файлы |
|---------|--------|
| Debug UI | `ChordsScreen.tsx`, `MelodyScreen.tsx`, `TunerEngine.tsx`, `useSungNoteHistory.ts` |
| Поиск | `searchSongsSmart.ts`, `registry.ts`, `ChordsScreen.tsx` (rank map, FlatList) |
| Аккорды в тексте | `chordLyricsNormalize.ts`, `chordProParse.ts`, `chordFetchProxy.ts`, `lyricsApi.ts` |
| Авто-табы | `providerSettings.ts`, `autoChordProxy.ts`, `chordFetchProxy.ts`, `ChordsScreen.tsx` |
| НАЙТИ | `ChordsScreen.tsx` (комментарии, кнопка базы, default mic) |
| Pitch | `TunerEngine.tsx`, `TunerScreen.tsx`, `MelodyScreen.tsx` |
| Melody контур | `melodyTranscription.ts`, `melodyPlayback.ts`, `useSungNoteHistory.ts` |

## Было → стало

| # | Было | Стало |
|---|------|--------|
| 1 | `__DEV__` chip на Melody, WebView мог перехватывать тапы | Chip убран; hidden WebView `pointerEvents:none`, `zIndex:-1`, off-screen |
| 2 | После поиска список снова сортировался по «богатству» builtin | Порядок `searchProviders`; quality только tie-break в smart search |
| 3 | `(Am)` и bare chords без скобок | `normalizeLyricsChords` в parse/fetch/load |
| 4 | ⚙ и выключенные amdm по умолчанию | Табы/lyrics auto; gear скрыт (long-press на заголовок базы) |
| 5 | Неясный НАЙТИ / мёртвый каталог | Комментарии в коде; кнопка «База в Практике»; default Запись |
| 6 | Рывки pitch | Медиана ring 9, мягче EMA (Tuner/Melody), WebView blend 42/58 |
| 7 | Контур: короткие ноты, расхождение с графиком | Длиннее сегменты, меньше merge; кадры по smoothed freq; PLAY floor 200 ms |

## Проверка

1. Chords → База: поиск «лето» — релевантные title/artist сверху, скролл списка.
2. Практика: выбор metadata-only песни → тихая подгрузка таба без ⚙.
3. Melody: режим контур — ноты на ленте ближе к линии графика; PLAY не «щелчки».
4. НАЙТИ: вкладки Запись/Файл/YouTube/Вручную + «База песен».
