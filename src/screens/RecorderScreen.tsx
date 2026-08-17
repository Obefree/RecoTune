import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, Animated, Modal, TextInput, ScrollView, Pressable, Platform, useWindowDimensions,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useMediaRemoteControls } from '../hooks/useMediaRemoteControls';
import { applyPlaybackAudioMode } from '../utils/playbackAudioMode';
import { assertPlaybackFileExists, saveAudioToPhoneLibrary } from '../utils/playbackUri';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarVisibility } from '../context/TabBarVisibility';
import SeekBar from '../components/SeekBar';
import {
  RecQuality, QUALITY_PRESETS, DEFAULT_QUALITY,
  loadQualitySettings, saveQualitySettings, buildRecordingOptions, presetLabel,
} from '../utils/qualitySettings';
import {
  DEFAULT_AUDIO_ROUTING,
  probeRecordingInputs,
  applyStudioAudioMode,
  revalidateStudioRoutingOnFocus,
  applyRecordingInput,
  loadStudioAudioRouting,
  saveStudioAudioRouting,
  type StudioAudioRouting,
  type AudioRouteSnapshot,
  type RecordingInputInfo,
} from '../utils/studioAudioRouting';
import RecordingInputPicker from '../components/RecordingInputPicker';
import { useRecordingBackground, warnExpoGoBackgroundRecording } from '../hooks/useRecordingBackground';
import TunerEngine, { PitchMessage } from '../components/TunerEngine';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  applyMicMonitorAudioMode,
  releaseMicMonitorAudioMode,
  micMonitorActiveHint,
  micMonitorLimitationsText,
} from '../utils/micLiveMonitor';

interface Recording {
  id: string;
  uri: string;
  name: string;
  createdAt: number;
}

