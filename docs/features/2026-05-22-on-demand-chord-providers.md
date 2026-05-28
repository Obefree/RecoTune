# On-demand AmDm / Ultimate Guitar (прокси)

**Дата:** 2026-05-22  
**Зачем:** загрузка полного таба **одной** песни по явному тапу пользователя, без скрапера и bulk в APK (KB D6, chord-library §8–9).

## Файлы

| Путь | Роль |
|------|------|
| `src/providers/chordFetchProxy.ts` | POST на `chordFetchProxyUrl`, ошибки без silent fail |
| `src/providers/amdmProvider.ts` | `fetchAmdmChordSheet` |
| `src/providers/pesniRuProvider.ts` | `fetchPesniRuChordSheet` (HTTPS, см. [2026-05-28-pesni-ru-api.md](./2026-05-28-pesni-ru-api.md)) |
| `src/providers/ultimateGuitarProvider.ts` | `fetchUltimateGuitarChordSheet` |
| `src/providers/providerSettings.ts` | toggles `amdm` / `ultimate_guitar` (off), `chordFetchProxyUrl` |
| `src/providers/types.ts` | `ProviderId`, `OnDemandChordProviderId` |
| `src/db/chordCache.ts` | TTL 7 дней, таблица `chord_cache` (schema v3) |
| `src/db/songLibrary.ts` | миграция schema 3 |
| `src/utils/songContent.ts` | `needsOnDemandChordFetch` |
| `src/screens/ChordsScreen.tsx` | кнопка «Загрузить аккорды», настройки прокси |
| `tools/chord-fetch/dev-proxy-server.mjs` | Локальный POST `/fetch` на порту 8787 (AmDm best-effort) |
| `tools/chord-fetch/package.json` | `npm run dev-proxy` |
| `tools/chord-fetch/` | README + stub `.mjs` для ПК |

## Было → стало

| Было | Стало |
|------|--------|
| AmDm/UG только офлайн-импорт вручную | Опционально: тап → прокси → ChordPro → `upsertUserSong` |
| Нет кэша on-demand | `chord_cache` 7 дней по artist+title+provider |
| UG в APK запрещён | Только POST на пользовательский URL |
| Провайдеры только в НАЙТИ search | AmDm/UG **не** в `searchProviders` (нет фонового bulk) |

## Включение

1. ⚙ **Источники песен** → включить AmDm и/или Ultimate Guitar.
2. Указать **URL прокси** (локальный `tools/chord-fetch` или свой сервер).
3. Практика → песня с «прогрессия» → **Загрузить аккорды**.

## Тест одной песни

1. Прокси возвращает минимальный ChordPro, например `{title: Test}\n[Am]Line`.
2. Включить AmDm + URL `http://<PC-IP>:8787/fetch`.
3. Открыть builtin с прогрессией без `[Am]` в lyrics → **Загрузить аккорды** → AmDm → текст с аккордами в практике.
