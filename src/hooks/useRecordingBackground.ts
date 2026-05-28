import { useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import Constants from 'expo-constants';
import type { Audio } from 'expo-av';
import { applyRecordingBackgroundAudioMode } from '../utils/recordingAudioMode';

const KEEP_AWAKE_TAG = 'recotune-recording';

export function isExpoGoClient(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

export function warnExpoGoBackgroundRecording(): void {
  if (!isExpoGoClient()) return;
  Alert.alert(
    'Expo Go',
    'Фоновая запись микрофона в Expo Go ограничена. Для Studio/Recorder в фоне соберите dev build: npx expo run:android или run:ios.',
  );
}

export interface RecordingBackgroundOptions {
  isRecording: boolean;
  isRecordingRef: React.MutableRefObject<boolean>;
  recRef: React.MutableRefObject<Audio.Recording | null>;
  /** True while user pressed STOP (ignore isDoneRecording from stopAndUnloadAsync) */
  stoppingRef?: React.MutableRefObject<boolean>;
  playThroughEarpieceAndroid: boolean;
  onInBackgroundChange?: (inBackground: boolean) => void;
  /** OS or expo-av stopped the mic while UI still shows REC */
  onRecordingInterrupted?: () => void;
}

async function applyRecMode(playThroughEarpieceAndroid: boolean): Promise<void> {
  await applyRecordingBackgroundAudioMode({ playThroughEarpieceAndroid });
}

/**
 * AppState + keep-awake + recording status guard for Studio / Recorder.
 * Does not stop recording on background — only re-applies audio session.
 */
export function useRecordingBackground({
  isRecording,
  isRecordingRef,
  recRef,
  stoppingRef,
  playThroughEarpieceAndroid,
  onInBackgroundChange,
  onRecordingInterrupted,
}: RecordingBackgroundOptions): void {
  const earpieceRef = useRef(playThroughEarpieceAndroid);
  useEffect(() => {
    earpieceRef.current = playThroughEarpieceAndroid;
  }, [playThroughEarpieceAndroid]);

  const interruptedRef = useRef(onRecordingInterrupted);
  interruptedRef.current = onRecordingInterrupted;

  useEffect(() => {
    if (!isRecording) {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
      onInBackgroundChange?.(false);
      return;
    }

    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    void applyRecMode(earpieceRef.current);

    const rec = recRef.current;
    if (rec) {
      rec.setOnRecordingStatusUpdate(status => {
        if (!isRecordingRef.current || stoppingRef?.current) return;
        if (status.isDoneRecording) {
          interruptedRef.current?.();
        }
      });
    }

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (!isRecordingRef.current) return;
      const bg = next === 'background' || next === 'inactive';
      onInBackgroundChange?.(bg);
      if (bg || next === 'active') {
        void applyRecMode(earpieceRef.current);
      }
    });

    return () => {
      sub.remove();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
      onInBackgroundChange?.(false);
    };
  }, [isRecording, isRecordingRef, recRef, onInBackgroundChange]);
}
