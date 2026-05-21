# Changelog

Краткий список релизных заметок. Подробности по темам — в [docs/features/README.md](./features/README.md).

## [Unreleased]

### 2026-05-21

- **Melody:** playhead и подсветка нот на стане при PLAY. См. [docs/features/2026-05-21-staff-playback-playhead.md](./features/2026-05-21-staff-playback-playhead.md).
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
