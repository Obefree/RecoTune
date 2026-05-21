import { useEffect, useRef } from 'react';
import {
  MediaRemoteControlMode,
  MediaRemoteHandlers,
  MediaNowPlaying,
  publishNowPlaying,
  registerMediaRemote,
  unregisterMediaRemote,
} from '../utils/mediaRemoteControls';

let ownerSeq = 0;

export function useMediaRemoteControls(
  active: boolean,
  mode: MediaRemoteControlMode,
  handlers: MediaRemoteHandlers,
  nowPlaying: MediaNowPlaying | null,
): void {
  const ownerRef = useRef(`media-${++ownerSeq}`);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!active) {
      try {
        unregisterMediaRemote(ownerRef.current);
      } catch {}
      return;
    }

    try {
      registerMediaRemote(ownerRef.current, mode, {
        onTogglePlay: () => handlersRef.current.onTogglePlay?.(),
        onPlay: () => handlersRef.current.onPlay?.(),
        onPause: () => handlersRef.current.onPause?.(),
        onNext: () => handlersRef.current.onNext?.(),
        onPrevious: () => handlersRef.current.onPrevious?.(),
        onSkipForward: () => handlersRef.current.onSkipForward?.(),
        onSkipBackward: () => handlersRef.current.onSkipBackward?.(),
        onSeek: (pos) => handlersRef.current.onSeek?.(pos),
      });
    } catch {}

    return () => {
      try {
        unregisterMediaRemote(ownerRef.current);
      } catch {}
    };
  }, [active, mode]);

  useEffect(() => {
    if (!active || !nowPlaying) return;
    try {
      publishNowPlaying(nowPlaying);
    } catch {}
  }, [active, nowPlaying?.title, nowPlaying?.artist, nowPlaying?.durationSec, nowPlaying?.elapsedSec, nowPlaying?.isPlaying]);
}
