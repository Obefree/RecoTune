# Legacy builtin song archive

## `legacy-songs-536.json`

Full bundled catalog (~536 entries) exported before the **2026-05-22 minimal seed**.

- Many rows are **metadata-only** (title + chord progression, no ChordPro lyrics).
- Some Russian / placeholder lyrics were low quality or humorous — **not** used as default practice seed.
- Kept for optional restore via **Настройки провайдеров → Импорт архивного каталога (536)**.

Regenerate from a snapshot:

```bash
npx tsx tools/export-legacy-catalog.ts
```

(Requires `src/data/legacySongDatabase.ts` snapshot; not shipped in the app bundle.)

## Active seed

Default builtin practice songs: `src/data/builtinSongsSeed.ts` (~32 songs with annotated ChordPro-style lyrics).

Metadata search (~5000 titles): `assets/metadata/chunk-*.json` — lazy scan, no full SQLite import on Chords open.

## `pesni-chordpro.json`

**1113** verified ChordPro tabs from pesni.ru (bundle version **2**), imported into SQLite on app start (background). Regenerate on PC:

```bash
npm run ingest-pesni-chords
```

Checkpoint: `tools/.pesni-ingest-checkpoint.json` (gitignored). See `docs/features/2026-07-20-chords-phone-scale.md`.
