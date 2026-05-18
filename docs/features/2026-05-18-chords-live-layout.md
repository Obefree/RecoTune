# Chords: LIVE — компактная вёрстка и нижний док

**Дата:** 2026-05-18  
**Файл:** `src/screens/ChordsScreen.tsx`

## Задача

В режиме **LIVE** много пустого места, список аккордов сжат, кнопки **СТАРТ** / **В практику** в потоке flex конкурировали с таб-баром. Нужна та же идея, что в **практике**: основной контент на `flex:1`, управление — **док снизу** экрана Chords.

## Изменения

| Было | Стало |
|------|--------|
| Огромный аккорд (`chordBig` ~72) + вертикальный блок, кнопки в `liveActions` внутри колонки | Компактная строка: `liveChordHero` (~44) + мета справа (`liveTopCompact`) |
| `mainScreenColumn` только `paddingBottom` для practice | Для **live** тоже: `liveDockHeight` с `onLayout` нижнего дока |
| Кнопки внутри flex-колонки LIVE | Отдельный блок `mode === 'live'`: те же стили `practiceToolbarDockBar` + `practiceToolbarDockFixed`, строка `liveDockRow`, подсказка `liveDockHint` |
| `liveSegOuter` только `flex:1` | `minHeight: 0`, `flexGrow: 1`, `flexBasis: 0` — список реально забирает высоту |
| Список сегментов `ScrollView` без явного `minHeight` | `styles.liveSegScroll` (`flex:1`, `minHeight:0`) |

## Состояние

- `liveDockHeight` — измеряется с нижнего дока LIVE (как `practiceDockHeight` у практики).
