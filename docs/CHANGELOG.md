# Changelog

Краткий список релизных заметок. Подробности по темам — в [docs/features/README.md](./features/README.md).

## [Unreleased]

### 2026-05-24

- **Chords / Практика:** стабильный свайп текста на Android — убраны touch-хендлеры с обёртки ScrollView, автопрокрутка не сбрасывает offset. См. [docs/features/2026-05-24-practice-lyrics-scroll-gesture-fix.md](./features/2026-05-24-practice-lyrics-scroll-gesture-fix.md).
- **Melody график:** playhead — нота больше не «убегает» вперёд (откат cap скролла 9 px, EMA 0.20). См. [docs/features/2026-05-24-melody-chart-playhead-regression-fix.md](./features/2026-05-24-melody-chart-playhead-regression-fix.md).
- **AI Lab / ДОРОЖКИ:** режимы **вокал** и **минус**, раскладка на весь экран, воспроизведение stem после разделения. См. [docs/features/2026-05-24-ailab-stems-playback-layout.md](./features/2026-05-24-ailab-stems-playback-layout.md).
- **Melody / Chords UX:** плавный график высоты (voiced-only, throttle, playhead ~57%), таймаут подгрузки табов 15 с, параллельный AmDm. См. [docs/features/2026-05-24-melody-chart-chords-ux.md](./features/2026-05-24-melody-chart-chords-ux.md).

### 2026-05-23

- **Chords:** поиск (раскладка RU/EN, metadata) и подгрузка табов — без stub-заглушек, подсказки proxy/Vercel, AmDm multi-query. См. [docs/features/2026-05-23-chord-search-fetch-reliability.md](./features/2026-05-23-chord-search-fetch-reliability.md).
- **Chords / Практика:** надёжный свайп текста — `delayPressIn` на аккордах, View вместо nested ScrollView, стоп авто при касании. См. [docs/features/2026-05-23-practice-lyrics-finger-scroll.md](./features/2026-05-23-practice-lyrics-finger-scroll.md).

### 2026-05-22

