# Chords: этап A — после «НАЙТИ» текст + аккорды из каталога

**Дата:** 2026-05-19  
**Файлы:** `src/screens/ChordsScreen.tsx`, `src/utils/auddApi.ts`, `src/utils/songMatch.ts`

## Что сделано

| Было | Стало |
|------|--------|
| AudD только `test`, без `return` | `auddApi.ts`: `return=apple_music,spotify,lyrics`, токен `EXPO_PUBLIC_AUDD_TOKEN` |
| Текст только lyrics.ovh | Сначала **AudD lyrics**, затем **lyrics.ovh** |
| После распознавания — только текст | Поиск в **каталоге RecoTune** (`findBestSongMatch`) → блок **АККОРДЫ**, бейдж «В библиотеке» |
| «В Практику» без аккордов | **«В практику с аккордами»** — подставляет progression + текст |

## LIVE (доработка в том же коммите)

| Параметр | Было | Стало |
|----------|------|--------|
| `STABLE_NEED` | 16 | **18** |
| `MIN_CONF` | 0.45 | **0.46** |
| `MIN_CHROMA_SUM` | 0.32 | **0.34** |
| Onset | ×2.2 | **×2.5** (меньше ложных сбросов на шуме) |
| Дисплей | мигание `?` | **DISPLAY_HOLD 5** — кратко держим последний аккорд |

## Токен AudD

В `.env` (не в git): `EXPO_PUBLIC_AUDD_TOKEN=ваш_ключ`

Без него остаётся `test` (малый дневной лимит).

## Дальше по очереди

- **B** — напой → ноты (локально)  
- **C** — ShazamKit  
- **D** — ACRCloud humming  

См. [2026-05-19-roadmap-queue.md](./2026-05-19-roadmap-queue.md)
