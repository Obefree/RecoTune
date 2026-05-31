# Android: таб-бар посередине экрана (P7 regression)

## Зачем

На Android (release / Expo) нижняя половина экрана была белой, таб-бар «висел» по центру, особенно на вкладке Chords → Практика.

## Причина

В P7 `SnippetAnalyzerEngine` (hidden WebView) перенесли в `App.tsx` **соседом** `NavigationContainer` в колонке `flex: 1`. На Android WebView в flex-колонке забирает место в layout (~50% высоты), хотя стили `position: 'absolute'` — тот же класс бага, что уже описан в `ChordsScreen` (`hiddenWV` вне flex-соседей).

## Файлы

| Файл | Изменение |
|------|-----------|
| `App.tsx` | `NavigationContainer` в `navFill` с `flex: 1`; analyzer в `position: 'absolute'` overlay 1×1 |
| `src/components/SnippetAnalyzerEngine.tsx` | `left: -9999`, `pointerEvents="none"`, как `hiddenWV` на Chords |

## Было → стало

| | Было | Стало |
|---|------|--------|
| Корень `AppInner` | Nav + WebView — два flex-ребёнка | Nav на весь экран; WebView вне потока |
| Таб-бар | Середина экрана | Низ экрана + safe area |
| Нижняя зона | Белая ~50% | Контент на всю высоту сцены |
