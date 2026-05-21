# Melody: fit-to-key, chord strip, simple staff

## Зачем

Фаза 2 вкладки **Melody**: подгонка нот к тональности, подбор диатонических аккордов, лёгкий нотный стан без VexFlow. Без генерации минуса и импорта в Studio.

## Файлы

| Файл | Роль |
|------|------|
| `src/utils/melodyKeyQuantize.ts` | Snap к ближайшей ступени major/minor; «was X → Y» |
| `src/utils/melodyChords.ts` | 4–8 диатонических аккордов по окнам нот |
| `src/components/SimpleStaffView.tsx` | SVG-free staff: линии + круги-головки, аккорды сверху |
| `src/screens/MelodyScreen.tsx` | Toggle Fit to key, chords, staff, save |
| `src/utils/melodyStorage.ts` | `chords?`, `quantizedNotes?`, `updateMelodyFile` |
| `src/i18n/strings.ts` | EN/RU строки |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Тональность | только анализ KS-lite | + toggle **Fit to key**, последовательность под ключ |
| Аккомпанемент | Soon | полоска `Am · F · G · C`, римские опционально, **Apply chords** |
| Нотный стан | Soon | скрипичный staff, равный шаг по нотам, аккорды над сменами |
| JSON | `notes, key, bpm` | + `chords[]`, `quantizedNotes[]` |
| Кнопки Soon | staff/chords disabled | staff/chords активны; export/studio — Soon |

## Fit to key

Для каждой ноты: pitch class → ближайший тон гаммы (major или minor из `estimateKey`). Октава сдвигается только если snap > 6 полутонов. Список правок: `F#4 → G4`.

## Подбор аккордов

1. Мелодия делится на 4–8 окон (равное число нот).
2. В каждом окне считаются pitch classes и ступени гаммы.
3. Выбирается диатонический triad (I–vii° / i–VII) с макс. покрытием нот окна + бонусы: I в начале, I/V в конце.
4. Символы совместимы с `basicChordCatalog` (ASCII: `Am`, `F`, `Gdim`).

## Staff (v1)

- 5 линий, подпись «Treble», без знака ключа.
- `midi` → Y от нижней линии E4; C4 — ledger area.
- Ноты слева направо, **равный шаг** (не пропорционально времени).
- Фиолетовые головки = скорректированные под ключ.
- Аккорд над первой нотой сегмента при смене символа.

## Не в этой итерации

- Аудио-аккомпанемент / экспорт минуса
- Импорт в Studio (stub-кнопка)
- VexFlow, длительности, пропорциональный ритм на стане

## Связанные записи

- [2026-05-20-melody-recognition-page.md](./2026-05-20-melody-recognition-page.md) — фаза 1
