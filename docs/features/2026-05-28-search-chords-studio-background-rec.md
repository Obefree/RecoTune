# Поиск каталога, честные аккорды, фоновая запись Studio

**Дата:** 2026-05-28  
**Зачем:** «веб-поиск» (MusicBrainz/metadata + SQLite) возвращал пусто или слабые совпадения; в списке и практике казалось, что таб «выдуман»; запись в Studio обрывалась при сворачивании приложения.

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/metadata/metadataDb.ts` | Поиск metadata через `LIKE` по `search_text`, без полного скана таблицы |
| `src/providers/registry.ts` | Мягче отсев fuzzy metadata (порог 12) |
| `src/utils/songContent.ts` | Сниппет только из `chords` или verified ChordPro; бейдж «прогрессия, не таб» |
| `src/utils/lyricsApi.ts` | lyrics.ovh — plain text, без `normalizeLyricsChords` |
| `src/screens/ChordsScreen.tsx` | Практика только `practiceLyricsDisplay` verified; НАЙТИ — plain text для ovh |
| `src/utils/recordingAudioMode.ts` | `staysActiveInBackground` + запись iOS/Android |
| `src/utils/studioAudioRouting.ts` | Режим записи через background audio mode |
| `src/screens/StudioScreen.tsx` | `AppState`, не гасить backing при уходе с таба во время REC; hint «запись в фоне» |
| `src/screens/RecorderScreen.tsx` | Тот же background audio mode при REC |
| `app.json` | `FOREGROUND_SERVICE_MICROPHONE` (Android) |

## Было → стало

| Было | Стало |
|------|--------|
| Metadata SQLite: все строки в RAM | `LIKE` по токенам, лимит кандидатов |
| Список: аккорды из неверифицированных `lyrics` | Только `chords` / verified; подпись «прогр.: …» |
| Практика: `normalizeLyricsChords` на любом тексте | Панель текста только verified (~32 builtin + AmDm) |
| НАЙТИ: ChordLyricsLine на lyrics.ovh | Plain text + тег «lyrics.ovh» |
| Studio REC: без `staysActiveInBackground` | Сессия записи держится в фоне; подсказка в UI |

## Что реально в каталоге

- **Таб (текст ✓):** ~32 встроенные с verified ChordPro + песни после AmDm (`custom_amdm_*`) / ручной ChordPro в «Мои».
- **Прогрессия, не таб:** строка аккордов в шапке (builtin ~450+), без поддельных строк текста.
- **Метаданные:** MusicBrainz / metadata — название и исполнитель для поиска; полный таб — «Подгрузить таб с AmDm» при `npm run dev-proxy`.

## Проверка

1. `node tools/chord-fetch/test-endpoint.mjs` — Creep 200, без HTML в начале.  
2. База песен: запрос «creep» / «кино» — metadata + builtin; бейджи «прогрессия, не таб» / «текст ✓».  
3. Studio: REC → свернуть приложение → таймер идёт, «запись в фоне»; STOP сохраняет дорожку.

## Фоновая запись (лимиты)

- **iOS:** `UIBackgroundModes: audio` + `staysActiveInBackground` — запись при свёрнутом приложении, пока система не убьёт процесс.  
- **Android:** permission `FOREGROUND_SERVICE_MICROPHONE`; на части OEM фоновый mic ограничен без отдельного foreground-service UI (Expo AV — best effort).  
- Пересборка native (`expo run:android` / `run:ios`) после смены `app.json`.
