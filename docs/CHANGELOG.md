# Changelog

Краткий список релизных заметок. Подробности по темам — в [docs/features/README.md](./features/README.md).

## [Unreleased]

- **P7 Melody / stem host:** лента напева (сниппет НАЙТИ + микрофон), `EXPO_PUBLIC_STEM_SERVER_URL` в AI Lab, версия **1.0.1**. См. [docs/features/2026-05-31-p7-melody-hum-stem-host.md](./features/2026-05-31-p7-melody-hum-stem-host.md).
- **P6 НАЙТИ / Studio:** подсказки по записи (BPM, тональность, напев, слабые кандидаты + metadata), Studio routing re-apply on focus; env `EXPO_PUBLIC_CHORD_FETCH_URL` / `EXPO_PUBLIC_STEM_SERVER_URL`. См. [docs/features/2026-05-31-p6-find-hints-studio-routing.md](./features/2026-05-31-p6-find-hints-studio-routing.md).
- **P5 каталог / НАЙТИ / Melody:** bundled metadata 5200 (+Мельница), `npm run append-metadata`; chroma+BPM из записи; «В STUDIO» после basic-pitch. См. [docs/features/2026-05-31-p5-metadata-recognition-studio.md](./features/2026-05-31-p5-metadata-recognition-studio.md).
- **Dev / AI Lab / НАЙТИ:** `npm start` поднимает :8787+:8788; честное распознавание по записи; импорт Demucs в Studio. См. [docs/features/2026-05-31-dev-all-p4-studio.md](./features/2026-05-31-dev-all-p4-studio.md).
- **Melody / из файла:** basic-pitch на ПК (`POST /transcribe`, :8788), кнопка «Из файла», PLAY по сегментам; без сервера — только микрофон. См. [docs/features/2026-05-31-basic-pitch-transcribe.md](./features/2026-05-31-basic-pitch-transcribe.md).
- **AI Lab / ДОРОЖКИ:** Demucs на ПК (`npm run stems:dev`, :8788), переключатель DSP (демо) vs Нейросеть (ПК), честные ошибки без фейковых stem. См. [docs/features/2026-05-31-stem-demucs-server.md](./features/2026-05-31-stem-demucs-server.md), [docs/stem-separate-local.md](./stem-separate-local.md).
- **Tuner:** усиленное сглаживание стрелки/ноты/Hz, outlier hold, UI ~10 Hz, EMA только для линии графика. См. [docs/features/2026-05-30-tuner-display-smoothing-v2.md](./features/2026-05-30-tuner-display-smoothing-v2.md).
- **Tuner:** dedupe — удалён мёртвый `useTuner`/WAV YIN, tuner WebView отдаёт raw Hz в `TunerPitchDisplay`, `ChartFreqStabilizer` только для Melody; план Choona в KB. См. [docs/features/2026-05-30-tuner-dedupe-choona-pipeline.md](./features/2026-05-30-tuner-dedupe-choona-pipeline.md).
- **Tuner:** фиксированное окно графика (12 с), убран лишний `ChartFreqStabilizer` на табе тюнера; стрелка на одном `TunerPitchDisplay`. См. [docs/features/2026-05-30-tuner-chart-rolling-window.md](./features/2026-05-30-tuner-chart-rolling-window.md).
- **Tuner:** гистерезис ноты и плавная стрелка без «убегания» вперёд; отдельный `TunerPitchDisplay`. См. [docs/features/2026-05-30-tuner-needle-note-hysteresis.md](./features/2026-05-30-tuner-needle-note-hysteresis.md).
- **Tuner:** быстрее стрелка и чувствительнее к тихому сигналу; профили стабилизатора отделены от Melody. См. [docs/features/2026-05-30-tuner-latency-sensitivity-fix.md](./features/2026-05-30-tuner-latency-sensitivity-fix.md).

- **Android release build:** `app.config.js` + `expo-build-properties` (minify/shrink/ProGuard survives prebuild), `metro.config.js` blocks `tools/`, `build-apk-release.bat` clears stale `app\build`, `docs/BUILD-ANDROID.md`, npm scripts `build:android:release` / `prebuild:android`.

### 2026-05-29