- **Chords / UX:** Android Back — стек оверлеев Chords; табы `history`; упрощена «База песен». См. [docs/features/2026-05-22-back-nav-library-filters.md](./features/2026-05-22-back-nav-library-filters.md).
- **Chords / Практика:** прокрутка текста и автопрокрутка — отдельная панель BPM, стоп при свайпе, без nested-scroll конфликта. См. [docs/features/2026-05-22-practice-lyrics-scroll-ux.md](./features/2026-05-22-practice-lyrics-scroll-ux.md).
- **Chords:** Creep chorus — runtime normalize (curly `I'm`, repair SQLite, mid-line UI). См. [docs/features/2026-05-22-creep-chorus-runtime-normalize.md](./features/2026-05-22-creep-chorus-runtime-normalize.md). `npm run verify-chord-normalize`.
- **Chords:** Creep chorus — аккорд не перед `I'm`, а на последнем слове (`But I'm a [G]creep`); merge `G` над connector-строкой. См. [docs/features/2026-05-22-creep-chorus-chord-placement.md](./features/2026-05-22-creep-chorus-chord-placement.md). `npm run verify-chord-normalize`.
- **Chords:** v2 нормализации текста (`stripSpuriousChordBrackets`, merge по числу слов) + база песен при фокусе вкладки. См. [docs/features/2026-05-22-chord-brackets-library-tab.md](./features/2026-05-22-chord-brackets-library-tab.md). `npm run verify-chord-normalize`.
- **UX batch (7 fixes):** dev overlays, search rank, chord brackets, auto tabs, НАЙТИ, pitch smooth, melody contour. См. [docs/features/2026-05-22-ux-fixes-batch.md](./features/2026-05-22-ux-fixes-batch.md).
- **Chords:** Vercel API табов, починка поиска, НАЙТИ без дубля каталога. См. [docs/features/2026-05-22-vercel-chord-api-nav-cleanup.md](./features/2026-05-22-vercel-chord-api-nav-cleanup.md), [docs/deploy-chord-api-vercel.md](./deploy-chord-api-vercel.md).
- **Chords:** авто URL прокси из Expo debugger host + UI без AmDm/UG/URL. См. [docs/features/2026-05-22-auto-chord-proxy-ui.md](./features/2026-05-22-auto-chord-proxy-ui.md).
- **Chords / Практика:** тихая подгрузка таба, ⚙ в шапке, без Alert «Нет источников». См. [docs/features/2026-05-22-practice-quiet-chord-load.md](./features/2026-05-22-practice-quiet-chord-load.md).
- **Chords:** основной поиск — «База» в Практике; НАЙТИ→Каталог без дубля. См. [docs/features/2026-05-22-practice-library-search-primary.md](./features/2026-05-22-practice-library-search-primary.md).
- **Chords / Практика:** модал «База песен» — список на всю высоту (flex-шапка + `FlatList`). См. [docs/features/2026-05-22-practice-library-modal-layout.md](./features/2026-05-22-practice-library-modal-layout.md).
- **Chords / каталог:** архив legacy 536 → `assets/archive/`, активный seed ~32; опциональный импорт в настройках; UI без build-строк. См. [docs/features/2026-05-22-legacy-catalog-archive.md](./features/2026-05-22-legacy-catalog-archive.md).
- **Chords / каталог:** поиск по bundled JSON без импорта 5000 в SQLite при открытии; опциональный офлайн-индекс. См. [docs/features/2026-05-22-metadata-on-demand-search.md](./features/2026-05-22-metadata-on-demand-search.md).
- **Melody:** MVP1 транскрипция по контуру кадров, PLAY из сегментов, переключатель контур/классика. См. [docs/features/2026-05-22-melody-transcription-mvp1.md](./features/2026-05-22-melody-transcription-mvp1.md).
- **Pitch / графики:** откат регрессии сглаживания (TunerEngine, Melody chart, EMA тюнера). См. [docs/features/2026-05-22-pitch-graph-smoothing-regression-fix.md](./features/2026-05-22-pitch-graph-smoothing-regression-fix.md).
- **Chords:** исправлен nested SQLite transaction при импорте metadata (mutex + retry UI). См. [docs/features/2026-05-22-chords-metadata-nested-tx-fix.md](./features/2026-05-22-chords-metadata-nested-tx-fix.md).
- **Chords / каталог D7:** MusicBrainz ingestion ≥5000 metadata tracks, bundled `chunk-*.json` до ~10 MB, `npm run ingest-metadata`. См. [docs/features/2026-05-22-metadata-musicbrainz-5000.md](./features/2026-05-22-metadata-musicbrainz-5000.md).
- **Chords:** поиск первым (НАЙТИ/каталог), SQLite metadata_tracks + bundled chunks, on-demand полный таб. См. [docs/features/2026-05-22-chords-search-first-metadata.md](./features/2026-05-22-chords-search-first-metadata.md).
- **Chords:** on-demand AmDm / Ultimate Guitar через прокси + feature flags (без скрапера в APK). См. [docs/features/2026-05-22-on-demand-chord-providers.md](./features/2026-05-22-on-demand-chord-providers.md).
- **Chords:** dev-proxy `tools/chord-fetch` — `npm run dev-proxy`, тест с телефона за 3 шага (README). UX: скролл к тексту после загрузки, ошибки с подсказками.
- **Chords / каталог:** бейджи контента, миграция builtin seed, открытие полной песни из SQLite + ChordPro-строки (~150 полных / ~386 прогрессия). См. [docs/features/2026-05-22-catalog-chord-lyrics-quality.md](./features/2026-05-22-catalog-chord-lyrics-quality.md).
- **Chords:** поиск в «База песен» и НАЙТИ→Каталог — init SQLite до запроса, debounce, подсказки. См. [docs/features/2026-05-22-chords-search-init-fix.md](./features/2026-05-22-chords-search-init-fix.md).
- **Chords / каталог UI:** nested SQLite fix, progress bar, баннер «Повторить», список и пустые состояния. См. [docs/features/2026-05-22-chords-catalog-ui-fix.md](./features/2026-05-22-chords-catalog-ui-fix.md).
- **Chords:** поиск не пустой при выключенном «Каталог» в настройках; кириллица (`лет`, `кино`); маркер `build: chord-v2` всегда в шапке.
- **Chords НАЙТИ:** AudD и `EXPO_PUBLIC_AUDD_TOKEN` удалены; офлайн каталог + модуль `src/recognition` (сниппеты, multi-signal roadmap). См. [docs/features/2026-05-22-local-recognition-no-audd.md](./features/2026-05-22-local-recognition-no-audd.md).
- **Chords:** библиотека Phase 2–4 — провайдеры, умный поиск, импорт/экспорт, сохранение из НАЙТИ. См. [docs/features/2026-05-21-chord-providers-phase2-4.md](./features/2026-05-21-chord-providers-phase2-4.md).

