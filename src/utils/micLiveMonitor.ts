import { Platform } from 'react-native';

import { applyPlaybackAudioMode } from './playbackAudioMode';
import { applyRecordingBackgroundAudioMode } from './recordingAudioMode';
import type { StudioAudioRouting } from './studioAudioRouting';

/** Typical round-trip when monitoring via Web Audio in WebView (not studio-grade IEM). */
export const MIC_MONITOR_LATENCY_WIRED_MS = 80;
export const MIC_MONITOR_LATENCY_BT_MS = 200;

/** Passthrough gain (WebView). Lower default reduces speaker→mic feedback; not a full IEM chain. */
export const MIC_MONITOR_DEFAULT_GAIN = 0.55;

export function playThroughEarpieceForRouting(routing: StudioAudioRouting): boolean {
  return routing.mode === 'manual' && routing.output === 'earpiece';
}

/**
 * Single playAndRecord session for live mic monitor (expo-av). Output device follows
 * system route (D14); connect BT/AUX before start. Passthrough audio runs in WebView.
 */
export async function applyMicMonitorAudioMode(routing: StudioAudioRouting): Promise<void> {
  await applyRecordingBackgroundAudioMode({
    playThroughEarpieceAndroid: playThroughEarpieceForRouting(routing),
  });
}

export async function releaseMicMonitorAudioMode(): Promise<void> {
  await applyPlaybackAudioMode().catch(() => {});
}

export function micMonitorRouteHint(snapListen: string | undefined, routing: StudioAudioRouting): string {
  const base = snapListen ?? 'Подключи BT или AUX и обнови список в настройках';
  if (routing.mode === 'manual' && routing.output === 'earpiece') {
    return 'Выход: верхний динамик (трубка). BT/AUX — переключи выход в настройках Studio/Recorder.';
  }
  if (routing.mode === 'manual' && routing.output === 'speaker') {
    return 'Выход: нижний динамик телефона (expo-av). BT — подключи до старта и выбери «Система».';
  }
  return `${base}. RecoTune не выбирает колонку по имени — маршрут задаёт телефон.`;
}

/** Shown while monitor is running (route + echo/latency tips). */
export function micMonitorActiveHint(snapListen: string | undefined, routing: StudioAudioRouting): string {
  const route = micMonitorRouteHint(snapListen, routing);
  const echo =
    'AEC включён для колонки/динамика; без эха надёжнее проводные наушники. Не держи mic у динамика — громкость монитора снижена.';
  return `${route} ${echo}`;
}

export function micMonitorLimitationsText(): string {
  const lat =
    Platform.OS === 'android'
      ? `Ожидаемая задержка: провод ~${MIC_MONITOR_LATENCY_WIRED_MS}–150 мс, Bluetooth ~${MIC_MONITOR_LATENCY_BT_MS}–700 мс (кодек SCO/A2DP).`
      : `Ожидаемая задержка: ~${MIC_MONITOR_LATENCY_WIRED_MS}–200 мс; Bluetooth зависит от гарнитуры.`;

  const expoGo =
    'Expo Go SDK 55+ без expo-av: вкладка Media недоступна — нужен dev build (npx expo run:android).';

  const micSrc =
    'Микрофон — захват WebView (обычно встроенный телефона). BT-мик через setPreferredDevice — только в Studio/Recorder при записи expo-av, не в режиме монитора.';

  const echo =
    'Колонка/динамик: возможно эхо — лучше наушники; при мониторе включено подавление эха (WebRTC AEC).';

  return `${lat} ${echo} ${micSrc} ${Platform.OS === 'android' ? expoGo : ''}`.trim();
}
