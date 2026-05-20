# Changelog

Краткий список релизных заметок. Подробности по темам — в [docs/features/README.md](./features/README.md).

## [Unreleased]

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
