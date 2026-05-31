import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { buildRecordingOptions, DEFAULT_QUALITY } from './qualitySettings';

export const AUDIO_ROUTING_FILE = (FileSystem.documentDirectory ?? '') + 'studio_audio_routing.json';

/** Задержка для проводных / встроенных (дорожки 2+) */
export const PREROLL_MS_WIRED = 150;
/** Задержка при записи поверх Bluetooth-прослушивания */
export const PREROLL_MS_BLUETOOTH = 700;

export type AudioRouteMode = 'auto' | 'manual';
export type AudioOutputRoute = 'system' | 'speaker' | 'earpiece' | 'bluetooth' | 'wired';

export interface StudioAudioRouting {
  mode: AudioRouteMode;
  output: AudioOutputRoute;
  /** uid с getAvailableInputs(); null = микрофон по умолчанию у системы */
  inputUid: string | null;
}

export const DEFAULT_AUDIO_ROUTING: StudioAudioRouting = {
  mode: 'auto',
  output: 'system',
  inputUid: null,
};

export interface RecordingInputInfo {
  name: string;
  type: string;
  uid: string;
  kind: 'builtin' | 'bluetooth' | 'wired' | 'usb' | 'other';
}

export interface AudioRouteSnapshot {
  inputs: RecordingInputInfo[];
  currentInput: RecordingInputInfo | null;
  listenHint: string;
  recordHint: string;
  hasBluetooth: boolean;
  hasWired: boolean;
}

export interface OutputOption {
  id: AudioOutputRoute;
  label: string;
  icon: 'hardware-chip-outline' | 'volume-high-outline' | 'call-outline' | 'bluetooth' | 'headset';
  hint: string;
  suggestPrerollMs?: number;
}

/** Все варианты выхода — всегда в UI (BT/AUX = системный маршрут, если устройство подключено). */
export const OUTPUT_OPTIONS: OutputOption[] = [
  { id: 'system', label: 'Система', icon: 'hardware-chip-outline', hint: 'Куда назначил телефон' },
  { id: 'speaker', label: 'Динамик', icon: 'volume-high-outline', hint: 'Нижний динамик телефона' },
  { id: 'earpiece', label: 'Трубка', icon: 'call-outline', hint: 'Верхний динамик, как звонок' },
  { id: 'bluetooth', label: 'Bluetooth', icon: 'bluetooth', hint: 'BT-наушники / колонка', suggestPrerollMs: PREROLL_MS_BLUETOOTH },
  { id: 'wired', label: 'AUX', icon: 'headset', hint: 'Проводные наушники / jack', suggestPrerollMs: PREROLL_MS_WIRED },
];

export const INPUT_GROUPS: { kind: RecordingInputInfo['kind']; title: string; empty: string }[] = [
  { kind: 'builtin', title: 'Микрофон телефона', empty: 'Встроенный микрофон не найден' },
  { kind: 'bluetooth', title: 'Bluetooth', empty: 'Нет BT — подключи наушники и нажми обновить' },
  { kind: 'wired', title: 'AUX / провод', empty: 'Нет проводного входа — вставь кабель и обнови' },
  { kind: 'usb', title: 'USB-аудио', empty: 'USB-микрофон не найден' },
];

export async function loadStudioAudioRouting(): Promise<StudioAudioRouting> {
  try {
    const info = await FileSystem.getInfoAsync(AUDIO_ROUTING_FILE);
    if (info.exists) {
      return migrateStudioAudioRouting(JSON.parse(await FileSystem.readAsStringAsync(AUDIO_ROUTING_FILE)));
    }
  } catch {}
  return { ...DEFAULT_AUDIO_ROUTING };
}

export async function saveStudioAudioRouting(r: StudioAudioRouting): Promise<void> {
  await FileSystem.writeAsStringAsync(AUDIO_ROUTING_FILE, JSON.stringify(r));
}

