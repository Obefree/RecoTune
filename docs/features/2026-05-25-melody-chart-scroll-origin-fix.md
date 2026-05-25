# Melody: график не «убегает» после старта записи

## Зачем

После [2026-05-25-melody-chart-glide-recognition.md](./2026-05-25-melody-chart-glide-recognition.md) (`4c7420f`) пользователь видел: ~секунду нормально, затем снова дёрганье и уход playhead/трассы «вперёд».

## Что было не так

| Причина | Эффект |
|---------|--------|
| Нет `layoutOriginTs` на Melody (в Tuner уже был с `7fc2059`) | При `slice(-120)` менялся `pts[0].ts` → вся ось X сдвигалась, скролл догонял скачком |
| Скролл мгновенно к `lastEndX - anchor` при любом скачке X | После сдвига t0 или всплеска `lastEndX` — рывок вперёд |
| График ел `stableFrequency` + `ChartFreqStabilizer` | Двойное сглаживание → отставание, потом догонка по Y |
| `reset()` стабилизатора на каждом unvoiced кадре | После паузы в звуке — скачок частоты на следующей точке |

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/hooks/useSungNoteHistory.ts` | `chartLayoutOriginTs` с первой точки сессии; chart из `frameFrequency`; без reset стабилизатора на unvoiced |
| `src/components/MelodyPitchChart.tsx` | `layoutOriginTs` → `FrequencyChart` |
| `src/screens/MelodyScreen.tsx` | проброс `chartLayoutOriginTs` |
| `src/components/FrequencyChart.tsx` | при `timeAxis` + follow — cap прироста скролла по wall-clock (px/ms), мгновенный догон если отстаём |
| `src/utils/pitchChartHistory.ts` | `CHART_EMA_ALPHA` 0.28 (чуть быстрее догонка по высоте) |

**Не трогали:** `TunerScreen` needle EMA, `TunerEngine`, контур `expandVoicedFrames` / slope 12 st/s.

## Было → стало

| Было | Стало |
|------|--------|
| `t0 = pts[0].ts` на Melody | `layoutOriginTs` фиксируется на START сессии |
| Скролл всегда snap к target | Snap + лимит вперёд ≤ ~1.12× (px/ms×Δt); назад — сразу |
| Chart ← stable + stabilizer | Chart ← raw frame + один stabilizer |
| Reset stabilizer на silent | Reset только begin/end/reset сессии |

## Как проверить

1. Melody → START → **медленная нота ~30 с** (один тон, без смены ноты): линия у playhead (~58% ширины), без рывка через 1–2 с и на 12+ с.
2. Медленное глиссандо 2–3 с между нотами: без вертикальных скачков > ~полутона; контур по-прежнему виден.
3. STOP: скролл заморожен (`scrollFollow={active}`), последняя точка без скачка.
4. Тюнер → режим «График» 30+ с — без регрессии playhead.
