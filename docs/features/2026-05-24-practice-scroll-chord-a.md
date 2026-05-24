# Практика: свайп при выкл. авто + аккорд A

**Дата:** 2026-05-24  
**Файлы:** `src/screens/ChordsScreen.tsx`, `src/utils/chordLyricsNormalize.ts`, `tools/verify-chord-normalize.mjs`

## Зачем

1. При **выключенной** автопрокрутке палец по тексту/аккордам «залипал» — срабатывали лишние `scrollTo` (MIC-follow, `onContentSizeChange`, restore после layout).
2. Аккорд **A** терялся (путали с артиклем `a`) или был плохо читаем в `ChordLyricsLine`.

## Было → стало

| Область | Было | Стало |
|--------|------|--------|
| `scrollLyricsTo` | Всегда `scrollTo` | Без `force` — только при активной автопрокрутке (`autoScrollActiveRef`) |
| MIC-follow | Скролл при совпадении аккорда | Только если авто **вкл.** |
| `onContentSizeChange` | Всегда `scrollLyricsTo(y)` | Обновление высоты; `scrollTo` только при авто |
| `restoreLyricsScrollAfterLayout` | Всегда restore | Только при авто |
| Аккорды в строке | `unstable_pressDelay` | `delayPressIn`: 320 ms (авто выкл) / 140 ms (авто вкл) |
| Одиночные A–G | Узкий padding | `minWidth`, центрирование, chip-стиль |
| `isBareWordChordToken` | `A`/`a` в false-pos; только G–F | `a`/`i` — артикли; **A**–**G** как аккорды; строка только из аккордов — `chordLine` |
| Creep «a feather» | — | По-прежнему без `[a]` (`npm run verify-chord-normalize`) |

## Как проверить

См. шаги в ответе агента / релизные заметки.