export function classifyInput(type: string, name: string): RecordingInputInfo['kind'] {
  const s = `${type} ${name}`.toLowerCase();
  if (
    s.includes('bluetooth') || s.includes('bt ') || s.includes('ble') ||
    s.includes('a2dp') || s.includes('sco') || s.includes('hands-free') ||
    s.includes('handsfree') || s.includes('гарнитур')
  ) {
    return 'bluetooth';
  }
  if (
    s.includes('usb') || s.includes('headset') || s.includes('wired') || s.includes('aux') ||
    s.includes('jack') || s.includes('3.5') || s.includes('line') || s.includes('headphone')
  ) {
    return s.includes('usb') ? 'usb' : 'wired';
  }
  if (s.includes('built') || s.includes('internal') || s.includes('iphone') || s.includes('android') || s.includes('mic')) {
    return 'builtin';
  }
  return 'other';
}

function mapInput(raw: { name: string; type: string; uid: string }): RecordingInputInfo {
  return {
    name: raw.name,
    type: raw.type,
    uid: raw.uid,
    kind: classifyInput(raw.type, raw.name),
  };
}

export function labelKind(kind: RecordingInputInfo['kind']): string {
  switch (kind) {
    case 'bluetooth': return 'Bluetooth';
    case 'wired': return 'AUX / провод';
    case 'usb': return 'USB';
    case 'builtin': return 'телефон';
    default: return 'другое';
  }
}

export function inputsOfKind(inputs: RecordingInputInfo[], kind: RecordingInputInfo['kind']): RecordingInputInfo[] {
  return inputs.filter(i => i.kind === kind);
}

export function firstInputOfKind(inputs: RecordingInputInfo[], kind: RecordingInputInfo['kind']): RecordingInputInfo | undefined {
  return inputs.find(i => i.kind === kind);
}

function parseOutput(v: unknown): AudioOutputRoute {
  if (v === 'speaker' || v === 'earpiece' || v === 'system' || v === 'bluetooth' || v === 'wired') return v;
  return 'system';
}

export function migrateStudioAudioRouting(raw: unknown): StudioAudioRouting {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AUDIO_ROUTING };
  const v = raw as Record<string, unknown>;
  if (v.mode === 'auto' || v.mode === 'manual') {
    return {
      mode: v.mode,
      output: parseOutput(v.output),
      inputUid: typeof v.inputUid === 'string' ? v.inputUid : null,
    };
  }
  const legacyOut = parseOutput(v.output);
  const legacyMic = v.mic;
  const inputUid = typeof v.inputUid === 'string' ? v.inputUid : null;
  const manual =
    legacyMic === 'builtin' ||
    legacyMic === 'headset' ||
    legacyOut !== 'system' ||
    inputUid != null;
  return { mode: manual ? 'manual' : 'auto', output: legacyOut, inputUid };
}

export async function probeRecordingInputs(): Promise<AudioRouteSnapshot> {
  const empty: AudioRouteSnapshot = {
    inputs: [],
    currentInput: null,
    listenHint: 'Подключи BT или AUX и нажми обновить',
    recordHint: '—',
    hasBluetooth: false,
    hasWired: false,
  };
  if (Platform.OS === 'web') return empty;

  const rec = new Audio.Recording();
  try {
    await rec.prepareToRecordAsync(buildRecordingOptions(DEFAULT_QUALITY));
    const rawInputs = await rec.getAvailableInputs();
    let current: RecordingInputInfo | null = null;
    try {
      current = mapInput(await rec.getCurrentInput());
    } catch {
      current = null;
    }
    const inputs = rawInputs.map(mapInput);
    const hasBluetooth = inputs.some(i => i.kind === 'bluetooth');
    const hasWired = inputs.some(i => i.kind === 'wired' || i.kind === 'usb');

    let listenHint = 'Система (динамик, BT или AUX — что выбрано в телефоне)';
    if (hasBluetooth && !hasWired) listenHint = 'Подключён Bluetooth';
    else if (hasWired && !hasBluetooth) listenHint = 'Подключён провод / AUX';
    else if (hasBluetooth && hasWired) listenHint = 'BT и провод в списке устройств';

    const recordHint = current
      ? `${current.name} (${labelKind(current.kind)})`
      : inputs.length > 0
        ? 'По умолчанию у системы'
        : '—';

    return { inputs, currentInput: current, listenHint, recordHint, hasBluetooth, hasWired };
  } catch {
    return empty;
  } finally {
    try {
      await rec.stopAndUnloadAsync();
    } catch {}
  }
}

