import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, Animated, Modal, TextInput,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SeekBar from '../components/SeekBar';
import {
  RecQuality, QUALITY_PRESETS, DEFAULT_QUALITY,
  loadQualitySettings, saveQualitySettings, buildRecordingOptions, presetLabel,
} from '../utils/qualitySettings';

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

export default function RecorderScreen() {
  const insets = useSafeAreaInsets();
  const [recordings, setRecordings]   = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recDur, setRecDur]           = useState(0);
  const [loading, setLoading]         = useState(true);
  const [renameRec, setRenameRec]     = useState<Recording | null>(null);
  const [renameText, setRenameText]   = useState('');
  const [quality, setQuality]         = useState<RecQuality>(DEFAULT_QUALITY);
  const [showQuality, setShowQuality] = useState(false);
  const qualityRef = useRef<RecQuality>(DEFAULT_QUALITY);
  useEffect(() => { qualityRef.current = quality; }, [quality]);

  // Single-source-of-truth for playback
  const [playingId, setPlayingId]       = useState<string | null>(null);
  const [playPos, setPlayPos]           = useState(0);
  const [playDur, setPlayDur]           = useState(0);

  const recRef     = useRef<Audio.Recording | null>(null);
  const soundRef   = useRef<Audio.Sound | null>(null);
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
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    loadQualitySettings().then(q => { setQuality(q); qualityRef.current = q; });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => { killSound(); };
  }, []));

  /* ─── Sound teardown (sync-safe) ─── */
  const killSound = useCallback(() => {
    const s = soundRef.current;
    soundRef.current = null;
    setPlayingId(null);
    setPlayPos(0);
    setPlayDur(0);
    if (s) {
      s.stopAsync()
        .catch(() => {})
        .finally(() => s.unloadAsync().catch(() => {}));
    }
  }, []);

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

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

      const { sound } = await Audio.Sound.createAsync(
        { uri: rec.uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        (st: AVPlaybackStatus) => {
          if (!st.isLoaded) return;
          setPlayPos(st.positionMillis / 1000);
          if (st.durationMillis) setPlayDur(st.durationMillis / 1000);
          if (st.didJustFinish) {
            soundRef.current = null;
            setPlayingId(null);
            setPlayPos(0);
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
  const handleSeek = useCallback(async (seconds: number) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setStatusAsync({ positionMillis: Math.round(seconds * 1000) });
    } catch {}
  }, []);

  /* ─── Recording ─── */
  const startRecording = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied'); return; }
    killSound();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(buildRecordingOptions(qualityRef.current));
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
      await recRef.current.stopAndUnloadAsync();
      const uri = recRef.current.getURI();
      recRef.current = null;
      setIsRecording(false);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
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
      }
    } catch (e) {
      setIsRecording(false);
      Alert.alert('Stop error', String(e));
    }
  };

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
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Recorder</Text>
        {!isRecording && (
          <TouchableOpacity onPress={() => setShowQuality(true)} style={styles.qualityChip}>
            <Ionicons name="settings-outline" size={13} color="#7c4dff" />
            <Text style={styles.qualityChipText}>{presetLabel(quality)}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Record button */}
      <View style={styles.recordArea}>
        {isRecording && (
          <View style={styles.recDurRow}>
            <Animated.View style={[styles.recDot, { opacity: dotOpacity }]} />
            <Text style={styles.recDurText}>{fmt(recDur)}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          style={[styles.recBtn, isRecording ? styles.recBtnActive : null]}
          activeOpacity={0.8}
        >
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hint}>{isRecording ? 'Tap to stop' : 'Tap to record'}</Text>
      </View>

      {/* List */}
      <View style={styles.listWrap}>
        <Text style={styles.listTitle}>
          {recordings.length > 0 ? `RECORDINGS (${recordings.length})` : 'NO RECORDINGS YET'}
        </Text>
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
      <Modal visible={showQuality} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
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
            <TouchableOpacity onPress={() => setShowQuality(false)}
              style={[styles.modalCancel, { marginTop: 14, alignSelf: 'center', paddingHorizontal: 32 }]}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal visible={renameRec !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
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
          </View>
        </View>
      </Modal>
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

  recordArea: { alignItems: 'center', paddingVertical: 20, marginHorizontal: 16, backgroundColor: '#111118', borderRadius: 20, borderWidth: 1, borderColor: '#222', marginBottom: 20 },
  recDurRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff1744' },
  recDurText: { color: '#ff5252', fontSize: 28, fontWeight: '700', letterSpacing: 2 },
  recBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1e1e28', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#333' },
  recBtnActive: { backgroundColor: '#ff1744', borderColor: '#ff1744' },
  hint: { color: '#444', fontSize: 12, marginTop: 10, letterSpacing: 1 },

  listWrap: { flex: 1, paddingHorizontal: 16 },
  listTitle: { color: '#444', fontSize: 11, letterSpacing: 2, fontWeight: '600', marginBottom: 12 },
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
