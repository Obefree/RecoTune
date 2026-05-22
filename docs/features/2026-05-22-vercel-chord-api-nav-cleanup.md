# Vercel chord API, поиск, навигация НАЙТИ

**Дата:** 2026-05-22  
**Зачем:** табы без ПК (serverless), починить поиск «кино», убрать дубль каталога на НАЙТИ.

## Файлы

| Путь | Изменение |
|------|-----------|
| `tools/chord-fetch/amdmFetch.mjs` | Общий парсер AmDm |
| `api/fetch-chords.mjs`, `vercel.json` | Vercel POST API + CORS + rate limit |
| `src/providers/chordFetchUrl.ts`, `autoChordProxy.ts`, `chordFetchProxy.ts` | URL: env → Metro → `extra.chordFetchApiUrl` |
| `src/providers/registry.ts` | Поиск без блокировки SQLite на remote |
| `src/metadata/metadataSearch.ts` | Fallback на bundled chunks |
| `src/screens/ChordsScreen.tsx` | НАЙТИ без «Каталог»; ⚙ только «Табы онлайн» |
| `app.json` | `expo.extra.chordFetchApiUrl` |
| `docs/deploy-chord-api-vercel.md` | 5 шагов деплоя |

## Было → стало

| Было | Стало |
|------|--------|
| Только dev-proxy на ПК | + `api/fetch-chords` на Vercel |
| НАЙТИ → Каталог → кнопка в Практику | НАЙТИ: Запись / Файл / YouTube / Вручную |
| Поиск в очереди SQLite с remote | Поиск без write-lock; init перед запросом |
| Частичный metadata SQLite без hits | Доп. scan bundled JSON |

## Проверка

1. Практика → База → «кино» — песни Кино / metadata.
2. POST `/api/fetch-chords` на Vercel или `npm run dev-proxy`.
3. Практика → песня без таба → тихая подгрузка «Табы онлайн».
