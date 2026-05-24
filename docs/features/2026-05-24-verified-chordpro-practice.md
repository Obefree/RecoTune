# Практика: только проверенный ChordPro (без склейки)

**Дата:** 2026-05-24  
**Зачем:** в режиме практики показывать аккорды **построчно с сайтов (AmDm)** или из **~32 builtin** с реальным ChordPro — не эвристику «прогрессия + текст».

## Было → стало

| Было | Стало |
|------|--------|
| `LYRICS_DB` и `projectChordsOntoLyrics` подставляли `[G]` на plain-текст | Текст в практике только при `chordProVerified` (builtin / AmDm / ручной ChordPro в «Мои») |
| `mergeChordLineAboveLyric` всегда в `normalizeLyricsChords` | Слияние строк выключено по умолчанию (`allowMerge` только для opt-in) |
| Песни «прогрессия» показывали склеенный таб | Только аккорды в шапке + подсказка «Подгрузить таб с AmDm» |
| Бейдж «аккорды ✓» | **текст ✓** / **прогрессия** |
| lyrics.ovh в авто-обогащении практики | Убрано из `enrichSongForPractice` |
| SQLite с фейковыми `[Am]` на user/meta | `purgeUnverifiedMergedLyrics` при init |

## Файлы

- `src/utils/songContent.ts` — `isChordProVerified`, `hasVerifiedPracticeLyrics`
- `src/utils/chordLyricsNormalize.ts` — `allowMerge` default false
- `src/screens/ChordsScreen.tsx` — `pickSong`, бейджи, без `projectChordsOntoLyrics`
- `src/db/songLibrary.ts` — purge, seed version bump
- `src/data/songDatabase.ts` — поле `chordProVerified`

## Прокси для новых песен

На ПК в каталоге RecoTune: `npm run dev-proxy`. Телефон и ПК в одной Wi‑Fi; в приложении ⚙ → «Табы с AmDm» включены. После выбора песни без **текст ✓** таб подгружается автоматически или кнопкой «Подгрузить таб с AmDm».
