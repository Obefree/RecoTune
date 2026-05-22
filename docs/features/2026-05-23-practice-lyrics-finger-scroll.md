# Практика: надёжный свайп текста пальцем

**Дата:** 2026-05-23  
**Файл:** `src/screens/ChordsScreen.tsx`

## Зачем

После [2026-05-22-practice-lyrics-scroll-ux.md](./2026-05-22-practice-lyrics-scroll-ux.md) (commit `5180b5e`) ручная прокрутка текста на Android всё ещё могла «не цепляться»: жест перехватывали `TouchableOpacity` на аккордах, вложенный `ScrollView` панели, автопрокрутка продолжала `scrollTo` до `onScrollBeginDrag`, `minHeight` текста не учитывал верхнюю панель.

## Было → стало

| Область | Было | Стало |
|--------|------|--------|
| Верхняя панель при тексте | `ScrollView` с `scrollEnabled={false}` (nested coordinator на Android) | Обычный `View`; `ScrollView` только без текста |
| Аккорды в строках | `TouchableOpacity` без задержки | `delayPressIn={120}` — вертикальный свайп уходит в `ScrollView` |
| Авто vs палец | Стоп только в `onScrollBeginDrag` | `onTouchStart` + флаг `lyricsUserScrollRef`; интервал не вызывает `scrollTo` пока палец на тексте |
| MIC-follow scroll | Всегда `scrollTo` | Пропуск, пока пользователь трогает текст |
| Высота зоны текста | `minHeight` ~70% тела без вычета панели | `lyricsMinHeightFit` с резервом под бар + панель + BPM-строку |
| Lyrics `ScrollView` | Без явного `scrollEnabled` | `scrollEnabled`, `onScrollEndDrag` / `onMomentumScrollEnd`, `paddingBottom` под док |

Кнопки play/pause и BPM ±10 (44×44) из `5180b5e` — без изменений.

## Как проверить

1. Практика → песня с длинным текстом.
2. Автовкл **выкл** — свайп по тексту и по фиолетовым аккордам вверх/вниз.
3. Автовкл **вкл** — свайп: прокрутка останавливается, можно листать вручную; play снова — автопрокрутка.
4. Открытая верхняя панель — текст не «ленточка», скролл только у колонки текста.
5. Android + iOS.
