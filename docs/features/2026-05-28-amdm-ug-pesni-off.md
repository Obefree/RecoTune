# Chords: AmDm → UG, pesni.ru выкл, короткие ошибки

## Зачем

- **pesni.ru** — лимиты 429; временно не в авто-цепочке и не в поиске по умолчанию.
- Приоритет **AmDm + Ultimate Guitar** через `npm run dev-proxy`.
- Парсер AmDm: латиница в URL (`кино` → `kino`), штрафы за каверы/пародии, алиасы Цой/Кино.
- UG в прокси (`ugFetch.mjs`), не HTTP 501.
- UI: «Не найдено», без длинных цепочек источников.

## Файлы

| Файл | Изменение |
|------|-----------|
| `tools/chord-fetch/amdmFetch.mjs` | scoring/translit, dev-log `RECO_CHORD_FETCH_DEBUG=1`, UG handler |
| `tools/chord-fetch/ugFetch.mjs` | Cloudflare/403, порог кандидатов |
| `src/providers/onDemandChordAuto.ts` | `amdm` → `ultimate_guitar`, pesni только `enabled` |
| `src/providers/providerSettings.ts` | `pesni_ru: false` по умолчанию |
| `src/providers/registry.ts` | pesni в поиске только если включён |
| `src/providers/pesniRuApi.ts` | короткое сообщение rate limit |
| `src/providers/chordFetchProxy.ts` | 404 → «Не найдено» |
| `src/screens/ChordsScreen.tsx` | подписи AmDm → UG, старт прогресса с AmDm |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Авто-таб | UG → AmDm → pesni.ru | **AmDm → UG** |
| pesni.ru | всегда в поиске и цепочке | **выкл** (вкл. в расширенных) |
| Ошибка | длинный список | **«Не найдено»** |
| AmDm «Кино» | часто кавер Ленинград | штраф каверов, slug `kino` |

## Проверка

1. `npm run dev-proxy` на ПК, Expo Go, та же Wi‑Fi.
2. **Radiohead — Creep** — AmDm или UG, verified таб.
3. **Кино — Звезда** — AmDm.
4. **Кино — Группа крови** — может не быть на AmDm; UG или «Не найдено».

`RECO_CHORD_FETCH_DEBUG=1 npm run dev-proxy` — кандидаты AmDm в консоли прокси.