const RECORDINGS_DIR = (FileSystem.documentDirectory ?? '') + 'recordings/';

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function RecorderScreen({ embedded }: { embedded?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { setTabBarHidden } = useTabBarVisibility();
  const recorderModalScrollMaxH = Math.max(260, Math.round(windowH * 0.72) - insets.top - insets.bottom - 24);
  const [recordings, setRecordings]   = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recInBackground, setRecInBackground] = useState(false);
  const [recDur, setRecDur]           = useState(0);
  const [loading, setLoading]         = useState(true);
  const [renameRec, setRenameRec]     = useState<Recording | null>(null);
  const [renameText, setRenameText]   = useState('');
  const [quality, setQuality]         = useState<RecQuality>(DEFAULT_QUALITY);
  const [showQuality, setShowQuality] = useState(false);
  const [audioRouting, setAudioRouting] = useState<StudioAudioRouting>(DEFAULT_AUDIO_ROUTING);
  const [audioRouteSnap, setAudioRouteSnap] = useState<AudioRouteSnapshot | null>(null);
  const [audioRouteLoading, setAudioRouteLoading] = useState(false);
  const [micMonitorOn, setMicMonitorOn] = useState(false);
  const [micMonitorBusy, setMicMonitorBusy] = useState(false);
  const [micMonitorError, setMicMonitorError] = useState<string | null>(null);
  const [micMonitorLevel, setMicMonitorLevel] = useState(0);
  const micMonitorOnRef = useRef(false);
  const audioRoutingRef = useRef<StudioAudioRouting>(DEFAULT_AUDIO_ROUTING);
  const qualityRef = useRef<RecQuality>(DEFAULT_QUALITY);
  useEffect(() => { qualityRef.current = quality; }, [quality]);
  useEffect(() => { audioRoutingRef.current = audioRouting; }, [audioRouting]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { micMonitorOnRef.current = micMonitorOn; }, [micMonitorOn]);

  const anyRecModalOpen = showQuality || renameRec !== null;
  useEffect(() => {
    setTabBarHidden(anyRecModalOpen);
  }, [anyRecModalOpen, setTabBarHidden]);

  // Single-source-of-truth for playback
  const [playingId, setPlayingId]       = useState<string | null>(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [playPos, setPlayPos]           = useState(0);
  const [playDur, setPlayDur]           = useState(0);

  const recRef     = useRef<Audio.Recording | null>(null);
  const isRecordingRef = useRef(false);
  const stoppingRecRef = useRef(false);
  const soundRef   = useRef<Audio.Sound | null>(null);
  const recordingsRef = useRef<Recording[]>([]);
  const busyRef    = useRef(false);   // prevents concurrent stop/start
  const startRef   = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const dotOpacity = useRef(new Animated.Value(1)).current;
  const dotLoop    = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isRecording) {
      dotLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]));
      dotLoop.current.start();
    } else {
      dotLoop.current?.stop();
      dotOpacity.setValue(1);
    }
  }, [isRecording]);

  /* ─── Load recordings ─── */
  const load = useCallback(async () => {
    try {
      await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
      const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
      const recs: Recording[] = [];
      for (const f of files) {
        if (!/\.(m4a|wav|mp4|caf)$/i.test(f)) continue;
        const uri  = RECORDINGS_DIR + f;
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) continue;
        const match = f.match(/_(\d+)\./);
        const ts    = match ? parseInt(match[1], 10) : (info.modificationTime ?? 0) * 1000;
        recs.push({
          id: f, uri,
          name: `Recording ${new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
          createdAt: ts,
        });
      }
      recs.sort((a, b) => b.createdAt - a.createdAt);
      setRecordings(recs);
      recordingsRef.current = recs;
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { recordingsRef.current = recordings; }, [recordings]);

  const refreshAudioRoutes = useCallback(async () => {
    setAudioRouteLoading(true);
    try {
      const snap = await probeRecordingInputs();
      setAudioRouteSnap(snap);
      return snap;
    } finally {
      setAudioRouteLoading(false);
    }
  }, []);

  const pickInput = useCallback((inp: RecordingInputInfo) => {
    const next: StudioAudioRouting = {
      mode: 'manual',
      output: audioRoutingRef.current.output,
      inputUid: inp.uid,
    };
    setAudioRouting(next);
    audioRoutingRef.current = next;
    void saveStudioAudioRouting(next);
  }, []);

  useEffect(() => {
    load();
    loadQualitySettings().then(q => { setQuality(q); qualityRef.current = q; });
    loadStudioAudioRouting().then(r => {
      setAudioRouting(r);
      audioRoutingRef.current = r;
    });
  }, []);

  useEffect(() => {
    if (showQuality) void refreshAudioRoutes();
  }, [showQuality, refreshAudioRoutes]);

  /* ─── Sound teardown (sync-safe) ─── */
  const killSound = useCallback(() => {
    const s = soundRef.current;
    soundRef.current = null;
    setPlayingId(null);
    setIsPlaying(false);
    setPlayPos(0);
    setPlayDur(0);
    if (s) {
      s.stopAsync()
        .catch(() => {})
        .finally(() => s.unloadAsync().catch(() => {}));
    }
  }, []);

  const stopMicMonitor = useCallback(async () => {
    setMicMonitorOn(false);
    micMonitorOnRef.current = false;
    setMicMonitorLevel(0);
    setMicMonitorError(null);
    setMicMonitorBusy(false);
    try {
      deactivateKeepAwake();
    } catch {}
    await releaseMicMonitorAudioMode();
  }, []);

  const handleMicMonitorMessage = useCallback((msg: PitchMessage) => {
    if (msg.type === 'ready') {
      setMicMonitorError(null);
      setMicMonitorBusy(false);
    } else if (msg.type === 'error') {
      setMicMonitorBusy(false);
      setMicMonitorError(msg.message ?? 'Микрофон недоступен');
      void stopMicMonitor();
    } else if (msg.type === 'signal' && typeof msg.signal === 'number') {
      setMicMonitorLevel(msg.signal);
    }
  }, [stopMicMonitor]);

  const startMicMonitor = useCallback(async () => {
    if (isRecordingRef.current || micMonitorOnRef.current || micMonitorBusy) return;
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа к микрофону');
      return;
    }
    setMicMonitorBusy(true);
    setMicMonitorError(null);
    killSound();
    try {
      const snap = await refreshAudioRoutes();
      await applyMicMonitorAudioMode(audioRoutingRef.current);
      await activateKeepAwakeAsync();
      setMicMonitorOn(true);
      micMonitorOnRef.current = true;
      if (!snap.hasBluetooth && audioRoutingRef.current.output === 'bluetooth') {
        setMicMonitorError('Bluetooth не в списке — подключи колонку и обнови настройки.');
      }
    } catch (e) {
      setMicMonitorBusy(false);
      Alert.alert('Монитор', String(e));
    }
  }, [killSound, micMonitorBusy, refreshAudioRoutes]);

  const toggleMicMonitor = useCallback(() => {
    if (micMonitorOn) void stopMicMonitor();
    else void startMicMonitor();
  }, [micMonitorOn, startMicMonitor, stopMicMonitor]);

  useFocusEffect(useCallback(() => {
    load();
    if (!isRecordingRef.current) {
      void revalidateStudioRoutingOnFocus(audioRoutingRef.current).then(({ routing }) => {
        if (routing !== audioRoutingRef.current) {
          setAudioRouting(routing);
          audioRoutingRef.current = routing;
        }
      });
    }
    return () => {
      killSound();
      void stopMicMonitor();
      setTabBarHidden(false);
      setShowQuality(false);
      setRenameRec(null);
      setRenameText('');
    };
  }, [killSound, load, setTabBarHidden, stopMicMonitor]));

  const handleRecordingInterrupted = useCallback(() => {
    if (!isRecordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    recRef.current = null;
    setIsRecording(false);
    setRecInBackground(false);
    Alert.alert(
      'Запись прервана',
      'Система остановила микрофон (часто в Expo Go или без dev build). Соберите приложение: npx expo run:android / run:ios.',
    );
  }, []);

  useRecordingBackground({
    isRecording,
    isRecordingRef,
    recRef,
    stoppingRef: stoppingRecRef,
    playThroughEarpieceAndroid:
      audioRouting.mode === 'manual' && audioRouting.output === 'earpiece',
    onInBackgroundChange: setRecInBackground,
    onRecordingInterrupted: handleRecordingInterrupted,
  });

  /* ─── Playback ─── */
  const togglePlay = useCallback(async (rec: Recording) => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      // Tapping the currently playing track → stop
      if (playingId === rec.id) {
        killSound();
        return;
      }

      // Stop whatever is playing
      killSound();

      await applyPlaybackAudioMode();

      const playbackUri = await assertPlaybackFileExists(rec.uri);
      const { sound } = await Audio.Sound.createAsync(
        { uri: playbackUri },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        (st: AVPlaybackStatus) => {
          if (!st.isLoaded) return;
          setIsPlaying(st.isPlaying);
          if (!playbackSeekingRef.current) {
            setPlayPos(Math.round(st.positionMillis / 100) / 10);
          }
          if (st.durationMillis) setPlayDur(st.durationMillis / 1000);
          if (st.didJustFinish) {
            soundRef.current = null;
            setPlayingId(null);
            setIsPlaying(false);
            if (!playbackSeekingRef.current) setPlayPos(0);
          }
        }
      );

      // Guard: another operation may have already killed us
      if (soundRef.current !== null) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;
      setPlayingId(rec.id);
    } catch (e) {
      Alert.alert('Playback error', String(e));
      killSound();
    } finally {
      busyRef.current = false;
    }
  }, [playingId, killSound]);

  /* ─── Seeking ─── */
  const playbackSeekingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);

  const handleSeek = useCallback(async (seconds: number) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setStatusAsync({ positionMillis: Math.round(seconds * 1000) });
      setPlayPos(Math.round(seconds * 10) / 10);
    } catch {}
  }, []);

  const togglePlayRemote = useCallback(async () => {
    const id = playingId;
    if (!id) return;
    const rec = recordingsRef.current.find(r => r.id === id);
    if (rec) await togglePlay(rec);
  }, [playingId, togglePlay]);

  const skipPlaySec = useCallback(async (delta: number) => {
    if (!soundRef.current || playDur <= 0) return;
    const next = Math.max(0, Math.min(playDur, playPos + delta));
    await handleSeek(next);
  }, [playPos, playDur, handleSeek]);

  const playAdjacentRecording = useCallback(async (dir: 1 | -1) => {
    const id = playingId;
    if (!id) return;
    const list = recordingsRef.current;
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= list.length) return;
    await togglePlay(list[nextIdx]);
  }, [playingId, togglePlay]);

  const playingRec = playingId ? recordings.find(r => r.id === playingId) : null;

  useMediaRemoteControls(
    !!playingId && !!playingRec,
    'list',
    {
      onTogglePlay: togglePlayRemote,
      onNext: () => playAdjacentRecording(1),
      onPrevious: () => playAdjacentRecording(-1),
      onSkipForward: () => skipPlaySec(10),
      onSkipBackward: () => skipPlaySec(-10),
      onSeek: handleSeek,
    },
    playingRec
      ? {
          title: playingRec.name,
          artist: 'Recording',
          durationSec: playDur,
          elapsedSec: playPos,
          isPlaying,
        }
      : null,
  );

  /* ─── Recording ─── */
  const startRecording = async () => {
    if (micMonitorOnRef.current) {
      await stopMicMonitor();
    }
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied'); return; }
    warnExpoGoBackgroundRecording();
    killSound();
    await applyStudioAudioMode(audioRoutingRef.current, { recording: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(buildRecordingOptions(qualityRef.current));
    await applyRecordingInput(rec, audioRoutingRef.current);
    await rec.startAsync();
    recRef.current = rec;
    startRef.current = Date.now();
    setIsRecording(true);
    setRecDur(0);
    timerRef.current = setInterval(() => setRecDur(Math.floor((Date.now() - startRef.current) / 1000)), 500);
  };

  const stopRecording = async () => {
    if (!recRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      stoppingRecRef.current = true;
      await recRef.current.stopAndUnloadAsync();
      const uri = recRef.current.getURI();
      recRef.current = null;
      setIsRecording(false);
      setRecInBackground(false);
      try {
        await applyStudioAudioMode(audioRoutingRef.current, { recording: false });
      } catch {}
      if (uri) {
        const ts  = Date.now();
        const ext = uri.split('.').pop() ?? 'm4a';
        const dst = RECORDINGS_DIR + `rec_${ts}.${ext}`;
        await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
        await FileSystem.moveAsync({ from: uri, to: dst });
        setRecordings(prev => [{
          id: `rec_${ts}.${ext}`, uri: dst,
          name: `Recording ${new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
          createdAt: ts,
        }, ...prev]);
        const saved = await saveAudioToPhoneLibrary(dst);
        if (!saved.ok) {
          Alert.alert(
            'Запись в приложении',
            `${saved.error ?? 'Не удалось скопировать в память телефона'}. Файл есть в RecoTune; разрешите доступ к аудио, чтобы копия переживала удаление приложения.`,
          );
        }
      }
    } catch (e) {
      setIsRecording(false);
      setRecInBackground(false);
      Alert.alert('Stop error', String(e));
    } finally {
      stoppingRecRef.current = false;
    }
  };

  /* ─── Share (copy out of app sandbox) ─── */
  const shareRecording = useCallback(async (rec: Recording) => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available on this device');
        return;
      }
      const mime = rec.uri.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mp4';
      await Sharing.shareAsync(rec.uri, {
        mimeType: mime,
        dialogTitle: rec.name,
        UTI: 'public.audio',
      });
    } catch (e) {
      Alert.alert('Export error', String(e));
    }
  }, []);

  const shareAllRecordings = useCallback(() => {
    const list = recordingsRef.current;
    if (!list.length) return;
    Alert.alert(
      'Save copies',
      `Copy ${list.length} recordings into the RecoTune album on this phone? They stay after uninstall.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save to phone',
          onPress: async () => {
            let ok = 0;
            let fail = 0;
            for (const rec of recordingsRef.current) {
              const r = await saveAudioToPhoneLibrary(rec.uri);
              if (r.ok) ok += 1;
              else fail += 1;
            }
            Alert.alert('Saved', `${ok} in RecoTune album` + (fail ? `, ${fail} failed` : ''));
          },
        },
        {
          text: 'Share sheets',
          onPress: async () => {
            for (const rec of recordingsRef.current) {
              await shareRecording(rec);
            }
          },
        },
      ],
    );
  }, [shareRecording]);

  /* ─── Delete / Rename ─── */
  const applyRename = useCallback(() => {
    if (renameRec && renameText.trim()) {
      setRecordings(p => p.map(r => r.id === renameRec.id ? { ...r, name: renameText.trim() } : r));
    }
    setRenameRec(null);
    setRenameText('');
  }, [renameRec, renameText]);

  const onLongPress = (rec: Recording) => {
    Alert.alert(rec.name, undefined, [
      { text: 'Share / save copy', onPress: () => { void shareRecording(rec); } },
      {
        text: 'Rename', onPress: () => {
          setRenameRec(rec);
          setRenameText(rec.name);
        },
      },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (playingId === rec.id) killSound();
          await FileSystem.deleteAsync(rec.uri, { idempotent: true });
          setRecordings(p => p.filter(r => r.id !== rec.id));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /* ─── Render item ─── */
  const renderItem = ({ item }: { item: Recording }) => {
    const playing = playingId === item.id;
    return (
      <TouchableOpacity
        style={[styles.recItem, playing ? styles.recItemPlaying : null]}
        onLongPress={() => onLongPress(item)}
        activeOpacity={0.9}
        delayLongPress={400}
      >
        {/* Play/pause */}
        <TouchableOpacity onPress={() => togglePlay(item)} style={styles.playBtn}>
          <Ionicons
            name={playing ? 'pause-circle' : 'play-circle'}
            size={44}
            color={playing ? '#7c4dff' : '#555'}
          />
        </TouchableOpacity>

        <View style={styles.recInfo}>
          <Text style={styles.recName}>{item.name}</Text>
          <Text style={styles.recDate}>{fmtDate(item.createdAt)}</Text>

          {playing && (
            <>
              {/* Seek bar */}
              <View style={styles.seekWrap}>
                <SeekBar
                  position={playPos}
                  duration={playDur}
                  onSeek={handleSeek}
                  onScrubStart={() => {
                    playbackSeekingRef.current = true;
                    const s = soundRef.current;
                    if (!s) return;
                    void s.getStatusAsync().then(st => {
                      if (st.isLoaded) wasPlayingBeforeScrubRef.current = st.isPlaying;
                      if (st.isLoaded && st.isPlaying) s.pauseAsync().catch(() => {});
                    });
                  }}
                  onScrubEnd={() => {
                    playbackSeekingRef.current = false;
                    if (wasPlayingBeforeScrubRef.current) {
                      soundRef.current?.playAsync().catch(() => {});
                    }
                  }}
                  color="#7c4dff"
                />
              </View>
              <Text style={styles.timeText}>
                {fmt(playPos)}  ·  {fmt(playDur)}
              </Text>
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={() => { void shareRecording(item); }}
          style={styles.deleteBtn}
          accessibilityLabel="Share recording"
        >
          <Ionicons name="share-outline" size={20} color="#888" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (playingId === item.id) killSound();
            Alert.alert('Delete?', item.name, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete', style: 'destructive', onPress: async () => {
                  await FileSystem.deleteAsync(item.uri, { idempotent: true });
                  setRecordings(p => p.filter(r => r.id !== item.id));
                },
              },
            ]);
          }}
          style={styles.deleteBtn}
        >
          <Ionicons name="trash-outline" size={20} color="#444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: embedded ? 8 : insets.top + 8 }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Recorder</Text>
        {!isRecording && (
          <TouchableOpacity onPress={() => setShowQuality(true)} style={styles.qualityChip}>
            <Ionicons name="settings-outline" size={13} color="#7c4dff" />
            <Text style={styles.qualityChipText}>{presetLabel(quality)}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.micMonitorCard}>
        <TouchableOpacity
          style={[styles.micMonitorBtn, micMonitorOn && styles.micMonitorBtnOn]}
          onPress={toggleMicMonitor}
          disabled={isRecording || micMonitorBusy}
          activeOpacity={0.85}
        >
          <Ionicons
            name={micMonitorOn ? 'radio' : 'megaphone-outline'}
            size={18}
            color={micMonitorOn ? '#0a0a0f' : '#00e676'}
          />
          <Text style={[styles.micMonitorBtnText, micMonitorOn && styles.micMonitorBtnTextOn]}>
            {micMonitorBusy && !micMonitorOn ? '…' : micMonitorOn ? 'Стоп монитор' : 'Микрофон → колонки'}
          </Text>
        </TouchableOpacity>
        {micMonitorOn && (
          <View style={styles.micMonitorMeterTrack}>
            <View style={[styles.micMonitorMeterFill, { width: `${Math.round(micMonitorLevel * 100)}%` }]} />
          </View>
        )}
        <Text style={styles.micMonitorHint} numberOfLines={4}>
          {micMonitorOn
            ? micMonitorActiveHint(audioRouteSnap?.listenHint, audioRouting)
            : micMonitorLimitationsText()}
        </Text>
        {micMonitorError ? (
          <Text style={styles.micMonitorWarn}>{micMonitorError}</Text>
        ) : null}
      </View>

      {/* Record button */}
      <View style={styles.recordArea}>
        {isRecording && (
          <View style={styles.recDurRow}>
            <Animated.View style={[styles.recDot, { opacity: dotOpacity }]} />
            <Text style={styles.recDurText}>{fmt(recDur)}</Text>
            {recInBackground ? (
              <Text style={styles.recBackgroundHint}>запись в фоне</Text>
            ) : null}
          </View>
        )}
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          style={[styles.recBtn, isRecording ? styles.recBtnActive : null]}
          activeOpacity={0.8}
          disabled={micMonitorOn && !isRecording}
        >
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hint}>{isRecording ? 'Tap to stop' : 'Tap to record'}</Text>
      </View>

      {/* List */}
      <View style={styles.listWrap}>
        <View style={styles.listTitleRow}>
          <Text style={styles.listTitle}>
            {recordings.length > 0 ? `RECORDINGS (${recordings.length})` : 'NO RECORDINGS YET'}
          </Text>
          {recordings.length > 0 ? (
            <TouchableOpacity onPress={shareAllRecordings} style={styles.shareAllBtn} accessibilityLabel="Share all recordings">
              <Ionicons name="share-outline" size={16} color="#ffeb3b" />
              <Text style={styles.shareAllText}>SAVE ALL</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {loading
          ? null
          : (
            <FlatList
              data={recordings}
              keyExtractor={i => i.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={<Text style={styles.emptyText}>Record something above</Text>}
            />
          )}
      </View>
      {/* Quality modal */}
      <Modal
        visible={showQuality}
        transparent
        animationType="fade"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => setShowQuality(false)}
      >
        <View style={[styles.recModalOverlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowQuality(false)} accessibilityLabel="Закрыть" />
          <View style={styles.recModalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={{ maxHeight: recorderModalScrollMaxH }}
              contentContainerStyle={styles.recModalScrollContent}
            >
              <Text style={styles.modalTitle}>Recording Quality</Text>
              <Text style={styles.qualityHint}>Shared with Studio — applies to new recordings</Text>
              {QUALITY_PRESETS.map((p, i) => {
                const active =
                  p.q.sampleRate === quality.sampleRate &&
                  p.q.channels   === quality.channels   &&
                  p.q.bitRate    === quality.bitRate;
                return (
                  <TouchableOpacity key={i}
                    onPress={async () => {
                      setQuality(p.q); qualityRef.current = p.q;
                      await saveQualitySettings(p.q);
                    }}
                    style={[styles.qualityRow, active && styles.qualityRowActive]}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.qualityName, active && { color: '#7c4dff' }]}>{p.label}</Text>
                      <Text style={styles.qualitySub}>{p.sub}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color="#7c4dff" />}
                  </TouchableOpacity>
                );
              })}
              <RecordingInputPicker
                routing={audioRouting}
                snap={audioRouteSnap}
                loading={audioRouteLoading}
                onRefresh={() => void refreshAudioRoutes()}
                onPickInput={pickInput}
              />
              <TouchableOpacity onPress={() => setShowQuality(false)}
                style={[styles.modalCancel, { marginTop: 14, flexGrow: 0, alignSelf: 'center', paddingHorizontal: 32 }]}>
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={renameRec !== null}
        transparent
        animationType="fade"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => { setRenameRec(null); setRenameText(''); }}
      >
        <View style={[styles.recModalOverlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => { setRenameRec(null); setRenameText(''); }}
            accessibilityLabel="Закрыть"
          />
          <View style={styles.recModalCardSm}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Rename</Text>
              <TextInput
                style={styles.modalInput}
                value={renameText}
                onChangeText={setRenameText}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={applyRename}
                returnKeyType="done"
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity onPress={() => { setRenameRec(null); setRenameText(''); }} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={applyRename} style={styles.modalConfirm}>
                  <Text style={styles.modalConfirmText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {micMonitorOn && (
        <TunerEngine mode="monitor" active onMessage={handleMicMonitorMessage} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a0f' },
  titleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16, paddingHorizontal: 16 },
  title:      { color: '#888', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  qualityChip:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#7c4dff18', borderRadius: 10, borderWidth: 1, borderColor: '#7c4dff44' },
  qualityChipText: { color: '#7c4dff', fontSize: 10, fontWeight: '700' },
  qualityHint:{ color: '#555', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a24', borderRadius: 12, padding: 13, marginTop: 8, borderWidth: 1, borderColor: '#2a2a38', width: '100%' },
  qualityRowActive: { borderColor: '#7c4dff44', backgroundColor: '#7c4dff10' },
  qualityName:{ color: '#ccc', fontSize: 14, fontWeight: '700' },
  qualitySub: { color: '#555', fontSize: 11, marginTop: 2 },

  micMonitorCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#111118',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e2a22',
  },
  micMonitorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00e67655',
    backgroundColor: '#00e67612',
  },
  micMonitorBtnOn: { backgroundColor: '#00e676', borderColor: '#00e676' },
  micMonitorBtnText: { color: '#00e676', fontSize: 13, fontWeight: '700' },
  micMonitorBtnTextOn: { color: '#0a0a0f' },
  micMonitorMeterTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1a1a24',
    marginTop: 10,
    overflow: 'hidden',
  },
  micMonitorMeterFill: { height: '100%', backgroundColor: '#00e676', borderRadius: 2 },
  micMonitorHint: { color: '#555', fontSize: 10, lineHeight: 14, marginTop: 8 },
  micMonitorWarn: { color: '#ff9800', fontSize: 10, marginTop: 6 },

  recordArea: { alignItems: 'center', paddingVertical: 20, marginHorizontal: 16, backgroundColor: '#111118', borderRadius: 20, borderWidth: 1, borderColor: '#222', marginBottom: 20 },
  recDurRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff1744' },
  recDurText: { color: '#ff5252', fontSize: 28, fontWeight: '700', letterSpacing: 2 },
  recBackgroundHint: { color: '#ff9800', fontSize: 11, fontWeight: '600' },
  recBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1e1e28', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#333' },
  recBtnActive: { backgroundColor: '#ff1744', borderColor: '#ff1744' },
  hint: { color: '#444', fontSize: 12, marginTop: 10, letterSpacing: 1 },

  listWrap: { flex: 1, paddingHorizontal: 16 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  listTitle: { color: '#444', fontSize: 11, letterSpacing: 2, fontWeight: '600', flex: 1 },
  shareAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8 },
  shareAllText: { color: '#ffeb3b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  emptyText: { color: '#333', fontSize: 14, textAlign: 'center', marginTop: 32 },

  recItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1e1e28', gap: 10 },
  recItemPlaying: { borderColor: '#7c4dff44', backgroundColor: '#13131e' },
  playBtn: { padding: 2 },
  recInfo: { flex: 1 },
  recName: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  recDate: { color: '#555', fontSize: 12, marginTop: 2 },
  seekWrap: { marginTop: 10, marginBottom: 2 },
  timeText: { color: '#7c4dff', fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 6 },
  recModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  recModalCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#2a2a38',
    overflow: 'hidden',
  },
  recModalCardSm: {
    backgroundColor: '#1a1a24',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  recModalScrollContent: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#1a1a24', borderRadius: 20, padding: 24, width: '82%', borderWidth: 1, borderColor: '#2a2a38' },
  modalTitle: { color: '#ccc', fontSize: 15, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  modalInput: { backgroundColor: '#0d0d15', borderRadius: 12, padding: 12, color: '#e0e0e0', fontSize: 15, borderWidth: 1, borderColor: '#2a2a38', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#2a2a38', borderRadius: 12 },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalConfirm: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#7c4dff', borderRadius: 12 },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});
