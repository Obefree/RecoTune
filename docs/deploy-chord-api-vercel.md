# Deploy chord-fetch API на Vercel (5 шагов)

RecoTune подгружает табы через **ваш** serverless endpoint — без постоянного ПК.

## 1. Репозиторий на GitHub

Убедитесь, что проект `RecoTune` запушен в GitHub (ветка `main` или `master`).

## 2. Новый проект в Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import репозитория **RecoTune**
3. Framework Preset: **Other** (корень репо, есть `vercel.json` и `api/fetch-chords.mjs`)

## 3. Deploy

Нажмите **Deploy**. После сборки скопируйте URL проекта, например:

`https://recotune-xxxx.vercel.app`

Проверка в браузере или curl:

```bash
curl -X POST "https://ВАШ-ПРОЕКТ.vercel.app/api/fetch-chords" \
  -H "Content-Type: application/json" \
  -d "{\"artist\":\"Кино\",\"title\":\"Группа крови\",\"provider\":\"amdm\"}"
```

В ответе — JSON с полями `chordPro` и `sourceUrl`.

## 4. URL в приложении

**Вариант A (рекомендуется)** — файл `.env` в корне RecoTune:

```env
EXPO_PUBLIC_CHORD_FETCH_URL=https://ВАШ-ПРОЕКТ.vercel.app/api/fetch-chords
```

Перезапустите Expo: `npx expo start -c`.

**Вариант B** — `app.json` → `expo.extra.chordFetchApiUrl`:

```json
"extra": {
  "chordFetchApiUrl": "https://ВАШ-ПРОЕКТ.vercel.app/api/fetch-chords"
}
```

Приоритет: `EXPO_PUBLIC_CHORD_FETCH_URL` → Metro `:8787/fetch` (dev-proxy) → `chordFetchApiUrl`.

## 5. Включить «Табы онлайн»

В приложении: **Практика** → **⚙** → включить **Табы онлайн** (или автоматически после первого запуска с URL).

Локально без Vercel:

```bash
cd tools/chord-fetch && npm install && npm run dev-proxy
```

Телефон и ПК в одной Wi‑Fi, Expo Go — URL подставится на `http://<IP-ПК>:8787/fetch`.

## Локальная проверка API

```bash
npx vercel dev
```

POST на `http://localhost:3000/api/fetch-chords` с тем же телом JSON.