export function prerollForInput(inp: RecordingInputInfo | undefined): number {
  if (!inp) return PREROLL_MS_WIRED;
  return inp.kind === 'bluetooth' ? PREROLL_MS_BLUETOOTH : PREROLL_MS_WIRED;
}

export function prerollForOutput(output: AudioOutputRoute): number | undefined {
  const opt = OUTPUT_OPTIONS.find(o => o.id === output);
  return opt?.suggestPrerollMs;
}

/** Подобрать микрофон под выбранный выход (BT → BT-мик, AUX → проводной). */
export function suggestInputForOutput(
  output: AudioOutputRoute,
  inputs: RecordingInputInfo[],
): RecordingInputInfo | undefined {
  if (output === 'bluetooth') return firstInputOfKind(inputs, 'bluetooth');
  if (output === 'wired') return firstInputOfKind(inputs, 'wired') ?? firstInputOfKind(inputs, 'usb');
  if (output === 'earpiece' || output === 'speaker') return firstInputOfKind(inputs, 'builtin');
  return undefined;
}

export function outputDeviceMissing(output: AudioOutputRoute, snap: AudioRouteSnapshot | null): boolean {
  if (!snap || output === 'system' || output === 'speaker' || output === 'earpiece') return false;
  if (output === 'bluetooth') return !snap.hasBluetooth;
  if (output === 'wired') return !snap.hasWired;
  return false;
}

export async function applyStudioAudioMode(
  routing: StudioAudioRouting,
  opts?: { recording?: boolean },
): Promise<void> {
  const recording = opts?.recording ?? false;
  const manual = routing.mode === 'manual';
  const playThroughEarpieceAndroid = manual && routing.output === 'earpiece';
  if (recording) {
    const { applyRecordingBackgroundAudioMode } = await import('./recordingAudioMode');
    await applyRecordingBackgroundAudioMode({ playThroughEarpieceAndroid });
    return;
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: manual,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid,
    shouldDuckAndroid: true,
    interruptionModeAndroid: 1,
    interruptionModeIOS: 1,
  });
}

export async function applyRecordingInput(rec: Audio.Recording, routing: StudioAudioRouting): Promise<void> {
  if (routing.mode !== 'manual' || !routing.inputUid) return;
  try {
    const inputs = await rec.getAvailableInputs();
    const found = inputs.find(i => i.uid === routing.inputUid);
    if (found) await rec.setInput(found.uid);
  } catch {}
}

/**
 * Re-apply audio mode when tab gains focus; drop BT/AUX output if device disconnected.
 * Returns updated routing (may equal input when unchanged).
 */
export async function revalidateStudioRoutingOnFocus(
  routing: StudioAudioRouting,
): Promise<{ routing: StudioAudioRouting; snap: AudioRouteSnapshot }> {
  await applyStudioAudioMode(routing).catch(() => {});
  const snap = await probeRecordingInputs();
  if (routing.mode === 'manual' && outputDeviceMissing(routing.output, snap)) {
    const next: StudioAudioRouting = { ...routing, output: 'system' };
    await saveStudioAudioRouting(next);
    await applyStudioAudioMode(next).catch(() => {});
    return { routing: next, snap };
  }
  return { routing, snap };
}
