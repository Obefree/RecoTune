# More offline tabs in the APK

**Date:** 2026-09-20 · **Files:** `tools/ingest-pesni-chordpro.mjs`, catalog shards, `proxy-parsed-chords.json`

## Why

The 19 Sep APK had 2634 verified tabs. Alex asked for more. Local disk was already exhausted; extra tabs had to be fetched.

## Was → now

| Was | Now |
|-----|-----|
| 2634 offline ChordPro | **3219** (pesni 2759 + AmDm overlay + legacy) |
| Pesni ingest stuck at last artist | `--start-artist` + `--from-start` continues Latin/English names with per-artist 40 |
| AmDm store 220 | Overlay **523** (Beatles, Queen, Coldplay, Stones…) |

No fake tabs. Ingest was paused to freeze the catalog for this APK; it can resume toward 4000 / remaining AmDm tracks.
