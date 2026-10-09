/**
 * Subset of expo-av Audio.Sound / Recording used by RecoTune, backed by expo-audio.
 * Why a dedicated module: Studio mix uses ref-based Sound.createAsync / new Recording(),
 * not useAudioPlayer/useAudioRecorder hooks — mapping once avoids rewriting six screens.
 */
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  type AudioPlayer,
  type AudioStatus,
  type RecordingOptions,
  type RecordingStatus,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { beatIntervalMs, clampMetronomeBpm } from './metronomeClick';
import { setMappedAudioModeAsync, applyPlaybackAudioMode, type LegacyAudioMode } from './playbackAudioMode';
import { normalizePlaybackUri } from './playbackUri';

export type AVPlaybackStatus =
  | { isLoaded: false }
  | {
      isLoaded: true;
      isPlaying: boolean;
      positionMillis: number;
      durationMillis?: number;
      didJustFinish?: boolean;
    };

type SoundSource = { uri: string } | string | number;

type SoundInitialStatus = {
  shouldPlay?: boolean;
  positionMillis?: number;
  volume?: number;
  progressUpdateIntervalMillis?: number;
};

type StatusCallback = (status: AVPlaybackStatus) => void;

type NativeRecorder = {
  uri: string | null;
  isRecording: boolean;
  prepareToRecordAsync: (options?: Partial<RecordingOptions>) => Promise<void>;
  record: () => void;
  stop: () => Promise<void>;
  getStatus?: () => { url?: string | null };
  getAvailableInputs: () => { name: string; type: string; uid: string }[] | Promise<{ name: string; type: string; uid: string }[]>;
  getCurrentInput: () => Promise<{ name: string; type: string; uid: string }>;
  setInput: (uid: string) => void | Promise<void>;
  addListener: (event: 'recordingStatusUpdate', listener: (status: RecordingStatus) => void) => { remove: () => void };
};

function recorderUri(rec: NativeRecorder | null, extra?: string | null): string | null {
  if (extra) return extra;
  if (!rec) return null;
  const fromStatus = typeof rec.getStatus === 'function' ? rec.getStatus()?.url : null;
  return rec.uri || fromStatus || null;
}

function flattenRecordingOptions(options: RecordingOptions): Partial<RecordingOptions> {
  const common = {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: options.isMeteringEnabled ?? false,
    directory: options.directory,
  };
  if (Platform.OS === 'ios') return { ...common, ...options.ios };
  if (Platform.OS === 'android') return { ...common, ...options.android };
  return { ...common, ...options.web };
}

function createNativeRecorder(options: RecordingOptions): NativeRecorder {
  const Ctor = (AudioModule as { AudioRecorder?: new (opts: Partial<RecordingOptions>) => NativeRecorder }).AudioRecorder;
  if (typeof Ctor !== 'function') {
    throw new Error('expo-audio AudioRecorder is not available');
  }
  return new Ctor(flattenRecordingOptions(options));
}

function waitUntilLoaded(player: AudioPlayer, timeoutMs = 4000): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise(resolve => {
    let sub: { remove: () => void } | null = null;
    const timer = setTimeout(() => {
      sub?.remove();
      resolve();
    }, timeoutMs);
    sub = player.addListener('playbackStatusUpdate', (st: AudioStatus) => {
      if (!st.isLoaded) return;
      clearTimeout(timer);
      sub?.remove();
      resolve();
    });
  });
}

function releasePlayer(player: AudioPlayer): void {
  const p = player as AudioPlayer & { release?: () => void; remove?: () => void };
  try {
    if (typeof p.release === 'function') p.release();
    else if (typeof p.remove === 'function') p.remove();
  } catch {}
}

function mapPlaybackStatus(st: AudioStatus): AVPlaybackStatus {
  if (!st.isLoaded) return { isLoaded: false };
  return {
    isLoaded: true,
    isPlaying: st.playing,
    positionMillis: Math.round((st.currentTime ?? 0) * 1000),
    durationMillis: Math.round((st.duration ?? 0) * 1000),
    didJustFinish: st.didJustFinish,
  };
}

export namespace Audio {
  export class Sound {
    private player: AudioPlayer;
    private statusSub: { remove: () => void } | null = null;

    constructor(player: AudioPlayer) {
      this.player = player;
    }

