# Chords: выдуманные аккорды, Back → маленькое окно, GitHub ChordPro

**Дата:** 2026-08-17 · **Файлы:** `ChordsScreen.tsx`, `chordLyricsNormalize.ts`, `chordProgression.ts`, `chordProParse.ts`, `chordFetchProxy.ts`, `pesniRuProvider.ts`, `onDemandChordAuto.ts`, `tools/chord-fetch/githubChordPro.mjs`, `fetch-one-amdm.mjs`

## Симптомы (Alex)

- Не все табы подгружаются; часть аккордов «выдуманные», как случайные.
- Назад из песни открывает **другое окно меньшего размера**.
- Дубли, заглушки, пустые CLI.

## Корни

| Баг | Корень |
|-----|--------|
| Случайный таб | `Promise.any` по вариантам artist/title **параллельно** + обрезка названия до первого слова (`Fix You` → `Fix`) — побеждал первый успешный чужой таб |
| `C G Am F` | Fallback в `chordProParse`, pesni payload, «Сохранить» из НАЙТИ, stub `fetch-one-amdm.mjs` |
| `[Chorus]` как аккорд | `CHORD_MARKER_RE` с `[^\]]*` — любое слово на A–H в скобках считалось аккордом |
| Чужой pesni | `resolveBestTrackSlug` брал лучший hit **без порога** (частичное имя) |
| Маленькое окно | RN `Modal` без fullscreen на Android = второй native-window меньшего размера; close без песни → пустая практика |
| Заглушка CLI | `fetch-one-amdm.mjs` писал placeholder JSON с `C G Am F` |

## Что сделано

| Было | Стало |
|------|-------|
| Гонка вариантов fetch | Последовательно: точное имя, затем swap artist/title. Без first-word |
| Fallback `C G Am F` | Пустая прогрессия, если нет verified маркеров |
| `[Chorus]` / `[And]` | `CHORD_MARKER_RE` = только валидный chord token |
| pesni любой best | min score 100 при известном исполнителе, иначе 80 |
| Library = Modal | In-tree overlay на весь экран; Back из песни → список; Back из списка без песни → уход с таба, не пустая практика |
| Нет OSS источника | Цепочка AmDm → UG → **GitHub ChordPro** (прокси) → pesni.ru. Парсер тот же `chordLayout` (как ChordSheetJS UG parser с Reddit/GitHub) |
| CLI stub | `fetch-one-amdm.mjs` зовёт реальный `fetchAmdmChordPro` |

GitHub: `POST /fetch { provider: "github", artist, title }`. Для code search на прокси задайте `GITHUB_TOKEN`. Без токена — честный 404, не фейковый таб.

`RecoTune.bat` перед Metro запускает `chords-dev.mjs`. Прокси `:8787` поднимается **сам** (не зависит от Python UG). Старый прокси без версии `2026-08-17` перезапускается. Холодный старт на Windows ждал 8 с и ошибочно считал порт мёртвым — теперь до 25 с + лог `%TEMP%\recotune-chord-proxy.log`. Bat пытается открыть TCP 8787 в Windows Firewall.

**Не** добавлен ChordSheetJS в приложение (GPL). Колоночный merge уже в `chordLayout.mjs`.

## Проверить

1. Песня с текстом → Назад → список на весь экран, без карточки меньшего размера.
2. Metadata-only → нет грифа C G Am F до verified fetch; hint, не «успех».
3. `[Chorus]` в тексте не становится аккордом; `[Am]` остаётся.
4. `npm run verify-chord-normalize` и `npm run verify-song-content`.
5. Прокси: `POST /fetch` с `provider: github` (нужен токен для поиска).
