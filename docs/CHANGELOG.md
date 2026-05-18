# Changelog

Краткий список релизных заметок. Подробности по темам — в [docs/features/README.md](./features/README.md).

## [Unreleased]

### 2026-05-18

- **Studio:** модалки настроек/экспорта — скрытие таб-бара на время, затемнение с закрытием по тапу, прокрутка длинного меню на низком экране, `onRequestClose` / `statusBarTranslucent`. См. [docs/features/2026-05-18-studio-settings-modal.md](./features/2026-05-18-studio-settings-modal.md).
- **Studio:** при Play all изменение тайминга дорожки (±offset) сразу пересобирает позиции всех `Audio.Sound` по текущему таймлайну, без остановки.
- **Chords LIVE:** компактная шапка текущего аккорда, список распознанных на `flex:1`, нижний док СТАРТ/В практику как у практики (`paddingBottom` + абсолютный бар), меньше пустого места.

### 2026-05-15

- **Тюнер:** сглаживание частоты и центов в RN, мягче анимация стрелки; в WebView — YIN по глобальному минимуму, медиана кадров, подавление скачков гармоники, порог RMS 0.006. См. [docs/features/2026-05-15-tuner-needle-stability.md](./features/2026-05-15-tuner-needle-stability.md).
- **Chords (практика):** док Мик/REC привязан к корневому контейнеру экрана, `paddingBottom` под док, прокручиваемая верхняя панель при тексте, `minHeight` для зоны текста, компактнее график при наличии текста. См. [docs/features/2026-05-15-chords-practice-layout.md](./features/2026-05-15-chords-practice-layout.md).
