# НАЙТИ: локальное распознавание, AudD удалён

**Дата:** 2026-05-22  
**Зачем:** свой механизм поиска песни без стороннего music-ID API (AudD).

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/recognition/*` | Модуль `SongRecognizer`, сигналы, сниппеты записи |
| `src/utils/lyricsApi.ts` | Текст через lyrics.ovh (вынесено из auddApi) |
| `src/screens/ChordsScreen.tsx` | НАЙТИ: каталог, запись/файл без облака |
| `src/providers/registry.ts`, `types.ts` | Провайдер `audd` удалён |
| Удалено | `src/utils/auddApi.ts`, `src/providers/auddProvider.ts` |

## Было → стало

| Было | Стало |
|------|--------|
| Мик/файл → `api.audd.io`, токен `EXPO_PUBLIC_AUDD_TOKEN` | Запись копируется в `recognition_snippets/`; сопоставление по звуку — roadmap |
| НАЙТИ без офлайн-поиска в UI | Вкладка **Каталог** — `searchSongsSmart` / SQLite |
| AudD lyrics + ovh | Только каталог + lyrics.ovh |
| Провайдер `audd` в настройках | Убран |

## FIND сейчас

1. **Каталог** — умный офлайн-поиск (встроенные + «Мои»).
2. **Запись / Файл** — сохранение сниппета; при совпадении сигналов — результат, иначе подсказка → каталог/вручную.
3. **YouTube** — oEmbed (название/автор), без AudD.
4. **Вручную** — artist/title + lyrics.ovh + сопоставление с каталогом.

## Roadmap (`src/recognition`)

Сигналы: text, melody, tempo, chords, voice, language, style, instruments. Сейчас wired: text, chords, bpm; melody — hook; audio fingerprint — после анализа сниппетов.
