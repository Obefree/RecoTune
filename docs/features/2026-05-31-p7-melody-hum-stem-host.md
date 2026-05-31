# P7: лента напева в Melody + hosted stem URL

**Дата:** 2026-05-31

## Зачем

P6 добавил `melodyMidi` в SnippetAnalyzer только для подсказок НАЙТИ. Нужна **полная лента/стан** на Melody после микрофона или импорта сниппета, и **рабочий** `EXPO_PUBLIC_STEM_SERVER_URL` для AI Lab без отдельного legacy env.

## Файлы

| Область | Файлы |
|---------|--------|
| Контур напева | `src/utils/melodyTranscription.ts` (`segmentsFromMelodyMidi`), `src/recognition/snippets.ts` |
| Melody UI | `src/screens/MelodyScreen.tsx` |
| Stem URL | `src/providers/stemSeparateUrl.ts`, `app.config.js` |
| AI Lab | `src/screens/AILabScreen.tsx` |
| Analyzer global | `App.tsx` (`SnippetAnalyzerEngine`) |
| Релиз | `app.config.js` version `1.0.1`, `docs/BUILD-ANDROID.md` |

## Было → стало

| Было | Стало |
|------|--------|
| `melodyMidi` только в подсказках Chords | «Напев» на Melody: сниппет НАЙТИ / аудио → лента + `DualStaffView`, PLAY по сегментам |
| Контур с микрофона только неявно | После STOP — автопоказ стана при уверенном контуре; кнопка «Контур» |
| Stem: `EXPO_PUBLIC_STEM_URL` или Metro | + `EXPO_PUBLIC_STEM_SERVER_URL` → `expo.extra.stemServerUrl` → Metro `:8788` |
| AI Lab neural — только source label | При выборе «Нейросеть» — **полный URL** сервера + источник |
| Версия 1.0.0 | **1.0.1** в `app.config.js` |

## Политика

- Без заглушек: пустой `melodyMidi` → ошибка «ноты не распознаны», не fake strip.
- Один пайплайн: `segmentsFromMelodyMidi` / `transcribeFromPitchFrames` / `segmentsFromBasicPitchNotes`.

## Как проверить

1. **Melody → START → STOP** (напев 5–10 с) — лента нот, стан, PLAY.
2. **Chords → НАЙТИ → запись** → **Melody → Напев** — выбрать сниппет, лента + BPM/key в подсказке.
3. **AI Lab → ДОРОЖКИ → Нейросеть** — строка с URL (`EXPO_PUBLIC_STEM_SERVER_URL` или Metro).
4. `npm run build:android:release` — версия **1.0.1** в APK.
