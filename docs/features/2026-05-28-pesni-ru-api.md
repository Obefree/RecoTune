# pesni.ru API — поиск и табы без прокси

**Дата:** 2026-05-28  
**Зачем:** легальный HTTPS API текстов и аккордов с телефона (без ПК-прокси); AmDm остаётся запасным путём.

## API (проба curl)

- Base: `https://pesni.ru/api/v1`, без ключа, **60 req/min** на IP (`X-RateLimit-Limit`, `X-RateLimit-Remaining`; при 429 — понятная ошибка).
- `GET /search?q=…&type=all&limit=50` → `{ artists: [...], tracks: [{ id, name, slug, artist }] }`.
- `GET /tracks/{slug}` → трек с полем **`text`** (не `lyrics`): аккорд на отдельной строке над строкой текста (`\r\n`), без `[Am]` в сыром виде.
- Пример: slug `zvezda-po-imeni-solnce` (Кино) — валидный ChordPro после `normalizeLyricsChords(…, { allowMerge: true })`.

## Файлы

| Путь | Роль |
|------|------|
| `src/providers/pesniRuApi.ts` | HTTP, типы, `PesniRuError`, rate limit |
| `src/providers/pesniRuProvider.ts` | `pesniRuProvider`, `fetchPesniRuChordSheet`, конвертация `text` → verified ChordPro |
| `src/providers/registry.ts` | поиск при `q.length >= 2`, до 50 хитов |
| `src/providers/providerSettings.ts` | `enabled.pesni_ru`, `onDemandChordSource` |
| `src/providers/types.ts` | `ProviderId` / badge `pesni_ru` |
| `src/db/chordCache.ts` | кэш on-demand `pesni_ru`, TTL 7 дней |
| `src/screens/ChordsScreen.tsx` | ⚙ источник pesni vs AmDm, подгрузка, fallback |
| `src/utils/songContent.ts` | verified id `pesni_ru_*` / `custom_pesni_*` |

## Было → стало

| Было | Стало |
|------|--------|
| Только AmDm через прокси на ПК | По умолчанию **pesni.ru** с телефона; AmDm — fallback или выбор в ⚙ |
| Поиск только SQLite + metadata | Дополнительно хиты pesni.ru (сеть, ≥2 символа) |
| — | Атрибуция: «pesni.ru» + ссылка на трек |

## Настройки

⚙ **Подгрузка табов** → источник по умолчанию (pesni.ru / AmDm), чекбоксы источников.

## Тестовые песни

1. **Кино — Звезда по имени Солнце** — поиск «Звезда по имени солнце» или slug `zvezda-po-imeni-solnce`.
2. **Radiohead — Creep** — на pesni.ru может не быть точного хита; проверить fallback на AmDm (прокси).
3. Поиск **«кино»** — артисты + треки в API; выбор трека Кино из списка.

## Когда нужен AmDm

- Песни вне каталога pesni.ru или без построчных аккордов в `text`.
- Лимит 60 req/min исчерпан.
- Пользователь выбрал источник **AmDm** в настройках.
