# Melody: детектор нот v2 (onset + pitch voting)

**Дата:** 2026-05-21  
**Зачем:** ~половина нот пропускалась, особенно при быстром пении. Нужен гибридный onset + подтверждение высоты с YIN-фильтром.

## Файлы

- `src/utils/sungNoteDetector.ts` — dual-path, YIN gate, midi hysteresis, attack fast path
- `src/components/TunerEngine.tsx` — `yinConfidence` в pitch-сообщениях
- `src/hooks/useSungNoteHistory.ts` — post-pass `mergeJitterNotes`, debug state
- `src/screens/MelodyScreen.tsx` — передача YIN, `__DEV__` chip
- `src/screens/TunerScreen.tsx` — YIN в детектор (график)
- `src/utils/melodyPlayback.ts` — `MERGE_GAP_MS` 60 ms

## Алгоритм (v2)

1. **YIN gate** — pitch в детектор только при `yinConfidence ≤ 0.18` (CMNDF из WebView).
2. **Midi hysteresis** — кандидат продвигается, если **3 из 4** последних кадров согласны в пределах ±1 полутона.
3. **Dual path commit:**
   - **(a) Stability path:** pitch стабилен ≥120 ms (или ≥80 ms при attack/accent).
   - **(b) Fast confirm:** ≥2 кадра одной высоты в окне 40 ms (быстрые стаккато).
4. **Attack fast path** — скачок RMS derivative ≥35% rolling avg → `accentMinStableMs` 80 ms.
5. **Fast runs:** `repeatGapMs` 150 ms (та же нота), `debounceNewMs` 90 ms + **2-frame stability** для смены высоты.
6. **Post-pass:** слияние только same-midi jitter <60 ms; разные высоты не схлопываются.

Melody использует тот же `TunerEngine` WebView, что и тюнер (YIN + median + harmonic fold).

## Было → стало

| Аспект | Было (v1) | Стало (v2) |
|--------|-----------|------------|
| YIN фильтр | нет | gate при CMNDF > 0.18 |
| Подтверждение высоты | только minStableMs | stability **или** 2-frame / 40 ms |
| Midi стабильность | ±1 в кандидате | vote 3/4 кадров ±1 semitone |
| Быстрая атака | accent RMS 1.4× | + RMS derivative spike |
| Повтор той же ноты | repeatGapMs 200 ms | 150 ms |
| Смена ноты | debounceNewMs 130 ms | 90 ms + 2-frame stability |
| Jitter merge | 80 ms (PLAY) | 60 ms (detector + PLAY) |
| Debug | нет | `__DEV__` chip: YIN, vote, conf, ATK |
| Confidence | нет | 0–1 на каждой зарегистрированной ноте |

## Константы (`SUNG_NOTE_DETECTOR_DEFAULTS`)

- `maxYinConfidence: 0.18`
- `minStableMs: 120`, `accentMinStableMs: 80`
- `repeatGapMs: 150`, `debounceNewMs: 90`
- `midiVoteFrames: 4`, `midiVoteRequired: 3`
- `fastConfirmFrames: 2`, `fastConfirmWindowMs: 40`
- `differentNoteMinFrames: 2`, `attackDerivativeRatio: 0.35`
- `jitterMergeMs: 60`

## Советы пользователю

- Пой **стаккато** — короткая атака на каждой ноте помогает attack-path.
- Делай **короткую паузу** между нотами (≥100 ms) при быстрых пассажах.
- Держи **стабильный тон** 120+ ms на длинных нотах.
- В dev-сборке смотри chip: YIN < 0.18, vote 3/4, conf > 0.6.

## Как проверить

1. Melody → START → быстрая гамма 5–8 нот → в ленте должно быть ≥80% нот.
2. Повтор одной высоты с акцентом (E4·E4·E4) — каждый onset отдельно.
3. `npx tsc --noEmit` — без ошибок.
