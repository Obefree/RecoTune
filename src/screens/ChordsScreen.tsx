import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

/* ─── Types ─── */
interface AuddResult {
  artist: string; title: string; album?: string;
  release_date?: string; song_link?: string;
}

/* ─── Chord colours ─── */
function chordColor(conf: number): string {
  if (conf > 2.5) return '#00e676';
  if (conf > 1.5) return '#ffeb3b';
  return '#ff5252';
}

/* ─── Chord tones from chord name ─── */
const NOTE_NAMES_FLAT = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CHORD_INTERVALS: Record<string, number[]> = {
  '':     [0,4,7],
  'm':    [0,3,7],
  '7':    [0,4,7,10],
  'maj7': [0,4,7,11],
  'm7':   [0,3,7,10],
  'dim':  [0,3,6],
  'aug':  [0,4,8],
  'sus2': [0,2,7],
  'sus4': [0,5,7],
};
function parseChordTones(chordName: string): string[] {
  if (!chordName || chordName === '?' || chordName === '—') return [];
  let rootIdx = -1;
  // Try 2-char root first (e.g. C#), then 1-char
  for (let len = 2; len >= 1; len--) {
    const candidate = chordName.slice(0, len);
    const idx = NOTE_NAMES_FLAT.indexOf(candidate);
    if (idx >= 0) { rootIdx = idx; break; }
  }
  if (rootIdx < 0) return [];
  const rootName = chordName.slice(0, rootIdx >= 0 && NOTE_NAMES_FLAT[rootIdx].length > 1 ? 2 : 1);
  const suffix   = chordName.slice(rootName.length);
  const intervals = CHORD_INTERVALS[suffix] ?? CHORD_INTERVALS[''];
  return intervals.map(iv => NOTE_NAMES_FLAT[(rootIdx + iv) % 12]);
}

