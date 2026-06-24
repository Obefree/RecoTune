import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView,
  Alert, Animated, TextInput, Modal, PanResponder, Pressable, Platform,
  useWindowDimensions,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useMediaRemoteControls } from '../hooks/useMediaRemoteControls';
import { useRecordingBackground, warnExpoGoBackgroundRecording } from '../hooks/useRecordingBackground';
import { assertPlaybackFileExists } from '../utils/playbackUri';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import { useTabBarVisibility } from '../context/TabBarVisibility';
import SeekBar from '../components/SeekBar';
import RecordingInputPicker from '../components/RecordingInputPicker';

/* ─── Types ─── */
interface Track {
  id: string;
  uri: string;
  label: string;
  color: string;
  offsetMs?: number;
  /** Линейная громкость в сведении / Play all (0…2, 1 = номинал). В expo-av ограничиваем до 1. */
  gain?: number;
}
interface Session { id: string; name: string; createdAt: number; tracks: Track[] }

import {
  RecQuality, QUALITY_PRESETS, DEFAULT_QUALITY,
  loadQualitySettings, saveQualitySettings, buildRecordingOptions, presetLabel,
} from '../utils/qualitySettings';
import {
  PREROLL_MS_WIRED,
  PREROLL_MS_BLUETOOTH,
  DEFAULT_AUDIO_ROUTING,
  OUTPUT_OPTIONS,
  type StudioAudioRouting,
  type AudioRouteSnapshot,
  type AudioOutputRoute,
  type RecordingInputInfo,
  probeRecordingInputs,
  applyStudioAudioMode,
  revalidateStudioRoutingOnFocus,
  applyRecordingInput,
  prerollForInput,
  prerollForOutput,
  suggestInputForOutput,
  outputDeviceMissing,
  loadStudioAudioRouting,
  saveStudioAudioRouting,
} from '../utils/studioAudioRouting';

/* ─── Constants ─── */
const MAX_TRACKS    = 10;
const SESSIONS_FILE = (FileSystem.documentDirectory ?? '') + 'studio_sessions.json';
const STUDIO_DIR    = (FileSystem.documentDirectory ?? '') + 'studio/';
const LATENCY_FILE        = (FileSystem.documentDirectory ?? '') + 'studio_latency.json';

// Android mic hardware latency is typically 80–200 ms.
// prerollMs = how long to wait (after rec starts) before starting playback.
// New track stores this as offsetMs so that silence is skipped during playback.
// Дорожки 2+ получают offsetMs = preroll при записи; пресеты: провод 150, BT 700.
const DEFAULT_PREROLL_MS = PREROLL_MS_WIRED;

const TRACK_COLORS = [
  '#7c4dff', '#00e676', '#ff5252', '#ffeb3b',
  '#40c4ff', '#ff6d00', '#ea80fc', '#69f0ae',
  '#ff4081', '#b0bec5',
];
const TRACK_LABELS = [
  'Guitar', 'Voice', 'Bass', 'Keys',
  'Drums', 'Synth', 'Strings', 'Brass',
  'Acoustic', 'Misc',
];

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function playbackVolume(track: Track, muted: boolean): number {
  if (muted) return 0;
  const g = typeof track.gain === 'number' && Number.isFinite(track.gain) ? track.gain : 1;
  return Math.min(1, Math.max(0, g));
}

/* ─── HoldButton — tap once, hold to auto-repeat every 80 ms ─── */
function HoldButton({ onPress, children, style }: {
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const onPressRef  = useRef(onPress);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);

  // Keep latest onPress accessible inside stable PanResponder closure
  useEffect(() => { onPressRef.current = onPress; }, [onPress]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Clear any leftover timers (safety)
        if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        // Immediate first fire
        onPressRef.current();
        // Start repeat after 380 ms hold
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current  = null;
          intervalRef.current = setInterval(() => onPressRef.current(), 80);
        }, 380);
      },
      onPanResponderRelease: () => {
        if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      },
      onPanResponderTerminate: () => {
        if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      },
    })
  ).current;

  return (
    <View {...panResponder.panHandlers} style={style}>
      {children}
    </View>
  );
}

/* ─── TrackRow component (solo play + scrub + mute + offset) ─── */
interface TrackRowProps {
  track: Track;
  index: number;
  isSolo: boolean;
  isMuted: boolean;
  soloPos: number;
  soloDur: number;
  allPlayPos: number;
  allPlayDur: number;
  isPlayingAll: boolean;
  onSoloToggle: (track: Track) => void;
  onMuteToggle: (track: Track) => void;
  onSeek: (seconds: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  onRename: (track: Track) => void;
  onDelete: (track: Track) => void;
  onOffsetChange: (track: Track, delta: number) => void;
  gain: number;
  onGainChange: (track: Track, delta: number) => void;
}

function TrackRow({
  track, index, isSolo, isMuted, soloPos, soloDur, allPlayPos, allPlayDur, isPlayingAll,
  onSoloToggle, onMuteToggle, onSeek, onScrubStart, onScrubEnd, onRename, onDelete, onOffsetChange, gain, onGainChange,
}: TrackRowProps) {
  const soloProgress = isSolo && soloDur > 0 ? soloPos / soloDur : 0;
  const allProgress  = isPlayingAll && allPlayDur > 0 ? allPlayPos / allPlayDur : 0;

  return (
    <View
      style={[styles.trackRow, { borderLeftColor: isMuted ? '#333' : track.color }, isSolo && styles.trackRowSolo, isMuted && { opacity: 0.45 }]}
    >
      {/* Index badge */}
      <View style={[styles.trackBadge, { backgroundColor: (isMuted ? '#333' : track.color) + '33' }]}>
        <Text style={[styles.trackBadgeText, { color: isMuted ? '#444' : track.color }]}>{index + 1}</Text>
      </View>

      {/* Info + progress bar */}
      <View style={styles.trackMid}>
        <View style={styles.trackLabelRow}>
          <Text style={[styles.trackLabel, isMuted && { color: '#444' }]} numberOfLines={1}>
            {track.label}
          </Text>
          {isSolo && (
            <Text style={[styles.trackTime, { color: track.color }]}>
              {fmt(soloPos)} / {fmt(soloDur)}
            </Text>
          )}
        </View>
        <View style={styles.trackAdjustRow}>
          {index > 0 && (
            <View style={styles.trackOffsetRow}>
              <Text style={styles.trackChipTag}>мс</Text>
              <HoldButton onPress={() => onOffsetChange(track, -10)} style={styles.trackOffsetBtnArea}>
                <Text style={styles.trackOffsetBtn}>−</Text>
              </HoldButton>
              <TouchableOpacity
                onLongPress={() => onOffsetChange(track, -(track.offsetMs ?? 0))}
                delayLongPress={500}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={styles.trackOffsetValArea}>
                <Text style={[styles.trackOffsetVal, {
                  color: (track.offsetMs ?? 0) > 100 ? '#00e676' : (track.offsetMs ?? 0) < 0 ? '#ff9800' : '#888',
                }]}>
                  {(track.offsetMs ?? 0) > 0 ? '+' : ''}{track.offsetMs ?? 0}
                </Text>
              </TouchableOpacity>
              <HoldButton onPress={() => onOffsetChange(track, +10)} style={styles.trackOffsetBtnArea}>
                <Text style={styles.trackOffsetBtn}>+</Text>
              </HoldButton>
            </View>
          )}
          <View style={styles.trackOffsetRow}>
            <Text style={styles.trackChipTag}>VOL</Text>
            <HoldButton onPress={() => onGainChange(track, -0.05)} style={styles.trackOffsetBtnArea}>
              <Text style={[styles.trackOffsetBtn, { color: '#aaa' }]}>−</Text>
            </HoldButton>
            <View style={styles.trackOffsetValArea}>
              <Text style={styles.trackOffsetVal}>{Math.round(gain * 100)}%</Text>
            </View>
            <HoldButton onPress={() => onGainChange(track, +0.05)} style={styles.trackOffsetBtnArea}>
              <Text style={[styles.trackOffsetBtn, { color: '#aaa' }]}>+</Text>
            </HoldButton>
          </View>
        </View>

        {isSolo && soloDur > 0 && (
          <SeekBar
            position={soloPos}
            duration={soloDur}
            onSeek={onSeek}
            onScrubStart={onScrubStart}
            onScrubEnd={onScrubEnd}
            color={track.color}
          />
        )}

        {/* Playall progress bar (passive, no scrub here) */}
        {isPlayingAll && !isSolo && (
          <View style={[styles.scrubTrack, { height: 2 }]}>
            <View style={[styles.scrubFill, { width: `${allProgress * 100}%` as any, backgroundColor: isMuted ? '#333' : track.color + '88' }]} />
          </View>
        )}
      </View>

      {/* Mute toggle */}
      <TouchableOpacity onPress={() => onMuteToggle(track)} style={styles.iconBtn}>
        <Ionicons name={isMuted ? 'volume-mute' : 'volume-medium-outline'} size={16} color={isMuted ? '#ff5252' : '#555'} />
      </TouchableOpacity>

      {/* Solo play/pause button */}
      <TouchableOpacity onPress={() => onSoloToggle(track)} style={styles.soloBtn}>
        <Ionicons name={isSolo ? 'pause-circle' : 'play-circle'} size={34} color={isSolo ? track.color : '#444'} />
      </TouchableOpacity>

      {/* Edit & delete */}
      <TouchableOpacity onPress={() => onRename(track)} style={styles.iconBtn}>
        <Ionicons name="pencil-outline" size={15} color="#555" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDelete(track)} style={styles.iconBtn}>
        <Ionicons name="trash-outline" size={15} color="#c0392b" />
      </TouchableOpacity>
    </View>
  );
}

