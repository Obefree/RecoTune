import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { detectPitch, parseWav } from '../utils/pitchDetection';
import { frequencyToNote, NoteInfo } from '../utils/noteUtils';

const SAMPLE_INTERVAL_MS = 350;

export interface TunerState {
  isActive: boolean;
  frequency: number | null;
  note: NoteInfo | null;
  signalLevel: number; // 0..1
  error: string | null;
}

export function useTuner() {
  const [state, setState] = useState<TunerState>({
    isActive: false,
    frequency: null,
    note: null,
    signalLevel: 0,
    error: null,
  });

  const recordingRef = useRef<Audio.Recording | null>(null);
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopRecordingCycle = useCallback(async () => {
    activeRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    setState(s => ({ ...s, isActive: false, frequency: null, note: null, signalLevel: 0 }));
  }, []);

  const analyzeAndCycle = useCallback(async () => {
    if (!activeRef.current) return;

    const rec = recordingRef.current;
    if (!rec) return;

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;

      if (uri) {
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Decode base64 to ArrayBuffer
        const binary = atob(b64);
        const buf = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const parsed = parseWav(buf);
        let frequency: number | null = null;
        let signalLevel = 0;

        if (parsed) {
          // Compute RMS for signal level
          let rms = 0;
          for (let i = 0; i < parsed.samples.length; i++) {
            rms += parsed.samples[i] * parsed.samples[i];
          }
          rms = Math.sqrt(rms / parsed.samples.length);
          signalLevel = Math.min(1, rms * 8);

          if (rms > 0.01) {
            frequency = detectPitch(parsed.samples, parsed.sampleRate);
          }
        }

        const note = frequency ? frequencyToNote(frequency) : null;
        setState(s => ({
          ...s,
          frequency,
          note,
          signalLevel,
          error: null,
        }));

        // Clean up temp file
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    } catch (err) {
      // ignore mid-cycle errors
    }

    if (!activeRef.current) return;

    // Start next recording cycle
    try {
      const newRec = new Audio.Recording();
      await newRec.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: 2, // MPEG_4
          audioEncoder: 3, // AAC
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm',
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      });
      await newRec.startAsync();
      recordingRef.current = newRec;

      timerRef.current = setTimeout(analyzeAndCycle, SAMPLE_INTERVAL_MS);
    } catch (err) {
      setState(s => ({ ...s, error: 'Recording error' }));
    }
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;

    setState(s => ({ ...s, error: null }));

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setState(s => ({ ...s, error: 'Microphone permission denied' }));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      activeRef.current = true;
      setState(s => ({ ...s, isActive: true }));

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm',
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      });
      await rec.startAsync();
      recordingRef.current = rec;

      timerRef.current = setTimeout(analyzeAndCycle, SAMPLE_INTERVAL_MS);
    } catch (err) {
      activeRef.current = false;
      setState(s => ({ ...s, isActive: false, error: 'Could not start tuner' }));
    }
  }, [analyzeAndCycle]);

  const stop = useCallback(() => {
    stopRecordingCycle();
  }, [stopRecordingCycle]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  return { state, start, stop };
}
