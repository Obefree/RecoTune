# Melody: двойной стан и воспроизведение с аккордами

**Дата:** 2026-05-21

## Зачем

Улучшить читаемость нот (скрипичный + басовый ключ, штиля, добавочные линии) и дать PLAY с подложкой аккордов, если аккорды подобраны или сохранены.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/components/DualStaffView.tsx` | Новый: два стана, 𝄞/𝄢, разделение по middle C (60), штили, ledger lines, символы аккордов |
| `src/components/MelodyPlayerEngine.tsx` | Payload `{ notes, chords }`, block chord pad (triangle, тише мелодии) |
| `src/utils/melodyPlayback.ts` | `startMs`, `MelodyPlaybackPayload`, сборка аккордных сегментов |
| `src/utils/melodyChords.ts` | `chordSymbolToMidiNotes`, `chordsFromAppliedSymbols` |
| `src/screens/MelodyScreen.tsx` | `DualStaffView`, PLAY с notes + chords |
| `src/i18n/strings.ts` | `melodyStaffBass` |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Нотный стан | Один скрипичный `SimpleStaffView` | `DualStaffView`: treble (midi ≥ 60), bass (&lt; 60) |
| Ноты | Круги без штилей | Овальные головки, штили вверх/вниз, ledger lines |
| PLAY | Только мелодия, массив `{midi, durationMs}` | `{ notes: [{midi, durationMs, startMs}], chords: [...] }` |
| Аккорды при PLAY | Не звучали | Block chord на каждый сегмент до следующей смены |
| Квантизация | Уже в playback notes | Без изменений: при Fit to key — quantized MIDI |

## Формат WebView

```json
{
  "notes": [{ "midi": 64, "durationMs": 420, "startMs": 0 }],
  "chords": [{ "symbol": "Am", "startMs": 0, "durationMs": 800, "midiNotes": [45, 48, 52] }]
}
```

VexFlow не добавлялся — отрисовка на `View` / `Text`.
