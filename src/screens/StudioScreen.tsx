import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, Animated, TextInput, Modal, PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

/* ─── Types ─── */
interface Track { id: string; uri: string; label: string; color: string }
interface Session { id: string; name: string; createdAt: number; tracks: Track[] }

import {
  RecQuality, QUALITY_PRESETS, DEFAULT_QUALITY,
  loadQualitySettings, saveQualitySettings, buildRecordingOptions, presetLabel,
} from '../utils/qualitySettings';

/* ─── Constants ─── */
const MAX_TRACKS    = 10;
const SESSIONS_FILE = (FileSystem.documentDirectory ?? '') + 'studio_sessions.json';
const STUDIO_DIR    = (FileSystem.documentDirectory ?? '') + 'studio/';
const LATENCY_FILE  = (FileSystem.documentDirectory ?? '') + 'studio_latency.json';

// Android mic has ~80-150ms hardware latency.
// We preroll playback by this amount before starting recording so they cancel out.
// User can calibrate via the ±button in the header.
const DEFAULT_PREROLL_MS = 120;

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

/* ─── TrackRow component (solo play + scrub) ─── */
interface TrackRowProps {
  track: Track;
  index: number;
  isSolo: boolean;
  soloPos: number;
  soloDur: number;
  onSoloToggle: (track: Track) => void;
  onSeek: (seconds: number) => void;
  onRename: (track: Track) => void;
  onDelete: (track: Track) => void;
}