    static async createAsync(
      source: SoundSource,
      initialStatus: SoundInitialStatus = {},
      onPlaybackStatusUpdate?: StatusCallback,
    ): Promise<{ sound: Sound }> {
      const uri = typeof source === 'object' && source && 'uri' in source ? source.uri : source;
      const interval = initialStatus.progressUpdateIntervalMillis ?? 100;
      const player = createAudioPlayer(
        typeof uri === 'number' ? uri : { uri: normalizePlaybackUri(String(uri)) },
        { updateInterval: interval },
      );
      const sound = new Sound(player);
      await waitUntilLoaded(player);
      if (initialStatus.volume != null) {
        player.volume = Math.max(0, Math.min(1, initialStatus.volume));
      }
      if (initialStatus.positionMillis && initialStatus.positionMillis > 0) {
        await player.seekTo(initialStatus.positionMillis / 1000);
      }
      if (onPlaybackStatusUpdate) sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      if (initialStatus.shouldPlay) player.play();
      return { sound };
    }

    setOnPlaybackStatusUpdate(cb: StatusCallback | null): void {
      this.statusSub?.remove();
      this.statusSub = null;
      if (!cb) return;
      this.statusSub = this.player.addListener('playbackStatusUpdate', (st: AudioStatus) => {
        cb(mapPlaybackStatus(st));
      });
    }

    async getStatusAsync(): Promise<AVPlaybackStatus> {
      const p = this.player;
      if (!p.isLoaded) return { isLoaded: false };
      return {
        isLoaded: true,
        isPlaying: p.playing,
        positionMillis: Math.round((p.currentTime ?? 0) * 1000),
        durationMillis: Math.round((p.duration ?? 0) * 1000),
      };
    }

    async playAsync(): Promise<void> {
      this.player.play();
    }

    halt(): void {
      try { this.player.pause(); } catch {}
    }

    async pauseAsync(): Promise<void> {
      this.player.pause();
    }

    async stopAsync(): Promise<void> {
      this.player.pause();
      await this.player.seekTo(0);
    }

    async replayAsync(): Promise<void> {
      await this.player.seekTo(0);
      this.player.play();
    }

    async setPositionAsync(positionMillis: number): Promise<void> {
      await this.player.seekTo(Math.max(0, positionMillis) / 1000);
    }

    async setVolumeAsync(volume: number): Promise<void> {
      this.player.volume = Math.max(0, Math.min(1, volume));
    }

    async setRateAsync(rate: number, shouldCorrectPitch = true): Promise<void> {
      this.player.playbackRate = rate;
      this.player.shouldCorrectPitch = shouldCorrectPitch;
    }

    async setIsLoopingAsync(loop: boolean): Promise<void> {
      this.player.loop = loop;
    }

    async setStatusAsync(status: {
      shouldPlay?: boolean;
      positionMillis?: number;
      volume?: number;
    }): Promise<void> {
      if (status.volume != null) {
        this.player.volume = Math.max(0, Math.min(1, status.volume));
      }
      if (status.positionMillis != null) {
        await this.player.seekTo(Math.max(0, status.positionMillis) / 1000);
      }
      if (status.shouldPlay === false) this.player.pause();
      else if (status.shouldPlay === true) this.player.play();
    }

    async unloadAsync(): Promise<void> {
      this.statusSub?.remove();
      this.statusSub = null;
      try {
        this.player.pause();
      } catch {}
      releasePlayer(this.player);
    }
  }

  export class Recording {
    private rec: NativeRecorder | null = null;
    private statusSub: { remove: () => void } | null = null;
    /** expo-av kept the file URI after unload; expo-audio clears the native object. */
    private lastUri: string | null = null;

    private rememberUri(extra?: string | null): void {
      const next = recorderUri(this.rec, extra);
      if (next) this.lastUri = next;
    }

    async prepareToRecordAsync(options?: RecordingOptions): Promise<void> {
      const opts: RecordingOptions = {
        ...(options ?? RecordingPresets.HIGH_QUALITY),
        directory: 'document',
      };
      this.lastUri = null;
      this.rec = createNativeRecorder(opts);
      // Nested options: expo-audio's prototype shim flattens via createRecordingOptions.
      await this.rec.prepareToRecordAsync(opts);
      this.rememberUri();
    }

