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

- `src/utils/songContent.ts` — `isChordProVerified`, `hasVerifiedPracticeLyrics`, бейдж **текст ✓**
- `src/utils/chordLyricsNormalize.ts` — `isVerifiedChordProLyrics`, `cleanupVerifiedChordPro`, merge только при `allowMerge` / chord-line
- `tools/chord-fetch/amdmFetch.mjs` — полный ChordPro из `<pre>` (построчные `[Am]` с сайта)
- `src/providers/chordFetchProxy.ts` — кэш `fetch-amdm`, отказ от stub / короткого таба
- `src/screens/ChordsScreen.tsx` — `pickSong`, без lyrics.ovh в практике
- `src/db/songLibrary.ts` — `purgeUnverifiedMergedLyrics`, seed `2026-05-24-verified-chordpro-only`
- `src/data/songDatabase.ts` — поле `chordProVerified`

## Прокси для новых песен

На ПК в каталоге RecoTune: `npm run dev-proxy`. Телефон и ПК в одной Wi‑Fi; в приложении ⚙ → «Табы с AmDm» включены. После выбора песни без **текст ✓** таб подгружается автоматически или кнопкой «Подгрузить таб с AmDm».