/* ─── WebView HTML — chord detection + HPS pitch detection ─── */
const ENGINE_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#000"><script>
const NOTE=[' C','C#',' D','D#',' E',' F','F#',' G','G#',' A','A#',' B'];
const TEMPLATES={
  '':    [0,4,7],
  'm':   [0,3,7],
  '7':   [0,4,7,10],
  'maj7':[0,4,7,11],
  'm7':  [0,3,7,10],
  'dim': [0,3,6],
  'aug': [0,4,8],
  'sus2':[0,2,7],
  'sus4':[0,5,7],
};
const MAJOR_P=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_P=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
let ctx,analyser,src,smooth=new Float32Array(12),running=false;
function chroma(fft,sr,fftSz){
  const c=new Float32Array(12);const bHz=sr/fftSz;
  for(let i=1;i<fft.length;i++){
    const f=i*bHz;if(f<80||f>2200)continue;
    const db=fft[i];if(db<-65)continue;
    const e=Math.pow(10,db/20);
    const m=Math.round(12*Math.log2(f/440)+69);
    const pc=((m%12)+12)%12;c[pc]+=e;
  }
  const mx=Math.max(...c);if(mx>0)for(let i=0;i<12;i++)c[i]/=mx;return c;
}
function detectChord(c){
  let best={name:'?',conf:-Infinity};
  for(let r=0;r<12;r++){
    for(const[t,ivs]of Object.entries(TEMPLATES)){
      let sc=0;
      for(let i=0;i<12;i++){const ct=ivs.some(iv=>(r+iv)%12===i);sc+=ct?c[i]:-0.4*c[i];}
      if(sc>best.conf)best={name:NOTE[r].trim()+t,conf:sc};
    }
  }
  return best;
}
function estimateKey(c){
  let bk='',bs=-Infinity;
  for(let r=0;r<12;r++){
    let mj=0,mn=0;
    for(let i=0;i<12;i++){mj+=c[(i+r)%12]*MAJOR_P[i];mn+=c[(i+r)%12]*MINOR_P[i];}
    if(mj>bs){bs=mj;bk=NOTE[r].trim()+' major';}
    if(mn>bs){bs=mn;bk=NOTE[r].trim()+' minor';}
  }
  return bk;
}
function topNotes(c,n){
  return c.map((v,i)=>({n:NOTE[i].trim(),v})).sort((a,b)=>b.v-a.v).slice(0,n).filter(x=>x.v>0.25).map(x=>x.n);
}
function pitchHPS(fft,bHz,harmonics){
  const n=fft.length;
  const lin=new Float32Array(n);
  for(let i=0;i<n;i++)lin[i]=fft[i]>-100?Math.pow(10,fft[i]/20):0;
  const mx=Math.floor(n/harmonics);
  const hps=new Float32Array(mx);
  for(let i=0;i<mx;i++){hps[i]=lin[i];for(let h=2;h<=harmonics;h++)hps[i]*=(i*h<n?lin[i*h]:0);}
  const minB=Math.max(1,Math.ceil(70/bHz));
  const maxB=Math.min(mx-1,Math.floor(1100/bHz));
  let best=-1,bestV=0;
  for(let i=minB;i<=maxB;i++){if(hps[i]>bestV){bestV=hps[i];best=i;}}
  if(best<0||fft[best]<-50)return-1;
  return best*bHz;
}
async function start(){
  if(running)return;running=true;
  try{
    const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    ctx=new AudioContext();
    analyser=ctx.createAnalyser();
    analyser.fftSize=8192;analyser.smoothingTimeConstant=0.82;
    src=ctx.createMediaStreamSource(st);src.connect(analyser);
    const fft=new Float32Array(analyser.frequencyBinCount);
    const bHz=ctx.sampleRate/analyser.fftSize;
    const A=0.13;
    function loop(){
      if(!running)return;
      analyser.getFloatFrequencyData(fft);
      const c=chroma(fft,ctx.sampleRate,analyser.fftSize);
      for(let i=0;i<12;i++)smooth[i]=A*c[i]+(1-A)*smooth[i];
      const chord=detectChord(smooth);
      const key=estimateKey(smooth);
      const notes=topNotes(smooth,4);
      const pitchHz=pitchHPS(fft,bHz,4);
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'update',chord:chord.name,confidence:chord.conf,key,notes,pitchHz}));
      requestAnimationFrame(loop);
    }
    loop();
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
  }catch(e){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:e.message}));
  }
}
function stop(){
  running=false;
  try{if(src)src.disconnect();if(ctx)ctx.close();}catch{}
  smooth.fill(0);
}
document.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='start')start();else if(m.cmd==='stop')stop();}catch{}});
window.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='start')start();else if(m.cmd==='stop')stop();}catch{}});
</script></body></html>`;

const RECORDINGS_DIR = (FileSystem.documentDirectory ?? '') + 'recordings/';

type Mode = 'live' | 'practice' | 'identify';

export default function ChordsScreen() {
  const insets = useSafeAreaInsets();

  const [mode, setMode]               = useState<Mode>('live');
  const [liveActive, setLiveActive]   = useState(false);

  /* ── Chord state ── */
  const [chord, setChord]             = useState('—');
  const [confidence, setConfidence]   = useState(0);
  const [key, setKey]                 = useState('');
  const [notes, setNotes]             = useState<string[]>([]);
  const [history, setHistory]         = useState<string[]>([]);

  /* ── Voice pitch state ── */
  const [voiceNote, setVoiceNote]     = useState('—');
  const [voiceFreq, setVoiceFreq]     = useState(0);
  const [voiceCents, setVoiceCents]   = useState(0);

  /* ── Practice recording ── */
  const [isPracticeRec, setIsPracticeRec] = useState(false);
  const [practiceRecDur, setPracticeRecDur] = useState(0);
  const practiceRecRef = useRef<Audio.Recording | null>(null);
  const practiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Lyrics in practice ── */
  const [practiceLyrics, setPracticeLyrics] = useState('');

  /* ── Identify state ── */
  const [recSecs, setRecSecs]         = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [songResult, setSongResult]   = useState<AuddResult | null>(null);
  const [showChordBrowser, setShowChordBrowser] = useState(false);
  const [chordUrl, setChordUrl]       = useState('');
  const [ytUrl, setYtUrl]             = useState('');
  const [ytLoading, setYtLoading]     = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [identSource, setIdentSource] = useState<'mic' | 'file' | 'yt' | 'manual'>('mic');
  const [lyrics, setLyrics]           = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showFullLyrics, setShowFullLyrics] = useState(false);
  const [manualArtist, setManualArtist] = useState('');
  const [manualTitle, setManualTitle]   = useState('');

  const wvRef    = useRef<WebView>(null);
  const recRef   = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    return () => {
      stopLive();
      stopRec();
      stopPracticeRec();
    };
  }, []));

  function sendCmd(cmd: string) {
    wvRef.current?.injectJavaScript(`
      (function(){window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({cmd:'${cmd}'})}));})();true;
    `);
  }

  function startLive() {
    setLiveActive(true);
    setChord('—'); setKey(''); setNotes([]); setHistory([]);
    setVoiceNote('—'); setVoiceFreq(0); setVoiceCents(0);
    setTimeout(() => sendCmd('start'), 300);
  }
  function stopLive() {
    setLiveActive(false);
    sendCmd('stop');
  }

  function handleWVMessage(e: any) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'update') {
        setChord(msg.chord);
        setConfidence(msg.confidence);
        setKey(msg.key);
        setNotes(msg.notes ?? []);
        setHistory(prev => {
          const last = prev[prev.length - 1];
          if (msg.chord !== last && msg.chord !== '?') {
            const next = [...prev, msg.chord];
            return next.length > 14 ? next.slice(-14) : next;
          }
          return prev;
        });
        // Voice pitch (used in practice mode)
        if (msg.pitchHz > 0) {
          const midi = Math.round(12 * Math.log2(msg.pitchHz / 440) + 69);
          const noteIdx = ((midi % 12) + 12) % 12;
          const octave = Math.floor(midi / 12) - 1;
          setVoiceNote(NOTE_NAMES_FLAT[noteIdx] + octave);
          setVoiceFreq(Math.round(msg.pitchHz));
          // Cents from nearest semitone
          const exactMidi = 12 * Math.log2(msg.pitchHz / 440) + 69;
          setVoiceCents(Math.round((exactMidi - midi) * 100));
        } else {
          setVoiceNote('—'); setVoiceFreq(0); setVoiceCents(0);
        }
      }
    } catch {}
  }

  /* ── Practice recording ── */
  async function startPracticeRec() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Нет доступа к микрофону'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      practiceRecRef.current = rec;
      setIsPracticeRec(true);
      setPracticeRecDur(0);
      let s = 0;
      practiceTimerRef.current = setInterval(() => { s++; setPracticeRecDur(s); }, 1000);
    } catch (e) {
      Alert.alert('Ошибка записи', String(e));
    }
  }

  async function stopPracticeRec() {
    if (practiceTimerRef.current) clearInterval(practiceTimerRef.current);
    setIsPracticeRec(false);
    const rec = practiceRecRef.current;
    practiceRecRef.current = null;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return;
      const name = `practice_${Date.now()}.m4a`;
      const dest = RECORDINGS_DIR + name;
      await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
      await FileSystem.copyAsync({ from: uri, to: dest });
      Alert.alert('Записано!', `Сохранено: ${name}`);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (e) {
      Alert.alert('Ошибка сохранения', String(e));
    }
  }

  /* ── Identify ── */
  async function startIdentify() {
    if (isRecognizing) return;
    setSongResult(null); setShowChordBrowser(false);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Нет доступа к микрофону'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recRef.current = rec;
      setIsRecognizing(true); setRecSecs(0);
      let s = 0;
      timerRef.current = setInterval(() => {
        s++; setRecSecs(s);
        if (s >= 10) { if (timerRef.current) clearInterval(timerRef.current); finishIdentify(rec); }
      }, 1000);
    } catch (e) {
      Alert.alert('Ошибка записи', String(e));
      setIsRecognizing(false);
    }
  }

  async function stopRec() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recRef.current) {
      try { await recRef.current.stopAndUnloadAsync(); } catch {}
      recRef.current = null;
    }
  }

  async function finishIdentify(rec: Audio.Recording) {
    try {
      await rec.stopAndUnloadAsync(); recRef.current = null;
      const uri = rec.getURI();
      if (!uri) throw new Error('No recording URI');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const form = new FormData();
      (form as any).append('api_token', 'test');
      (form as any).append('audio', base64);
      (form as any).append('return', 'timecode');
      const res  = await fetch('https://api.audd.io/', { method: 'POST', body: form as any });
      const data = await res.json();
      if (data.status === 'success' && data.result) {
        setResultAndFetch(data.result as AuddResult);
      } else {
        Alert.alert('Не распознано', 'Попробуйте ещё раз или дольше держите инструмент у микрофона.');
      }
    } catch (e) { Alert.alert('Ошибка распознавания', String(e)); }
    setIsRecognizing(false); setRecSecs(0);
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
  }

  async function fetchLyrics(artist: string, title: string) {
    setLyrics(null); setLyricsLoading(true);
    try {
      const res  = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
      const data = await res.json();
      if (!data.error && data.lyrics) {
        const lyr = data.lyrics.trim();
        setLyrics(lyr);
        setPracticeLyrics(lyr);
      }
    } catch {}
    setLyricsLoading(false);
  }

  function setResultAndFetch(r: AuddResult) {
    setSongResult(r);
    fetchLyrics(r.artist, r.title);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 200);
  }

  function openChords(artist: string, title: string) {
    const q = encodeURIComponent(`${artist} ${title}`);
    setChordUrl(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${q}`);
    setShowChordBrowser(true);
  }

  async function pickFileAndIdentify() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (result.canceled) return;
      setFileLoading(true); setSongResult(null);
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const form = new FormData();
      (form as any).append('api_token', 'test');
      (form as any).append('audio', base64);
      const res  = await fetch('https://api.audd.io/', { method: 'POST', body: form as any });
      const data = await res.json();
      if (data.status === 'success' && data.result) {
        setResultAndFetch(data.result as AuddResult);
      } else {
        Alert.alert('Не распознано', 'Попробуйте другой файл или введите название вручную.');
      }
    } catch (e) { Alert.alert('Ошибка', String(e)); }
    setFileLoading(false);
  }

  async function handleYouTube() {
    const url = ytUrl.trim();
    if (!url) return;
    setYtLoading(true);
    try {
      const match = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (!match) throw new Error('Не удалось найти ID видео.');
      const videoId = match[1];
      const oembed = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (!oembed.ok) throw new Error('Видео не найдено');
      const info   = await oembed.json();
      setResultAndFetch({ title: info.title, artist: (info.author_name as string).replace(/\s*-\s*Topic$/, '') });
    } catch (e) { Alert.alert('Ошибка YouTube', String(e)); }
    setYtLoading(false);
  }

  function handleManualSearch() {
    const a = manualArtist.trim(), t = manualTitle.trim();
    if (!a && !t) return;
    setResultAndFetch({ artist: a || 'Unknown', title: t || 'Unknown' });
  }

  /* ── Practice chord progression ── */
  const [practiceInput, setPracticeInput]     = useState('Am F C G');
  const [practiceChords, setPracticeChords]   = useState<string[]>(['Am','F','C','G']);
  const [practiceChordIdx, setPracticeChordIdx] = useState(0);
  const [pitchActive, setPitchActive]         = useState(false);

  function parsePracticeInput(text: string) {
    const chords = text.trim().split(/[\s,|/]+/).filter(Boolean);
    if (chords.length > 0) {
      setPracticeChords(chords);
      setPracticeChordIdx(0);
    }
  }

  function practiceNext() {
    setPracticeChordIdx(i => Math.min(i + 1, practiceChords.length - 1));
  }
  function practicePrev() {
    setPracticeChordIdx(i => Math.max(i - 1, 0));
  }

  function startPitchDetection() {
    setPitchActive(true);
    setVoiceNote('—'); setVoiceFreq(0); setVoiceCents(0);
    setTimeout(() => sendCmd('start'), 300);
  }
  function stopPitchDetection() {
    setPitchActive(false);
    sendCmd('stop');
  }

  /* ── Switch mode helper ── */
  function switchMode(m: Mode) {
    if (liveActive) stopLive();
    if (pitchActive) stopPitchDetection();
    setMode(m);
    if (m === 'live') {
      setChord('—'); setKey(''); setNotes([]); setHistory([]);
      setVoiceNote('—'); setVoiceFreq(0); setVoiceCents(0);
      setTimeout(() => sendCmd('start'), 350);
      setLiveActive(true);
    }
  }

  /* ── Practice: voice vs manually-selected chord ── */
  const practiceCurrentChord = practiceChords[practiceChordIdx] ?? '—';
  const chordTones    = parseChordTones(practiceCurrentChord);
  const voiceNoteBase = voiceNote.replace(/\d/, '');
  const voiceInChord  = chordTones.includes(voiceNoteBase);

  // Cents deviation display (clamp ±50)
  const centsClamped = Math.max(-50, Math.min(50, voiceCents));
  const centsBarPct  = ((centsClamped + 50) / 100) * 100;

  const col = chordColor(confidence);

  if (showChordBrowser && chordUrl) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.browserHeader}>
          <TouchableOpacity onPress={() => setShowChordBrowser(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#ccc" />
            <Text style={styles.backText}>Назад</Text>
          </TouchableOpacity>
          <Text style={styles.browserTitle} numberOfLines={1}>Поиск аккордов</Text>
        </View>
        <WebView source={{ uri: chordUrl }} style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>CHORDS</Text>
        <View style={styles.modePills}>
          {(['live','practice','identify'] as Mode[]).map(m => {
            const labels: Record<Mode,string>   = { live:'LIVE', practice:'ПРАКТИКА', identify:'НАЙТИ' };
            const icons:  Record<Mode,any>      = { live:'mic', practice:'person', identify:'search' };
            return (
              <TouchableOpacity
                key={m}
                style={[styles.pill, mode === m && styles.pillActive]}
                onPress={() => switchMode(m)}
              >
                <Ionicons name={icons[m]} size={12} color={mode === m ? '#0a0a0f' : '#555'} />
                <Text style={[styles.pillText, mode === m && styles.pillTextActive]}>{labels[m]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── LIVE MODE ── */}
      {mode === 'live' && (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={styles.chordCard}>
            <Text style={[styles.chordBig, { color: col }]}>{chord}</Text>
            <Text style={styles.chordKey}>{key || (liveActive ? 'Анализ...' : 'Нажмите Start')}</Text>
            {notes.length > 0 && (
              <View style={styles.notesRow}>
                {notes.map((n, i) => (
                  <View key={i} style={styles.notePill}>
                    <Text style={styles.noteText}>{n}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.confRow}>
              <Text style={styles.confLabel}>Точность</Text>
              <View style={styles.confTrack}>
                <View style={[styles.confBar, {
                  width: `${Math.min(100, Math.max(0, (confidence / 4) * 100))}%`,
                  backgroundColor: col,
                }]} />
              </View>
            </View>
          </View>

          {history.length > 0 && (
            <View style={styles.histWrap}>
              <Text style={styles.histLabel}>ИСТОРИЯ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={styles.histRow}>
                  {history.map((c, i) => (
                    <View key={i} style={[styles.histPill, i === history.length - 1 && styles.histPillActive]}>
                      <Text style={[styles.histPillText, i === history.length - 1 && { color: '#00e676' }]}>{c}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.mainBtn, liveActive && styles.mainBtnStop]}
            onPress={liveActive ? stopLive : startLive}
            activeOpacity={0.8}
          >
            <Ionicons name={liveActive ? 'stop-circle' : 'mic-circle'} size={28} color="#fff" />
            <Text style={styles.mainBtnText}>{liveActive ? 'STOP' : 'START'}</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Играйте аккорды на гитаре рядом с микрофоном.{'\n'}
            Алгоритм: хромаграмма + шаблонное сопоставление.
          </Text>
        </ScrollView>
      )}

      {/* ── PRACTICE MODE ── */}
      {mode === 'practice' && (
        <View style={{ flex: 1 }}>

          {/* ① Chord progression input */}
          <View style={styles.progInput}>
            <TextInput
              style={styles.progTextField}
              value={practiceInput}
              onChangeText={setPracticeInput}
              placeholder="Am F C G Em7 Dm..."
              placeholderTextColor="#333"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => parsePracticeInput(practiceInput)}
            />
            <TouchableOpacity style={styles.progParseBtn} onPress={() => parsePracticeInput(practiceInput)}>
              <Text style={styles.progParseBtnText}>OK</Text>
            </TouchableOpacity>
            {lyrics && (
              <TouchableOpacity style={styles.progImportBtn} onPress={() => setPracticeLyrics(lyrics)}>
                <Ionicons name="document-text-outline" size={16} color="#ff9800" />
              </TouchableOpacity>
            )}
          </View>

          {/* ② Chord navigation */}
          <View style={styles.chordNav}>
            <TouchableOpacity onPress={practicePrev} style={styles.chordNavArrow} disabled={practiceChordIdx <= 0}>
              <Ionicons name="chevron-back" size={26} color={practiceChordIdx > 0 ? '#ccc' : '#222'} />
            </TouchableOpacity>

            {/* Chord pills — scrollable, tappable */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chordPillsScroll}
              contentContainerStyle={styles.chordPillsRow}>
              {practiceChords.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chordPill, i === practiceChordIdx && styles.chordPillActive]}
                  onPress={() => setPracticeChordIdx(i)}
                >
                  <Text style={[styles.chordPillText, i === practiceChordIdx && { color: '#ff9800', fontSize: 18 }]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity onPress={practiceNext} style={styles.chordNavArrow}
              disabled={practiceChordIdx >= practiceChords.length - 1}>
              <Ionicons name="chevron-forward" size={26}
                color={practiceChordIdx < practiceChords.length - 1 ? '#ccc' : '#222'} />
            </TouchableOpacity>
          </View>

          {/* ③ Voice pitch panel */}
          <View style={styles.voicePanel}>
            <View style={styles.voiceLeft}>
              <Text style={styles.voiceLabel}>ГОЛОС</Text>
              <Text style={[styles.voiceNote,
                { color: voiceNote === '—' ? '#333' : voiceInChord ? '#00e676' : '#ff9800' }]}>
                {voiceNote}
              </Text>
              {voiceFreq > 0 && <Text style={styles.voiceHz}>{voiceFreq} Hz</Text>}
            </View>

            <View style={styles.voiceMid}>
              <Text style={styles.chordTonesLabel}>НОТЫ АККОРДА {practiceCurrentChord}</Text>
              <View style={styles.chordTonesRow}>
                {chordTones.length > 0
                  ? chordTones.map((n, i) => (
                      <View key={i} style={[styles.chordTonePill, n === voiceNoteBase && styles.chordTonePillActive]}>
                        <Text style={[styles.chordToneText, n === voiceNoteBase && { color: '#00e676' }]}>{n}</Text>
                      </View>
                    ))
                  : <Text style={styles.chordTonesEmpty}>введите аккорды выше</Text>
                }
              </View>
              {voiceFreq > 0 && (
                <View style={styles.centsWrap}>
                  <Text style={styles.centsEdge}>−50</Text>
                  <View style={styles.centsTrack}>
                    <View style={styles.centsMid} />
                    <View style={[styles.centsThumb, { left: `${centsBarPct}%` as any }]} />
                  </View>
                  <Text style={styles.centsEdge}>+50</Text>
                  <Text style={[styles.centsVal, { color: Math.abs(voiceCents) < 10 ? '#00e676' : '#ffeb3b' }]}>
                    {voiceCents > 0 ? '+' : ''}{voiceCents}¢
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.voiceRight}>
              {voiceNote !== '—' && (
                <Ionicons
                  name={voiceInChord ? 'checkmark-circle' : 'alert-circle'}
                  size={28}
                  color={voiceInChord ? '#00e676' : '#ff9800'}
                />
              )}
            </View>
          </View>

          {/* ④ Lyrics */}
          <View style={styles.lyricsPanel}>
            <View style={styles.lyricsPanelHeader}>
              <Text style={styles.lyricsPanelTitle}>ТЕКСТ</Text>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.lyricsInput}
                multiline
                placeholder="Вставьте текст песни здесь (или нажмите 📄 вверху после поиска)..."
                placeholderTextColor="#333"
                value={practiceLyrics}
                onChangeText={setPracticeLyrics}
                scrollEnabled={false}
              />
            </ScrollView>
          </View>

          {/* ⑤ Bottom toolbar */}
          <View style={styles.practiceToolbar}>
            <TouchableOpacity
              style={[styles.mainBtn, pitchActive && styles.mainBtnStop, { flex: 1 }]}
              onPress={pitchActive ? stopPitchDetection : startPitchDetection}
              activeOpacity={0.8}
            >
              <Ionicons name={pitchActive ? 'stop-circle' : 'mic-circle'} size={22} color="#fff" />
              <Text style={styles.mainBtnText}>{pitchActive ? 'ВЫКЛ. МИК' : 'ВКЛ. МИК (ГОЛОС)'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.recBtn, isPracticeRec && styles.recBtnActive]}
              onPress={isPracticeRec ? stopPracticeRec : startPracticeRec}
              activeOpacity={0.8}
            >
              <View style={[styles.recDot, isPracticeRec && styles.recDotActive]} />
              <Text style={[styles.recBtnText, isPracticeRec && { color: '#ff5252' }]}>
                {isPracticeRec
                  ? `${Math.floor(practiceRecDur/60)}:${(practiceRecDur%60).toString().padStart(2,'0')}`
                  : 'REC'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── IDENTIFY MODE ── */}
      {mode === 'identify' && (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 14, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Result */}
          {songResult && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#00e676" />
                <Text style={styles.resultFound}>НАЙДЕНО</Text>
                <TouchableOpacity onPress={() => { setSongResult(null); setLyrics(null); }} style={{ marginLeft: 'auto' as any }}>
                  <Ionicons name="close" size={18} color="#444" />
                </TouchableOpacity>
              </View>
              <Text style={styles.resultTitle}>{songResult.title}</Text>
              <Text style={styles.resultArtist}>{songResult.artist}</Text>
              {songResult.album && (
                <Text style={styles.resultMeta}>{songResult.album}{songResult.release_date ? ` · ${songResult.release_date.slice(0,4)}` : ''}</Text>
              )}
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.chordsBtn} onPress={() => openChords(songResult.artist, songResult.title)}>
                  <Ionicons name="musical-note" size={15} color="#fff" />
                  <Text style={styles.chordsBtnText}>Аккорды (UG)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chordsBtn, { backgroundColor: '#ff980022', borderColor: '#ff980044' }]}
                  onPress={() => { switchMode('practice'); }}>
                  <Ionicons name="person" size={15} color="#ff9800" />
                  <Text style={[styles.chordsBtnText, { color: '#ff9800' }]}>В Практику</Text>
                </TouchableOpacity>
                {songResult.song_link ? (
                  <TouchableOpacity style={[styles.chordsBtn, { backgroundColor: '#1db95422', borderColor: '#1db95444' }]}
                    onPress={() => { setChordUrl(songResult.song_link!); setShowChordBrowser(true); }}>
                    <Ionicons name="link" size={15} color="#1db954" />
                    <Text style={[styles.chordsBtnText, { color: '#1db954' }]}>Открыть</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.lyricsWrap}>
                <View style={styles.lyricsHeader}>
                  <Text style={styles.lyricsLabel}>ТЕКСТ ПЕСНИ</Text>
                  {lyrics && (
                    <TouchableOpacity onPress={() => setShowFullLyrics(v => !v)}>
                      <Text style={styles.lyricsToggle}>{showFullLyrics ? 'Свернуть' : 'Развернуть'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {lyricsLoading ? (
                  <ActivityIndicator color="#555" size="small" style={{ marginTop: 8 }} />
                ) : lyrics ? (
                  <Text style={styles.lyricsText} numberOfLines={showFullLyrics ? undefined : 8}>{lyrics}</Text>
                ) : (
                  <Text style={styles.lyricsEmpty}>Текст не найден</Text>
                )}
              </View>
            </View>
          )}

          {/* Source selector */}
          <View style={styles.sourceRow}>
            {([
              ['mic','ear','Слушать'],['file','document','Файл'],
              ['yt','logo-youtube','YouTube'],['manual','create','Вручную'],
            ] as const).map(([src, icon, label]) => (
              <TouchableOpacity key={src}
                style={[styles.srcBtn, identSource === src && styles.srcBtnActive]}
                onPress={() => setIdentSource(src)}>
                <Ionicons name={icon as any} size={15} color={identSource === src ? '#0a0a0f' : '#555'} />
                <Text style={[styles.srcLabel, identSource === src && { color: '#0a0a0f' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {identSource === 'mic' && (
            <View style={styles.identCard}>
              <Text style={styles.identSub}>Поднесите телефон к колонке — запись 10 с → отправка в AudD.</Text>
              {isRecognizing ? (
                <View style={styles.recProgress}>
                  <ActivityIndicator color="#7c4dff" size="large" />
                  <Text style={styles.recSecs}>{recSecs} / 10 с</Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { if (timerRef.current) clearInterval(timerRef.current); stopRec(); setIsRecognizing(false); }}>
                    <Text style={styles.cancelText}>Отмена</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.identBtn} onPress={startIdentify} activeOpacity={0.8}>
                  <Ionicons name="ear" size={22} color="#fff" />
                  <Text style={styles.identBtnText}>СЛУШАТЬ И РАСПОЗНАТЬ</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {identSource === 'file' && (
            <View style={styles.identCard}>
              <Text style={styles.identSub}>Выберите MP3, AAC, WAV с устройства — отправка в AudD.</Text>
              {fileLoading ? (
                <View style={styles.recProgress}>
                  <ActivityIndicator color="#7c4dff" size="large" />
                  <Text style={styles.recSecs}>Распознавание...</Text>
                </View>
              ) : (
                <TouchableOpacity style={[styles.identBtn, { backgroundColor: '#ff980099' }]} onPress={pickFileAndIdentify} activeOpacity={0.8}>
                  <Ionicons name="folder-open" size={22} color="#fff" />
                  <Text style={styles.identBtnText}>ВЫБРАТЬ ФАЙЛ</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {identSource === 'yt' && (
            <View style={styles.identCard}>
              <Text style={styles.identSub}>Вставьте ссылку YouTube — получим название и текст.</Text>
              <TextInput style={styles.urlInput} placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor="#333" value={ytUrl} onChangeText={setYtUrl}
                autoCapitalize="none" autoCorrect={false} keyboardType="url"
                returnKeyType="search" onSubmitEditing={handleYouTube} />
              {ytLoading ? <ActivityIndicator color="#ff0000" style={{ marginTop: 10 }} /> : (
                <TouchableOpacity style={[styles.identBtn, { backgroundColor: '#cc000099' }]} onPress={handleYouTube} activeOpacity={0.8}>
                  <Ionicons name="logo-youtube" size={22} color="#fff" />
                  <Text style={styles.identBtnText}>НАЙТИ ПО ССЫЛКЕ</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {identSource === 'manual' && (
            <View style={styles.identCard}>
              <Text style={styles.identSub}>Введите исполнителя и название — найдём текст и аккорды.</Text>
              <TextInput style={styles.urlInput} placeholder="Исполнитель (напр. The Beatles)"
                placeholderTextColor="#333" value={manualArtist} onChangeText={setManualArtist}
                autoCorrect={false} returnKeyType="next" />
              <TextInput style={[styles.urlInput, { marginTop: 8 }]} placeholder="Название трека"
                placeholderTextColor="#333" value={manualTitle} onChangeText={setManualTitle}
                autoCorrect={false} returnKeyType="search" onSubmitEditing={handleManualSearch} />
              <TouchableOpacity style={[styles.identBtn, { marginTop: 8 }]} onPress={handleManualSearch} activeOpacity={0.8}>
                <Ionicons name="search" size={22} color="#fff" />
                <Text style={styles.identBtnText}>НАЙТИ ТЕКСТ И АККОРДЫ</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.hint}>
            Текст: lyrics.ovh (бесплатно) · Аккорды: Ultimate Guitar{'\n'}
            AudD: ~100 распознаваний/день бесплатно
          </Text>
        </ScrollView>
      )}

      {/* Hidden engine WebView */}
      <WebView
        ref={wvRef}
        source={{ html: ENGINE_HTML }}
        style={styles.hiddenWV}
        onMessage={handleWVMessage}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a0f' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  title:      { color: '#888', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  modePills:  { flexDirection: 'row', gap: 5 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  pillActive: { backgroundColor: '#ff9800', borderColor: '#ff9800' },
  pillText:   { color: '#555', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  pillTextActive: { color: '#0a0a0f' },
  hiddenWV:   { position: 'absolute', width: 1, height: 1, opacity: 0 },

  /* Live mode */
  chordCard:  { backgroundColor: '#111118', borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#1e1e28', gap: 8 },
  chordBig:   { fontSize: 72, fontWeight: '900', letterSpacing: -2 },
  chordKey:   { color: '#444', fontSize: 13, letterSpacing: 1 },
  notesRow:   { flexDirection: 'row', gap: 6, marginTop: 4 },
  notePill:   { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1e1e28', borderRadius: 12 },
  noteText:   { color: '#888', fontSize: 13, fontWeight: '700' },
  confRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: 4 },
  confLabel:  { color: '#333', fontSize: 9, width: 50, letterSpacing: 1 },
  confTrack:  { flex: 1, height: 3, backgroundColor: '#1e1e28', borderRadius: 2 },
  confBar:    { height: 3, borderRadius: 2 },
  histWrap:   { backgroundColor: '#111118', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e1e28' },
  histLabel:  { color: '#333', fontSize: 9, letterSpacing: 2 },
  histStrip:  { paddingHorizontal: 12, paddingVertical: 4 },
  histRow:    { flexDirection: 'row', gap: 6 },
  histPill:   { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1a1a24', borderRadius: 10 },
  histPillActive: { backgroundColor: '#00e67622', borderWidth: 1, borderColor: '#00e67655' },
  histPillText:   { color: '#555', fontSize: 13, fontWeight: '700' },
  mainBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#00e67688', borderRadius: 14, padding: 14 },
  mainBtnStop:{ backgroundColor: '#ff525288' },
  mainBtnText:{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  hint:       { color: '#333', fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 4 },

  /* Practice mode — chord input */
  progInput:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#1e1e28', backgroundColor: '#0d0d14' },
  progTextField: { flex: 1, backgroundColor: '#1a1a24', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, color: '#ccc', fontSize: 14, borderWidth: 1, borderColor: '#2a2a3a' },
  progParseBtn:  { backgroundColor: '#ff9800', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  progParseBtnText: { color: '#000', fontWeight: '800', fontSize: 12 },
  progImportBtn: { padding: 6 },

  /* Chord navigation */
  chordNav:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', borderBottomWidth: 1, borderColor: '#1e1e28', paddingVertical: 6 },
  chordNavArrow:   { padding: 10 },
  chordPillsScroll:{ flex: 1 },
  chordPillsRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  chordPill:       { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1a1a24', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a3a' },
  chordPillActive: { backgroundColor: '#ff980022', borderColor: '#ff9800' },
  chordPillText:   { color: '#666', fontSize: 14, fontWeight: '700' },

  /* Practice mode */
  voicePanel: { flexDirection: 'row', backgroundColor: '#111118', borderBottomWidth: 1, borderColor: '#1e1e28', padding: 10, gap: 10, alignItems: 'center' },
  voiceLeft:  { alignItems: 'center', minWidth: 60 },
  voiceLabel: { color: '#333', fontSize: 8, letterSpacing: 2, marginBottom: 2 },
  voiceNote:  { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  voiceHz:    { color: '#444', fontSize: 9 },
  voiceMid:   { flex: 1 },
  chordTonesLabel: { color: '#444', fontSize: 9, letterSpacing: 1, marginBottom: 4 },
  chordTonesRow:   { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginBottom: 4 },
  chordTonePill:   { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#1a1a24', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a3a' },
  chordTonePillActive: { backgroundColor: '#00e67622', borderColor: '#00e67655' },
  chordToneText:   { color: '#666', fontSize: 12, fontWeight: '700' },
  chordTonesEmpty: { color: '#333', fontSize: 12 },
  centsWrap:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  centsEdge:  { color: '#333', fontSize: 8, width: 18 },
  centsTrack: { flex: 1, height: 6, backgroundColor: '#1a1a24', borderRadius: 3, position: 'relative' },
  centsMid:   { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#333' },
  centsThumb: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff9800', marginLeft: -6 },
  centsVal:   { color: '#888', fontSize: 9, width: 32, textAlign: 'right' },
  voiceRight: { alignItems: 'center', justifyContent: 'center', width: 36 },

  lyricsPanel: { flex: 1, backgroundColor: '#0d0d14', margin: 8, borderRadius: 14, borderWidth: 1, borderColor: '#1e1e28', overflow: 'hidden' },
  lyricsPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, borderBottomWidth: 1, borderColor: '#1a1a24' },
  lyricsPanelTitle: { color: '#333', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  lyricsImportBtn:  { color: '#ff9800', fontSize: 10 },
  lyricsInput: { color: '#bbb', fontSize: 13, lineHeight: 22, padding: 12, minHeight: 80 },

  practiceToolbar: { flexDirection: 'row', gap: 8, padding: 10, paddingBottom: 12, borderTopWidth: 1, borderColor: '#1a1a24' },
  recBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a24', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#2a2a3a' },
  recBtnActive:{ borderColor: '#ff525244', backgroundColor: '#ff525211' },
  recBtnText:  { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  recDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#555' },
  recDotActive:{ backgroundColor: '#ff5252' },

  /* Identify mode */
  resultCard: { backgroundColor: '#111118', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#00e67633', gap: 4 },
  resultHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  resultFound: { color: '#00e676', fontSize: 10, fontWeight: '800', letterSpacing: 2, flex: 1 },
  resultTitle: { color: '#e0e0e0', fontSize: 18, fontWeight: '800' },
  resultArtist:{ color: '#888', fontSize: 13 },
  resultMeta:  { color: '#444', fontSize: 11 },
  resultActions:{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  chordsBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7c4dff44', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#7c4dff55' },
  chordsBtnText:{ color: '#ccc', fontSize: 11, fontWeight: '700' },
  lyricsWrap:  { marginTop: 8, borderTopWidth: 1, borderColor: '#1e1e28', paddingTop: 8 },
  lyricsHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  lyricsLabel: { color: '#333', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  lyricsToggle:{ color: '#7c4dff', fontSize: 11 },
  lyricsText:  { color: '#888', fontSize: 12, lineHeight: 20 },
  lyricsEmpty: { color: '#333', fontSize: 12, fontStyle: 'italic' },
  sourceRow:   { flexDirection: 'row', gap: 4 },
  srcBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: '#111118', borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#1e1e28' },
  srcBtnActive:{ backgroundColor: '#ff9800', borderColor: '#ff9800' },
  srcLabel:    { color: '#555', fontSize: 9, fontWeight: '700' },
  identCard:   { backgroundColor: '#111118', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e1e28', gap: 10 },
  identSub:    { color: '#555', fontSize: 12, lineHeight: 18 },
  recProgress: { alignItems: 'center', gap: 10 },
  recSecs:     { color: '#7c4dff', fontSize: 20, fontWeight: '800' },
  recNote:     { color: '#555', fontSize: 12 },
  cancelBtn:   { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a1a24', borderRadius: 10 },
  cancelText:  { color: '#888', fontSize: 13 },
  identBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7c4dff88', borderRadius: 12, padding: 12 },
  identBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  urlInput:    { backgroundColor: '#1a1a24', borderRadius: 10, padding: 10, color: '#ccc', fontSize: 13, borderWidth: 1, borderColor: '#2a2a3a' },

  /* Browser */
  browserHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderColor: '#1e1e28' },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:     { color: '#ccc', fontSize: 14 },
  browserTitle: { flex: 1, color: '#888', fontSize: 12, letterSpacing: 1 },
});
