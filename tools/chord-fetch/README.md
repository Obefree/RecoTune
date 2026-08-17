# chord-fetch (локально на ПК)

**Основная инструкция для приложения:** [../../docs/chord-fetch-local-proxy.md](../../docs/chord-fetch-local-proxy.md)

Офлайн-утилиты для **одной** песни за запуск. Не для массового каталога и не для коммита scraped bulk в публичный репозиторий.

**База на ПК:** прокси сначала отдаёт уже спарсенные табы (~1113 pesni + новые AmDm/UG в `tools/chord-fetch/data/parsed-chords.local.json`). На Vercel — тот же lookup (pesni в репо + `assets/archive/proxy-parsed-chords.json` после `npm run chord-db:publish`).

## Зачем



## Зачем



В APK RecoTune **нет** HTML-скрапера AmDm / Ultimate Guitar (политика D5/D6). Приложение шлёт POST на ваш прокси — для пользователя это одна кнопка **«Загрузить аккорды»** в том же экране практики.



```json

{ "provider": "amdm", "artist": "Кино", "title": "Группа крови" }

```



Ответ: ChordPro-текст (`text/plain`) или JSON:



```json

{ "chordPro": "{title:...}\n[Am]...", "sourceUrl": "https://..." }

```



## Тест end-to-end за 3 шага



1. **Установка** (один раз), в папке `tools/chord-fetch`:



   ```bash

   npm install

   ```



2. **Запуск на ПК** (окно не закрывать) — **прокси + Ultimate Guitar API**:



   ```bash

   npm run dev-stack

   ```



   Поднимает Flask `ultimate-api` (`http://127.0.0.1:5000/tab`) и dev-proxy `http://0.0.0.0:8787/fetch`.



   Только прокси (без UG): `npm run dev-proxy`. Только API: `npm run ultimate-api` (нужен Python 3 + `pip install -r ../ultimate-api/requirements.txt` в venv).



3. **Телефон (RecoTune):** Expo Go, та же Wi‑Fi → ⚙ **Источники** → **Подставить авто** (или вручную `http://192.168.x.x:8787/fetch`).



   Вместо `192.168.x.x` — IP вашего ПК в Wi‑Fi (`ipconfig` → IPv4). Телефон и ПК в одной сети.



Дальше: **Практика** → песня с бейджем «прогрессия» → **Загрузить аккорды** → AmDm.



Проверка с ПК без телефона:



```bash

curl -s -X POST http://127.0.0.1:8787/fetch -H "Content-Type: application/json" -d "{\"provider\":\"amdm\",\"artist\":\"Ленинград\",\"title\":\"Группа крови\"}"

```



## dev-proxy-server.mjs



| provider | Поведение |

|----------|-----------|

| `amdm` | Поиск на amdm.ru → первая подходящая ссылка → парс `<pre>` с `podbor__chord` → ChordPro |

| `ultimate_guitar` | Поиск в `ugFetch.mjs`, таб через [ultimate-api](../ultimate-api/README.md) (`ULTIMATE_API_URL`, по умолчанию `:5000`) |

| `github` | Публичные ChordPro (`.cho`/`.chopro`) через GitHub code search → raw.githubusercontent. `GITHUB_TOKEN` на прокси поднимает лимиты; без токена search часто 401 — честный 404. |



Если amdm.ru недоступен или таб не распознан — **HTTP 404** и `{ error, stub: true }` (без ChordPro в теле). Приложение не показывает это как таб (`chordFetchProxy` / `isChordProStubBody`).



Порт: переменная `CHORD_FETCH_PORT` (по умолчанию `8787`).



## Скрипты-заготовки



| Файл | Назначение |

|------|------------|

| `fetch-one-amdm.mjs` | CLI: тот же парсер, что прокси (`fetchAmdmChordPro`) |

| `fetch-one-ug.mjs` | CLI: UG через `ugFetch.mjs` |

| `dev-proxy-server.mjs` | HTTP POST `/fetch` для приложения |



Вывод для ручного импорта: `import-chord-song.json` (формат как `SongEntry` / ChordPro).



## ToS и этика



- Только по явному запросу пользователя (одна песня).

- Не зеркалить каталоги, не обходить anti-bot, не публиковать bulk в GitHub.

- Ultimate Guitar в release APK не парсится — только ваш прокси на доверенной машине.



## Импорт без прокси



Сгенерируйте JSON локально и импортируйте через **Импорт JSON-бэкапа** или ChordPro batch в приложении.



## Troubleshooting: «после сборки ничего не изменилось»



| Симптом | Частая причина |

|---------|----------------|

| Поиск в «База песен» / НАЙТИ→Каталог пустой | Старая сборка или БД не инициализировалась (`0` песен в подзаголовке) |

| Нет бейджей «аккорды» / «прогрессия», нет «Загрузить аккорды» | Установлен APK / Expo Go без локальных правок (см. `git status` в `RecoTune`) |

| Старые только «прогрессии» без `[Am]` | Каталог не обновился: нужен код с `upgradeBuiltinCatalog` и `BUILTIN_SEED_VERSION=2026-05-22` |



**Проверка, что на устройстве новая версия:**



1. **Chords → Практика → База песен** — в подзаголовке десятки/сотни песен, у строк бейджи «аккорды» / «прогрессия»; в dev-сборке видно `· DB:N`.

2. **НАЙТИ → Каталог** — при вводе «лет» / «beatles» появляются совпадения без кнопки (debounce ~220 ms).

3. Песня только с прогрессией → в практике кнопка **Загрузить аккорды**.



**Expo Go (из папки репозитория с актуальным кодом):**



```bash

cd C:\Users\lev\Documents\GitHub\RecoTune

npx expo start -c

```



QR в Expo Go; папка должна быть именно `RecoTune`, не другой клон.



**Release APK:** `build-apk-release.bat` берёт **текущую** папку (`%~dp0`), но если `git status` показывает отсутствие `src/db/`, `src/providers/` — на другой машине/после `git pull` без этих файлов APK будет старым. Перед сборкой: `git status` — каталоги `src/db/`, `src/providers/`, `src/services/` должны быть в проекте.



**Не путать:** вкладки «НАЙТИ ТЕКСТ» / «Вручную» — не каталог SQLite; умный поиск — **Каталог** и **База песен**.


## Expo Metro (RecoTune app)

If RecoTune.bat fails with TypeError: fetch failed, start Metro offline — see [docs/troubleshooting-expo-offline.md](../../docs/troubleshooting-expo-offline.md). Quick: 
pm run start:offline from repo root.
