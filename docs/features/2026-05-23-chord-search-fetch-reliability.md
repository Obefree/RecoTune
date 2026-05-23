# Chords: поиск и подгрузка табов (надёжность)

**Дата:** 2026-05-23  
**Зачем:** пользователь не находил известные песни или получал «пустую» практику — таб не подгружался, ошибки проглатывались, заглушки AmDm выглядели как успех.

## Что было не так

| Проблема | Причина |
|----------|---------|
| Поиск «кино» на EN-раскладке (`rbjy`) | Не учитывалась перепутанная раскладка |
| Таб «загрузился», но фейковый | Прокси возвращал HTTP 200 со stub ChordPro (`Тестовая заглушка`) |
| Ошибка сети не видна | `enrichSongForPractice` ловил `ChordFetchError` без подсказки в UI |
| Ultimate Guitar | API отвечает 501 — кнопка вела в тупик |
| AmDm matching | Один поисковый запрос `artist title` — промах при другом порядке слов |
| Онлайн-табы на телефоне | AmDm недоступен из APK; нужен **Vercel** или **dev-proxy** на ПК в той же Wi‑Fi |

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/utils/keyboardLayoutSwap.ts` | QWERTY ↔ JCUKEN для запроса |
| `src/utils/searchNormalize.ts` | `searchQueryVariants`, расширенные `searchQueryForms` |
| `src/utils/searchScore.ts` | лучший score по вариантам запроса |
| `src/providers/chordFetchProxy.ts` | отказ от stub, варианты artist/title, очистка битого кэша |
| `tools/chord-fetch/amdmFetch.mjs` | несколько поисковых запросов; stub → HTTP 404 |
| `src/screens/ChordsScreen.tsx` | подсказки при пустом поиске и ошибке fetch; только AmDm |
| `src/providers/registry.ts` | до 80 metadata-хитов в merge |

## Было → стало

| Было | Стало |
|------|--------|
| Stub 200 OK | 404 + `ChordFetchError` в приложении |
| Тихий fail fetch | Строка-подсказка под текстом (`practiceFetchHint`) |
| UG в меню «Подгрузить» | Только AmDm (UG — явная ошибка в proxy) |
| Один AmDm search | `artist title`, `title artist`, title-only, artist-only |
| «Ничего не найдено» | Подсказка про раскладку + онлайн-табы / proxy |

## Настройка онлайн-табов (для пользователя)

1. **Vercel (рекомендуется с телефона вне LAN)**  
   - Репозиторий RecoTune → Deploy.  
   - Endpoint: `https://<project>.vercel.app/api/fetch-chords`  
   - В `.env` или EAS: `EXPO_PUBLIC_CHORD_FETCH_URL=<url>`  
   - Либо `app.json` → `expo.extra.chordFetchApiUrl`

2. **dev-proxy на ПК (Expo Go, та же Wi‑Fi)**  
   ```bash
   cd tools/chord-fetch && npm install && npm run dev-proxy
   ```  
   Metro подставит `http://<IP-ПК>:8787/fetch` автоматически.

3. **Проверка:** ⚙ Источники → AmDm включён; выбрать песню с бейджем «метаданные» / «прогрессия» → таб подгрузится или покажется причина ошибки.

## Офлайн vs онлайн

| Офлайн | Только онлайн |
|--------|----------------|
| Поиск ~32 builtin + ~5000 metadata (bundled chunks) | Полный ChordPro с AmDm |
| Прогрессии аккордов в seed | Парсинг HTML через proxy/Vercel |
| Кэш `chord_cache` 7 дней после успешной подгрузки | lyrics.ovh (текст без аккордов) |

## Тест

1. База: `Creep`, `Radiohead`, `кино` / `rbjy` — есть результаты.  
2. Песня без `[Am]` в lyrics → авто-подгрузка или «Подгрузить таб».  
3. Без proxy — подсказка про `EXPO_PUBLIC_CHORD_FETCH_URL` / dev-proxy, не заглушка.  
4. С proxy: Radiohead — Creep → реальные строки с amdm.ru.