    async startAsync(): Promise<void> {
      if (!this.rec) throw new Error('Recording is not prepared');
      this.rec.record();
      this.rememberUri();
    }

    async stopAndUnloadAsync(): Promise<void> {
      if (!this.rec) return;
      const rec = this.rec as NativeRecorder & { release?: () => void };
      try {
        await rec.stop();
      } catch {}
      this.rememberUri();
      this.statusSub?.remove();
      this.statusSub = null;
      this.rec = null;
      try {
        rec.release?.();
      } catch {}
    }

    getURI(): string | null {
      return this.lastUri ?? recorderUri(this.rec);
    }

    async getAvailableInputs(): Promise<{ name: string; type: string; uid: string }[]> {
      if (!this.rec) return [];
      const raw = await this.rec.getAvailableInputs();
      return Array.isArray(raw) ? raw : [];
    }

    async getCurrentInput(): Promise<{ name: string; type: string; uid: string }> {
      if (!this.rec) throw new Error('Recording is not prepared');
      return this.rec.getCurrentInput();
    }

    async setInput(uid: string): Promise<void> {
      if (!this.rec) throw new Error('Recording is not prepared');
      await this.rec.setInput(uid);
    }

    setOnRecordingStatusUpdate(
      cb: ((status: { isDoneRecording: boolean }) => void) | null,
    ): void {
      this.statusSub?.remove();
      this.statusSub = null;
      if (!cb || !this.rec) return;
      this.statusSub = this.rec.addListener('recordingStatusUpdate', (status: RecordingStatus) => {
        this.rememberUri(status.url);
        cb({ isDoneRecording: status.isFinished });
      });
    }
  }

  export const RecordingOptionsPresets = RecordingPresets;

  export async function requestPermissionsAsync() {
    return requestRecordingPermissionsAsync();
  }

  export async function setAudioModeAsync(mode: LegacyAudioMode): Promise<void> {
    await setMappedAudioModeAsync(mode);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += alphabet[(triple >> 18) & 63] + alphabet[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? alphabet[triple & 63] : '=';
  }
  return out;
}

function encodeMonoWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataLen = samples.byteLength;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, dataLen, true);
  new Uint8Array(buf, 44).set(new Uint8Array(samples.buffer, samples.byteOffset, dataLen));
  return new Uint8Array(buf);
}

const TONE_SR = 22050;
const PIANO_PARTIALS: [number, number][] = [
  [1, 1], [2, 0.42], [3, 0.18], [4, 0.08], [5, 0.04],
];

function exactLoopSize(freq: number, sampleRate: number): { n: number; periods: number } {
  const periods = Math.max(12, Math.round(freq * 0.18));
  const n = Math.max(48, Math.round(periods * sampleRate / freq));
  return { n, periods };
}

function normalizePcm(raw: Float32Array, peakTarget: number): Int16Array {
  let peak = 0;
  for (let i = 0; i < raw.length; i++) peak = Math.max(peak, Math.abs(raw[i]));
  const g = peak > 1e-6 ? peakTarget / peak : 0;
  const data = new Int16Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    data[i] = Math.round(Math.max(-1, Math.min(1, raw[i] * g)) * 32767);
  }
  return data;
}

function periodicTone(freq: number, partials: [number, number][], peakTarget: number, sampleRate = TONE_SR): Int16Array {
  const { n, periods } = exactLoopSize(freq, sampleRate);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let p = 0; p < partials.length; p++) {
      const [k, a] = partials[p];
      s += a * Math.sin((2 * Math.PI * k * periods * i) / n + k * 0.6);
    }
    raw[i] = s;
  }
  return normalizePcm(raw, peakTarget);
}

function pianoPeak(freq: number): number {
  if (freq < 100) return 0.64;
  if (freq < 150) return 0.54;
  if (freq < 220) return 0.44;
  if (freq < 350) return 0.36;
  return 0.32;
}

function repeatToMinDuration(period: Int16Array, minSeconds: number, sampleRate: number): Int16Array {
  const minN = Math.round(sampleRate * minSeconds);
  if (period.length >= minN) return period;
  const reps = Math.max(2, Math.ceil(minN / period.length));
  const out = new Int16Array(period.length * reps);
  for (let r = 0; r < reps; r++) out.set(period, r * period.length);
  return out;
}

