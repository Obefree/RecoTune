# Видеоплеер: scrub, один слой контролов, fullscreen

**Дата:** 2026-05-28  
**Зачем:** ползунок дёргался, неудобно перематывать пальцем, в fullscreen мешали верхние вкладки Media и дублировались контролы.

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/screens/VideoScreen.tsx` | один `<Video>`, общий `SeekBar`, `videoSeekingRef`, `progressUpdateIntervalMillis: 100` |
| `src/components/SeekBar.tsx` | без изменений (тот же паттерн, что Player/Studio) |
| `src/context/TabBarVisibility.tsx` | `mediaSegHidden` — скрыть ЗАПИСЬ/ПЛЕЕР/ВИДЕО в fullscreen |
| `src/screens/MediaScreen.tsx` | не рендерить seg bar при `mediaSegHidden` |

## Было → стало

| Было | Стало |
|------|--------|
| В fullscreen второй `<Video>` + два `onPlaybackStatusUpdate` | Один экземпляр, shell меняет layout |
| Свой PanResponder: `setPositionAsync` на каждый move + статус в `setPos` | `SeekBar`: локальный thumb, seek на release, `videoSeekingRef` |
| `locationX` без `dx` на move | `grantX + gestureState.dx` (как в SeekBar) |
| Seg bar Media поверх fullscreen | `setMediaSegHidden(true)` + tab bar уже скрывался |
| Двойная отрисовка полосы (bg + fill + thumb вручную) | Один `SeekBar` |

## Проверка на устройстве

1. **Media → ВИДЕО:** выбрать файл, воспроизвести — время и ползунок плавные (шаг ~0.1 с).
2. **Scrub:** потянуть ползунок — thumb следует за пальцем; отпустить — позиция совпадает, без отскока.
3. **Fullscreen:** expand — нет вкладок ЗАПИСЬ/ПЛЕЕР/ВИДЕО и нижнего tab bar; один ряд контролов; выход contract.
4. **Тап-зоны:** ±10 с по краям, центр — показать контролы (в fullscreen автоскрытие через 3.5 с).