/* ─── Main screen ─── */
export default function StudioScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { setTabBarHidden } = useTabBarVisibility();
  /** Высота карточки модалки; кнопка «Закрыть» — снаружи ScrollView */
  const studioModalScrollMaxH = Math.max(260, Math.round(windowHeight * 0.78) - insets.top - insets.bottom - 32);
  const studioModalBodyMaxH = studioModalScrollMaxH - 56;
  const [sessions, setSessions]           = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  /** Без проекта — список на весь экран; с проектом — полоса сессий, ниже дорожки */
  const sessionsListCompactH = Math.min(220, Math.max(120, Math.round(windowHeight * 0.24)));
  const [isRecording, setIsRecording]     = useState(false);
  const [recInBackground, setRecInBackground] = useState(false);
  const [recDuration, setRecDuration]     = useState(0);
  const [playingAll, setPlayingAll]       = useState(false);
  const [soloTrackId, setSoloTrackId]     = useState<string | null>(null);
  const [soloPos, setSoloPos]             = useState(0);
  const [soloDur, setSoloDur]             = useState(0);
  const [showNewModal, setShowNewModal]   = useState(false);
  const [newName, setNewName]             = useState('');
  const [renameTarget, setRenameTarget]   = useState<{ type: 'session' | 'track'; id: string } | null>(null);
  const [renameText, setRenameText]       = useState('');
  const [showExport, setShowExport]       = useState(false);
  const [exportingId, setExportingId]     = useState<string | null>(null);
  const [mixState, setMixState]           = useState<'idle'|'loading'|'mixing'|'done'|'error'>('idle');
  const [mixProgress, setMixProgress]     = useState('');
  const [mixHtml, setMixHtml]             = useState<string | null>(null);
  const [mixBitDepth, setMixBitDepth]     = useState<16|24>(16);
  const mixerRef = useRef<WebView>(null);

  const [quality, setQuality]             = useState<RecQuality>(DEFAULT_QUALITY);
  const [showQuality, setShowQuality]     = useState(false);
  const qualityRef = useRef<RecQuality>(DEFAULT_QUALITY);

  // Latency compensation
  const [prerollMs, setPrerollMs]         = useState(DEFAULT_PREROLL_MS);
  const prerollRef = useRef(DEFAULT_PREROLL_MS);

  const [audioRouting, setAudioRouting]   = useState<StudioAudioRouting>(DEFAULT_AUDIO_ROUTING);
  const audioRoutingRef = useRef<StudioAudioRouting>(DEFAULT_AUDIO_ROUTING);
  const [audioRouteSnap, setAudioRouteSnap] = useState<AudioRouteSnapshot | null>(null);
  const [audioRouteLoading, setAudioRouteLoading] = useState(false);
  /** Honest note when the OS ignored the manual mic choice during the last record. */
  const [inputApplyNote, setInputApplyNote] = useState<string | null>(null);
  useEffect(() => { qualityRef.current = quality; }, [quality]);
  useEffect(() => { prerollRef.current = prerollMs; }, [prerollMs]);

  // Master playback position
  const [allPlayPos, setAllPlayPos]       = useState(0);
  const [allPlayDur, setAllPlayDur]       = useState(0);
  const masterSeekingRef                  = useRef(false);
  const playAllPausedForScrubRef          = useRef(false);
  const soloSeekingRef                    = useRef(false);

  // Per-track mute
  const [mutedTracks, setMutedTracks]     = useState<Record<string, boolean>>({});
  const mutedRef                         = useRef<Record<string, boolean>>({});
  const allSoundTrackIds                 = useRef<string[]>([]);

  const recRef      = useRef<Audio.Recording | null>(null);
  const isRecordingRef = useRef(false);
  const stoppingRecRef = useRef(false);
  const allSounds   = useRef<Audio.Sound[]>([]);
  const soloSound   = useRef<Audio.Sound | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef    = useRef(0);
  const busyRef     = useRef(false);

  // Always-fresh refs so async callbacks never read stale state
  const activeSessionRef = useRef(activeSession);
  const sessionsRef      = useRef(sessions);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  useEffect(() => { sessionsRef.current      = sessions;      }, [sessions]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

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

  /* ── Persistence ── */
  const saveSessions = useCallback(async (data: Session[]) => {
    await FileSystem.writeAsStringAsync(SESSIONS_FILE, JSON.stringify(data));
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      await FileSystem.makeDirectoryAsync(STUDIO_DIR, { intermediates: true });
      const info = await FileSystem.getInfoAsync(SESSIONS_FILE);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(SESSIONS_FILE);
        setSessions(JSON.parse(raw));
      }
    } catch {}
  }, []);

  const loadQuality = useCallback(async () => {
    const q = await loadQualitySettings();
    setQuality(q);
    qualityRef.current = q;
    try {
      const info = await FileSystem.getInfoAsync(LATENCY_FILE);
      if (info.exists) {
        const ms = JSON.parse(await FileSystem.readAsStringAsync(LATENCY_FILE));
        const effective = (typeof ms === 'number' && ms > 0) ? ms : DEFAULT_PREROLL_MS;
        setPrerollMs(effective); prerollRef.current = effective;
      }
    } catch {}
    const merged = await loadStudioAudioRouting();
    setAudioRouting(merged);
    audioRoutingRef.current = merged;
  }, []);

  const savePreroll = useCallback(async (ms: number) => {
    setPrerollMs(ms); prerollRef.current = ms;
    await FileSystem.writeAsStringAsync(LATENCY_FILE, JSON.stringify(ms));
  }, []);

  const refreshAudioRoutes = useCallback(async (): Promise<AudioRouteSnapshot> => {
    setAudioRouteLoading(true);
    try {
      const snap = await probeRecordingInputs();
      setAudioRouteSnap(snap);
      return snap;
    } finally {
      setAudioRouteLoading(false);
    }
  }, []);

  const saveAudioRouting = useCallback(async (r: StudioAudioRouting, suggestPreroll?: number) => {
    setAudioRouting(r);
    audioRoutingRef.current = r;
    await saveStudioAudioRouting(r);
    try {
      await applyStudioAudioMode(r);
    } catch {}
    const pr = suggestPreroll ?? (r.mode === 'manual' ? prerollForOutput(r.output) : undefined);
    if (typeof pr === 'number' && pr > 0) await savePreroll(pr);
  }, [savePreroll]);

  const pickOutput = useCallback((output: AudioOutputRoute) => {
    const snap = audioRouteSnap;
    const suggestedInp = snap ? suggestInputForOutput(output, snap.inputs) : undefined;
    const next: StudioAudioRouting = {
      mode: 'manual',
      output,
      inputUid: suggestedInp?.uid ?? audioRoutingRef.current.inputUid,
    };
    void saveAudioRouting(next, prerollForOutput(output));
  }, [audioRouteSnap, saveAudioRouting]);

  const pickInput = useCallback((inp: RecordingInputInfo) => {
    void saveAudioRouting(
      { mode: 'manual', output: audioRoutingRef.current.output, inputUid: inp.uid },
      prerollForInput(inp),
    );
  }, [saveAudioRouting]);

  useEffect(() => {
    if (showQuality) void refreshAudioRoutes();
  }, [showQuality, refreshAudioRoutes]);

  useEffect(() => {
    loadSessions();
    loadQuality().then(() => {
      applyStudioAudioMode(audioRoutingRef.current).catch(() => {});
    });
  }, []);

  const anyStudioModalOpen =
    showQuality || showExport || showNewModal || renameTarget !== null;
  useEffect(() => {
    setTabBarHidden(anyStudioModalOpen);
  }, [anyStudioModalOpen, setTabBarHidden]);

  /* ── Sound teardown ── */
  const killAllSounds = useCallback(async () => {
    const sounds = allSounds.current;
    allSounds.current = [];
    allSoundTrackIds.current = [];
    setPlayingAll(false);
    setAllPlayPos(0);
    for (const s of sounds) {
      try { await s.stopAsync(); await s.unloadAsync(); } catch {}
    }
  }, []);

  const killSolo = useCallback(() => {
    const s = soloSound.current;
    soloSound.current = null;
    setSoloTrackId(null);
    setSoloPos(0);
    setSoloDur(0);
    if (s) s.stopAsync().catch(() => {}).finally(() => s.unloadAsync().catch(() => {}));
  }, []);

  const handleRecordingInterrupted = useCallback(() => {
    if (!isRecordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    recRef.current = null;
    setIsRecording(false);
    setRecInBackground(false);
    void killAllSounds();
    Alert.alert(
      'Запись прервана',
      'Система остановила микрофон (часто в Expo Go или без dev build). Соберите приложение: npx expo run:android / run:ios.',
    );
  }, [killAllSounds]);

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

  useFocusEffect(useCallback(() => {
    loadSessions();
    void (async () => {
      const { routing, snap } = await revalidateStudioRoutingOnFocus(audioRoutingRef.current);
      if (routing !== audioRoutingRef.current) {
        setAudioRouting(routing);
        audioRoutingRef.current = routing;
      }
      setAudioRouteSnap(snap);
    })();
    return () => {
      if (!isRecordingRef.current) {
        killAllSounds();
      }
      killSolo();
      setTabBarHidden(false);
      setShowQuality(false);
      setShowExport(false);
      setShowNewModal(false);
      setRenameTarget(null);
      setRenameText('');
    };
  }, [killAllSounds, killSolo, loadSessions, setTabBarHidden]));

  /* ── Solo playback ── */
  const toggleSolo = useCallback(async (track: Track) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await killAllSounds();

      if (soloTrackId === track.id) {
        killSolo();
        return;
      }
      killSolo();

      await applyStudioAudioMode(audioRoutingRef.current, { recording: false });
      const playbackUri = await assertPlaybackFileExists(track.uri);
      const { sound } = await Audio.Sound.createAsync(
        { uri: playbackUri },
        { shouldPlay: true, progressUpdateIntervalMillis: 100, volume: playbackVolume(track, false) },
        (st: AVPlaybackStatus) => {
          if (!st.isLoaded) return;
          if (!soloSeekingRef.current) {
            setSoloPos(Math.round(st.positionMillis / 100) / 10);
          }
          if (st.durationMillis) setSoloDur(st.durationMillis / 1000);
          if (st.didJustFinish) { soloSound.current = null; setSoloTrackId(null); setSoloPos(0); }
        }
      );
      if (soloSound.current !== null) { await sound.unloadAsync(); return; }
      soloSound.current = sound;
      setSoloTrackId(track.id);
    } catch (e) {
      Alert.alert('Playback error', String(e));
      killSolo();
    } finally {
      busyRef.current = false;
    }
  }, [soloTrackId, killSolo, killAllSounds]);

  const handleSoloSeek = useCallback(async (seconds: number) => {
    if (!soloSound.current) return;
    setSoloPos(seconds);
    try {
      await soloSound.current.setStatusAsync({ positionMillis: Math.round(seconds * 1000) });
    } catch {}
  }, []);

  const toggleSoloRemote = useCallback(async () => {
    const s = soloSound.current;
    if (!s) return;
    const st = await s.getStatusAsync() as AVPlaybackStatus;
    if (!st.isLoaded) return;
    if (st.isPlaying) await s.pauseAsync();
    else await s.playAsync();
  }, []);

  const skipSoloSec = useCallback(async (delta: number) => {
    if (soloDur <= 0) return;
    await handleSoloSeek(Math.max(0, Math.min(soloDur, soloPos + delta)));
  }, [soloPos, soloDur, handleSoloSeek]);

  const playAdjacentSolo = useCallback(async (dir: 1 | -1) => {
    const sess = activeSessionRef.current;
    const id = soloTrackId;
    if (!sess || !id) return;
    const idx = sess.tracks.findIndex(t => t.id === id);
    if (idx < 0) return;
    const next = sess.tracks[idx + dir];
    if (next) await toggleSolo(next);
  }, [soloTrackId, toggleSolo]);

  const togglePlayAllRemote = useCallback(async () => {
    if (!playingAll || allSounds.current.length === 0) return;
    const st = await allSounds.current[0].getStatusAsync() as AVPlaybackStatus;
    if (!st.isLoaded) return;
    if (st.isPlaying) {
      await Promise.all(allSounds.current.map(s => s.pauseAsync().catch(() => {})));
    } else {
      await Promise.all(allSounds.current.map(s => s.playAsync().catch(() => {})));
    }
  }, [playingAll]);

  const pauseAllForScrub = useCallback(async () => {
    if (!playingAll || allSounds.current.length === 0) return;
    playAllPausedForScrubRef.current = true;
    await Promise.all(allSounds.current.map(s => s.pauseAsync().catch(() => {})));
  }, [playingAll]);

  const resumeAllAfterScrub = useCallback(() => {
    if (!playAllPausedForScrubRef.current) return;
    playAllPausedForScrubRef.current = false;
    allSounds.current.forEach(s => { s.playAsync().catch(() => {}); });
  }, []);

  const beginSoloScrub = useCallback(() => {
    soloSeekingRef.current = true;
    soloSound.current?.pauseAsync().catch(() => {});
  }, []);

  const endSoloScrub = useCallback(() => {
    soloSeekingRef.current = false;
    if (soloTrackId) soloSound.current?.playAsync().catch(() => {});
  }, [soloTrackId]);

  /* ── Master seek (all sounds) ── */
  const handleMasterSeek = useCallback((posMs: number) => {
    const sess = activeSessionRef.current;
    allSounds.current.forEach((s, i) => {
      const off = sess?.tracks[i]?.offsetMs ?? 0;
      // File position = session position + offset (clamped to 0)
      s.setStatusAsync({ positionMillis: Math.max(0, posMs + off) }).catch(() => {});
    });
    setAllPlayPos(Math.max(0, posMs) / 1000);
  }, []);

  const skipPlayAllSec = useCallback((delta: number) => {
    const next = Math.max(0, Math.min(allPlayDur, allPlayPos + delta));
    handleMasterSeek(next * 1000);
  }, [allPlayPos, allPlayDur, handleMasterSeek]);

  const soloTrack = soloTrackId
    ? activeSession?.tracks.find(t => t.id === soloTrackId) ?? null
    : null;

  useMediaRemoteControls(
    playingAll || !!soloTrackId,
    playingAll ? 'single' : 'list',
    playingAll
      ? {
          onTogglePlay: togglePlayAllRemote,
          onSkipForward: () => skipPlayAllSec(10),
          onSkipBackward: () => skipPlayAllSec(-10),
          onSeek: (sec) => handleMasterSeek(sec * 1000),
        }
      : {
          onTogglePlay: toggleSoloRemote,
          onNext: () => playAdjacentSolo(1),
          onPrevious: () => playAdjacentSolo(-1),
          onSkipForward: () => skipSoloSec(10),
          onSkipBackward: () => skipSoloSec(-10),
          onSeek: handleSoloSeek,
        },
    playingAll
      ? {
          title: activeSession?.name ?? 'Studio',
          artist: 'Play all',
          durationSec: allPlayDur,
          elapsedSec: allPlayPos,
          isPlaying: playingAll,
        }
      : soloTrack
        ? {
            title: soloTrack.label,
            artist: activeSession?.name ?? 'Studio',
            durationSec: soloDur,
            elapsedSec: soloPos,
            isPlaying: !!soloTrackId,
          }
        : null,
  );

  /** Во время Play all — сразу пересчитать позиции файлов под новые offsetMs (та же логика, что у master seek). */
  const liveResyncTrackOffsets = useCallback((sess: Session) => {
    const sounds = allSounds.current;
    if (sounds.length === 0 || sounds.length !== sess.tracks.length) return;
    for (let i = 0; i < sess.tracks.length; i++) {
      if (sess.tracks[i].id !== allSoundTrackIds.current[i]) return;
    }
    const ref0 = sounds[0];
    void ref0.getStatusAsync().then(st => {
      if (!st.isLoaded) return;
      const ref0off = Math.max(0, sess.tracks[0]?.offsetMs ?? 0);
      const T = Math.max(0, (st.positionMillis ?? 0) - ref0off);
      sounds.forEach((sound, i) => {
        const off = sess.tracks[i]?.offsetMs ?? 0;
        sound.setStatusAsync({ positionMillis: Math.max(0, T + off) }).catch(() => {});
      });
      setAllPlayPos(T / 1000);
    });
  }, []);

  /* ── Mute toggle ── */
  const toggleMute = useCallback((track: Track) => {
    const next = { ...mutedRef.current, [track.id]: !mutedRef.current[track.id] };
    mutedRef.current = next;
    setMutedTracks({ ...next });
    // Apply live volume if currently playing
    const idx = allSoundTrackIds.current.indexOf(track.id);
    if (idx >= 0 && allSounds.current[idx]) {
      const v = playbackVolume(track, !!next[track.id]);
      allSounds.current[idx].setStatusAsync({ volume: v }).catch(() => {});
    }
  }, []);

  /* ── Play all ── */
  const playAll = useCallback(async (session: Session) => {
    if (session.tracks.length === 0) { Alert.alert('No tracks yet'); return; }
    killSolo();
    await killAllSounds();
    setAllPlayPos(0);
    setAllPlayDur(0);
    try {
      await applyStudioAudioMode(audioRoutingRef.current, { recording: false });

      const uris = await Promise.all(
        session.tracks.map((t) => assertPlaybackFileExists(t.uri)),
      );

      // Load every sound pre-positioned at its offset so playAsync() fires
      // immediately without a second round-trip to the bridge.
      // Positive offset → skip N ms of silence at start (content moves earlier).
      // Negative offset → track starts at 0 but fires N ms after the others.
      const loaded = await Promise.all(
        session.tracks.map((t, i) => {
          const off = Math.max(0, t.offsetMs ?? 0); // negative handled via setTimeout below
          const vol = playbackVolume(t, !!mutedRef.current[t.id]);
          return Audio.Sound.createAsync(
            { uri: uris[i] },
            { shouldPlay: false, positionMillis: off, volume: vol, progressUpdateIntervalMillis: 100 },
          ).then(({ sound }) => sound);
        })
      );
      allSounds.current = loaded;
      allSoundTrackIds.current = session.tracks.map(t => t.id);
      setPlayingAll(true);

      // Progress tracking: use track 0 as reference (simplest and most stable)
      const ref0off = Math.max(0, (session.tracks[0]?.offsetMs ?? 0));
      loaded[0].setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => {
        if (!st.isLoaded) return;
        if (st.durationMillis) setAllPlayDur((st.durationMillis - ref0off) / 1000);
        if (!masterSeekingRef.current) {
          const sec = Math.max(0, (st.positionMillis - ref0off) / 1000);
          setAllPlayPos(Math.round(sec * 10) / 10);
        }
        if (st.didJustFinish) killAllSounds();
      });

      // Fire: positive-offset tracks play immediately (already pre-positioned).
      // Negative-offset tracks start from pos=0 after |offset| ms delay.
      loaded.forEach((sound, i) => {
        const off = session.tracks[i].offsetMs ?? 0;
        if (off >= 0) {
          sound.playAsync().catch(() => {});
        } else {
          setTimeout(() => { sound.playAsync().catch(() => {}); }, Math.abs(off));
        }
      });
    } catch (e) { Alert.alert('Playback error', String(e)); }
  }, [killSolo, killAllSounds]);

  /* ── Record new track ── */
  const recordTrack = useCallback(async (session: Session) => {
    if (session.tracks.length >= MAX_TRACKS) { Alert.alert(`Max ${MAX_TRACKS} tracks`); return; }
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Microphone permission denied'); return; }

    warnExpoGoBackgroundRecording();
    killSolo();
    await killAllSounds();

    try {
      await applyStudioAudioMode(audioRoutingRef.current, { recording: true });

      // Load all existing tracks with the SAME offsets and mute state as playAll,
      // so the musician hears exactly what will be heard during playback.
      const playbackSounds = await Promise.all(
        session.tracks.map(async (t) => {
          const off = Math.max(0, t.offsetMs ?? 0);
          const vol = playbackVolume(t, !!mutedRef.current[t.id]);
          const playbackUri = await assertPlaybackFileExists(t.uri);
          return Audio.Sound.createAsync(
            { uri: playbackUri },
            { shouldPlay: false, positionMillis: off, volume: vol }
          ).then(({ sound }) => sound);
        })
      );
      allSounds.current = playbackSounds;

      // Prepare recording
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(buildRecordingOptions(qualityRef.current));
      const inputResult = await applyRecordingInput(rec, audioRoutingRef.current);
      if (inputResult === 'missing' || inputResult === 'rejected') {
        // Honest feedback: the OS refused the chosen mic (old Android / device gone) — record on default.
        setInputApplyNote(
          inputResult === 'missing'
            ? 'Выбранный микрофон не найден — пишем на системный. Обнови список в настройках.'
            : 'Система не дала выбрать микрофон (Android < 9 или занят) — пишем на системный.',
        );
      } else {
        setInputApplyNote(null);
      }

      // ── Simultaneous start ───────────────────────────────────────────
      // Fire playback first (fire-and-forget), then await mic start.
      // Backing tracks are already pre-positioned at their offsets, same as
      // during playAll, so recording happens against the identical audio.
      // The new track gets offsetMs = prerollMs to compensate for mic latency.
      // Mirror Play all: positive-offset tracks (pre-positioned) play now; negative-offset
      // tracks start after |offset| ms so the monitor mix matches final playback alignment.
      playbackSounds.forEach((s, i) => {
        const off = session.tracks[i]?.offsetMs ?? 0;
        if (off >= 0) s.playAsync().catch(() => {});
        else setTimeout(() => { s.playAsync().catch(() => {}); }, Math.abs(off));
      });
      await rec.startAsync();
      recRef.current = rec;
      startRef.current = Date.now();

      setIsRecording(true);
      setRecInBackground(false);
      setRecDuration(0);
      timerRef.current = setInterval(() => {
        setRecDuration(Math.floor((Date.now() - startRef.current) / 1000));
      }, 500);
    } catch (e) {
      Alert.alert('Record error', String(e));
    }
  }, [killSolo, killAllSounds]);

  const stopRecording = useCallback(async () => {
    if (!recRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    await killAllSounds();

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

      // Use refs to get the guaranteed-fresh session state
      const currentSession  = activeSessionRef.current;
      const currentSessions = sessionsRef.current;

      if (uri && currentSession) {
        const ts  = Date.now();
        const ext = uri.split('.').pop() ?? 'm4a';
        const dst = `${STUDIO_DIR}track_${ts}.${ext}`;
        await FileSystem.makeDirectoryAsync(STUDIO_DIR, { intermediates: true });
        await FileSystem.moveAsync({ from: uri, to: dst });

        const idx   = currentSession.tracks.length;
        const track: Track = {
          id:       `t_${ts}`,
          uri:      dst,
          label:    TRACK_LABELS[idx] ?? `Track ${idx + 1}`,
          color:    TRACK_COLORS[idx % TRACK_COLORS.length],
          // Strip the leading silence introduced by the preroll approach
          offsetMs: idx > 0 ? prerollRef.current : 0,
          gain:     1,
        };
        const updated: Session = { ...currentSession, tracks: [...currentSession.tracks, track] };
        const next = currentSessions.map(s => s.id === updated.id ? updated : s);
        setSessions(next);
        setActiveSession(updated);
        await saveSessions(next);
      }
    } catch (e) {
      setIsRecording(false);
      setRecInBackground(false);
      Alert.alert('Stop error', String(e));
    } finally {
      stoppingRecRef.current = false;
    }
  }, [saveSessions, killAllSounds]);

  /* ── Per-track offset adjustment ── */
  const updateTrackOffset = useCallback(async (track: Track, delta: number) => {
    const sess = activeSessionRef.current;
    if (!sess) return;
    const newOffset = Math.max(-1000, Math.min(1000, (track.offsetMs ?? 0) + delta));
    const updatedTracks = sess.tracks.map(t =>
      t.id === track.id ? { ...t, offsetMs: newOffset } : t
    );
    const updated: Session = { ...sess, tracks: updatedTracks };
    const next = sessionsRef.current.map(s => s.id === updated.id ? updated : s);
    setSessions(next);
    setActiveSession(updated);
    await saveSessions(next);
    liveResyncTrackOffsets(updated);
  }, [saveSessions, liveResyncTrackOffsets]);

  const updateTrackGain = useCallback(async (track: Track, delta: number) => {
    const sess = activeSessionRef.current;
    if (!sess) return;
    const cur = typeof track.gain === 'number' && Number.isFinite(track.gain) ? track.gain : 1;
    const nextG = Math.round(Math.max(0, Math.min(2, cur + delta)) * 100) / 100;
    const updatedTracks = sess.tracks.map(t => (t.id === track.id ? { ...t, gain: nextG } : t));
    const updated: Session = { ...sess, tracks: updatedTracks };
    const next = sessionsRef.current.map(s => s.id === updated.id ? updated : s);
    setSessions(next);
    setActiveSession(updated);
    await saveSessions(next);
    const idx = allSoundTrackIds.current.indexOf(track.id);
    if (idx >= 0 && allSounds.current[idx] && !mutedRef.current[track.id]) {
      allSounds.current[idx].setStatusAsync({ volume: Math.min(1, nextG) }).catch(() => {});
    }
  }, [saveSessions]);

  /* ── Загрузить минус (первая дорожка) из файла ── */
  const loadMinusTrack = useCallback(async () => {
    const sess = activeSessionRef.current;
    if (!sess) {
      Alert.alert('Studio', 'Сначала выберите или создайте сессию.');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      await FileSystem.makeDirectoryAsync(STUDIO_DIR, { intermediates: true });
      const m = asset.name?.match(/\.([a-zA-Z0-9]+)$/);
      const ext = (m?.[1] ?? 'm4a').toLowerCase();
      const dst = `${STUDIO_DIR}minus_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dst });
      const ts = Date.now();
      const newTrack: Track = {
        id: `t_${ts}`,
        uri: dst,
        label: 'Минус',
        color: TRACK_COLORS[0],
        offsetMs: 0,
        gain: 1,
      };

      const apply = async () => {
        const latest = activeSessionRef.current;
        if (!latest) return;
        let nextTracks: Track[];
        if (latest.tracks.length === 0) {
          nextTracks = [newTrack];
        } else {
          const old0 = latest.tracks[0];
          if (old0.uri.startsWith(STUDIO_DIR)) {
            await FileSystem.deleteAsync(old0.uri, { idempotent: true }).catch(() => {});
          }
          nextTracks = [newTrack, ...latest.tracks.slice(1)];
        }
        const updated: Session = { ...latest, tracks: nextTracks };
        const nextS = sessionsRef.current.map(s => s.id === updated.id ? updated : s);
        setSessions(nextS);
        setActiveSession(updated);
        await saveSessions(nextS);
      };

      if (sess.tracks.length > 0) {
        Alert.alert(
          'Минус (дорожка 1)',
          'Заменить первую дорожку выбранным файлом? Остальные дорожки и смещения сохранятся.',
          [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Заменить', style: 'destructive', onPress: () => { void apply(); } },
          ],
        );
      } else {
        await apply();
      }
    } catch (e) {
      Alert.alert('Импорт', String(e));
    }
  }, [saveSessions]);

  /* ── Reset all per-track offsets to defaults ── */
  const resetAllOffsets = useCallback(async () => {
    const sess = activeSessionRef.current;
    if (!sess) return;
    // Track 1 (index 0) → 0ms; all others → current prerollMs
    const updatedTracks = sess.tracks.map((t, i) => ({
      ...t,
      offsetMs: i === 0 ? 0 : prerollRef.current,
    }));
    const updated: Session = { ...sess, tracks: updatedTracks };
    const next = sessionsRef.current.map(s => s.id === updated.id ? updated : s);
    setSessions(next);
    setActiveSession(updated);
    await saveSessions(next);
    liveResyncTrackOffsets(updated);
  }, [saveSessions, liveResyncTrackOffsets]);

  /* ── Session CRUD ── */
  const createSession = useCallback(async () => {
    const name = newName.trim() || `Session ${sessions.length + 1}`;
    const s: Session = { id: `s_${Date.now()}`, name, createdAt: Date.now(), tracks: [] };
    const next = [s, ...sessions];
    setSessions(next);
    await saveSessions(next);
    setActiveSession(s);
    setShowNewModal(false);
    setNewName('');
  }, [newName, sessions, saveSessions]);

  const deleteSession = useCallback((id: string) => {
    Alert.alert('Delete session?', 'All tracks will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const cur = sessionsRef.current;
          const sess = cur.find(s => s.id === id);
          if (sess) for (const t of sess.tracks) await FileSystem.deleteAsync(t.uri, { idempotent: true }).catch(() => {});
          const next = cur.filter(s => s.id !== id);
          setSessions(next);
          if (activeSessionRef.current?.id === id) { setActiveSession(null); killSolo(); killAllSounds(); }
          await saveSessions(next);
        },
      },
    ]);
  }, [saveSessions, killSolo, killAllSounds]);

  const deleteTrack = useCallback((trackId: string) => {
    const cur = activeSessionRef.current;
    if (!cur) return;
    Alert.alert('Delete track?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (soloTrackId === trackId) killSolo();
          const latest = activeSessionRef.current ?? cur;
          const track = latest.tracks.find(t => t.id === trackId);
          if (track) await FileSystem.deleteAsync(track.uri, { idempotent: true }).catch(() => {});
          const updated: Session = { ...latest, tracks: latest.tracks.filter(t => t.id !== trackId) };
          const next = sessionsRef.current.map(s => s.id === updated.id ? updated : s);
          setSessions(next); setActiveSession(updated);
          await saveSessions(next);
        },
      },
    ]);
  }, [saveSessions, soloTrackId, killSolo]);

  const applyRename = useCallback(async () => {
    if (!renameTarget || !renameText.trim()) { setRenameTarget(null); return; }
    const curSessions = sessionsRef.current;
    const curActive   = activeSessionRef.current;
    if (renameTarget.type === 'session') {
      const next = curSessions.map(s => s.id === renameTarget.id ? { ...s, name: renameText.trim() } : s);
      setSessions(next);
      if (curActive?.id === renameTarget.id) setActiveSession(p => p ? { ...p, name: renameText.trim() } : p);
      await saveSessions(next);
    } else if (renameTarget.type === 'track' && curActive) {
      const updatedTracks = curActive.tracks.map(t => t.id === renameTarget.id ? { ...t, label: renameText.trim() } : t);
      const updated: Session = { ...curActive, tracks: updatedTracks };
      const next = curSessions.map(s => s.id === updated.id ? updated : s);
      setSessions(next); setActiveSession(updated);
      await saveSessions(next);
    }
    setRenameTarget(null); setRenameText('');
  }, [renameTarget, renameText, saveSessions]);

  /* ── Export ── */
  const openExport = useCallback(() => setShowExport(true), []);

  const shareTrack = useCallback(async (track: Track, sessionName: string) => {
    setExportingId(track.id);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert('Sharing not available on this device'); return; }
      await Sharing.shareAsync(track.uri, {
        mimeType: 'audio/mp4',
        dialogTitle: `${sessionName} — ${track.label}`,
        UTI: 'public.audio',
      });
    } catch (e) {
      Alert.alert('Export error', String(e));
    } finally {
      setExportingId(null);
    }
  }, []);

  /* ── Mix all tracks → single WAV ── */
  const startMix = useCallback(async (session: Session) => {
    if (session.tracks.length === 0) return;
    setMixState('loading');
    setMixProgress('Reading tracks…');
    try {
      const tracksB64: string[] = [];
      for (const t of session.tracks) {
        const b64 = await FileSystem.readAsStringAsync(t.uri, { encoding: FileSystem.EncodingType.Base64 });
        tracksB64.push(b64);
      }

      // Build self-contained HTML that mixes audio via Web Audio API
      const tracksJson = JSON.stringify(tracksB64);
      const offsets = session.tracks.map(t => t.offsetMs ?? 0);
      const gains = session.tracks.map(t => {
        let g = (typeof t.gain === 'number' && Number.isFinite(t.gain)) ? t.gain : 1;
        g = Math.max(0, Math.min(2, g));
        if (mutedRef.current[t.id]) g = 0;
        return g;
      });
      const offsetsJson = JSON.stringify(offsets);
      const gainsJson = JSON.stringify(gains);
      const stereo   = qualityRef.current.channels === 2 ? 'true' : 'false';
      const bitDepth = mixBitDepth;
      const html = `<!DOCTYPE html><html><body><script>
(function(){
var STEREO=${stereo};
var BITS=${bitDepth};
function writeStr(v,o,s){for(var i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));}
function encodeWAV(L,R,sr){
  var nch=STEREO?2:1, bps2=BITS/8, n=L.length, blk=nch*bps2, dataLen=n*blk;
  var buf=new ArrayBuffer(44+dataLen),v=new DataView(buf);
  writeStr(v,0,'RIFF');v.setUint32(4,36+dataLen,true);writeStr(v,8,'WAVE');
  writeStr(v,12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,nch,true);v.setUint32(24,sr,true);v.setUint32(28,sr*blk,true);
  v.setUint16(32,blk,true);v.setUint16(34,BITS,true);
  writeStr(v,36,'data');v.setUint32(40,dataLen,true);
  var off=44;
  function write(x){
    var s=Math.max(-1,Math.min(1,x||0));
    if(BITS===16){v.setInt16(off,Math.round(s*32767),true);off+=2;}
    else{ /* 24-bit little-endian signed */
      var iv=Math.round(s*8388607);
      v.setUint8(off,  iv&0xff);
      v.setUint8(off+1,(iv>>8)&0xff);
      v.setUint8(off+2,(iv>>16)&0xff);
      off+=3;
    }
  }
  for(var i=0;i<n;i++){ write(L[i]); if(STEREO) write(R?R[i]:L[i]); }
  return buf;
}
function b64ToAB(b64){
  var bin=atob(b64),bytes=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes.buffer;
}
function ab64(buf){
  var bytes=new Uint8Array(buf),s='',chunk=8192;
  for(var i=0;i<bytes.length;i+=chunk)
    s+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  return btoa(s);
}
function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}
function normArr(arr){
  var mx=0;
  for(var i=0;i<arr.length;i++) if(Math.abs(arr[i])>mx) mx=Math.abs(arr[i]);
  if(mx>1) for(var i=0;i<arr.length;i++) arr[i]/=mx;
}

(async function(){
  try{
    var tracks=${tracksJson};
    var offsets=${offsetsJson};
    var gains=${gainsJson};
    post({type:'progress',msg:'Decoding '+tracks.length+' tracks…'});
    var actx=new (window.AudioContext||window.webkitAudioContext)();
    var buffers=[];
    for(var i=0;i<tracks.length;i++){
      post({type:'progress',msg:'Decoding track '+(i+1)+' of '+tracks.length+'…'});
      var decoded=await actx.decodeAudioData(b64ToAB(tracks[i]));
      buffers.push(decoded);
    }
    await actx.close();
    var sr=buffers[0].sampleRate;
    var maxOut=0;
    for(var i=0;i<buffers.length;i++){
      var d=Math.round((offsets[i]||0)*sr/1000);
      var len=buffers[i].length;
      var ext=len-d;
      if(ext>maxOut)maxOut=ext;
    }
    if(maxOut<1)maxOut=1;
    post({type:'progress',msg:'Mixing '+maxOut+' samples (offsets + VOL)…'});
    var mixL=new Float32Array(maxOut);
    var mixR=STEREO?new Float32Array(maxOut):null;
    for(var s=0;s<maxOut;s++){
      var accL=0,accR=0;
      for(var b=0;b<buffers.length;b++){
        var d=Math.round((offsets[b]||0)*sr/1000);
        var g=(gains[b]!=null)?gains[b]:1;
        if(g===0)continue;
        var len=buffers[b].length;
        var fi=s+d;
        if(fi<0||fi>=len)continue;
        var L0=buffers[b].getChannelData(0);
        var R0=STEREO?(buffers[b].numberOfChannels>1?buffers[b].getChannelData(1):L0):null;
        accL+=g*L0[fi];
        if(STEREO&&mixR&&R0) accR+=g*R0[fi];
      }
      mixL[s]=accL;
      if(STEREO&&mixR) mixR[s]=accR;
    }
    normArr(mixL); if(STEREO&&mixR) normArr(mixR);
    post({type:'progress',msg:'Encoding WAV ('+(STEREO?'Stereo':'Mono')+')…'});
    var wav=encodeWAV(mixL,mixR,sr);
    post({type:'mix_done',data:ab64(wav)});
  }catch(e){
    post({type:'mix_error',msg:String(e)});
  }
})();
})();
</script></body></html>`;

      setMixHtml(html);
      setMixState('mixing');
      setMixProgress('Starting mixer…');
    } catch (e) {
      setMixState('error');
      setMixProgress(String(e));
    }
  }, []);

  const handleMixerMessage = useCallback(async (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'progress') {
        setMixProgress(msg.msg);
      } else if (msg.type === 'mix_done') {
        setMixProgress('Saving…');
        const cur = activeSessionRef.current;
        const outPath = `${FileSystem.documentDirectory}mix_${Date.now()}.wav`;
        await FileSystem.writeAsStringAsync(outPath, msg.data, { encoding: FileSystem.EncodingType.Base64 });
        setMixHtml(null);
        setMixState('idle');
        setShowExport(false);
        await Sharing.shareAsync(outPath, { mimeType: 'audio/wav', dialogTitle: `${cur?.name ?? 'Session'} — mix` });
      } else if (msg.type === 'mix_error') {
        setMixHtml(null);
        setMixState('error');
        setMixProgress(msg.msg);
      }
    } catch {}
  }, []);

  /* ── Render session list item ── */
  const renderSessionItem = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={[styles.sessionItem, activeSession?.id === item.id && styles.sessionItemActive]}
      onPress={() => { setActiveSession(item); killSolo(); killAllSounds(); }}
      onLongPress={() =>
        Alert.alert(item.name, 'Выберите действие', [
          { text: 'Переименовать', onPress: () => { setRenameTarget({ type: 'session', id: item.id }); setRenameText(item.name); } },
          { text: 'Удалить сессию', style: 'destructive', onPress: () => deleteSession(item.id) },
          { text: 'Отмена', style: 'cancel' },
        ])
      }
      delayLongPress={400}
      activeOpacity={0.8}
    >
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{item.name}</Text>
        <Text style={styles.sessionMeta}>{item.tracks.length} / {MAX_TRACKS} tracks · удерж. для меню</Text>
      </View>
      <View style={styles.sessionDots}>
        {item.tracks.slice(0, 6).map((t, i) => (
          <View key={i} style={[styles.trackDot, { backgroundColor: t.color }]} />
        ))}
        {item.tracks.length > 6 && <Text style={styles.moreDots}>+{item.tracks.length - 6}</Text>}
      </View>
      <TouchableOpacity onPress={() => deleteSession(item.id)} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color="#c0392b" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const closeProject = useCallback(() => {
    setActiveSession(null);
    killSolo();
    void killAllSounds();
  }, [killSolo, killAllSounds]);

  /* ── Render ── */
  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Studio</Text>

      <View style={styles.screenBody}>
        {/* Список сессий: на весь экран, пока проект не открыт */}
        <View style={[
          styles.section,
          styles.sessionsSection,
          activeSession ? styles.sessionsSectionCompact : styles.sessionsSectionExpanded,
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SESSIONS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowQuality(true)} style={styles.headerIconBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="settings-outline" size={18} color="#7c4dff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowNewModal(true)} style={styles.addBtn}>
                <Ionicons name="add" size={20} color="#00e676" />
                <Text style={styles.addBtnText}>NEW</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={sessions}
            keyExtractor={i => i.id}
            renderItem={renderSessionItem}
            style={
              activeSession
                ? [styles.sessionsListCompact, { maxHeight: sessionsListCompactH }]
                : styles.sessionsListExpanded
            }
            showsVerticalScrollIndicator
            nestedScrollEnabled
            ListEmptyComponent={<Text style={styles.emptyText}>Нет сессий — нажми NEW</Text>}
          />
        </View>

        {activeSession && (
        <View style={[styles.section, styles.projectSection]}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity onPress={closeProject} style={styles.projectBackBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color="#888" />
            </TouchableOpacity>
            <View style={styles.projectTitleWrap}>
              <Text style={[styles.sectionTitle, styles.projectTitle]} numberOfLines={1}>
                {activeSession.name.toUpperCase()}
              </Text>
            </View>
            {soloTrackId ? (
              <View style={styles.soloIndicator}>
                <View style={styles.soloDot} />
                <Text style={styles.soloLabel}>SOLO</Text>
              </View>
            ) : (
              <View style={styles.projectHeaderSpacer} />
            )}
          </View>

          <FlatList
            data={activeSession.tracks}
            keyExtractor={t => t.id}
            style={styles.trackList}
            contentContainerStyle={activeSession.tracks.length === 0 ? styles.trackListEmpty : styles.trackListContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>Запиши первую дорожку ниже</Text>}
            renderItem={({ item, index }) => (
              <TrackRow
                track={item}
                index={index}
                isSolo={soloTrackId === item.id}
                isMuted={!!mutedTracks[item.id]}
                soloPos={soloPos}
                soloDur={soloDur}
                allPlayPos={allPlayPos}
                allPlayDur={allPlayDur}
                isPlayingAll={playingAll}
                onSoloToggle={toggleSolo}
                onMuteToggle={toggleMute}
                onSeek={handleSoloSeek}
                onScrubStart={beginSoloScrub}
                onScrubEnd={endSoloScrub}
                onRename={(t) => { setRenameTarget({ type: 'track', id: t.id }); setRenameText(t.label); }}
                onDelete={(t) => deleteTrack(t.id)}
                onOffsetChange={updateTrackOffset}
                gain={typeof item.gain === 'number' && Number.isFinite(item.gain) ? item.gain : 1}
                onGainChange={updateTrackGain}
              />
            )}
            ListFooterComponent={
              <View style={styles.projectFooter}>
                {isRecording ? (
                  <>
                    <View style={styles.recordingRow}>
                      <Animated.View style={[styles.recDot, { opacity: dotOpacity }]} />
                      <Text style={styles.recDuration}>{fmt(recDuration)}</Text>
                      {recInBackground ? (
                        <Text style={styles.recBackgroundHint}>запись в фоне</Text>
                      ) : null}
                      <TouchableOpacity onPress={stopRecording} style={styles.stopBtn}>
                        <Ionicons name="stop" size={22} color="#fff" />
                        <Text style={styles.stopBtnText}>STOP REC</Text>
                      </TouchableOpacity>
                    </View>
                    {inputApplyNote ? <Text style={styles.recWarnNote}>{inputApplyNote}</Text> : null}
                  </>
                ) : (
                  <>
                    <View style={styles.controlRow}>
                      <TouchableOpacity
                        onPress={playingAll ? killAllSounds : () => playAll(activeSession)}
                        style={[styles.controlBtn, playingAll && styles.controlBtnPlaying]}
                        disabled={activeSession.tracks.length === 0}
                      >
                        <Ionicons name={playingAll ? 'stop' : 'play'} size={20} color={activeSession.tracks.length === 0 ? '#333' : '#00e676'} />
                        <Text style={[styles.controlBtnText, activeSession.tracks.length === 0 && { color: '#333' }]}>
                          {playingAll ? 'STOP' : 'PLAY ALL'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => recordTrack(activeSession)}
                        style={[styles.controlBtn, styles.recCtrlBtn, activeSession.tracks.length >= MAX_TRACKS && styles.controlBtnDisabled]}
                        disabled={activeSession.tracks.length >= MAX_TRACKS}
                      >
                        <Ionicons name="mic" size={20} color={activeSession.tracks.length >= MAX_TRACKS ? '#333' : '#fff'} />
                        <Text style={[styles.recCtrlText, activeSession.tracks.length >= MAX_TRACKS && { color: '#333' }]}>
                          {activeSession.tracks.length === 0
                            ? 'REC TRACK 1'
                            : activeSession.tracks.length >= MAX_TRACKS
                            ? 'MAX REACHED'
                            : `ADD TRACK ${activeSession.tracks.length + 1}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={loadMinusTrack} style={styles.minusLoadRow} activeOpacity={0.75}>
                      <Ionicons name="musical-notes-outline" size={16} color="#ffeb3b" />
                      <Text style={styles.minusLoadRowText}>Загрузить минус · дорожка 1</Text>
                    </TouchableOpacity>
                    <View style={styles.latencyBar}>
                      <TouchableOpacity onPress={() => setShowQuality(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7c4dff22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#7c4dff44' }}>
                        <Ionicons name="settings-outline" size={12} color="#7c4dff" />
                        <Text style={{ color: '#7c4dff', fontSize: 10, fontWeight: '700' }}>{presetLabel(quality)}</Text>
                      </TouchableOpacity>
                      <View style={{ width: 1, height: 16, backgroundColor: '#2a2a38' }} />
                      <Ionicons name="timer-outline" size={13} color="#888" />
                      <HoldButton onPress={() => savePreroll(Math.max(0, prerollMs - 10))} style={styles.latencyBtn}>
                        <Text style={styles.latencyBtnText}>−</Text>
                      </HoldButton>
                      <TouchableOpacity onPress={() => savePreroll(DEFAULT_PREROLL_MS)} style={{ paddingHorizontal: 3 }}>
                        <Text style={styles.latencyVal}>{prerollMs}</Text>
                      </TouchableOpacity>
                      <HoldButton onPress={() => savePreroll(Math.min(1200, prerollMs + 10))} style={styles.latencyBtn}>
                        <Text style={styles.latencyBtnText}>+</Text>
                      </HoldButton>
                      <Text style={{ color: '#555', fontSize: 9 }}>мс</Text>
                      <TouchableOpacity onPress={() => savePreroll(PREROLL_MS_WIRED)}
                        style={{ backgroundColor: prerollMs === PREROLL_MS_WIRED ? '#00e67633' : '#1a1a28', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: prerollMs === PREROLL_MS_WIRED ? '#00e676' : '#2a2a38' }}>
                        <Text style={{ color: prerollMs === PREROLL_MS_WIRED ? '#00e676' : '#555', fontSize: 9, fontWeight: '700' }}>150</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => savePreroll(PREROLL_MS_BLUETOOTH)}
                        style={{ backgroundColor: prerollMs === PREROLL_MS_BLUETOOTH ? '#00bcd433' : '#1a1a28', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: prerollMs === PREROLL_MS_BLUETOOTH ? '#00bcd4' : '#2a2a38' }}>
                        <Text style={{ color: prerollMs === PREROLL_MS_BLUETOOTH ? '#00bcd4' : '#555', fontSize: 9, fontWeight: '700' }}>BT</Text>
                      </TouchableOpacity>
                    </View>
                    {activeSession.tracks.length > 0 && (
                      <View style={styles.bottomRow}>
                        <TouchableOpacity onPress={() => setShowQuality(true)} style={styles.qualityChip}>
                          <Ionicons name="settings-outline" size={13} color="#7c4dff" />
                          <Text style={styles.qualityChipText}>{presetLabel(quality)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={openExport} style={styles.exportBtn}>
                          <Ionicons name="share-outline" size={15} color="#ffeb3b" />
                          <Text style={styles.exportBtnText}>EXPORT ({activeSession.tracks.length})</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            }
          />

          {/* Master seek bar — shown during playAll */}
          {playingAll && allPlayDur > 0 && (
            <View style={styles.masterSeekContainer}>
              <Text style={styles.masterSeekTime}>{fmt(allPlayPos)}</Text>
              <View style={styles.masterSeekBarWrap}>
                <SeekBar
                  position={allPlayPos}
                  duration={allPlayDur}
                  color="#00e676"
                  onScrubStart={() => {
                    masterSeekingRef.current = true;
                    void pauseAllForScrub();
                  }}
                  onScrubEnd={() => {
                    masterSeekingRef.current = false;
                    resumeAllAfterScrub();
                  }}
                  onSeek={sec => handleMasterSeek(sec * 1000)}
                />
              </View>
              <Text style={styles.masterSeekTime}>{fmt(allPlayDur)}</Text>
            </View>
          )}

        </View>
        )}
      </View>

      {/* New session modal */}
      <Modal
        visible={showNewModal}
        transparent
        animationType="fade"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => { setShowNewModal(false); setNewName(''); }}
      >
        <View style={[styles.studioModalOverlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => { setShowNewModal(false); setNewName(''); }}
            accessibilityLabel="Закрыть"
          />
          <View style={styles.studioModalCardSm}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>New Session</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Session name..."
                placeholderTextColor="#555"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                onSubmitEditing={createSession}
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity onPress={() => { setShowNewModal(false); setNewName(''); }} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={createSession} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => { setRenameTarget(null); setRenameText(''); }}
      >
        <View style={[styles.studioModalOverlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => { setRenameTarget(null); setRenameText(''); }}
            accessibilityLabel="Закрыть"
          />
          <View style={styles.studioModalCardSm}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Rename</Text>
              <TextInput
                style={styles.modalInput}
                value={renameText}
                onChangeText={setRenameText}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={applyRename}
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity onPress={() => { setRenameTarget(null); setRenameText(''); }} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={applyRename} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export modal */}
      <Modal
        visible={showExport}
        transparent
        animationType="slide"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => {
          if (mixState === 'mixing' || mixState === 'loading') return;
          setShowExport(false);
          setMixState('idle');
          setMixHtml(null);
        }}
      >
        <View style={[styles.studioModalOverlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (mixState === 'mixing' || mixState === 'loading') return;
              setShowExport(false);
              setMixState('idle');
              setMixHtml(null);
            }}
            accessibilityLabel="Закрыть"
          />
          <View style={[styles.studioModalCard, { maxHeight: studioModalScrollMaxH }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              nestedScrollEnabled
              style={{ maxHeight: studioModalBodyMaxH }}
              contentContainerStyle={styles.studioModalScrollContent}
            >
              <Text style={styles.modalTitle}>Export Tracks</Text>

              {(activeSession?.tracks.length ?? 0) > 1 && (
                <View style={styles.formatRow}>
                  <Text style={styles.formatLabel}>Mix format:</Text>
                  {([16, 24] as const).map(d => (
                    <TouchableOpacity key={d} onPress={() => setMixBitDepth(d)}
                      style={[styles.fmtBtn, mixBitDepth === d && styles.fmtBtnActive]}>
                      <Text style={[styles.fmtBtnText, mixBitDepth === d && { color: '#00e676' }]}>
                        WAV {d}-bit
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => setMixBitDepth(mixBitDepth)}
                    style={[styles.fmtBtn, { borderColor: '#7c4dff44' }]}>
                    <Text style={[styles.fmtBtnText, { color: '#7c4dff' }]}>
                      {quality.channels === 2 ? 'Stereo' : 'Mono'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {(activeSession?.tracks.length ?? 0) > 1 && (
                <TouchableOpacity
                  onPress={() => activeSession && startMix(activeSession)}
                  disabled={mixState === 'mixing' || mixState === 'loading'}
                  style={styles.mixAllBtn}
                  activeOpacity={0.75}
                >
                  <Ionicons name="git-merge-outline" size={18} color="#00e676" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mixAllText}>
                      {mixState === 'idle'
                        ? `Merge all → WAV ${mixBitDepth}-bit ${quality.channels === 2 ? 'Stereo' : 'Mono'}`
                        : mixProgress}
                    </Text>
                    {mixState === 'idle' && (
                      <Text style={styles.mixAllSub}>
                        {quality.sampleRate / 1000} kHz · {mixBitDepth}-bit · {quality.channels === 2 ? 'Stereo' : 'Mono'}
                      </Text>
                    )}
                  </View>
                  {(mixState === 'loading' || mixState === 'mixing') && (
                    <Animated.Text style={{ color: '#00e676', fontSize: 18 }}>⏳</Animated.Text>
                  )}
                  {mixState === 'error' && <Ionicons name="alert-circle" size={18} color="#ff5252" />}
                </TouchableOpacity>
              )}

              <Text style={[styles.exportHint, { marginTop: 10 }]}>
                Or share individual tracks:
              </Text>
              {(activeSession?.tracks ?? []).length === 0 ? (
                <Text style={styles.emptyText}>No tracks in this session</Text>
              ) : (
                (activeSession?.tracks ?? []).map(item => {
                  const busy = exportingId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => activeSession && shareTrack(item, activeSession.name)}
                      disabled={busy}
                      style={[styles.exportTrackRow, { borderLeftColor: item.color }]}
                      activeOpacity={0.75}
                    >
                      <View style={styles.exportTrackInfo}>
                        <Text style={styles.exportTrackLabel}>{item.label}</Text>
                        <Text style={styles.exportTrackSub}>tap to share</Text>
                      </View>
                      {busy
                        ? <Text style={styles.exportBusy}>…</Text>
                        : <Ionicons name="share-outline" size={20} color="#ffeb3b" />
                      }
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => { setShowExport(false); setMixState('idle'); setMixHtml(null); }}
              style={styles.studioModalFooterBtn}
            >
              <Text style={styles.modalCancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quality settings modal */}
      <Modal
        visible={showQuality}
        transparent
        animationType="fade"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => setShowQuality(false)}
      >
        <View style={[styles.studioModalOverlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowQuality(false)}
            accessibilityLabel="Закрыть"
          />
          <View style={[styles.studioModalCard, { maxHeight: studioModalScrollMaxH }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              nestedScrollEnabled
              style={{ maxHeight: studioModalBodyMaxH }}
              contentContainerStyle={styles.studioModalScrollContent}
            >
              <Text style={styles.modalTitle}>Настройки студии</Text>

              <Text style={styles.settingsSectionLabel}>① Качество записи</Text>
              <Text style={styles.settingsSectionHint}>Для всех новых дорожек этой сессии</Text>
              {QUALITY_PRESETS.map((p, i) => {
                const active =
                  p.q.sampleRate === quality.sampleRate &&
                  p.q.channels   === quality.channels   &&
                  p.q.bitRate    === quality.bitRate;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={async () => { setQuality(p.q); qualityRef.current = p.q; await saveQualitySettings(p.q); }}
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
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>② Задержка дорожек (мс)</Text>
                <Text style={styles.settingsSectionHint}>
                  Дорожки 2+ сдвигаются на эту величину, чтобы попасть в минус.
                  Запаздывает — увеличь, опережает — уменьши. Пресеты: провод {PREROLL_MS_WIRED}, BT {PREROLL_MS_BLUETOOTH}.
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  <TouchableOpacity onPress={() => savePreroll(Math.max(0, prerollMs - 20))}
                    style={styles.latencyStepBtn}>
                    <Text style={styles.latencyStepText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.latencyBigVal}>{prerollMs}</Text>
                  <TouchableOpacity onPress={() => savePreroll(Math.min(1200, prerollMs + 20))}
                    style={styles.latencyStepBtn}>
                    <Text style={styles.latencyStepText}>+</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.latencyPresetRow}>
                  <TouchableOpacity onPress={() => savePreroll(PREROLL_MS_WIRED)}
                    style={[styles.latencyPresetChip, prerollMs === PREROLL_MS_WIRED && styles.latencyPresetChipActive]}>
                    <Text style={[styles.latencyPresetText, prerollMs === PREROLL_MS_WIRED && { color: '#00e676' }]}>Провод {PREROLL_MS_WIRED}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => savePreroll(PREROLL_MS_BLUETOOTH)}
                    style={[styles.latencyPresetChip, prerollMs === PREROLL_MS_BLUETOOTH && styles.latencyPresetChipActive]}>
                    <Text style={[styles.latencyPresetText, prerollMs === PREROLL_MS_BLUETOOTH && { color: '#00bcd4' }]}>BT {PREROLL_MS_BLUETOOTH}</Text>
                  </TouchableOpacity>
                </View>
                {(activeSession?.tracks.length ?? 0) > 1 && (
                  <TouchableOpacity onPress={() => { void resetAllOffsets(); }} style={styles.applyOffsetsBtn} activeOpacity={0.8}>
                    <Ionicons name="sync-outline" size={14} color="#7c4dff" />
                    <Text style={styles.applyOffsetsText}>Применить {prerollMs} мс ко всем дорожкам 2+</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.settingsSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={[styles.settingsSectionLabel, { marginBottom: 0 }]}>③ Звук — микрофон и выход</Text>
                  <TouchableOpacity onPress={() => void refreshAudioRoutes()} disabled={audioRouteLoading} style={{ padding: 6 }}>
                    <Ionicons name="refresh" size={18} color={audioRouteLoading ? '#333' : '#7c4dff'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.routeModeRow}>
                  <TouchableOpacity
                    style={[styles.routeModeBtn, audioRouting.mode === 'auto' && styles.routeModeBtnActive]}
                    onPress={() => saveAudioRouting({ mode: 'auto', output: 'system', inputUid: null })}
                  >
                    <Text style={[styles.routeModeBtnText, audioRouting.mode === 'auto' && styles.routeModeBtnTextActive]}>
                      АВТО
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.routeModeBtn, audioRouting.mode === 'manual' && styles.routeModeBtnActive]}
                    onPress={() => {
                      void (async () => {
                        let snap = audioRouteSnap;
                        if (!snap?.inputs.length) snap = await refreshAudioRoutes();
                        let output: AudioOutputRoute = audioRouting.output;
                        if (output === 'system') {
                          if (snap.hasBluetooth) output = 'bluetooth';
                          else if (snap.hasWired) output = 'wired';
                          else output = 'speaker';
                        }
                        const suggested = suggestInputForOutput(output, snap.inputs);
                        const keepUid =
                          audioRouting.inputUid && snap.inputs.some(i => i.uid === audioRouting.inputUid)
                            ? audioRouting.inputUid
                            : suggested?.uid ?? snap.inputs[0]?.uid ?? null;
                        const inp = snap.inputs.find(i => i.uid === keepUid);
                        await saveAudioRouting({
                          mode: 'manual',
                          output,
                          inputUid: keepUid,
                        }, inp ? prerollForInput(inp) : prerollForOutput(output));
                      })();
                    }}
                  >
                    <Text style={[styles.routeModeBtnText, audioRouting.mode === 'manual' && styles.routeModeBtnTextActive]}>
                      ВРУЧНУЮ
                    </Text>
                  </TouchableOpacity>
                </View>

                <RecordingInputPicker
                  routing={audioRouting}
                  snap={audioRouteSnap}
                  loading={audioRouteLoading}
                  onRefresh={() => void refreshAudioRoutes()}
                  onPickInput={pickInput}
                  compact
                />

                {audioRouting.mode === 'auto' ? (
                  <View style={[styles.routeStatusCard, { marginTop: 10 }]}>
                    <Text style={styles.routeStatusLine}>
                      <Text style={{ color: '#666' }}>Слушать: </Text>
                      {audioRouteSnap?.listenHint ?? (audioRouteLoading ? '…' : 'обнови список')}
                    </Text>
                    <Text style={{ color: '#444', fontSize: 10, marginTop: 8, lineHeight: 14 }}>
                      Воспроизведение — как назначил телефон. Микрофон — из списка выше.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.qualitySub, { marginBottom: 6 }]}>Воспроизведение (минус)</Text>
                    <View style={styles.routeOutputGrid}>
                      {OUTPUT_OPTIONS.map(opt => {
                        const active = audioRouting.output === opt.id;
                        const missing = outputDeviceMissing(opt.id, audioRouteSnap);
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            onPress={() => pickOutput(opt.id)}
                            style={[
                              styles.routeOutputChip,
                              active && styles.routeOutputChipActive,
                              missing && styles.routeOutputChipWarn,
                            ]}
                          >
                            <Ionicons name={opt.icon} size={16} color={active ? '#7c4dff' : missing ? '#ff9800' : '#555'} />
                            <Text style={[styles.routeOutputChipLabel, active && { color: '#7c4dff' }]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {outputDeviceMissing(audioRouting.output, audioRouteSnap) && (
                      <Text style={styles.routeWarnText}>
                        Устройство не в списке — подключи кабель или BT и нажми обновить ↑
                      </Text>
                    )}

                    <Text style={{ color: '#444', fontSize: 10, lineHeight: 14, marginTop: 6 }}>
                      Принудительно приложение умеет только «Трубка» (тихо, у уха). Динамик / BT / AUX — звук идёт туда
                      автоматически, когда устройство подключено; выбор здесь задаёт пресет задержки (BT {PREROLL_MS_BLUETOOTH} мс).
                    </Text>
                  </>
                )}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={() => setShowQuality(false)} style={styles.studioModalFooterBtn}>
              <Text style={styles.modalCancelText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Hidden mixer WebView */}
      {mixHtml && (
        <WebView
          ref={mixerRef}
          source={{ html: mixHtml }}
          onMessage={handleMixerMessage}
          style={{ width: 0, height: 0, position: 'absolute' }}
          javaScriptEnabled
          mediaPlaybackRequiresUserAction={false}
        />
      )}
    </View>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: '#0a0a0f', paddingHorizontal: 16 },
  title: { color: '#888', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600', textAlign: 'center', marginBottom: 10, flexShrink: 0 },
  screenBody: { flex: 1, minHeight: 0 },

  section: { backgroundColor: '#111118', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#222' },
  sessionsSection: { flexDirection: 'column', minHeight: 0 },
  sessionsSectionExpanded: { flex: 1, minHeight: 0, marginBottom: 0 },
  sessionsSectionCompact: { flexShrink: 0, marginBottom: 6, paddingVertical: 8, paddingHorizontal: 12 },
  sessionsListExpanded: { flex: 1, minHeight: 0 },
  sessionsListCompact: { minHeight: 0 },
  projectSection: { flex: 1, minHeight: 0, marginBottom: 0 },
  projectFooter: { paddingTop: 4, paddingBottom: 8 },
  trackListContent: { paddingBottom: 4 },
  headerIconBtn: { padding: 6, backgroundColor: '#7c4dff18', borderRadius: 10, borderWidth: 1, borderColor: '#7c4dff33' },
  projectBackBtn: { width: 28 },
  projectHeaderSpacer: { width: 28 },
  projectTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  projectTitle: { textAlign: 'center', marginBottom: 0 },
  trackList: { flex: 1, minHeight: 0 },
  trackListEmpty: { flexGrow: 1, justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#555', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  emptyText: { color: '#333', fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#00e67618', borderRadius: 10, borderWidth: 1, borderColor: '#00e67644' },
  addBtnText: { color: '#00e676', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  soloIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  soloDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ff5252' },
  soloLabel: { color: '#ff5252', fontSize: 10, fontWeight: '700', letterSpacing: 2 },

  sessionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a24', borderRadius: 12, padding: 11, marginBottom: 7, borderWidth: 1, borderColor: '#2a2a38', gap: 10 },
  sessionItemActive: { borderColor: '#00e67644', backgroundColor: '#00e67610' },
  sessionInfo: { flex: 1 },
  sessionName: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  sessionMeta: { color: '#555', fontSize: 11, marginTop: 2 },
  sessionDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  trackDot: { width: 7, height: 7, borderRadius: 4 },
  moreDots: { color: '#555', fontSize: 10 },
  deleteBtn: { padding: 4 },

  // Track row
  trackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a24', borderRadius: 12, padding: 10, marginBottom: 7, borderLeftWidth: 3, gap: 8 },
  trackRowSolo: { backgroundColor: '#1e1e2e' },
  trackBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  trackBadgeText: { fontSize: 12, fontWeight: '800' },
  trackMid: { flex: 1, minWidth: 0 },
  trackLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  trackLabel: { color: '#ccc', fontSize: 13, fontWeight: '600', flex: 1, minWidth: 0 },
  trackAdjustRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 5 },
  trackChipTag: { color: '#444', fontSize: 8, fontWeight: '800', letterSpacing: 0.5, paddingLeft: 8, paddingRight: 2 },
  trackTime: { fontSize: 10, fontWeight: '600' },
  scrubTrack: { height: 3, backgroundColor: '#2a2a38', borderRadius: 2, marginTop: 6, overflow: 'visible', position: 'relative' },
  scrubFill: { height: 3, borderRadius: 2 },
  soloBtn: { padding: 2 },
  iconBtn: { padding: 5 },

  // Recording
  recordingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 10 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ff1744' },
  recDuration: { color: '#ff5252', fontSize: 22, fontWeight: '700', letterSpacing: 2, minWidth: 56 },
  recBackgroundHint: { color: '#ff9800', fontSize: 11, fontWeight: '600' },
  recWarnNote: { color: '#ff9800', fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ff1744', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18 },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 1 },

  // Master seek bar
  masterSeekContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, paddingVertical: 8 },
  masterSeekBarWrap: { flex: 1 },
  masterSeekTime: { color: '#888', fontSize: 11, minWidth: 38, textAlign: 'center' },

  trackOffsetRow:     { flexDirection: 'row', alignItems: 'center', gap: 0, backgroundColor: '#1a1a28', borderRadius: 10, overflow: 'hidden' },
  trackOffsetBtnArea: { paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  trackOffsetBtn:     { color: '#7c4dff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  trackOffsetValArea: { paddingHorizontal: 4, paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  trackOffsetVal:     { color: '#aaa', fontSize: 10, fontWeight: '700', minWidth: 38, textAlign: 'center' },

  latencyBar: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: '#0d0d18', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#1e1e30', flexWrap: 'wrap' },
  latencyVal: { color: '#fff', fontSize: 14, fontWeight: '800', minWidth: 54, textAlign: 'center' },
  latencyBtn: { width: 30, height: 30, backgroundColor: '#7c4dff30', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  latencyBtnText: { color: '#fff', fontSize: 20, lineHeight: 24, fontWeight: '700' },

  // Settings modal sections
  settingsSection: { marginTop: 16, borderTopWidth: 1, borderColor: '#1e1e28', paddingTop: 14 },
  settingsSectionLabel: { color: '#7c4dff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  settingsSectionHint: { color: '#666', fontSize: 11, lineHeight: 15, marginBottom: 10 },
  latencyStepBtn: { width: 40, height: 40, backgroundColor: '#1e1e28', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  latencyStepText: { color: '#fff', fontSize: 22, lineHeight: 26 },
  latencyBigVal: { color: '#fff', fontSize: 22, fontWeight: '800', width: 60, textAlign: 'center' },
  latencyPresetRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  latencyPresetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a38', backgroundColor: '#1a1a24' },
  latencyPresetChipActive: { borderColor: '#00e67644', backgroundColor: '#00e67614' },
  latencyPresetText: { color: '#888', fontSize: 11, fontWeight: '700' },
  applyOffsetsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#7c4dff44', backgroundColor: '#7c4dff14' },
  applyOffsetsText: { color: '#7c4dff', fontSize: 11, fontWeight: '700' },

  controlRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  controlBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, backgroundColor: '#1e1e28', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a38' },
  minusLoadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffeb3b33',
    backgroundColor: '#ffeb3b0c',
  },
  minusLoadRowText: { color: '#ffeb3b', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  controlBtnPlaying: { backgroundColor: '#00e67618', borderColor: '#00e67644' },
  controlBtnDisabled: { opacity: 0.4 },
  controlBtnText: { color: '#00e676', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  recCtrlBtn: { backgroundColor: '#ff174418', borderColor: '#ff174444' },
  recCtrlText: { color: '#ff5252', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  hintText: { color: '#444', fontSize: 10, textAlign: 'center', marginTop: 8, lineHeight: 15 },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: '#ffeb3b18', borderRadius: 12, borderWidth: 1, borderColor: '#ffeb3b44' },
  exportBtnText: { color: '#ffeb3b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  exportHint: { color: '#555', fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 4 },
  exportTrackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a24', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderWidth: 1, borderColor: '#2a2a38', gap: 10 },
  exportTrackInfo: { flex: 1 },
  exportTrackLabel: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  exportTrackSub: { color: '#444', fontSize: 11, marginTop: 2 },
  exportBusy: { color: '#ffeb3b', fontSize: 18, fontWeight: '700' },
  mixAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#00e67614', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#00e67644', width: '100%' },
  mixAllText: { color: '#00e676', fontSize: 13, fontWeight: '700' },
  mixAllSub:  { color: '#00e67688', fontSize: 10, marginTop: 2 },
  formatRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  formatLabel:{ color: '#555', fontSize: 11, fontWeight: '600', marginRight: 2 },
  fmtBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a38', backgroundColor: '#1a1a24' },
  fmtBtnActive:{ borderColor: '#00e67644', backgroundColor: '#00e67614' },
  fmtBtnText: { color: '#555', fontSize: 11, fontWeight: '700' },
  bottomRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  qualityChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#7c4dff18', borderRadius: 12, borderWidth: 1, borderColor: '#7c4dff44' },
  qualityChipText: { color: '#7c4dff', fontSize: 11, fontWeight: '700' },

  routeStatusCard: {
    backgroundColor: '#0d0d14',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e1e28',
  },
  routeStatusLine: { color: '#bbb', fontSize: 12, lineHeight: 17 },
  routeModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    backgroundColor: '#0d0d14',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1e1e28',
  },
  routeModeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  routeModeBtnActive: { backgroundColor: '#7c4dff' },
  routeModeBtnText: { color: '#555', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  routeModeBtnTextActive: { color: '#fff' },
  routeOutputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  routeOutputChip: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a38',
    backgroundColor: '#1a1a24',
  },
  routeOutputChipActive: { borderColor: '#7c4dff', backgroundColor: '#7c4dff18' },
  routeOutputChipWarn: { borderColor: '#ff980044' },
  routeOutputChipLabel: { color: '#888', fontSize: 10, fontWeight: '700' },
  routeWarnText: { color: '#ff9800', fontSize: 10, lineHeight: 14, marginBottom: 4 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a24', borderRadius: 12, padding: 13, marginTop: 8, borderWidth: 1, borderColor: '#2a2a38', width: '100%' },
  qualityRowActive: { borderColor: '#7c4dff44', backgroundColor: '#7c4dff10' },
  qualityName: { color: '#ccc', fontSize: 14, fontWeight: '700' },
  qualitySub:  { color: '#555', fontSize: 11, marginTop: 2 },

  /** Полноэкранный слой: таб-бар скрывается отдельно; карточка выше Pressable-затемнения */
  studioModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  studioModalCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a38',
    overflow: 'hidden',
  },
  studioModalFooterBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#2a2a38',
    backgroundColor: '#15151c',
  },
  studioModalCardSm: {
    backgroundColor: '#1a1a24',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  studioModalScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  modalTitle: { color: '#ccc', fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#0d0d15', borderRadius: 12, padding: 12, color: '#e0e0e0', fontSize: 15, borderWidth: 1, borderColor: '#2a2a38', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#2a2a38', borderRadius: 12 },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#00e676', borderRadius: 12 },
  modalConfirmText: { color: '#0a0a0f', fontWeight: '700' },
});
