# Chords: wrong tabs (Fix You) + UI back/layering

**Дата:** 2026-07-26 · **Файлы:** `chordLyricsNormalize.ts`, `songContent.ts`, `songMatch.ts`, `ChordsScreen.tsx`, `App.tsx`, `tools/lib/chordNormalize.mjs`, `tools/verify-song-content.mjs`

## A) Случайные / неверные аккорды (Fix You и др.)

### Симптом

Песни вроде **Fix You (Coldplay)** показывали «левый» набор аккордов или мусорный таб; то же на других треках из каталога.

### Корень

1. **ASCII/tab-архивы** (PLEASE NOTE, Band:/Song:, OLGA) проходили `isVerifiedChordProLyrics` — в pesni bundle **49** таких записей (напр. `pesni_ru_a-ghost`).
2. **`enrichSongForPractice`** искал таб через `findBestSongMatch` по **всем** строкам каталога — возможна подмена metadata-песни чужим verified-табом при частичном совпадении title/artist.
3. **`BUILTIN_VERIFIED_IDS`** помечал **все** seed-песни verified, даже progression-only.
4. Fallback **`C G Am F`** при пустой прогрессии — fake chords (D8).

### Что сделано

| Было | Стало |
|------|-------|
| Tab-дампы проходят verify | `isTabArchiveDumpLyrics` → отказ в `isVerifiedChordProLyrics` / ingest |
| Fuzzy match по всему каталогу | `findVerifiedCatalogMatch` + `findBuiltinVerifiedMatch` (title+artist, только verified) |
| Все seed = verified | `BUILTIN_VERIFIED_IDS` только с прошедшим verify lyrics |
| Пустая прогрессия → `C G Am F` | Честная пустая прогрессия + hint / auto-fetch |

**Fix You:** builtin `s015` (Coldplay) — verified ChordPro; strict match score 150. Тест: `npm run verify-song-content`.

## B) UI: layering, back, nav bar

### Симптом

- Практика «просвечивала» под модалкой списка.
- Back иногда возвращал ghost chord view.
- Android system nav смешивался с tab bar.

### Корень

- Practice + dock рендерились **под** `Modal` (`showLibrary`) → двойной слой.
- `useFocusEffect` принудительно закрывал библиотеку при `practiceSong` → гонка с back/open.
- `hasLyricsBody` по сырому `practiceLyrics`, не по verified display → лишний immersive layout.

### Что сделано

| Было | Стало |
|------|-------|
| Practice всегда под Modal | `{mode === 'practice' && !showLibrary && …}` — один слой |
| focus → force close library | Initial open once; back: clear + open list одним шагом |
| Immersive по raw lyrics | `hasLyricsBody` = `practiceLyricsDisplay` |
| Root без фона | `App.tsx` root/navFill `backgroundColor: DARK_BG` |

## Проверить на устройстве

1. Fix You → текст Coldplay, прогрессия C Em Am F (не мусор pesni ghost).
2. Metadata-only песня без таба → hint, без fake C G Am F.
3. Песня → Back → сразу список, без ghost overlay.
4. Библиотека открыта → практика не видна сзади.
5. Android: tab bar + system nav без двойной полосы.
