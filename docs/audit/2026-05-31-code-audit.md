# RecoTune code audit — 2026-05-31

Read-only review + minimal fixes. Scope: duplicates, logic, stubs (policy `no-stubs-half-features.mdc`).

## Executive summary

| Severity | Count | Notes |
|----------|-------|--------|
| Critical (fixed) | 1 | Mic «напев с микрофона» did not apply contour |
| Medium (fixed) | 1 | Recognizer `merge()` dropped weaker signal reasons |
| Low / deferred | 6 | See below |

---

## 1. Duplicates

### Pitch / smoothing

| Layer | Location | Verdict |
|-------|----------|---------|
| YIN + median | `TunerEngine.tsx` (`mode: tuner \| melody`) | **OK** — single WebView, profiles differ |
| Chart EMA | `MelodyScreen` + `FrequencyChart` `smoothCenterMidi` | **OK** — display only; contour uses raw `pitchFrames` |
| Contour DSP | `melodyTranscription.ts` (`smoothVoicedFrames`, gates) | **OK** — not duplicated in Tuner |
| Chords practice | Separate WebView in `ChordsScreen` | **OK** — intentional HPS path |

No second tuner refactor needed.

### URL resolution (chord vs stem)

| Concern | Implementation |
|---------|----------------|
| Shared Metro host | `readExpoDebuggerHost()` in `chordFetchUrl.ts`, imported by `stemSeparateUrl.ts` |
| Chord proxy | `chordFetchUrl.ts` — env → Metro `:8787` → `app.extra.chordFetchApiUrl` |
| Stem server | `stemSeparateUrl.ts` — legacy `STEM_URL` → env base / Metro `:8788` → `app.extra.stemServerUrl` |

**Not duplicated** — parallel resolvers, different ports/paths. `getEffectiveChordFetchUrl()` adds user-saved URL + Vercel/Metro priority (chord-only).

**Deferred:** In dev, Metro stem URL wins over `app.extra.stemServerUrl` even when a hosted URL is baked into APK config — by design for LAN; document for release testing.

### Segment conversion (melodyMidi / basic-pitch / contour)

| Entry | Function | Used by |
|-------|----------|---------|
| Pitch frames | `transcribeFromPitchFrames` | Melody mic, mic-hum button |
| Snippet MIDI | `segmentsFromMelodyMidi` | НАЙТИ → Melody import, `analyzeHumUri` |
| Server notes | `segmentsFromBasicPitchNotes` | File import / `POST /transcribe` |
| Events | `segmentsToRegisteredEvents` | All contour paths |

**OK** — one module (`melodyTranscription.ts`), three ingress mappers, one egress.

### SnippetAnalyzer

- Single global instance: `App.tsx` → `SnippetAnalyzerEngine`.
- Bridge: `snippetAnalyzerBridge.ts` (used by `recordingSignals`, Chords НАЙТИ, Melody напев import).
- **No duplicate WebView** on Melody tab.

### Dead code (P1–P7)

| Item | Status |
|------|--------|
| `projectChordsOntoLyrics` | **Unused** in `src/` (only definition). Safe to delete later; not called from practice paths. |
| `recognition/index.ts` | Minimal exports — OK |
| `backups/` | Historical — out of audit scope |

---

## 2. Logic errors

### Fixed: `handleMicHumContour` (`MelodyScreen.tsx`)

**Bug:** After `transcribeFromPitchFrames`, code set `humContour` to `null`, only updated hint — no `loadSnapshot`, no staff/events.

**Fix:** Call `applyHumTranscription(result, …)` (same as file/snippet napев path).

### Fixed: `rankBySignals` merge (`localSongRecognizer.ts`)

**Bug:** If a second hit had **lower** score, `merge()` ignored it — lost `text` / `tempo` reasons when audio score was already high.

**Fix:** Always union `reasons`; keep `max(score)` and best-scoring row as base.

### Reviewed: auto-match thresholds

- `MIN_AUTO_MATCH_SCORE = 72`, `MIN_LEAD_OVER_SECOND = 12`, `hasStrongSignal()` — conservative; recording path returns `snippet_saved` unless confident.
- **Gap (deferred):** `melodyMidi` is stored in hints but **not** used in `scoreSongByAudioSignals` — reason tag `melody` means key match, not contour match. Rename or add contour scoring later.

### Reviewed: `stemSeparateUrl`

- Legacy `EXPO_PUBLIC_STEM_URL`, base `STEM_SERVER_URL`, Metro, `app.extra` — order documented in module.
- `stemTranscribeUrlFromSeparate` / `stemHealthUrlFromSeparate` handle `/separate` suffix and port 8788.

### Reviewed: `onDemandChordAuto`

- Chain: settings order → proxy health → AmDm / UG / pesni.
- Stubs rejected via `chordFetchProxy.isChordProStubBody` + `quiet: true` errors → «Не найдено».
- pesni.ru in `auto` always last; disabled flag only affects non-auto modes (except explicit `pesni_ru` source).

### Reviewed: `providerSettings` defaults

- `pesni_ru: false`, `ultimate_guitar: true`, `onDemandChordSource: 'auto'`.
- `isProviderEnabled`: `!== false` — missing keys default enabled.

### ChordsScreen find + Melody

- Find: `localSongRecognizer.recognizeFromRecording` + global SnippetAnalyzer.
- Melody napев: reuses `analyzeRecordingUri` on saved snippet — **consistent**, no second analyzer.

---

## 3. Stubs / fake behavior

| Area | Finding |
|------|---------|
| ChordPro | `isChordProStubBody`, no fake tabs in practice (`hasVerifiedPracticeLyrics`) |
| `projectChordsOntoLyrics` | Dead — not shown as tab |
| lyrics.ovh | Metadata provider only (`lyricsProvider.ts`) |
| Stem `GET /transcribe` 501 | Replaced by `POST /transcribe`; client uses POST only |
| Health `ok: true` without demucs | Server returns 200; UI should use `probeStemServer` + `basic_pitch` / `demucs` flags — Melody/AILab show setup hints |

No user-visible fake success found in chord practice paths.

---

## 4. Verification

| Script | Result |
|--------|--------|
| `verify-tuner-display` | OK |
| `verify-pitch-chart` | OK |
| `verify-metadata-search` | 7/7 OK |
| `verify-chord-normalize` | PASS |
| `verify-chord-transpose` | ok |
| `test-stem-separate` | GET /health 200; `demucs=false`, `basic_pitch=false` on this PC (Python env) |

---

## 5. Changes in this session

| File | Change |
|------|--------|
| `src/screens/MelodyScreen.tsx` | Fix mic hum contour apply |
| `src/recognition/localSongRecognizer.ts` | Fix candidate merge reasons |

Commit: `fix: audit dedupe and logic` (local, no push).

---

## 6. Deferred backlog

1. Use or remove `projectChordsOntoLyrics`.
2. Melody-aware scoring in `localSongRecognizer` (or rename `melody` reason → `key`).
3. Optional: unify stem/chord “resolved URL” UI types (cosmetic).
4. Release QA: `EXPO_PUBLIC_STEM_SERVER_URL` vs Metro when testing hosted stems on device with dev client.
