# Практика: стабильный свайп текста (Android)

**Дата:** 2026-05-24  
**Файл:** `src/screens/ChordsScreen.tsx`

## Зачем

После [2026-05-23-practice-lyrics-finger-scroll.md](./2026-05-23-practice-lyrics-finger-scroll.md) на Android оставались жалобы: прокрутка «залипает», скачок в начало, иногда не листается в одну из сторон. Меню и модалки скроллились нормально — только колонка **ТЕКСТ + АККОРДЫ**.

## Корневая причина

1. **`onTouchStart` / `onTouchEnd` на родительском `View` вокруг `ScrollView`** — на Android родитель забирал responder до начала жеста прокрутки; `ScrollView` не получал стабильный drag → рывки, блок одного направления.
2. **`stopAutoScroll()` при каждом касании** — лишний `setState` в начале жеста; вместе с пересчётом `minHeight` мог сбрасывать offset.
3. **Автопрокрутка** — `scrollYRef += 1.2` без clamp и рассинхрон с `contentOffset`; повторный play всегда сбрасывал в 0.
4. **`onMomentumScrollBegin` → тот же handler, что и drag** — лишняя пауза при инерции.

## Было → стало

| Область | Было | Стало |
|--------|------|--------|
| Обёртка текста | `onTouchStart` / `onTouchEnd` / `onTouchCancel` | Только `onLayout` (с debounce высоты) |
| Стоп авто при свайпе | `onTouchStart` + `onScrollBeginDrag` + `onMomentumScrollBegin` | Только `onScrollBeginDrag`; пауза интервала без лишних touch-хендлеров |
| Авто-интервал | `scrollYRef += 1.2` | `min(maxY, scrollYRef + 1.2)` + sync из `onScroll` |
| Play после ручного стопа | Всегда `scrollTo(0)` | В начало только если уже внизу списка |
| Аккорды в строке | `TouchableOpacity` delay 120 ms | `Pressable` delay 200 ms |
| Смена панели / `minHeight` | Сброс offset | `restoreLyricsScrollAfterLayout` по сохранённому `scrollYRef` |

Кнопки play/pause и BPM ±10 (44×44) из `5180b5e` — без изменений.

## Как проверить

1. Практика → длинный текст с аккордами.
2. Авто **выкл** — свайп вверх/вниз по тексту и по фиолетовым аккордам; без скачка в начало.
3. Авто **вкл** — свайп: прокрутка останавливается, позиция сохраняется; play снова — продолжение с места (не с верха, если не в конце).
4. Свернуть/развернуть верхнюю панель — позиция текста не обнуляется.
5. Android (основной кейс) + iOS.
