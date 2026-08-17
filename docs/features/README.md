# Лог фич и изменений (RecoTune)

Здесь **одна фича / одна тема = один файл** с кратким описанием: зачем, какие файлы, что было → что стало.

## Как пользоваться

- Новые изменения: добавьте файл `YYYY-MM-DD-краткий-slug.md` в эту папку и при необходимости строку в [../CHANGELOG.md](../CHANGELOG.md).
- В теле фичи указывайте пути к коду и смысл правок (не обязательно полный diff).

## Записи

| Дата       | Тема | Файл |
|------------|------|------|
| 2026-08-17 | Expo Cloud Environment: environment.json, tunnel, expo:url | [2026-08-17-expo-cloud-environment.md](./2026-08-17-expo-cloud-environment.md) |
| 2026-08-17 | Media: антифон мегафона (петля колонка→mic) | [2026-08-17-mic-monitor-noise-gate.md](./2026-08-17-mic-monitor-noise-gate.md) |
| 2026-08-17 | Chords: parsed DB на ПК и Vercel | [2026-08-17-parsed-chord-db.md](./2026-08-17-parsed-chord-db.md) |
| 2026-08-17 | APK: URL прокси (LAN или HTTPS) | [2026-08-17-apk-proxy-url.md](./2026-08-17-apk-proxy-url.md) |
| 2026-08-17 | Media: диктофон/микс в альбом RecoTune на телефоне | [2026-08-17-save-recordings-share.md](./2026-08-17-save-recordings-share.md) |
| 2026-08-17 | Chords: fake C G Am F / [Chorus], Back overlay, GitHub ChordPro | [2026-08-17-chords-fake-back-github.md](./2026-08-17-chords-fake-back-github.md) |
| 2026-07-26 | Chords: дубли в списке песен (dedupe), доступ к справочнику базовых аккордов из шапки | [2026-07-26-song-list-dedupe-basic-chords-access.md](./2026-07-26-song-list-dedupe-basic-chords-access.md) |
| 2026-07-26 | Chords: wrong tabs (Fix You), UI back/layering, tab-dump gate | [2026-07-26-chords-wrong-tabs-ui-back.md](./2026-07-26-chords-wrong-tabs-ui-back.md) |
| 2026-07-20 | Chords D22: **1113** офлайн pesni, фоновый import, UX auto-fetch | [2026-07-20-chords-phone-scale.md](./2026-07-20-chords-phone-scale.md) |
| 2026-07-20 | Media: микрофон → колонки — AEC, gain, латентность | [2026-07-20-mic-monitor-echo-latency.md](./2026-07-20-mic-monitor-echo-latency.md) |
| 2026-07-20 | Media: микрофон → колонки / BT (live monitor, честные лимиты) | [2026-07-20-mic-live-monitor-bt.md](./2026-07-20-mic-live-monitor-bt.md) |
| 2026-07-05 | Chords #3: +300 офлайн verified табов (pesni archive bundle), честный hint | [2026-07-05-chords-pesni-archive-bundle.md](./2026-07-05-chords-pesni-archive-bundle.md) |
| 2026-07-05 | Tuner: гистерезис целевой струны + октавная свёртка (без каши/снапа вниз) | [2026-07-05-tuner-string-hysteresis-octave-fold.md](./2026-07-05-tuner-string-hysteresis-octave-fold.md) |
| 2026-07-05 | Studio: запись овердаба больше не требует удвоить задержку (ждём реальный старт бэкинга) | [2026-07-05-studio-record-latency-double-fix.md](./2026-07-05-studio-record-latency-double-fix.md) |
| 2026-07-05 | Melody: одна схема распознавания (убран флип 2 детекторов), единый timebase, фикс слияния разных нот | [2026-07-05-melody-single-path-timebase-merge.md](./2026-07-05-melody-single-path-timebase-merge.md) |
| 2026-06-28 | Expo Go: gate + lazy tabs вместо краша ExponentAV; bat без --offline | [2026-06-28-expo-go-startup-gate-lazy-tabs.md](./2026-06-28-expo-go-startup-gate-lazy-tabs.md) |
| 2026-06-28 | Expo Go / bat: док про SDK 55+ и dev build (superseded gate-фиксом) | [2026-06-28-expo-go-sdk54-expo-av-removed.md](./2026-06-28-expo-go-sdk54-expo-av-removed.md) |
| 2026-06-27 | Фикс синего/пустого экрана на телефоне: expo-font 55 → 14.x (SDK 54) | [2026-06-27-expo-font-version-mismatch-blue-screen-fix.md](./2026-06-27-expo-font-version-mismatch-blue-screen-fix.md) |
| 2026-06-25 | Chords: убран дубль-лист аккордов на результате НАЙТИ (старое лекало) | [2026-06-25-find-result-duplicate-chord-sheet-removed.md](./2026-06-25-find-result-duplicate-chord-sheet-removed.md) |
| 2026-06-25 | Chords/Практика: «Назад» из песни → чистый возврат к списку | [2026-06-25-chords-back-return-to-song-list.md](./2026-06-25-chords-back-return-to-song-list.md) |
| 2026-06-25 | Chords/Практика: фикс «полный экран → кусок + чёрная зона» | [2026-06-25-chords-practice-fullscreen-black-void-fix.md](./2026-06-25-chords-practice-fullscreen-black-void-fix.md) |
| 2026-06-24 | Chords: источники (AmDm/UG primary), pesni backup, нотация H/Hm | [2026-06-24-chord-sourcing-phone-fallback-h-notation.md](./2026-06-24-chord-sourcing-phone-fallback-h-notation.md) |
| 2026-06-24 | Melody: распознавание — диапазон, onset повторов, короткие ноты | [2026-06-24-melody-recognition-onset-range.md](./2026-06-24-melody-recognition-onset-range.md) |
| 2026-06-24 | Chords: ревизия парсера/поиска, выравнивание | [2026-06-24-chords-parser-search-revision.md](./2026-06-24-chords-parser-search-revision.md) |
| 2026-06-24 | Studio: маршрут/латентность/мик-выход, настройки | [2026-06-24-studio-routing-latency-settings.md](./2026-06-24-studio-routing-latency-settings.md) |
| 2026-06-24 | Tuner: 1€-сглаживание, диапазон строя, octave-guard | [2026-06-24-tuner-oneeuro-octave-guard.md](./2026-06-24-tuner-oneeuro-octave-guard.md) |
| 2026-06-01 | Android 14+: краш registerReceiver | [2026-06-01-android-receiver-crash-fix.md](./2026-06-01-android-receiver-crash-fix.md) |
| 2026-06-01 | Release APK: звук Melody/Studio/Media | [2026-06-01-release-audio-playback.md](./2026-06-01-release-audio-playback.md) |
| 2026-05-31 | Android: таб-бар внизу (P7 WebView flex) | [2026-05-31-android-tabbar-layout-fix.md](./2026-05-31-android-tabbar-layout-fix.md) |
| 2026-05-31 | P7: лента напева Melody, stem host URL, 1.0.1 | [2026-05-31-p7-melody-hum-stem-host.md](./2026-05-31-p7-melody-hum-stem-host.md) |
| 2026-05-31 | P6: НАЙТИ подсказки, Studio routing, env APK | [2026-05-31-p6-find-hints-studio-routing.md](./2026-05-31-p6-find-hints-studio-routing.md) |
| 2026-05-31 | P5: каталог 5200, chroma НАЙТИ, Melody→Studio | [2026-05-31-p5-metadata-recognition-studio.md](./2026-05-31-p5-metadata-recognition-studio.md) |
| 2026-05-31 | Dev :8787+:8788, P4 НАЙТИ, Studio import | [2026-05-31-dev-all-p4-studio.md](./2026-05-31-dev-all-p4-studio.md) |
| 2026-05-31 | Melody: basic-pitch из файла (ПК) | [2026-05-31-basic-pitch-transcribe.md](./2026-05-31-basic-pitch-transcribe.md) |
| 2026-05-31 | AI Lab: Demucs на ПК, DSP (демо) | [2026-05-31-stem-demucs-server.md](./2026-05-31-stem-demucs-server.md) |
| 2026-05-30 | Tuner: плавная стрелка v2 (outlier, UI throttle) | [2026-05-30-tuner-display-smoothing-v2.md](./2026-05-30-tuner-display-smoothing-v2.md) |
| 2026-05-30 | Tuner: dedupe + Choona-style pipeline | [2026-05-30-tuner-dedupe-choona-pipeline.md](./2026-05-30-tuner-dedupe-choona-pipeline.md) |
| 2026-05-30 | Tuner: окно графика 12 с, без лишнего EMA | [2026-05-30-tuner-chart-rolling-window.md](./2026-05-30-tuner-chart-rolling-window.md) |
| 2026-05-30 | Tuner: стрелка без убегания ноты | [2026-05-30-tuner-needle-note-hysteresis.md](./2026-05-30-tuner-needle-note-hysteresis.md) |
| 2026-05-30 | Tuner: latency + quiet input vs Melody | [2026-05-30-tuner-latency-sensitivity-fix.md](./2026-05-30-tuner-latency-sensitivity-fix.md) |
| 2026-05-29 | Справочник аккордов + схемы ukulele/guitar | [2026-05-29-chord-reference-dictionary.md](./2026-05-29-chord-reference-dictionary.md) |
| 2026-05-29 | Zoom 30%, прокси-поиск, layout Creep | [2026-05-29-zoom-proxy-creep-layout.md](./2026-05-29-zoom-proxy-creep-layout.md) |
| 2026-05-29 | База: AmDm/UG поиск, zoom, transpose | [2026-05-29-library-search-zoom-transpose.md](./2026-05-29-library-search-zoom-transpose.md) |
| 2026-05-29 | SeekBar scrub v2 + плавный график голоса | [2026-05-29-seek-scrub-pitch-tracker-fix.md](./2026-05-29-seek-scrub-pitch-tracker-fix.md) |
| 2026-05-28 | Видео: scrub, fullscreen, один плеер | [2026-05-28-video-player-scrub-fullscreen.md](./2026-05-28-video-player-scrub-fullscreen.md) |
| 2026-05-28 | Полностью авто табы + chords:dev | [2026-05-28-auto-chord-full-automatic.md](./2026-05-28-auto-chord-full-automatic.md) |
| 2026-05-28 | UG: ultimate-api sidecar + dev-stack | [2026-05-28-ultimate-api-ug-integration.md](./2026-05-28-ultimate-api-ug-integration.md) |
| 2026-05-28 | Chord fetch: validation, restart proxy | [2026-05-28-chord-fetch-validate-restart.md](./2026-05-28-chord-fetch-validate-restart.md) |
| 2026-05-28 | AmDm → UG, pesni выкл, «Не найдено» | [2026-05-28-amdm-ug-pesni-off.md](./2026-05-28-amdm-ug-pesni-off.md) |
| 2026-05-28 | UG → AmDm, поиск со скроллом, короткий UI | [2026-05-28-ug-priority-search-scroll.md](./2026-05-28-ug-priority-search-scroll.md) |
| 2026-05-28 | Авто-цепочка табов pesni.ru → AmDm | [2026-05-28-auto-chord-source-chain.md](./2026-05-28-auto-chord-source-chain.md) |
| 2026-05-28 | pesni.ru API: табы с телефона, поиск | [2026-05-28-pesni-ru-api.md](./2026-05-28-pesni-ru-api.md) |
| 2026-05-28 | AmDm: умный подбор таба, этапы загрузки | [2026-05-28-amdm-chord-fetch-smart-resolve.md](./2026-05-28-amdm-chord-fetch-smart-resolve.md) |
| 2026-05-28 | Поиск metadata, честные табы, Studio REC в фоне | [2026-05-28-search-chords-studio-background-rec.md](./2026-05-28-search-chords-studio-background-rec.md) |
| 2026-05-25 | Melody: playhead не убегает (layoutOrigin + scroll cap) | [2026-05-25-melody-chart-scroll-origin-fix.md](./2026-05-25-melody-chart-scroll-origin-fix.md) |
| 2026-05-25 | Melody: график + контур на глиссандо | [2026-05-25-melody-chart-glide-recognition.md](./2026-05-25-melody-chart-glide-recognition.md) |
| 2026-05-25 | Tuner: график нот без скачков (playhead) | [2026-05-25-tuner-chart-stable.md](./2026-05-25-tuner-chart-stable.md) |
| 2026-05-25 | Tuner: ряд струн внизу экрана | [2026-05-25-tuner-strings-row-restore.md](./2026-05-25-tuner-strings-row-restore.md) |
| 2026-05-25 | База: прогрессия в списке; AmDm; таб-строки | [2026-05-25-library-amdm-tab-lines.md](./2026-05-25-library-amdm-tab-lines.md) |
| 2026-05-24 | База: поиск по rank; Практика: свайп RNGH | [2026-05-24-library-search-scroll-fix.md](./2026-05-24-library-search-scroll-fix.md) |
| 2026-05-24 | Практика: стабильная строка с аккордом A | [2026-05-24-chord-a-layout-stable.md](./2026-05-24-chord-a-layout-stable.md) |
| 2026-05-24 | Практика: свайп без авто + аккорд A | [2026-05-24-practice-scroll-chord-a.md](./2026-05-24-practice-scroll-chord-a.md) |
| 2026-05-24 | База песен: без фантомного предвыбора чипов / модала | [2026-05-24-library-preselection-ux.md](./2026-05-24-library-preselection-ux.md) |
| 2026-05-24 | База песен: избранное по умолчанию, поиск без filler | [2026-05-24-library-favorites-default-search.md](./2026-05-24-library-favorites-default-search.md) |
| 2026-05-24 | Chords: практика — только verified ChordPro | [2026-05-24-verified-chordpro-practice.md](./2026-05-24-verified-chordpro-practice.md) |
| 2026-05-24 | Chords: прокси на ПК по умолчанию (без Vercel) | [2026-05-24-chord-fetch-pc-proxy-default.md](./2026-05-24-chord-fetch-pc-proxy-default.md) |
| 2026-05-24 | Chords: URL API табов, диагностика | [2026-05-24-chord-fetch-url-ux.md](./2026-05-24-chord-fetch-url-ux.md) |
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
| 2026-05-28 | Фон REC v2 + ползунок (seek до resume, 100 ms) | [2026-05-28-background-rec-seek-scrub-v2.md](./2026-05-28-background-rec-seek-scrub-v2.md) |
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
