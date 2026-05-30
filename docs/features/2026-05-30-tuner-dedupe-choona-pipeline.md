# Tuner: dedupe + Choona-style pipeline split

**Дата:** 2026-05-30

## Зачем

Правило `minimal-changes-no-duplication`: убрать мёртвые и дублирующие слои после итераций тюнера (e5b0e81 и ранее). Выровнять архитектуру с [Choona reference](https://github.com/rohankhayech/Choona) — отдельный путь детектор → UI без копирования TarsosDSP.

## Аудит (кратко)

| Находка | Действие |
|---------|----------|
| `useTuner.ts` + `pitchDetection.ts` — expo-av WAV, не импортируются | **Удалены** |
| `TUNER_CHART_STABILIZER` — не используется после e5b0e81 | **Удалён**; `ChartFreqStabilizer` только Melody |
| `freqToMidi` ×3 (`noteUtils`, `tunerDisplay`, `pitchChartHistory`, `pitchFrame`) | **Один** `noteUtils.freqToMidi` |
| WebView median + `TunerPitchDisplay` на табе Tuner | Tuner profile: **raw Hz** в RN, сглаживание только в `TunerPitchDisplay` |
| Melody | Без изменений: WebView `stabilizeFreq` + `ChartFreqStabilizer` |

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/hooks/useTuner.ts` | удалён |
| `src/utils/pitchDetection.ts` | удалён |
| `src/utils/noteUtils.ts` | `freqToMidi` |
| `src/utils/pitchChartHistory.ts` | только Melody stabilizer |
| `src/utils/pitchFrame.ts` | `freqToMidiFloat` → alias |
| `src/utils/tunerDisplay.ts` | импорт `freqToMidi` |
| `src/components/TunerEngine.tsx` | tuner: raw Hz; melody: median path |
| `tools/verify-pitch-chart-history.mjs` | без tuner stabilizer smoke |
| KB `choona-tuner-tech-reference.md` | архитектурный план |

## Было → стало

| Область | Было | Стало |
|---------|------|--------|
| Захват pitch | Два пути (WebView + мёртвый WAV hook) | Только WebView |
| Tuner WebView | median → RN + display | raw → RN display (melody profile как было) |
| Chart stabilizer presets | melody + tuner | Только melody |
| MIDI из Hz | 4 копии формулы | `noteUtils.freqToMidi` |

## Проверка

1. `npm run verify-tuner-display` && `npm run verify-pitch-chart` && `npm run verify-tuner-chart`
2. **Tuner:** тихий гудок, плавная стрелка, график 30+ с в окне
3. **Melody:** запись/график как до правки
