# Chords: вложенные транзакции SQLite при импорте metadata

**Зачем:** при открытии НАЙТИ→Каталог параллельно шли `ensureBundledMetadataSeed` и `searchProviders` → два `withTransactionAsync` на одном соединении → `cannot start a transaction within a transaction`, каталог обрывался на ~2005/5000.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/db/sqliteWriteLock.ts` | Очередь записей в SQLite |
| `src/metadata/metadataSyncLock.ts` | Mutex одного импорта + русские тексты ошибок |
| `src/metadata/metadataDb.ts` | `upsertMetadataBatch` через `enqueueSqliteWrite` |
| `src/metadata/metadataSync.ts` | `syncAllMetadataInner` + exclusive import |
| `src/screens/ChordsScreen.tsx` | Без повторного `reloadLibrary` в поиске; UI «Повторить загрузку каталога» |

## Было → стало

| Было | Стало |
|------|--------|
| Два параллельных импорта / batch + поиск с `reloadLibrary` | Один импорт; поиск по частичному каталогу без второго seed |
| Фиолетовый NativeDatabase error | Сообщение по-русски + кнопка повтора |

## Проверка

1. Expo Go → вкладка **Chords** → **НАЙТИ** → **Каталог**.
2. Дождаться `5000 треков (метаданные)` без ошибки.
3. Во время загрузки ввести запрос — выдача из уже импортированных строк.
4. При ошибке — **Повторить загрузку каталога**, импорт продолжается с cursor.
