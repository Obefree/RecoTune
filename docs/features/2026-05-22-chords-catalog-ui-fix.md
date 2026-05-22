# Chords: каталог НАЙТИ — SQLite и UI

**Дата:** 2026-05-22  
**Зачем:** при загрузке ~5000 metadata tracks — `nested transaction` в expo-sqlite; вкладка «Каталог» выглядела сырой (фиолетовый stack, путаная загрузка, неудобный список).

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/db/sqliteWriteLock.ts` | Очередь записей SQLite (уже была; search подключён к той же очереди) |
| `src/metadata/metadataSyncLock.ts` | Импорт метаданных + `formatMetadataSyncError` без stack trace |
| `src/metadata/metadataSync.ts` | `syncAllMetadata` / `ensureBundledMetadataSeed` через exclusive lock |
| `src/metadata/metadataDb.ts` | `upsertMetadataBatch` → `enqueueSqliteWrite` + transaction |
| `src/providers/registry.ts` | `searchProviders` в той же очереди — sync не пересекается с поиском |
| `src/screens/ChordsScreen.tsx` | UI каталога НАЙТИ + баннер/прогресс в «База песен» |

## Было → стало

| Было | Стало |
|------|--------|
| Параллельный seed + поиск → nested transaction | Одна очередь: импорт, batch upsert, search |
| Ошибка: сырой `expo-sqlite` / purple text | Компактный красный баннер, русский текст, «Повторить» |
| Загрузка: строка `#7c4dff` без прогресса | Progress bar + подпись группы N/M |
| Заголовок: длинный subtitle | Одна строка + pill «5000 треков» (зелёный) / N/5000 (янтарь) |
| Список: title/artist/badge столбиком | Строка: title жирный, artist серый, badge справа |
| Пусто: только текст | Иконка + примеры Let It Be / кино / Beatles |
| Кнопка «ИСКАТЬ» дублирует debounce | Поиск при вводе; поле крупнее, кнопка × очистки |
| `chord-v3` не затронут | Маркер в subtitle каталога |

## chord-v3

`CHORD_LIBRARY_BUILD = 'chord-v3'` без изменений; flow on-demand / practice не трогали.
