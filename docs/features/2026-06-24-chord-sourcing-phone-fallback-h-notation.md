# Chords: как берутся табы (AmDm/UG primary), телефонный backup и нотация H

**Дата:** 2026-06-24
**Зачем:** жалоба «табы не подгружаются» + вопрос по архитектуре. Зафиксировать поток источников, починить «тихий» телефонный backup и распознавание аккорда **H/Hm** (немецкая/русская запись B), которое раньше терялось в приложении.

## Откуда берутся табы (поток источников)

Скрапер сайтов **не** вшит в APK (политика D5/D6). Аккорды приходят так:

1. **builtin verified ChordPro** (~32 песни) — офлайн, в бандле.
2. **AmDm.ru + Ultimate Guitar — ОСНОВНОЙ путь.** У них нет открытого API → HTML страницы скрапятся и парсятся **на сервере** (`tools/chord-fetch`, прокси `:8787` + опц. `ultimate-api :5000`), который возвращает выровненный ChordPro (`chordLayout.mjs`). Сейчас это **ПК-прокси**; позже — один хостинг (VPS).
3. **pesni.ru — только запасной путь.** Единственный источник с реальным API (`https://pesni.ru/api/v1`, без ключа, ~60 req/min), который можно дёргать **прямо с телефона**. Используется молча, когда сервера нет (AmDm/UG недоступны) и они ничего не дали. Не «основной», в поиске по умолчанию не показывается.

Авто-цепочка (`onDemandChordAuto.ts`, без изменений): **AmDm → UG (через прокси, быстрый health-probe ~3.5 с) → pesni.ru (тихий fallback)**. Первый успех выигрывает; честное «Не найдено», если всё пусто.

## Что изменено

| Файл | Изменение |
|------|-----------|
| `src/utils/chordLyricsNormalize.ts` | `ROOT` / `CHORD_MARKER_RE` / single-letter guard → **`[A-H]`** (H = B). Теперь `[Hm]`, `[H]` распознаются и проходят verified-проверку, как в серверном `chordLayout.mjs` |
| `src/utils/chordProgression.ts` | `ROOT` и фильтр одиночной буквы → включают **H** (аккорд-summary не теряет Hm) |
| `src/utils/chordTranspose.ts` | `parseRoot`: `H/h → B natural`; guard'ы `[A-G]→[A-H]` — транспонирование `Hm`/`H` работает (в английские имена) |
| `src/providers/pesniRuProvider.ts` | backup надёжнее: снят ведущий `\t` (pesni indent), **понижение каверов/пародий** (`Переделанные песни`, `кавер`, `минус`, `(мотив`…) в `scorePesniTrack`/`scoreSearchHit` — silent fallback берёт **оригинал**, а не пародию |
| `tools/verify-chord-normalize.mjs`, `tools/verify-chord-transpose.mjs` | зеркала логики обновлены + кейсы H/Hm |

Цепочка, дефолтные настройки и UI **не трогали**: AmDm/UG остаются основными, pesni.ru не продвигается.

## Было → стало

| | Было | Стало |
|--|------|-------|
| Аккорд **Hm/H** (Цой, КиШ, Сплин…) | приложение знало только `[A-G]` → H/Hm не распознавались, иногда таб не проходил verified-проверку | `[A-H]` end-to-end: распознаётся, рендерится, транспонируется (H→B) |
| pesni.ru backup, выбор песни | мог зарезолвить **пародию/кавер** (напр. «Сплин» → только пародии в топе) | понижение каверов → берётся оригинал (проверено вживую: Кино/КиШ/Сплин, score ≥105, cover=false) |
| pesni.ru текст с табами | ведущие табы ломали вид | dedent, чистый ChordPro |

## Будущий хостинг (один URL)

Точка конфигурации одна: `EXPO_PUBLIC_CHORD_FETCH_URL` (или `app.config.js extra.chordFetchUrl`, или авто-Metro `:8787`). Когда Alex поднимет тот же `tools/chord-fetch` на VPS — задать **один URL** при сборке, и AmDm/UG заработают для всех **с телефона, без ПК**. Хостинговый и LAN-URL обрабатываются одинаково (`getEffectiveChordFetchUrl`). Не Vercel (квота). Подойдёт любой дешёвый Node-хост; деплой — в [chord-fetch-local-proxy.md](../chord-fetch-local-proxy.md).

## Проверка

```bash
npm run verify-chord-normalize   # + H chord line / H in chord row / H tab verifies
npm run verify-chord-transpose   # + H→C, Hm→Am, [Hm][D] транспонирование
npm run verify-chord-layout      # серверный парсер AmDm/UG
npm run chords:dev               # поднять прокси (AmDm/UG primary), проверить с телефона
```

pesni.ru backup проверен живым node-скриптом (одноразовый, удалён): поиск title-only + понижение пародий резолвит оригинал, тексты содержат построчные аккорды и H/Hm.

Политики: `no-stubs-half-features` (только verified ChordPro; pesni даёт реальные аккорды-над-текстом, не фейк), `minimal-changes-no-duplication`.
