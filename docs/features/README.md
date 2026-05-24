# Лог фич и изменений (RecoTune)

Здесь **одна фича / одна тема = один файл** с кратким описанием: зачем, какие файлы, что было → что стало.

## Как пользоваться

- Новые изменения: добавьте файл `YYYY-MM-DD-краткий-slug.md` в эту папку и при необходимости строку в [../CHANGELOG.md](../CHANGELOG.md).
- В теле фичи указывайте пути к коду и смысл правок (не обязательно полный diff).

## Записи

| Дата       | Тема | Файл |
|------------|------|------|
| 2026-05-24 | Pitch-графики: parity Tuner / Chords / Melody | [2026-05-24-pitch-chart-parity-tuner-chords.md](./2026-05-24-pitch-chart-parity-tuner-chords.md) |
| 2026-05-24 | Melody: ось времени на графике (без разгона) | [2026-05-24-melody-chart-time-axis.md](./2026-05-24-melody-chart-time-axis.md) |
| 2026-05-24 | Практика: свайп текста (Android gesture) | [2026-05-24-practice-lyrics-scroll-gesture-fix.md](./2026-05-24-practice-lyrics-scroll-gesture-fix.md) |
| 2026-05-24 | Melody: playhead, нота не убегает вперёд | [2026-05-24-melody-chart-playhead-regression-fix.md](./2026-05-24-melody-chart-playhead-regression-fix.md) |
| 2026-05-24 | AI Lab: вокал, минус, playback дорожек | [2026-05-24-ailab-stems-playback-layout.md](./2026-05-24-ailab-stems-playback-layout.md) |
| 2026-05-24 | Melody график + Chords подгрузка | [2026-05-24-melody-chart-chords-ux.md](./2026-05-24-melody-chart-chords-ux.md) |
| 2026-05-23 | Chords: поиск и подгрузка табов | [2026-05-23-chord-search-fetch-reliability.md](./2026-05-23-chord-search-fetch-reliability.md) |
| 2026-05-23 | Практика: свайп текста пальцем | [2026-05-23-practice-lyrics-finger-scroll.md](./2026-05-23-practice-lyrics-finger-scroll.md) |
| 2026-05-22 | Android Back + фильтры «База песен» | [2026-05-22-back-nav-library-filters.md](./2026-05-22-back-nav-library-filters.md) |
| 2026-05-22 | Практика: скролл текста и автопрокрутка | [2026-05-22-practice-lyrics-scroll-ux.md](./2026-05-22-practice-lyrics-scroll-ux.md) |
| 2026-05-22 | Creep: runtime normalize (апостроф, SQLite) | [2026-05-22-creep-chorus-runtime-normalize.md](./2026-05-22-creep-chorus-runtime-normalize.md) |
| 2026-05-22 | Creep: аккорд на creep, не перед I'm | [2026-05-22-creep-chorus-chord-placement.md](./2026-05-22-creep-chorus-chord-placement.md) |
| 2026-05-22 | Chords: ложные [a] в тексте, база при входе | [2026-05-22-chord-brackets-library-tab.md](./2026-05-22-chord-brackets-library-tab.md) |
| 2026-05-22 | UX batch: 7 пользовательских фиксов | [2026-05-22-ux-fixes-batch.md](./2026-05-22-ux-fixes-batch.md) |
| 2026-05-22 | Vercel chord API, поиск, НАЙТИ без каталога | [2026-05-22-vercel-chord-api-nav-cleanup.md](./2026-05-22-vercel-chord-api-nav-cleanup.md) |
| 2026-05-22 | Авто-прокси табов, нейтральный UI | [2026-05-22-auto-chord-proxy-ui.md](./2026-05-22-auto-chord-proxy-ui.md) |
| 2026-05-22 | Практика: тихая подгрузка аккордов, ⚙ в шапке | [2026-05-22-practice-quiet-chord-load.md](./2026-05-22-practice-quiet-chord-load.md) |
| 2026-05-22 | Chords: поиск в Практике (база), не дубль на НАЙТИ | [2026-05-22-practice-library-search-primary.md](./2026-05-22-practice-library-search-primary.md) |
| 2026-05-22 | Практика: модал «База песен» на всю высоту | [2026-05-22-practice-library-modal-layout.md](./2026-05-22-practice-library-modal-layout.md) |
| 2026-05-22 | Архив legacy 536, минимальный builtin seed | [2026-05-22-legacy-catalog-archive.md](./2026-05-22-legacy-catalog-archive.md) |
| 2026-05-22 | Metadata: поиск без полной загрузки SQLite | [2026-05-22-metadata-on-demand-search.md](./2026-05-22-metadata-on-demand-search.md) |
| 2026-05-22 | Pitch: регрессия сглаживания графиков | [2026-05-22-pitch-graph-smoothing-regression-fix.md](./2026-05-22-pitch-graph-smoothing-regression-fix.md) |
| 2026-05-22 | Melody: транскрипция MVP1 (контур) | [2026-05-22-melody-transcription-mvp1.md](./2026-05-22-melody-transcription-mvp1.md) |
| 2026-05-22 | Chords: nested SQLite tx при metadata import | [2026-05-22-chords-metadata-nested-tx-fix.md](./2026-05-22-chords-metadata-nested-tx-fix.md) |
| 2026-05-22 | Metadata: MusicBrainz ≥5000 (D7) | [2026-05-22-metadata-musicbrainz-5000.md](./2026-05-22-metadata-musicbrainz-5000.md) |
| 2026-05-22 | Chords: поиск первым, metadata catalog | [2026-05-22-chords-search-first-metadata.md](./2026-05-22-chords-search-first-metadata.md) |
| 2026-05-22 | On-demand AmDm/UG через прокси | [2026-05-22-on-demand-chord-providers.md](./2026-05-22-on-demand-chord-providers.md) |
| 2026-05-22 | Каталог: аккорды в строках, миграция builtin | [2026-05-22-catalog-chord-lyrics-quality.md](./2026-05-22-catalog-chord-lyrics-quality.md) |
| 2026-05-22 | Chords: каталог UI + SQLite nested tx | [2026-05-22-chords-catalog-ui-fix.md](./2026-05-22-chords-catalog-ui-fix.md) |
| 2026-05-22 | Chords: поиск каталог / НАЙТИ init fix | [2026-05-22-chords-search-init-fix.md](./2026-05-22-chords-search-init-fix.md) |
| 2026-05-22 | Chords НАЙТИ: без AudD, локальный recognizer | [2026-05-22-local-recognition-no-audd.md](./2026-05-22-local-recognition-no-audd.md) |
| 2026-05-22 | Chords: библиотека Phase 2–4, умный поиск | [2026-05-21-chord-providers-phase2-4.md](./2026-05-21-chord-providers-phase2-4.md) |
| 2026-05-21 | Melody: anti-noise / anti-slide детектор | [2026-05-21-melody-detector-noise-slide-filter.md](./2026-05-21-melody-detector-noise-slide-filter.md) |
| 2026-05-21 | Melody: детектор нот v2 (YIN, voting) | [2026-05-21-melody-detector-v2.md](./2026-05-21-melody-detector-v2.md) |
| 2026-05-21 | Melody: повторы одной ноты, акцент, PLAY | [2026-05-21-melody-repeat-notes-fix.md](./2026-05-21-melody-repeat-notes-fix.md) |
| 2026-05-21 | Melody: playhead на нотном стане при PLAY | [2026-05-21-staff-playback-playhead.md](./2026-05-21-staff-playback-playhead.md) |
| 2026-05-21 | Melody: длительности PLAY, монотонные ts | [2026-05-21-melody-playback-timing-fix.md](./2026-05-21-melody-playback-timing-fix.md) |
| 2026-05-21 | Melody: PLAY по спетому темпу | [2026-05-21-melody-rhythm-timing.md](./2026-05-21-melody-rhythm-timing.md) |
| 2026-05-21 | График: скролл к началу, разнесение меток | [2026-05-21-chart-scroll-markers.md](./2026-05-21-chart-scroll-markers.md) |
| 2026-05-21 | Melody: качество PLAY, детектор нот | [2026-05-21-melody-playback-quality.md](./2026-05-21-melody-playback-quality.md) |
| 2026-05-21 | Melody: двойной стан, PLAY + аккорды | [2026-05-21-dual-staff-chord-playback.md](./2026-05-21-dual-staff-chord-playback.md) |
| 2026-05-21 | Melody: PLAY, шапка, скролл графика | [2026-05-21-melody-playback-layout.md](./2026-05-21-melody-playback-layout.md) |
| 2026-05-21 | График: история, скролл, метки стабильных нот | [2026-05-21-pitch-chart-history-markers.md](./2026-05-21-pitch-chart-history-markers.md) |
| 2026-05-21 | Melody: fit-to-key, chords, staff (phase 2) | [2026-05-21-melody-chords-staff.md](./2026-05-21-melody-chords-staff.md) |
| 2026-05-21 | Melody workspace: график, анализ, save JSON | [2026-05-20-melody-recognition-page.md](./2026-05-20-melody-recognition-page.md) |
| 2026-05-21 | Melody + Media tabs, детектор спетых нот v2 | [2026-05-20-sung-notes-v2-tabs.md](./2026-05-20-sung-notes-v2-tabs.md) |
| 2026-05-20 | Release: краш playback Studio, URI + MediaControl | [2026-05-20-playback-crash-fix.md](./2026-05-20-playback-crash-fix.md) |
| 2026-05-20 | Фон + кнопки наушников / lock screen | [2026-05-20-background-headset-controls.md](./2026-05-20-background-headset-controls.md) |
| 2026-05-20 | Seek без дёрганья, BT-микрофон в настройках | [2026-05-20-seek-scrub-bt-mic.md](./2026-05-20-seek-scrub-bt-mic.md) |
| 2026-05-20 | Тюнер / практика: история спетых нот, EN default | [2026-05-20-sung-notes-history.md](./2026-05-20-sung-notes-history.md) |
| 2026-05-20 | Тюнер: хроматический режим (нота + ¢) | [2026-05-20-tuner-chromatic-mode.md](./2026-05-20-tuner-chromatic-mode.md) |
| 2026-05-20 | Тюнер: вёрстка, высокие ноты, RU/EN | [2026-05-20-tuner-layout-high-notes-i18n.md](./2026-05-20-tuner-layout-high-notes-i18n.md) |
| 2026-05-19 | Chords НАЙТИ: этап A (текст + аккорды каталога) | [2026-05-19-chords-identify-stage-a.md](./2026-05-19-chords-identify-stage-a.md) |
| 2026-05-19 | Очередь: chords → план A–D (Shazam/напев) | [2026-05-19-roadmap-queue.md](./2026-05-19-roadmap-queue.md) |
| 2026-05-19 | Chords: baseline движка + настройка порогов | [2026-05-19-chords-engine-baseline.md](./2026-05-19-chords-engine-baseline.md) · [tuning](./2026-05-19-chords-engine-tuning.md) |
| 2026-05-19 | Тюнер: цель по струне, график, высокие ноты | [2026-05-19-tuner-string-target.md](./2026-05-19-tuner-string-target.md) |
| 2026-05-19 | Studio: компакт сессий, модалка настроек | [2026-05-19-studio-layout-settings-modal.md](./2026-05-19-studio-layout-settings-modal.md) |
| 2026-05-19 | Studio: mix + offset, минус, VOL | [2026-05-19-studio-mix-offset-minus-gain.md](./2026-05-19-studio-mix-offset-minus-gain.md) |
| 2026-05-19 | Studio: задержка 150/BT 700, маршрут звука | [2026-05-19-studio-audio-routing.md](./2026-05-19-studio-audio-routing.md) |
| 2026-05-15 | Стабильность тюнера и стрелки | [2026-05-15-tuner-needle-stability.md](./2026-05-15-tuner-needle-stability.md) |
| 2026-05-15 | Практика Chords: вёрстка, док, текст | [2026-05-15-chords-practice-layout.md](./2026-05-15-chords-practice-layout.md) |
| 2026-05-18 | Chords LIVE: компакт + нижний док | [2026-05-18-chords-live-layout.md](./2026-05-18-chords-live-layout.md) |
| 2026-05-18 | Studio: модалки на маленьком экране | [2026-05-18-studio-settings-modal.md](./2026-05-18-studio-settings-modal.md) |
