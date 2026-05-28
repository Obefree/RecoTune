# AmDm: умный подбор таба и честные ошибки

## Зачем

Поиск показывал **исполнителя и название из metadata** (~5000 треков), но в практике — «таб слишком короткий» или пусто: прокси брал **первую ссылку** с AmDm (часто кавер), не сверял og:title и отбрасывал валидные короткие интро.

## Файлы

| Файл | Изменение |
|------|-----------|
| `tools/chord-fetch/amdmFetch.mjs` | Несколько URL с поиска, сверка исполнителя/названия, translit/раскладка в запросах, алиасы (Кино→Цой) |
| `tools/chord-fetch/amdmChordValidate.mjs` | Общая проверка: текст + аккорды, не только прогрессия |
| `tools/chord-fetch/test-endpoint.mjs` | Smoke: Creep, Искала; Кино — optional (на AmDm часто только каверы) |
| `src/providers/chordFetchProxy.ts` | Этапы загрузки, `chordProRejectionReason` в ошибках |
| `src/utils/chordLyricsNormalize.ts` | `chordProRejectionReason()` |
| `src/screens/ChordsScreen.tsx` | Подписи «Ищем…», «Проверяем…» |
| `src/metadata/metadataDb.ts` | Связка metadata → builtin с verified ChordPro |
| `docs/guides/chords-search-and-tabs-ru.md` | Краткий гид для пользователя |

## Было → стало

| Было | Стало |
|------|--------|
| Одна ссылка с поиска | До 8 кандидатов, перебор до первого валидного |
| «Таб слишком короткий» без контекста | «Нет текста», «другой исполнитель», «не найдено на AmDm» |
| Кавер Ленинград за «Кино» | Отказ при несовпадении исполнителя |
| Metadata без таба в поиске | Бейдж «метаданные»; таб только после AmDm или builtin ~32 |

## Прокси

Без `npm run dev-proxy` на ПК подгрузка AmDm недоступна (см. `docs/chord-fetch-local-proxy.md`).