function sineSamples(freq: number, durationMs: number, sampleRate = TONE_SR, seamless = false): Int16Array {
  if (seamless) {
    return repeatToMinDuration(periodicTone(freq, [[1, 1]], 0.34, sampleRate), 0.9, sampleRate);
  }
  const n = Math.max(1, Math.floor(sampleRate * durationMs / 1000));
  const data = new Int16Array(n);
  const attack = Math.max(1, Math.floor(sampleRate * 0.01));
  const release = Math.max(1, Math.floor(sampleRate * 0.04));
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / attack) * Math.min(1, (n - i) / release);
    data[i] = Math.round(Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.28 * env * 32767);
  }
  return data;
}

function pianoSustainSamples(freq: number): Int16Array {
  return repeatToMinDuration(periodicTone(freq, PIANO_PARTIALS, pianoPeak(freq)), 0.9, TONE_SR);
}

function pianoSamples(freq: number, durationMs = 820, sampleRate = TONE_SR): Int16Array {
  const n = Math.max(1, Math.floor(sampleRate * durationMs / 1000));
  const raw = new Float32Array(n);
  const attack = Math.max(1, Math.floor(sampleRate * 0.006));
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, i / attack) * Math.exp(-t * 2.8);
    let s = 0;
    for (let p = 0; p < PIANO_PARTIALS.length; p++) {
      const [k, a] = PIANO_PARTIALS[p];
      s += a * Math.sin(2 * Math.PI * k * freq * t + k * 0.6);
    }
    raw[i] = s * env;
  }
  return normalizePcm(raw, 0.26);
}

/** One beat: short wood tick + silence. Looped by the player — no JS timer, no overlay. */
function metroLoopSamples(intervalMs: number, sampleRate = 22050): Int16Array {
  const n = Math.max(Math.floor(sampleRate * 0.06), Math.round(sampleRate * intervalMs / 1000));
  const data = new Int16Array(n);
  const clickN = Math.min(n, Math.floor(sampleRate * 0.007));
  for (let i = 0; i < clickN; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 480);
    const noise = ((i * 1103515245 + 12345) >>> 16 & 0xffff) / 65535 - 0.5;
    const s = 0.5 * Math.sin(2 * Math.PI * 890 * t) + 0.28 * Math.sin(2 * Math.PI * 1780 * t) + 0.1 * noise;
    data[i] = Math.round(Math.max(-1, Math.min(1, s * env * 0.62)) * 32767);
  }
  return data;
}

