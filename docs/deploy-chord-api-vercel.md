# Опционально: chord-fetch API на Vercel

> **Основной способ для разработки:** [chord-fetch-local-proxy.md](./chord-fetch-local-proxy.md) — `npm run dev-proxy` на ПК, Expo Go в той же Wi‑Fi.

Развёртывание на Vercel нужно только если хотите подгружать табы **без** запущенного прокси на компьютере (например, телефон вне домашней сети).

GET `/api/fetch-chords` показывает `parsed.songs` (pesni seed + overlay). Live scrape — только cache miss.

Перед деплоем с ПК (новые парсы AmDm):

```bash
npm run chord-db:publish
```

Это пишет `assets/archive/proxy-parsed-chords.json`. Pesni-бандл в `assets/archive/pesni-chordpro.json` едет вместе с функцией.

## 1. Репозиторий на GitHub

Убедитесь, что проект `RecoTune` запушен в GitHub (ветка `main` или `master`).

**Прод:** `https://recotune-chords.vercel.app/api/fetch-chords`  
В приложении: ⚙ → **Свой URL** → вставить этот адрес.

После `npx vercel login` деплой в команду **RecoTune chords** (не Aleks' projects / CoB):

```bash
npm run chord-db:publish
npx vercel --yes --prod --scope recotune-chords
```

Не линкуйте RecoTune к `cob-game-clean-v-1` / `co-b-game` / `matchall`. Команда Aleks' projects сейчас в fair-use 402 — аккорды живут в отдельной Hobby-команде `recotune-chords`.

Если `npx vercel whoami` показывает Logged out — `npx vercel login`, затем команда выше.

## 2. Новый проект в Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import репозитория **RecoTune**
3. Framework Preset: **Other** (корень репо, есть `vercel.json` и `api/fetch-chords.mjs`)

## 3. Deploy

После сборки скопируйте URL, например `https://recotune-xxxx.vercel.app`.

```bash
node tools/chord-fetch/test-endpoint.mjs https://ВАШ-ПРОЕКТ.vercel.app/api/fetch-chords
```

## 4. URL в приложении

**Вариант A** — `.env` в корне RecoTune:

```env
EXPO_PUBLIC_CHORD_FETCH_URL=https://ВАШ-ПРОЕКТ.vercel.app/api/fetch-chords
```

**Вариант B** — ⚙ → **Свой URL (опционально, Vercel)** → вставить URL → сохранить.

**Вариант C** — `app.json` → `expo.extra.chordFetchApiUrl` (низкий приоритет; Metro :8787 важнее).

Приоритет при подгрузке: сохранённый URL (если вы явно задали Vercel) → `EXPO_PUBLIC_*` → Metro `:8787/fetch` → `app.json`.

## 5. Включить «Табы с AmDm»

Практика → **⚙** → включить **Табы с AmDm**.

## Локальная проверка handler

```bash
npx vercel dev
```

POST на `http://localhost:3000/api/fetch-chords` с телом:

```json
{ "provider": "amdm", "artist": "Radiohead", "title": "Creep" }
```