function TrackRow({ track, index, isSolo, soloPos, soloDur, onSoloToggle, onSeek, onRename, onDelete }: TrackRowProps) {
  const rowWidthRef = useRef(0);
  // Keep live refs so PanResponder closures are never stale
  const isSoloRef  = useRef(isSolo);
  const soloDurRef = useRef(soloDur);
  const onSeekRef  = useRef(onSeek);
  useEffect(() => { isSoloRef.current  = isSolo;  }, [isSolo]);
  useEffect(() => { soloDurRef.current = soloDur; }, [soloDur]);
  useEffect(() => { onSeekRef.current  = onSeek;  }, [onSeek]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isSoloRef.current,
      onMoveShouldSetPanResponder:  () => isSoloRef.current,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        if (!isSoloRef.current || rowWidthRef.current <= 0 || soloDurRef.current <= 0) return;
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / rowWidthRef.current));
        onSeekRef.current(pct * soloDurRef.current);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        if (!isSoloRef.current || rowWidthRef.current <= 0 || soloDurRef.current <= 0) return;
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / rowWidthRef.current));
        onSeekRef.current(pct * soloDurRef.current);
      },
    })
  ).current;

  const progress = isSolo && soloDur > 0 ? soloPos / soloDur : 0;

  return (
    <View
      style={[styles.trackRow, { borderLeftColor: track.color }, isSolo && styles.trackRowSolo]}
      onLayout={e => { rowWidthRef.current = e.nativeEvent.layout.width; }}
      {...(isSolo ? panResponder.panHandlers : {})}
    >
      {/* Index badge */}
      <View style={[styles.trackBadge, { backgroundColor: track.color + '33' }]}>
        <Text style={[styles.trackBadgeText, { color: track.color }]}>{index + 1}</Text>
      </View>

      {/* Info + progress bar */}
      <View style={styles.trackMid}>
        <View style={styles.trackLabelRow}>
          <Text style={styles.trackLabel}>{track.label}</Text>
          {isSolo && (
            <Text style={[styles.trackTime, { color: track.color }]}>
              {fmt(soloPos)} / {fmt(soloDur)}
            </Text>
          )}
        </View>

        {/* Progress bar (always visible when solo, acts as scrub target) */}
        {isSolo && (
          <View style={styles.scrubTrack}>
            <View style={[styles.scrubFill, { width: `${progress * 100}%` as any, backgroundColor: track.color }]} />
            <View style={[styles.scrubThumb, { left: `${progress * 100}%` as any, backgroundColor: track.color }]} />
          </View>
        )}
      </View>

      {/* Solo play/pause button */}
      <TouchableOpacity onPress={() => onSoloToggle(track)} style={styles.soloBtn}>
        <Ionicons
          name={isSolo ? 'pause-circle' : 'play-circle'}
          size={34}
          color={isSolo ? track.color : '#444'}
        />
      </TouchableOpacity>

      {/* Edit */}
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
  const [sessions, setSessions]           = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording]     = useState(false);
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

  // Latency compensation: preroll playback before recording starts
  const [prerollMs, setPrerollMs]         = useState(DEFAULT_PREROLL_MS);
  const prerollRef = useRef(DEFAULT_PREROLL_MS);
  useEffect(() => { qualityRef.current = quality; }, [quality]);
  useEffect(() => { prerollRef.current = prerollMs; }, [prerollMs]);

  const recRef      = useRef<Audio.Recording | null>(null);
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
        if (typeof ms === 'number') { setPrerollMs(ms); prerollRef.current = ms; }
      }
    } catch {}
  }, []);

  const savePreroll = useCallback(async (ms: number) => {
    setPrerollMs(ms); prerollRef.current = ms;
    await FileSystem.writeAsStringAsync(LATENCY_FILE, JSON.stringify(ms));
  }, []);

  useEffect(() => { loadSessions(); loadQuality(); }, []);

  useFocusEffect(useCallback(() => {
    loadSessions();
    return () => { killAllSounds(); killSolo(); };
  }, []));

  /* ── Sound teardown ── */
  const killAllSounds = useCallback(async () => {
    const sounds = allSounds.current;
    allSounds.current = [];
    setPlayingAll(false);
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

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 80 },
        (st: AVPlaybackStatus) => {
          if (!st.isLoaded) return;
          setSoloPos(st.positionMillis / 1000);
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
    try { await soloSound.current.setStatusAsync({ positionMillis: Math.round(seconds * 1000) }); } catch {}
  }, []);

  /* ── Play all ── */
  const playAll = useCallback(async (session: Session) => {
    if (session.tracks.length === 0) { Alert.alert('No tracks yet'); return; }
    killSolo();
    await killAllSounds();
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      // Load ALL sounds in parallel without starting them
      const loaded = await Promise.all(
        session.tracks.map(t =>
          Audio.Sound.createAsync({ uri: t.uri }, { shouldPlay: false })
            .then(({ sound }) => sound)
        )
      );
      allSounds.current = loaded;
      setPlayingAll(true);
      loaded[0].setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => {
        if (st.isLoaded && st.didJustFinish) killAllSounds();
      });
      // Start all tracks as close to simultaneously as possible
      await Promise.all(loaded.map(s => s.playAsync()));
    } catch (e) { Alert.alert('Playback error', String(e)); }
  }, [killSolo, killAllSounds]);

  /* ── Record new track ── */
  const recordTrack = useCallback(async (session: Session) => {
    if (session.tracks.length >= MAX_TRACKS) { Alert.alert(`Max ${MAX_TRACKS} tracks`); return; }
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Microphone permission denied'); return; }

    killSolo();
    await killAllSounds();

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      // Load all existing tracks in parallel (not playing yet)
      const playbackSounds = await Promise.all(
        session.tracks.map(t =>
          Audio.Sound.createAsync({ uri: t.uri }, { shouldPlay: false })
            .then(({ sound }) => sound)
        )
      );
      allSounds.current = playbackSounds;

      // Prepare recording
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(buildRecordingOptions(qualityRef.current));

      // ── Latency compensation preroll ──────────────────────────────────
      // Android mic has ~80-150ms hardware latency: sound enters mic but
      // arrives in the buffer delayed. To compensate, we start playback
      // FIRST and wait prerollMs before starting the recording.
      // When prerollMs ≈ hardware_latency, recording pos 0 aligns with
      // playback pos 0, so overdubbed tracks are in sync.
      if (playbackSounds.length > 0) {
        await Promise.all(playbackSounds.map(s => s.playAsync()));
        await new Promise<void>(r => setTimeout(r, prerollRef.current));
      }

      await rec.startAsync();
      recRef.current = rec;
      startRef.current = Date.now();

      setIsRecording(true);
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
      await recRef.current.stopAndUnloadAsync();
      const uri = recRef.current.getURI();
      recRef.current = null;
      setIsRecording(false);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

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
          id:    `t_${ts}`,
          uri:   dst,
          label: TRACK_LABELS[idx] ?? `Track ${idx + 1}`,
          color: TRACK_COLORS[idx % TRACK_COLORS.length],
        };
        const updated: Session = { ...currentSession, tracks: [...currentSession.tracks, track] };
        const next = currentSessions.map(s => s.id === updated.id ? updated : s);
        setSessions(next);
        setActiveSession(updated);
        await saveSessions(next);
      }
    } catch (e) {
      setIsRecording(false);
      Alert.alert('Stop error', String(e));
    }
  }, [saveSessions, killAllSounds]);

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
    var maxLen=Math.max.apply(null,buffers.map(function(b){return b.length;}));
    post({type:'progress',msg:'Mixing…'});
    var mixL=new Float32Array(maxLen);
    var mixR=STEREO?new Float32Array(maxLen):null;
    for(var b=0;b<buffers.length;b++){
      var L0=buffers[b].getChannelData(0);
      var R0=STEREO?(buffers[b].numberOfChannels>1?buffers[b].getChannelData(1):L0):null;
      for(var s=0;s<L0.length;s++) mixL[s]+=L0[s];
      if(STEREO&&R0) for(var s=0;s<R0.length;s++) mixR[s]+=R0[s];
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

  /* ── Render ── */
  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Studio</Text>

      {/* Sessions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SESSIONS</Text>
          <TouchableOpacity onPress={() => setShowNewModal(true)} style={styles.addBtn}>
            <Ionicons name="add" size={20} color="#00e676" />
            <Text style={styles.addBtnText}>NEW</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={sessions}
          keyExtractor={i => i.id}
          renderItem={renderSessionItem}
          style={{ maxHeight: 180 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>No sessions — create one</Text>}
        />
      </View>

      {/* Active session */}
      {activeSession && (
        <View style={[styles.section, { flex: 1 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{activeSession.name.toUpperCase()}</Text>
            {soloTrackId && (
              <View style={styles.soloIndicator}>
                <View style={styles.soloDot} />
                <Text style={styles.soloLabel}>SOLO</Text>
              </View>
            )}
          </View>

          {/* Track list */}
          <FlatList
            data={activeSession.tracks}
            keyExtractor={t => t.id}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>Record the first track below</Text>}
            renderItem={({ item, index }) => (
              <TrackRow
                track={item}
                index={index}
                isSolo={soloTrackId === item.id}
                soloPos={soloPos}
                soloDur={soloDur}
                onSoloToggle={toggleSolo}
                onSeek={handleSoloSeek}
                onRename={(t) => { setRenameTarget({ type: 'track', id: t.id }); setRenameText(t.label); }}
                onDelete={(t) => deleteTrack(t.id)}
              />
            )}
          />

          {/* Controls */}
          {isRecording ? (
            <View style={styles.recordingRow}>
              <Animated.View style={[styles.recDot, { opacity: dotOpacity }]} />
              <Text style={styles.recDuration}>{fmt(recDuration)}</Text>
              <TouchableOpacity onPress={stopRecording} style={styles.stopBtn}>
                <Ionicons name="stop" size={22} color="#fff" />
                <Text style={styles.stopBtnText}>STOP REC</Text>
              </TouchableOpacity>
            </View>
          ) : (
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
          )}

          {activeSession.tracks.length > 0 && !isRecording && (
            <>
              {activeSession.tracks.length < MAX_TRACKS && (
                <Text style={styles.hintText}>
                  ▶ Existing tracks play in headphones while you record the next one
                </Text>
              )}
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
            </>
          )}
        </View>
      )}

      {/* New session modal */}
      <Modal visible={showNewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
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
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal visible={renameTarget !== null} transparent animationType="fade">
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
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => { setRenameTarget(null); setRenameText(''); }} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyRename} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export modal */}
      <Modal visible={showExport} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Export Tracks</Text>

            {/* Mix format selector */}
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

            {/* Mix-all row */}
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
            <FlatList
              data={activeSession?.tracks ?? []}
              keyExtractor={t => t.id}
              style={{ width: '100%', marginTop: 6 }}
              renderItem={({ item }) => {
                const busy = exportingId === item.id;
                return (
                  <TouchableOpacity
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
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>No tracks in this session</Text>}
            />
            <TouchableOpacity
              onPress={() => { setShowExport(false); setMixState('idle'); setMixHtml(null); }}
              style={[styles.modalCancelBtn, { marginTop: 14, alignSelf: 'center', paddingHorizontal: 32 }]}
            >
              <Text style={styles.modalCancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quality settings modal */}
      <Modal visible={showQuality} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Recording Quality</Text>
            <Text style={styles.exportHint}>Applies to all new tracks in this session</Text>
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
            {/* Latency compensation row */}
            <View style={{ marginTop: 16, borderTopWidth: 1, borderColor: '#1e1e28', paddingTop: 14 }}>
              <Text style={[styles.qualityName, { color: '#ccc', marginBottom: 2 }]}>Компенсация задержки (мс)</Text>
              <Text style={[styles.qualitySub, { marginBottom: 10 }]}>
                Android микрофон добавляет ~80-150мс задержки.{'\n'}
                Увеличьте если 2-я дорожка запаздывает, уменьшите если опережает.
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <TouchableOpacity onPress={() => savePreroll(Math.max(0, prerollMs - 20))}
                  style={{ width: 40, height: 40, backgroundColor: '#1e1e28', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26 }}>−</Text>
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', width: 60, textAlign: 'center' }}>{prerollMs}</Text>
                <TouchableOpacity onPress={() => savePreroll(Math.min(400, prerollMs + 20))}
                  style={{ width: 40, height: 40, backgroundColor: '#1e1e28', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26 }}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => savePreroll(DEFAULT_PREROLL_MS)}
                style={{ alignSelf: 'center', marginTop: 8 }}>
                <Text style={{ color: '#555', fontSize: 11 }}>сброс ({DEFAULT_PREROLL_MS}мс)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowQuality(false)}
              style={[styles.modalCancelBtn, { marginTop: 14, alignSelf: 'center', paddingHorizontal: 32 }]}
            >
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
  container: { flex: 1, backgroundColor: '#0a0a0f', paddingHorizontal: 16 },
  title: { color: '#888', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600', textAlign: 'center', marginBottom: 14 },

  section: { backgroundColor: '#111118', borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
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
  trackMid: { flex: 1 },
  trackLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackLabel: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  trackTime: { fontSize: 10, fontWeight: '600' },
  scrubTrack: { height: 3, backgroundColor: '#2a2a38', borderRadius: 2, marginTop: 6, overflow: 'visible', position: 'relative' },
  scrubFill: { height: 3, borderRadius: 2 },
  scrubThumb: { position: 'absolute', width: 12, height: 12, borderRadius: 6, top: -4.5, marginLeft: -6 },
  soloBtn: { padding: 2 },
  iconBtn: { padding: 5 },

  // Recording
  recordingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 10 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ff1744' },
  recDuration: { color: '#ff5252', fontSize: 22, fontWeight: '700', letterSpacing: 2, minWidth: 56 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ff1744', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18 },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 1 },

  controlRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  controlBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, backgroundColor: '#1e1e28', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a38' },
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
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a24', borderRadius: 12, padding: 13, marginTop: 8, borderWidth: 1, borderColor: '#2a2a38', width: '100%' },
  qualityRowActive: { borderColor: '#7c4dff44', backgroundColor: '#7c4dff10' },
  qualityName: { color: '#ccc', fontSize: 14, fontWeight: '700' },
  qualitySub:  { color: '#555', fontSize: 11, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#1a1a24', borderRadius: 20, padding: 24, width: '80%', borderWidth: 1, borderColor: '#2a2a38' },
  modalTitle: { color: '#ccc', fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#0d0d15', borderRadius: 12, padding: 12, color: '#e0e0e0', fontSize: 15, borderWidth: 1, borderColor: '#2a2a38', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#2a2a38', borderRadius: 12 },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#00e676', borderRadius: 12 },
  modalConfirmText: { color: '#0a0a0f', fontWeight: '700' },
});
