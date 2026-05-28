# Chord fetch: validation fix + restart dev-proxy

## Зачем

После смены цепочки AmDm → UG пользователь видел «ничего не грузится»: прокси отвечал 200, но приложение отбрасывало таб как «без аккордов», либо работал **старый** `dev-proxy` на :8787 после `git pull`.

## Корневые причины

1. **Устаревший dev-proxy** — процесс на :8787 не перезапускали; парсер в памяти ≠ код в репо.
2. **`CHORD_MARKER_RE` слишком узкий** — не считал `[G]`, `[Am]`, `[Gsus4]` построчными аккордами (требовал `#/b/цифру` сразу после буквы). AmDm-ответы отклонялись как `no_chords`.
3. **Ошибки прокси сжимались в «Не найдено»** — в dev нельзя было понять реальную причину 404/stub.

## Файлы

| Файл | Изменение |
|------|-----------|
| `tools/chord-fetch/amdmChordValidate.mjs` | Широкий regex маркеров аккордов |
| `src/utils/chordLyricsNormalize.ts` | То же для client-side verify |
| `tools/verify-chord-normalize.mjs` | Зеркало regex |
| `tools/chord-fetch/amdmFetch.mjs` | Короткие search-запросы (первое слово title), scoring для «Кино» vs OST |
| `src/providers/chordFetchProxy.ts` | Варианты fetch по первому слову title; dev-сообщения от прокси |
| `tools/chord-fetch/dev-proxy-server.mjs` | `version` в `/health`, напоминание перезапуска |

## Было → стало

| Было | Стало |
|------|--------|
| `[G][Gsus4]When…` → validation fail | Принимается как verified ChordPro |
| 404/stub → всегда «Не найдено» | В `__DEV__` — текст ошибки прокси (до ~100 символов) |
| Старый proxy без версии | `GET /health` → `version: 2026-05-28-amdm-validate` |
| Длинное «Звезда по имени солнце» — только полный query | Также `Кино Звезда`, `Звезда` в AmDm search + variant в app |

## Проверка

```bash
npm run dev-proxy          # перезапуск после pull обязателен
npm run test-chord-fetch   # local + http://127.0.0.1:8787/fetch
```

Smoke: Radiohead — Creep, Земфира — Искала, Кино — Группа крови.

## Ограничения

- **Кино — Звезда по имени солнце:** официального таба на AmDm сейчас нет (только пародии/каверы); fallback — UG через прокси, если IP не блокирует Cloudflare.
- **UG:** с части IP Cloudflare 503 — ожидаемо.