async function writeWavFile(path: string, pcm: Int16Array, sampleRate = 22050): Promise<string> {
  const wav = encodeMonoWav(pcm, sampleRate);
  await FileSystem.writeAsStringAsync(path, bytesToBase64(wav), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

let toneSound: Audio.Sound | null = null;
let clickSound: Audio.Sound | null = null;
let metroGen = 0;
let toneGen = 0;
let playbackModeReady = false;
let activeToneKey: string | null = null;
const toneFiles = new Map<string, string>();
const tonePlayers = new Map<string, Audio.Sound>();
const toneLoading = new Map<string, Promise<Audio.Sound>>();

function toneCacheKey(hz: number, piano: boolean, loop: boolean): string {
  return `v5-${piano ? 'p' : 's'}${loop ? 'L' : ''}-${Math.round(hz)}`;
}

async function ensurePlaybackMode(): Promise<void> {
  if (playbackModeReady) return;
  await applyPlaybackAudioMode();
  playbackModeReady = true;
}

function pauseTone(s: Audio.Sound | null): void {
  if (!s) return;
  s.halt();
  void s.setPositionAsync(0).catch(() => {});
}

function discardSound(s: Audio.Sound | null): void {
  if (!s) return;
  s.halt();
  void s.stopAsync().catch(() => {}).finally(() => { void s.unloadAsync().catch(() => {}); });
}

async function ensureToneFile(hz: number, piano: boolean, loop: boolean): Promise<string> {
  const key = toneCacheKey(hz, piano, loop);
  const hit = toneFiles.get(key);
  if (hit) return hit;
  const path = `${FileSystem.cacheDirectory ?? ''}recotune-tone-${key}.wav`;
  const cached = await FileSystem.getInfoAsync(path);
  if (!cached.exists) {
    const pcm = loop
      ? (piano ? pianoSustainSamples(hz) : sineSamples(hz, 400, TONE_SR, true))
      : (piano ? pianoSamples(hz) : sineSamples(hz, 900, TONE_SR));
    await writeWavFile(path, pcm, TONE_SR);
  }
  toneFiles.set(key, path);
  return path;
}

async function loadTonePlayer(key: string, path: string, volume: number, loop: boolean): Promise<Audio.Sound> {
  const existing = tonePlayers.get(key);
  if (existing) return existing;
  const pending = toneLoading.get(key);
  if (pending) return pending;
  const job = (async () => {
    const { sound } = await Audio.Sound.createAsync(
      { uri: normalizePlaybackUri(path) },
      { shouldPlay: false, volume, progressUpdateIntervalMillis: 1000 },
    );
    if (loop) await sound.setIsLoopingAsync(true);
    tonePlayers.set(key, sound);
    if (tonePlayers.size > 28) {
      const first = tonePlayers.keys().next().value as string | undefined;
      if (first && first !== key && first !== activeToneKey) {
        const old = tonePlayers.get(first) ?? null;
        tonePlayers.delete(first);
        discardSound(old);
      }
    }
    return sound;
  })();
  toneLoading.set(key, job);
  try {
    return await job;
  } finally {
    toneLoading.delete(key);
  }
}

export async function preloadReferenceTones(
  freqs: number[],
  opts?: { loop?: boolean; piano?: boolean },
): Promise<void> {
  await ensurePlaybackMode();
  const loop = opts?.loop !== false;
  const piano = !!opts?.piano;
  const volume = piano ? 0.72 : 0.55;
  for (const hz of freqs) {
    if (!(hz > 20 && hz < 4000)) continue;
    const key = toneCacheKey(hz, piano, loop);
    try {
      const path = await ensureToneFile(hz, piano, loop);
      await loadTonePlayer(key, path, volume, loop);
    } catch {}
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}

export async function stopReferenceTone(): Promise<void> {
  toneGen += 1;
  activeToneKey = null;
  const s = toneSound;
  toneSound = null;
  pauseTone(s);
}

/** Tuner drone or piano hit. */
export async function playReferenceTone(hz: number, opts?: { loop?: boolean; piano?: boolean }): Promise<void> {
  if (!(hz > 20 && hz < 4000)) return;
  const loop = !!opts?.loop;
  const piano = !!opts?.piano;
  const key = toneCacheKey(hz, piano, loop);
  if (activeToneKey === key && toneSound) return;
  const gen = ++toneGen;
  activeToneKey = key;
  if (toneSound && tonePlayers.get(key) !== toneSound) pauseTone(toneSound);
  await ensurePlaybackMode();
  if (gen !== toneGen) return;
  const path = await ensureToneFile(hz, piano, loop);
  if (gen !== toneGen) return;
  const sound = await loadTonePlayer(key, path, piano ? 0.72 : 0.55, loop);
  if (gen !== toneGen) return;
  if (toneSound && toneSound !== sound) pauseTone(toneSound);
  await sound.setPositionAsync(0);
  if (gen !== toneGen) {
    pauseTone(sound);
    return;
  }
  await sound.playAsync();
  if (gen !== toneGen) {
    pauseTone(sound);
    return;
  }
  toneSound = sound;
}

export function stopMetronomeClick(): void {
  metroGen += 1;
  const s = clickSound;
  clickSound = null;
  discardSound(s);
}

export async function startMetronomeClick(bpm: number): Promise<boolean> {
  const gen = ++metroGen;
  const prev = clickSound;
  clickSound = null;
  discardSound(prev);
  const clamped = clampMetronomeBpm(bpm);
  const interval = beatIntervalMs(clamped);
  await applyPlaybackAudioMode();
  if (gen !== metroGen) return false;
  const path = `${FileSystem.cacheDirectory ?? ''}recotune-metro-${clamped}.wav`;
  const uri = await writeWavFile(path, metroLoopSamples(interval));
  if (gen !== metroGen) return false;
  const { sound } = await Audio.Sound.createAsync(
    { uri: normalizePlaybackUri(uri) },
    { shouldPlay: false, volume: 0.72 },
  );
  if (gen !== metroGen) {
    discardSound(sound);
    return false;
  }
  await sound.setIsLoopingAsync(true);
  await sound.playAsync();
  if (gen !== metroGen) {
    discardSound(sound);
    return false;
  }
  clickSound = sound;
  return true;
}
