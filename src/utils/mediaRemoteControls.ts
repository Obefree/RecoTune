import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/** queue = next/prev track; list = next/prev item; single = ±10 s skip only */
export type MediaRemoteControlMode = 'queue' | 'list' | 'single';

export interface MediaRemoteHandlers {
  onTogglePlay?: () => void | Promise<void>;
  onPlay?: () => void | Promise<void>;
  onPause?: () => void | Promise<void>;
  onNext?: () => void | Promise<void>;
  onPrevious?: () => void | Promise<void>;
  /** ±10 s for single-track / recording preview */
  onSkipForward?: () => void | Promise<void>;
  onSkipBackward?: () => void | Promise<void>;
  /** Lock screen scrub (seconds) */
  onSeek?: (positionSec: number) => void | Promise<void>;
}

export interface MediaNowPlaying {
  title: string;
  artist?: string;
  durationSec: number;
  elapsedSec: number;
  isPlaying: boolean;
}

type MusicControlModule = typeof import('react-native-music-control').default;
type CommandEnum = typeof import('react-native-music-control').Command;

let MusicControl: MusicControlModule | null = null;
let Command: CommandEnum | null = null;
let musicControlLoadAttempted = false;
let musicControlAvailable = false;

let initialized = false;
let activeOwner: string | null = null;
let activeMode: MediaRemoteControlMode = 'single';
let handlers: MediaRemoteHandlers = {};

function disableMusicControl(): void {
  musicControlAvailable = false;
  initialized = false;
  activeOwner = null;
  handlers = {};
  MusicControl = null;
  Command = null;
}

function runNative(fn: () => void): void {
  try {
    fn();
  } catch {
    disableMusicControl();
  }
}

/** Lock screen / headset controls need a dev build; Expo Go skips the native module. */
export function isMediaRemoteControlsAvailable(): boolean {
  return ensureMusicControl();
}

function ensureMusicControl(): boolean {
  if (musicControlLoadAttempted) return musicControlAvailable;
  musicControlLoadAttempted = true;

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-music-control') as {
      default?: MusicControlModule;
      Command?: CommandEnum;
    };
    MusicControl = mod.default ?? (mod as unknown as MusicControlModule);
    Command = mod.Command ?? null;
    musicControlAvailable = Boolean(MusicControl && Command);
  } catch {
    musicControlAvailable = false;
  }

  return musicControlAvailable;
}

function run(handler?: () => void | Promise<void>) {
  if (!handler) return;
  try {
    const r = handler();
    if (r && typeof (r as Promise<void>).catch === 'function') {
      (r as Promise<void>).catch(() => {});
    }
  } catch {}
}

function ensureInitialized(): void {
  if (initialized || !ensureMusicControl() || !MusicControl || !Command) return;

  try {
    MusicControl.enableBackgroundMode(true);
    if (Platform.OS === 'ios') {
      MusicControl.handleAudioInterruptions(true);
    }

    const bind = (cmd: CommandEnum[keyof CommandEnum], fn: (value?: unknown) => void) => {
      MusicControl!.on(cmd, fn);
    };

    bind(Command.play, () => run(handlers.onPlay ?? handlers.onTogglePlay));
    bind(Command.pause, () => run(handlers.onPause ?? handlers.onTogglePlay));
    bind(Command.togglePlayPause, () => run(handlers.onTogglePlay));
    bind(Command.nextTrack, () => {
      if (activeMode === 'queue' || activeMode === 'list') run(handlers.onNext);
      else run(handlers.onSkipForward);
    });
    bind(Command.previousTrack, () => {
      if (activeMode === 'queue' || activeMode === 'list') run(handlers.onPrevious);
      else run(handlers.onSkipBackward);
    });
    bind(Command.skipForward, () => run(handlers.onSkipForward ?? handlers.onNext));
    bind(Command.skipBackward, () => run(handlers.onSkipBackward ?? handlers.onPrevious));
    bind(Command.seek, (value?: unknown) => {
      if (typeof value === 'number' && handlers.onSeek) run(() => handlers.onSeek!(value));
    });
    bind(Command.changePlaybackPosition, (value?: unknown) => {
      if (typeof value === 'number' && handlers.onSeek) run(() => handlers.onSeek!(value));
    });

    initialized = true;
  } catch {
    disableMusicControl();
  }
}

function applyControlButtons(mode: MediaRemoteControlMode): void {
  if (!MusicControl || !Command) return;

  runNative(() => {
    MusicControl!.enableControl(Command!.play, true);
    MusicControl!.enableControl(Command!.pause, true);
    MusicControl!.enableControl(Command!.togglePlayPause, true);
    MusicControl!.enableControl(Command!.stop, false);

    if (mode === 'queue' || mode === 'list') {
      MusicControl!.enableControl(Command!.nextTrack, true);
      MusicControl!.enableControl(Command!.previousTrack, true);
      MusicControl!.enableControl(Command!.skipForward, false);
      MusicControl!.enableControl(Command!.skipBackward, false);
    } else {
      MusicControl!.enableControl(Command!.nextTrack, false);
      MusicControl!.enableControl(Command!.previousTrack, false);
      MusicControl!.enableControl(Command!.skipForward, true, { interval: 10 });
      MusicControl!.enableControl(Command!.skipBackward, true, { interval: 10 });
    }

    if (Platform.OS === 'android') {
      MusicControl!.enableControl(Command!.seek, true);
    } else {
      MusicControl!.enableControl(Command!.changePlaybackPosition, true);
    }
  });
}

/** Register lock-screen / headset handlers for the active playback owner. */
export function registerMediaRemote(
  ownerId: string,
  mode: MediaRemoteControlMode,
  nextHandlers: MediaRemoteHandlers,
): void {
  if (!ensureMusicControl()) return;
  try {
    ensureInitialized();
    if (!musicControlAvailable) return;
    activeOwner = ownerId;
    activeMode = mode;
    handlers = nextHandlers;
    applyControlButtons(mode);
  } catch {
    disableMusicControl();
  }
}

export function unregisterMediaRemote(ownerId: string): void {
  if (activeOwner !== ownerId) return;
  activeOwner = null;
  handlers = {};
  if (!MusicControl || !musicControlAvailable) return;
  runNative(() => {
    MusicControl!.resetNowPlaying();
    MusicControl!.stopControl();
  });
}

export function publishNowPlaying(info: MediaNowPlaying): void {
  if (!activeOwner || !ensureMusicControl() || !MusicControl || !musicControlAvailable) return;
  try {
    ensureInitialized();
    if (!musicControlAvailable || !MusicControl) return;

    const elapsed = Math.max(0, Math.min(info.durationSec || 0, info.elapsedSec || 0));
    const duration = Math.max(0, info.durationSec || 0);

    runNative(() => {
      MusicControl!.setNowPlaying({
        title: info.title,
        artist: info.artist ?? 'RecoTune',
        album: 'RecoTune',
        duration,
        elapsedTime: elapsed,
      });
      applyControlButtons(activeMode);
      MusicControl!.updatePlayback({
        state: info.isPlaying ? MusicControl!.STATE_PLAYING : MusicControl!.STATE_PAUSED,
        elapsedTime: elapsed,
        speed: 1,
      });
    });
  } catch {
    disableMusicControl();
  }
}

/** Call from App startup once (idempotent). No-op in Expo Go or if native init fails. */
export function initMediaRemoteControls(): void {
  try {
    ensureInitialized();
  } catch {
    disableMusicControl();
  }
}
