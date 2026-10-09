# APK: English first + chords URL in the build

**Date:** 2026-09-19 · **Files:** `app.json`, `app.config.js`, `chordFetchUrl.ts`, `autoChordProxy.ts`, `LocaleContext.tsx`, `appLocale.ts`, `TunerScreen.tsx`, `artistName.ts`, `offlineCatalog.ts`, `ChordsScreen.tsx`

## Why

The 11 Sep APK could not load remote tabs (no Metro, empty `extra.chordFetchApiUrl`). UI opened in Russian, and the catalog listed pesni.ru Cyrillic artists first (`Агата Кристи`…), with `localeCompare(..., 'ru')`.

## Was → now

| Was | Now |
|-----|-----|
| Release APK had no chord-fetch URL | `https://recotune-chords.vercel.app/api/fetch-chords` baked into extra + code fallback |
| `LocaleContext` started as `ru`; old `app_locale.json` stuck | Default `en`; file `app_locale_v2.json` so the old RU save is ignored |
| Tuner toggle RU then EN | EN then RU |
| Catalog ingest order / `localeCompare('ru')` | Latin labels first, Cyrillic last |
| Offline tabs in APK | **2634** verified ChordPro (pesni + overlay 220 + legacy verified). No extra scrape this build. |

English remains the first language. Russian is optional via the tuner toggle. Remote AmDm/UG still needs network to that Vercel URL; LAN `:8787` still wins when Metro is present.

A **new APK** is required. The 11 Sep build does not contain these changes.
