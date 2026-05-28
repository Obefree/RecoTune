# Chords: авто-цепочка табов (pesni.ru → AmDm)

**Зачем:** пользователь не настраивает источники вручную — выбирает песню в поиске, таб подгружается сам.

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/providers/onDemandChordAuto.ts` | **новый** — цепочка pesni.ru → AmDm, сообщение об ошибках |
| `src/providers/providerSettings.ts` | `onDemandChordSource: 'auto'` по умолчанию |
| `src/providers/registry.ts` | pesni.ru в поиске всегда (без чекбокса) |
| `src/screens/ChordsScreen.tsx` | UI «Режим: авто», расширенные настройки свёрнуты |

## Было → стало

| Было | Стало |
|------|--------|
| Радио pesni / AmDm в ⚙ | По умолчанию **авто**; принудительный источник — в «Расширенные» |
| Чекбоксы «включить pesni» для поиска | Поиск всегда: SQLite + metadata + pesni.ru |
| Разная логика enrich / кнопки | Одна функция `fetchOnDemandChordSheetAuto` |
| Ошибка без контекста | «Пробовали: pesni.ru: …; AmDm: …» |
| «Свой URL (Vercel)» в UI | «Свой URL прокси (опционально)» |

## Проверка

1. **Кино — Звезда** — поиск → выбор → таб с pesni.ru (HTTPS).
2. **Radiohead — Creep** — при отсутствии на pesni.ru fallback на AmDm (`npm run dev-proxy`, одна Wi‑Fi).

Политика: без stub-табов (`no-stubs-half-features`).