- **Chords / справочник:** кнопка «Справочник», полный список схем по инструменту (гитара/укулеле), резолв близких аккордов из песни. См. [docs/features/2026-05-29-chord-reference-dictionary.md](./features/2026-05-29-chord-reference-dictionary.md).
- **Chords / Практика:** zoom текста 30–190%, dev-подсказка при недоступном прокси, выравнивание аккорда над словом (Creep). См. [docs/features/2026-05-29-zoom-proxy-creep-layout.md](./features/2026-05-29-zoom-proxy-creep-layout.md).
- **Chords / База + Практика:** живой поиск AmDm+UG через прокси (`POST /search`), pinch/A± масштаб текста, транспонирование ±½ с сохранением на песню. См. [docs/features/2026-05-29-library-search-zoom-transpose.md](./features/2026-05-29-library-search-zoom-transpose.md).
- **Media / SeekBar + Melody:** стабильный scrub (refs + pageX, lock thumb), cooldown status в видео; плавный график голоса (`smoothCenterMidi`, `chartFrequency`). См. [docs/features/2026-05-29-seek-scrub-pitch-tracker-fix.md](./features/2026-05-29-seek-scrub-pitch-tracker-fix.md).

### 2026-05-28

- **Media / Видео:** стабильный scrub (общий `SeekBar`), один плеер без двойных контролов, fullscreen без seg bar. См. [docs/features/2026-05-28-video-player-scrub-fullscreen.md](./features/2026-05-28-video-player-scrub-fullscreen.md).
- **Chords / авто полностью:** probe прокси, цепочка AmDm → UG → pesni.ru с телефона, `npm start` поднимает dev-stack, упрощён ⚙. См. [docs/features/2026-05-28-auto-chord-full-automatic.md](./features/2026-05-28-auto-chord-full-automatic.md).
- **Chords / UG:** табы через vendored [ultimate-api](https://github.com/joncardasis/ultimate-api) (Flask `:5000`), поиск в Node; `npm run dev-stack`. См. [docs/features/2026-05-28-ultimate-api-ug-integration.md](./features/2026-05-28-ultimate-api-ug-integration.md).
- **Chords / dev-proxy:** fix chord-marker validation (`[G]`, `[Am]`), перезапуск прокси после pull, dev-ошибки от API. См. [docs/features/2026-05-28-chord-fetch-validate-restart.md](./features/2026-05-28-chord-fetch-validate-restart.md).
- **Chords / AmDm + UG:** авто-табы AmDm → Ultimate Guitar, pesni.ru выкл по умолчанию (лимиты API), короткое «Не найдено», улучшен scoring AmDm. См. [docs/features/2026-05-28-amdm-ug-pesni-off.md](./features/2026-05-28-amdm-ug-pesni-off.md).
- **Chords / UG + поиск:** парсер UG в `dev-proxy`, подгрузка результатов поиска при скролле. См. [docs/features/2026-05-28-ug-priority-search-scroll.md](./features/2026-05-28-ug-priority-search-scroll.md).
- **Chords / авто-табы:** без ручного выбора источника — цепочка pesni.ru → AmDm, поиск всегда с pesni.ru. См. [docs/features/2026-05-28-auto-chord-source-chain.md](./features/2026-05-28-auto-chord-source-chain.md).
- **Chords / pesni.ru:** поиск и on-demand табы по HTTPS (без ПК-прокси), кэш SQLite, fallback AmDm. См. [docs/features/2026-05-28-pesni-ru-api.md](./features/2026-05-28-pesni-ru-api.md).
- **Chords / AmDm:** несколько кандидатов с поиска, сверка исполнителя на странице, понятные ошибки, этапы «Ищем… / Проверяем…», гид [docs/guides/chords-search-and-tabs-ru.md](./guides/chords-search-and-tabs-ru.md). См. [docs/features/2026-05-28-amdm-chord-fetch-smart-resolve.md](./features/2026-05-28-amdm-chord-fetch-smart-resolve.md).
- **Chords / База + Практика + НАЙТИ:** быстрый metadata-поиск (SQL `LIKE`), честные бейджи и сниппеты («прогрессия, не таб»), практика только verified ChordPro, lyrics.ovh без fake-аккордов. См. [docs/features/2026-05-28-search-chords-studio-background-rec.md](./features/2026-05-28-search-chords-studio-background-rec.md).
- **Studio / Recorder:** запись продолжается в фоне (`staysActiveInBackground`, `AppState`, Android `FOREGROUND_SERVICE_MICROPHONE`). См. тот же файл.
- **Studio / Recorder / Player:** фон REC v2 (keep-awake, guard mic, Expo Go hint), ползунок без отскока (seek → resume, шаг 100 ms). См. [docs/features/2026-05-28-background-rec-seek-scrub-v2.md](./features/2026-05-28-background-rec-seek-scrub-v2.md).

### 2026-05-25

- **Melody / график:** фиксированный `layoutOriginTs`, time-based cap скролла, raw→stabilizer (без двойного EMA) — playhead не «убегает» после ~1 с. См. [docs/features/2026-05-25-melody-chart-scroll-origin-fix.md](./features/2026-05-25-melody-chart-scroll-origin-fix.md).
- **Melody:** плавная трассировка при записи, без рывка последней точки при STOP, контур на глиссандо. См. [docs/features/2026-05-25-melody-chart-glide-recognition.md](./features/2026-05-25-melody-chart-glide-recognition.md).
- **Tuner / График:** стабильная ось X (`layoutOriginTs`), отдельное сглаживание трассировки и tuner voiced-gate; стрелка ¢ без изменений. См. [docs/features/2026-05-25-tuner-chart-stable.md](./features/2026-05-25-tuner-chart-stable.md).
- **Tuner:** восстановлен нижний ряд открытых струн (подсветка ближайшей); хроматическая стрелка без изменений. См. [docs/features/2026-05-25-tuner-strings-row-restore.md](./features/2026-05-25-tuner-strings-row-restore.md).
- **Chords / База + AmDm + Практика:** прогрессия в строках списка, каталог по умолчанию (не только избранное), парсер AmDm без HTML в начале, табулатура в одну строку. См. [docs/features/2026-05-25-library-amdm-tab-lines.md](./features/2026-05-25-library-amdm-tab-lines.md).

### 2026-05-24

- **Chords / Практика:** стабильная высота/ширина колонки аккорда (A vs Am) в `ChordLyricsLine`. См. [docs/features/2026-05-24-chord-a-layout-stable.md](./features/2026-05-24-chord-a-layout-stable.md).
- **Chords / База + Практика:** поиск только по relevance (без preview-каталога); свайп текста — RNGH ScrollView, без `scrollTo` на normalize. См. [docs/features/2026-05-24-library-search-scroll-fix.md](./features/2026-05-24-library-search-scroll-fix.md).
- **Chords / Практика:** свайп текста при выкл. авто (без лишнего `scrollTo`/MIC); аккорд **A** в нормализации и UI. См. [docs/features/2026-05-24-practice-scroll-chord-a.md](./features/2026-05-24-practice-scroll-chord-a.md).
- **Chords / База песен:** без «двойного» предвыбора чипов, модал только без песни в практике, подпись ТАБЫ. См. [docs/features/2026-05-24-library-preselection-ux.md](./features/2026-05-24-library-preselection-ux.md).
- **Chords / База песен:** по умолчанию только избранное; поиск по каталогу без подмешивания несовпавших builtin. См. [docs/features/2026-05-24-library-favorites-default-search.md](./features/2026-05-24-library-favorites-default-search.md).
- **Chords / Практика:** только проверенный ChordPro (builtin ~32 + AmDm); без склейки прогрессии на текст, без `LYRICS_DB` в практике. См. [docs/features/2026-05-24-verified-chordpro-practice.md](./features/2026-05-24-verified-chordpro-practice.md).
- **Chords / табы AmDm:** по умолчанию прокси на ПК (`npm run dev-proxy`), Vercel опционален; Metro :8787 важнее app.json. См. [docs/chord-fetch-local-proxy.md](./chord-fetch-local-proxy.md), [docs/features/2026-05-24-chord-fetch-pc-proxy-default.md](./features/2026-05-24-chord-fetch-pc-proxy-default.md).
- **Chords / табы онлайн:** поле URL в ⚙, проверка Creep, ошибки в пустом экране, нормализация Vercel/dev-proxy, Android cleartext. См. [docs/features/2026-05-24-chord-fetch-url-ux.md](./features/2026-05-24-chord-fetch-url-ux.md).
- **Pitch-графики (Tuner / Chords):** parity с Melody — `timeAxis`, voiced throttle 100 ms, playhead. См. [docs/features/2026-05-24-pitch-chart-parity-tuner-chords.md](./features/2026-05-24-pitch-chart-parity-tuner-chords.md).
- **Melody график:** ось X по времени (px/ms), playhead без «разгона» за 30+ с. См. [docs/features/2026-05-24-melody-chart-time-axis.md](./features/2026-05-24-melody-chart-time-axis.md).
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