### 2026-05-21

- **Melody:** anti-noise / anti-slide фильтры детектора (портаменто, дыхание, повторы). См. [docs/features/2026-05-21-melody-detector-noise-slide-filter.md](./features/2026-05-21-melody-detector-noise-slide-filter.md).
- **Melody:** детектор нот v2 — YIN gate, midi voting, dual-path onset. См. [docs/features/2026-05-21-melody-detector-v2.md](./features/2026-05-21-melody-detector-v2.md).
- **Melody:** повторы одной ноты (акцент, PLAY, лента). См. [docs/features/2026-05-21-melody-repeat-notes-fix.md](./features/2026-05-21-melody-repeat-notes-fix.md).
- **Melody:** playhead и подсветка нот на стане при PLAY. См. [docs/features/2026-05-21-staff-playback-playhead.md](./features/2026-05-21-staff-playback-playhead.md).
- **Melody:** длительности PLAY, монотонные ts, legato. См. [docs/features/2026-05-21-melody-playback-timing-fix.md](./features/2026-05-21-melody-playback-timing-fix.md).
- **Melody:** PLAY по спетому темпу (ritmo), аккорды по фразам. См. [docs/features/2026-05-21-melody-rhythm-timing.md](./features/2026-05-21-melody-rhythm-timing.md).
- **Melody:** качество PLAY (ритм, ADSR, аккорды) и детектор нот. См. [docs/features/2026-05-21-melody-playback-quality.md](./features/2026-05-21-melody-playback-quality.md).
- **График:** скролл к началу, разнесение меток, zoom 2× на Melody. См. [docs/features/2026-05-21-chart-scroll-markers.md](./features/2026-05-21-chart-scroll-markers.md).
- **Melody:** двойной нотный стан (𝄞/𝄢), PLAY с подложкой аккордов. См. [docs/features/2026-05-21-dual-staff-chord-playback.md](./features/2026-05-21-dual-staff-chord-playback.md).
- **Melody:** PLAY (Web Audio), компактная шапка START/PLAY, скролл графика 120 точек. См. [docs/features/2026-05-21-melody-playback-layout.md](./features/2026-05-21-melody-playback-layout.md).
- **Тюнер / Мелодия:** прокручиваемая история на графике, подписи устойчивых нот (`SungNoteDetector`). См. [docs/features/2026-05-21-pitch-chart-history-markers.md](./features/2026-05-21-pitch-chart-history-markers.md).
- **Melody phase 2:** fit-to-key, diatonic chord strip, simple staff view, extended JSON. См. [docs/features/2026-05-21-melody-chords-staff.md](./features/2026-05-21-melody-chords-staff.md).
- **Melody workspace:** график высоты с метками нот, нумерованная последовательность, базовый анализ (тональность/ритм), сохранение JSON. См. [docs/features/2026-05-20-melody-recognition-page.md](./features/2026-05-20-melody-recognition-page.md).
- **Melody / Media tabs:** вкладка Melody для спетых нот; Recorder+Player+Video → Media (сегменты). Тюнер/Chords без ленты. См. [docs/features/2026-05-20-sung-notes-v2-tabs.md](./features/2026-05-20-sung-notes-v2-tabs.md).

### 2026-05-20

