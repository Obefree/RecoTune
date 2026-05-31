# Dev stack :8787+:8788, P4 честное распознавание, Studio import

**Дата:** 2026-05-31  
**Roadmap:** A (dev UX), P4 (НАЙТИ), C (Studio после Demucs)

## Зачем

- Один `npm start` поднимает chord-fetch и stem-separate на ПК.
- НАЙТИ не подставляет случайную песню после записи без сигналов.
- После Demucs — импорт минус/вокал в Studio без ручного share.

## Файлы

| Область | Файлы |
|---------|--------|
| Dev | `tools/dev-all.mjs`, `tools/stem-separate/stems-dev.mjs`, `package.json` |
| P4 | `src/recognition/localSongRecognizer.ts`, `recordingSignals.ts` |
| Studio | `src/utils/studioImport.ts`, `AILabScreen.tsx` |
| UI | `ChordsScreen.tsx` (подписи НАЙТИ) |

## Было → стало

| Тема | Было | Стало |
|------|------|--------|
| `npm start` | только `chords:dev` (:8787) | `dev:all` → :8787 + :8788 |
| `npm run stems:dev` | `npm run dev-proxy` в подпапке | `stems-dev.mjs` (авто-spawn) |
| Запись НАЙТИ | `rankBySignals({})` мог дать match | Только уверенный match (text/chords/tempo + порог); иначе `snippet_saved` |
| Файл | «распознавание» без метаданных | Парс «Artist - Title» из имени → подсказка, не авто-match |
| AI Lab stems | только play/export | Кнопка «ОТКРЫТЬ В STUDIO» → сессия Demucs |

## Команды

```bash
npm start          # dev:all + Expo (:8787, :8788)
npm run start:expo # только Metro
npm run dev:all    # только прокси на ПК
npm run chords:dev
npm run stems:dev
```

## P5 / дальше

- Metadata catalog ≥5000 (D7), on-demand табы.
- Распознавание по звуку: chroma/BPM из записи (не только имя файла).
- Melody → Studio import (симметрия с AI Lab).
