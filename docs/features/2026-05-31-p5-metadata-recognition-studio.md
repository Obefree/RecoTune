# P5: каталог, распознавание chroma/BPM, Melody → Studio

**Зачем:** офлайн-поиск по русским артистам (Мельница), честное НАЙТИ по звуку (BPM+тональность), экспорт basic-pitch в Studio.

## Файлы

| Область | Файлы |
|--------|--------|
| Каталог D7 | `tools/append-metadata-artists.mjs`, `data/metadata-supplement-artists.json`, `assets/metadata/chunk-*.json`, `src/metadata/bundledChunks.ts`, `src/metadata/metadataSearch.ts` |
| Recognition v2 | `src/recognition/snippetAnalyzer*.ts`, `chromaMatch.ts`, `recordingSignals.ts`, `localSongRecognizer.ts`, `src/components/SnippetAnalyzerEngine.tsx`, `ChordsScreen.tsx` |
| Melody → Studio | `MelodyPlayerEngine.tsx` (`renderMelodyWav`), `MelodyScreen.tsx`, `studioImport.ts` |

## Было → стало

| | Было | Стало |
|---|------|--------|
| Каталог | ~5000 треков, 49 артистов в chunks; Мельница отсутствует | `npm run append-metadata` дополняет MB-артистов; поиск бустит совпадения по `chunk.artists` |
| НАЙТИ по записи | Только имя файла + слабый BPM по каталогу | WebView: chroma 12 + BPM + key hint → скоринг по `bpm`/`key` builtin; auto-match только при пороге P4 |
| Melody «Из файла» | Сегменты + PLAY | Кнопка **В STUDIO** → WAV из синтеза нот → сессия «Melody» |

## Chroma-match (кратко)

1. Сниппет (≤15 с) декодируется в hidden WebView (`SnippetAnalyzerEngine` на Chords).
2. Считаются BPM (onset energy) и нормированный chroma-вектор 12 + оценка тональности (`G major` / `A minor`).
3. `localSongRecognizer` сравнивает с песнями SQLite: BPM ±4–8, `scoreKeyMatch`, cosine chroma vs профиль тональности.
4. Совпадение в UI только если top score ≥72, отрыв ≥12, есть **tempo** + **melody** (key) в reasons — иначе `snippet_saved`.

## Команды

```bash
npm run append-metadata
npm run verify-metadata-search
```

Ingest полный каталог: `npm run ingest-metadata` (как раньше).
