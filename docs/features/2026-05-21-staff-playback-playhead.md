# Нотный стан: playhead и подсветка при PLAY

## Зачем

При воспроизведении мелодии пользователь видит, какая нота звучит сейчас, и вертикальную линию позиции — как в простом MIDI-редакторе.

## Файлы

| Файл | Изменения |
|------|-----------|
| `src/components/MelodyPlayerEngine.tsx` | `progress` / `noteStart` из WebView, интервал ~48 ms |
| `src/screens/MelodyScreen.tsx` | `playbackElapsedMs`, `playbackNoteIndex`, пропсы в `DualStaffView` |
| `src/components/DualStaffView.tsx` | playhead, зелёная подсветка, приглушённые прошедшие ноты |
| `src/utils/melodyPlayback.ts` | `getMelodyPlaybackTotalMs`, `buildStaffPlaybackTimings`, `staffIndicesPerPlaybackNote` |

## Было → стало

| Было | Стало |
|------|-------|
| Стан статичен при PLAY | Вертикальная линия `#00e676` движется по таймлайну |
| Нет связи звука и нот | Текущая нота подсвечивается; ранее сыгранные тусклее |
| Только `done` из плеера | `progress` + `noteStart` + `done` |

Playhead X строится из тех же `NOTE_SLOT` / `STAFF_LEFT`, что и головки нот; тайминги на стане — через `buildStaffPlaybackTimings` (учёт merge дублей < 50 ms).