- **Release APK / Studio:** фикс краша и воспроизведения studio-треков — MediaControl no-op, audio mode, `file://` URI. См. [docs/features/2026-05-20-playback-crash-fix.md](./features/2026-05-20-playback-crash-fix.md).
- **Плеер / Recorder / Studio:** фоновое воспроизведение (`UIBackgroundModes` + `staysActiveInBackground`), lock screen и кнопки наушников через `react-native-music-control`. См. [docs/features/2026-05-20-background-headset-controls.md](./features/2026-05-20-background-headset-controls.md).
- **Expo Go:** снова запускается — lock screen/наушники отключены в Go, фон через `expo-av`; полные controls в dev build.
- **Плеер / Studio / Recorder:** перемотка — сначала позиция, seek при отпускании; микрофон BT в настройках. См. [docs/features/2026-05-20-seek-scrub-bt-mic.md](./features/2026-05-20-seek-scrub-bt-mic.md).
- **Тюнер:** фикс. высота экрана (нет сдвига при нотах), лучше высокие струны, переключатель RU/EN. См. [docs/features/2026-05-20-tuner-layout-high-notes-i18n.md](./features/2026-05-20-tuner-layout-high-notes-i18n.md).
- **Тюнер:** хроматический режим по умолчанию — нота + ¢, без привязки к струнам. См. [docs/features/2026-05-20-tuner-chromatic-mode.md](./features/2026-05-20-tuner-chromatic-mode.md).
- **Тюнер / Chords практика:** история спетых нот (onset + фильтр шума), EN по умолчанию. См. [docs/features/2026-05-20-sung-notes-history.md](./features/2026-05-20-sung-notes-history.md).

### 2026-05-19

- **Studio:** сведение WAV с теми же **offsetMs**, что Play all; **VOL** на дорожке (0…200%); кнопка **«МИНУС»** — импорт аудио как дорожка 1. См. [docs/features/2026-05-19-studio-mix-offset-minus-gain.md](./features/2026-05-19-studio-mix-offset-minus-gain.md).
- **Studio:** задержка **150** / **BT 700**; в **ВРУЧНУЮ** — все выходы (Система, Динамик, Трубка, Bluetooth, AUX) и микрофоны по группам (телефон, BT, AUX, USB). См. [docs/features/2026-05-19-studio-audio-routing.md](./features/2026-05-19-studio-audio-routing.md).
- **Studio:** компактный список сессий, ⚙ в шапке, модалка настроек с закреплённым «Закрыть». См. [docs/features/2026-05-19-studio-layout-settings-modal.md](./features/2026-05-19-studio-layout-settings-modal.md).
- **Тюнер:** стрелка и график относительно ближайшей **струны** строя, линия цели на графике, лучше высокие ноты (до 2 kHz). См. [docs/features/2026-05-19-tuner-string-target.md](./features/2026-05-19-tuner-string-target.md).
- **Chords:** снимок движка (baseline) + пороги тишины/уверенности, ноты только от аккорда. См. [baseline](./features/2026-05-19-chords-engine-baseline.md) · [tuning](./features/2026-05-19-chords-engine-tuning.md).
- **Chords НАЙТИ (этап A):** AudD+lyrics, аккорды из каталога, «В практику с аккордами». См. [docs/features/2026-05-19-chords-identify-stage-a.md](./features/2026-05-19-chords-identify-stage-a.md).
- **Studio:** список сессий на весь экран; при открытии проекта — компактный список сверху, дорожки на оставшуюся высоту (← назад к списку).

### 2026-05-18

- **Studio:** модалки настроек/экспорта — скрытие таб-бара на время, затемнение с закрытием по тапу, прокрутка длинного меню на низком экране, `onRequestClose` / `statusBarTranslucent`. См. [docs/features/2026-05-18-studio-settings-modal.md](./features/2026-05-18-studio-settings-modal.md).
- **Studio:** при Play all изменение тайминга дорожки (±offset) сразу пересобирает позиции всех `Audio.Sound` по текущему таймлайну, без остановки.
- **Chords LIVE:** компактная шапка текущего аккорда, список распознанных на `flex:1`, нижний док СТАРТ/В практику как у практики (`paddingBottom` + абсолютный бар), меньше пустого места.

### 2026-05-15

- **Тюнер:** сглаживание частоты и центов в RN, мягче анимация стрелки; в WebView — YIN по глобальному минимуму, медиана кадров, подавление скачков гармоники, порог RMS 0.006. См. [docs/features/2026-05-15-tuner-needle-stability.md](./features/2026-05-15-tuner-needle-stability.md).
- **Chords (практика):** док Мик/REC привязан к корневому контейнеру экрана, `paddingBottom` под док, прокручиваемая верхняя панель при тексте, `minHeight` для зоны текста, компактнее график при наличии текста. См. [docs/features/2026-05-15-chords-practice-layout.md](./features/2026-05-15-chords-practice-layout.md).
