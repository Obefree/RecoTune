# Практика: zoom 30%, прокси-поиск, layout Creep

## Зачем

Обратная связь: минимальный zoom 75% слишком крупный; поиск AmDm/UG «ничего не находит» без понятной подсказки про ПК; у Creep криво смотрелось окно аккорда над словом.

## Файлы

| Область | Файлы |
|---------|--------|
| Zoom | `src/settings/practiceDisplaySettings.ts`, `src/screens/ChordsScreen.tsx` |
| Поиск / прокси | `src/providers/remoteChordSearch.ts`, `src/providers/chordFetchUrl.ts`, `ChordsScreen` (пустой поиск) |
| Layout таба | `ChordLyricsLine` в `ChordsScreen.tsx` |

## Было → стало

| Тема | Было | Стало |
|------|------|--------|
| Масштаб текста | clamp 75–190% | **30–190%** (`PRACTICE_LYRICS_ZOOM_MIN/MAX`), pinch и A± |
| Пустой поиск | всегда «npm run chords:dev» | В **__DEV__** только если прокси недоступен: «Запустите npm start на ПК (:8787)» |
| POST /search URL | edge-case pathname | Явно `:8787` → `/search`, Vercel → `/api/search-chords` |
| Старый прокси на :8787 | `chords:dev` считал порт «готовым», `/search` → 404 | Перезапуск stack, если нет `POST /search` |
| Аккорд над словом | фикс. `minWidth` 26px | Для пары аккорд+слово: колонка по ширине слова, аккорд по центру (Creep «[G]creep») |
| Высота зоны текста | могла сжиматься | Нижний предел ~42% тела практики при открытой панели |

## Проверка на ПК

```bash
npm start          # chords:dev + Expo; прокси :8787
npm run chords:dev # только стек, если Metro уже запущен
curl -s http://127.0.0.1:8787/health
curl -s -X POST http://127.0.0.1:8787/search -H "Content-Type: application/json" -d "{\"q\":\"Bob Dylan\",\"limit\":5}"
node tools/chord-fetch/test-endpoint.mjs
```

Телефон: та же Wi‑Fi, Expo Go, ⚙ → «Подставить авто».
