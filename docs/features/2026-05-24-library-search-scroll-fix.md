# База: релевантный поиск; Практика: стабильный свайп текста

**Дата:** 2026-05-24  
**Файлы:** `src/screens/ChordsScreen.tsx`, `src/providers/registry.ts`

## Зачем

1. **Поиск:** вверху списка появлялись нерелевантные песни (порядок каталога / дубли metadata), пока догружался «умный» поиск.
2. **Практика:** свайп по тексту+аккордам по-прежнему «залипал» — `scrollTo` при смене нормализованного текста, `Pressable` на аккордах, RN `ScrollView`.

## Корневые причины

| # | Область | Причина |
|---|---------|---------|
| A | Поиск | Мгновенный `filterSongsQuick(librarySongs)` → порядок **каталога** (builtin сверху), не score; промежуточный `searchSongsSmart` без metadata; fallback снова `filterSongsQuick`; metadata merge с `+6` до сортировки; дубли по разным `id` при одном title+artist |
| B | Свайп | `useEffect([practiceLyricsDisplay])` вызывал `scrollLyricsTo(0, force)` при **выкл.** авто; `Pressable` на каждом аккорде перехватывал жест; обычный RN `ScrollView` |

## Было → стало

| Область | Было | Стало |
|--------|------|--------|
| Поиск (UI) | 3 фазы: quick → smart → providers | Одна фаза: `searchProviders`, спиннер, без preview |
| Дедуп | По `song.id` | По `combinedArtistTitle(artist, title)` |
| Metadata | Merge до SQLite hits, `score + 6` | После smart hits; слабые meta (`score < 35` без link) отбрасываются |
| Свайп / normalize | `scrollTo(0)` на каждый `practiceLyricsDisplay` | Сброс offset только при смене `practiceSong.id` |
| ScrollView практики | `react-native` | `react-native-gesture-handler` |
| Аккорды в строке | `Pressable`, hitSlop 4 | `GestureTouchableOpacity`, `pointerEvents="box-none"`, delay 420 ms (авто выкл) |
| Подгрузка таба | `scrollLyricsTo(..., force)` | Прямой `scrollTo` на ref |

## Как проверить

1. **Поиск:** Chords → Практика → База → ввести «кино» / «radiohead» — сверху точные совпадения, без пачки чужих builtin; нет «прыжка» списка при догрузке.
2. **Раскладка:** запрос в EN-раскладке для русского названия — варианты в выдаче, но не вытесняют exact match.
3. **Дубли:** одна строка на пару исполнитель+название.
4. **Свайп:** длинный текст, авто **выкл** — 10+ свайпов вверх/вниз по тексту и фиолетовым аккордам без залипания.
5. **Смена песни:** новая песня — текст с начала; тот же трек после нормализации — позиция не сбрасывается.
6. **Авто вкл:** свайп останавливает авто; play продолжает с места.
