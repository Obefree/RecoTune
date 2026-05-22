# Каталог метаданных: поиск без полной загрузки в SQLite

**Зачем:** при открытии НАЙТИ→Каталог `ensureBundledMetadataSeed` вставлял все ~5000 треков в SQLite — долго, блокировало UI, давало nested transaction.

## Было → стало

| Было | Стало |
|------|--------|
| Импорт всех chunk-ов при открытии вкладки | Поиск по in-memory JSON chunks при вводе (≥2 символов) |
| Прогресс «2005/5000» блокирует каталог | Pill «каталог: поиск без полной загрузки» |
| `searchMetadataTracks` читает всю таблицу в память | `searchBundledMetadata` / SQLite только после полного индекса |
| Один путь загрузки | Опционально: настройки → «Скачать полный индекс офлайн» → `startBackgroundIndex` |

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/metadata/metadataSearch.ts` | `searchBundledMetadata`, `searchMetadataCatalog` (cap 50) |
| `src/metadata/metadataSync.ts` | `startBackgroundIndex` (non-blocking); `ensureBundledMetadataSeed` → no-op без флага |
| `src/providers/registry.ts` | `searchMetadataCatalog` вместо полного SQLite scan |
| `src/providers/providerSettings.ts` | `metadataFullIndexOffline` |
| `src/screens/ChordsScreen.tsx` | UI pill, «Поиск по каталогу…», кнопка офлайн-индекса |

## Как работает поиск

1. **0–1 символ:** только встроенные ~536 песен с аккордами (SQLite builtin).
2. **≥2 символов:** builtin + скан `assets/metadata/chunk-*.json` (уже в bundle), ранний выход на 50 совпадений.
3. **Тап по результату:** полный таб on-demand (прокси / builtin), как раньше.
4. **Офлайн-индекс (опция):** фоновый импорт chunk за chunk в `metadata_tracks`; после завершения поиск идёт через SQLite.

## Проверка

1. Свежая установка / очистить данные приложения.
2. Chords → НАЙТИ → Каталог: **нет** долгого «Загрузка 5000», pill «поиск без полной загрузки».
3. Ввести `beatles` / `кино` (≥2 букв) → «Поиск по каталогу…» → результаты из MB каталога + builtin.
4. Открыть результат без аккордов → on-demand загрузка.
5. Настройки (шестерёнка) → «Скачать полный индекс офлайн» → фоновый прогресс «Индекс: группа N/3», поиск работает параллельно.
6. После индекса pill «5000 треков» (или близко), повторный поиск быстрее через SQLite.
