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

/* ─── Guitar chord fingering database ─────────────────────────────────────
 * frets[i] → string order: E6 A5 D4 G3 B2 e1
 * -1 = muted, 0 = open, N = fret number
 * barre = fret number of barre bar (if any)
 * ─────────────────────────────────────────────────────────────────────── */
const CHORD_DB: Record<string, { frets: number[]; barre?: number }> = {
  'C':    { frets: [-1,3,2,0,1,0] },    'Cm':   { frets: [-1,3,5,5,4,3], barre:3 },
  'C7':   { frets: [-1,3,2,3,1,0] },    'Cmaj7':{ frets: [-1,3,2,0,0,0] },
  'Cadd9':{ frets: [-1,3,2,0,3,3] },    'Csus2':{ frets: [-1,3,0,0,1,3] },
  'D':    { frets: [-1,-1,0,2,3,2] },   'Dm':   { frets: [-1,-1,0,2,3,1] },
  'D7':   { frets: [-1,-1,0,2,1,2] },   'Dmaj7':{ frets: [-1,-1,0,2,2,2] },
  'Dsus2':{ frets: [-1,-1,0,2,3,0] },   'Dsus4':{ frets: [-1,-1,0,2,3,3] },
  'E':    { frets: [0,2,2,1,0,0] },     'Em':   { frets: [0,2,2,0,0,0] },
  'E7':   { frets: [0,2,0,1,0,0] },     'Emaj7':{ frets: [0,2,1,1,0,0] },
  'F':    { frets: [1,3,3,2,1,1], barre:1 }, 'Fm': { frets: [1,3,3,1,1,1], barre:1 },
  'F7':   { frets: [1,3,1,2,1,1], barre:1 }, 'Fmaj7':{ frets: [-1,-1,3,2,1,0] },
  'G':    { frets: [3,2,0,0,0,3] },     'Gm':   { frets: [3,5,5,3,3,3], barre:3 },
  'G7':   { frets: [3,2,0,0,0,1] },     'Gmaj7':{ frets: [3,2,0,0,0,2] },
  'A':    { frets: [-1,0,2,2,2,0] },    'Am':   { frets: [-1,0,2,2,1,0] },
  'A7':   { frets: [-1,0,2,0,2,0] },    'Amaj7':{ frets: [-1,0,2,1,2,0] },
  'Asus2':{ frets: [-1,0,2,2,0,0] },    'Asus4':{ frets: [-1,0,2,2,3,0] },
  'B':    { frets: [-1,2,4,4,4,2], barre:2 }, 'Bm':  { frets: [-1,2,4,4,3,2], barre:2 },
  'B7':   { frets: [-1,2,1,2,0,2] },    'Bmaj7':{ frets: [-1,2,4,3,4,2], barre:2 },
  'Bb':   { frets: [-1,1,3,3,3,1], barre:1 }, 'Bbm': { frets: [-1,1,3,3,2,1], barre:1 },
  'F#m':  { frets: [2,4,4,2,2,2], barre:2 }, 'C#m': { frets: [-1,4,6,6,5,4], barre:4 },
  'G#m':  { frets: [4,6,6,4,4,4], barre:4 }, 'D#m': { frets: [-1,6,8,8,7,6], barre:6 },
  'Am7':  { frets: [-1,0,2,0,1,0] },    'Em7':  { frets: [0,2,2,0,3,0] },
  'Dm7':  { frets: [-1,-1,0,2,1,1] },   'Bm7':  { frets: [-1,2,4,2,3,2], barre:2 },
  'Cm7':  { frets: [-1,3,5,3,4,3], barre:3 }, 'Fm7': { frets: [1,3,1,1,1,1], barre:1 },
};

/* ─── Guitar chord diagram component ─── */
function ChordDiagram({ name }: { name: string }) {
  const def = CHORD_DB[name] ?? null;
  const S = 6; const NF = 4;
  const G = 14; const FH = 18;
  const PL = 10; const PT = 16;
  const W = (S - 1) * G + PL * 2;
  const H = NF * FH + PT + 10;

  if (!def) {
    return (
      <View style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#2a2a3a', fontSize: 20, fontWeight: '900' }}>?</Text>
      </View>
    );
  }
  const { frets, barre } = def;
  const fNums = frets.filter(f => f > 0);
  const minF = fNums.length ? Math.min(...fNums) : 1;
  const base = barre != null ? barre : (minF > 3 ? minF - 1 : 1);
  const showNum = base > 1;
  const gx = (si: number) => PL + si * G;
  const gy = (fi: number) => PT + fi * FH;

  return (
    <View style={{ width: W, height: H }}>
      {/* Nut line */}
      {!showNum && (
        <View style={{ position:'absolute', left:PL, top:PT, width:(S-1)*G, height:3, backgroundColor:'#666', borderRadius:2 }} />
      )}
      {showNum && (
        <Text style={{ position:'absolute', right:0, top: PT + FH/2 - 5, color:'#555', fontSize:8 }}>{base}fr</Text>
      )}
      {/* Fret lines */}
      {Array.from({ length: NF + 1 }).map((_,fi) => (
        <View key={fi} style={{ position:'absolute', left:PL, top:gy(fi), width:(S-1)*G, height:1, backgroundColor:'#222' }} />
      ))}
      {/* String lines */}
      {Array.from({ length: S }).map((_,si) => (
        <View key={si} style={{ position:'absolute', left:gx(si), top:PT, width:1, height:NF*FH, backgroundColor:'#252530' }} />
      ))}
      {/* Barre bar */}
      {barre != null && (
        <View style={{ position:'absolute', left:PL, top:gy(barre-base)+FH*0.2, width:(S-1)*G, height:FH*0.6, backgroundColor:'#ff980055', borderRadius:FH*0.3 }} />
      )}
      {/* Per-string dots & indicators */}
      {frets.map((f, si) => {
        const x = gx(si);
        if (f < 0) return <Text key={si} style={{ position:'absolute', left:x-4, top:1, color:'#555', fontSize:9, fontWeight:'700' }}>✕</Text>;
        if (f === 0) return <Text key={si} style={{ position:'absolute', left:x-4, top:2, color:'#444', fontSize:10 }}>○</Text>;
        const rf = f - base + 1;
        if (rf < 1 || rf > NF) return null;
        const cy = gy(rf - 1) + FH * 0.5;
        const r = G * 0.38;
        const isBarre = barre != null && f === barre;
        return (
          <View key={si} style={{ position:'absolute', left:x-r, top:cy-r, width:r*2, height:r*2, borderRadius:r, backgroundColor: isBarre ? '#ff9800bb' : '#7c4dff' }} />
        );
      })}
    </View>
  );
}

/* ─── Chord+lyrics line renderer ─── */
// Input: "[Am]Hello [F]world" → renders chord names (orange) above words
function ChordLyricsLine({ line, currentChord, onChordTap }: { line: string; currentChord: string; onChordTap: (c: string) => void }) {
  // Split into segments: [{chord?, text}]
  const segs: { chord?: string; text: string }[] = [];
  let remaining = line;
  while (remaining.length > 0) {
    const m = remaining.match(/^\[([A-G][^\]]*)\](.*)/);
    if (m) {
      // find next chord marker or end
      const afterChord = m[2];
      const nextChord = afterChord.match(/\[([A-G][^\]]*)\]/);
      const word = nextChord ? afterChord.slice(0, afterChord.indexOf('[')) : afterChord;
      segs.push({ chord: m[1], text: word });
      remaining = nextChord ? afterChord.slice(afterChord.indexOf('[')) : '';
    } else {
      segs.push({ text: remaining });
      remaining = '';
    }
  }
  if (segs.length === 0) return <Text style={{ color: '#666', fontSize: 13, lineHeight: 20 }}>{line}</Text>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 }}>
      {segs.map((seg, i) => (
        <View key={i} style={{ alignItems: 'flex-start', marginRight: 2, marginBottom: 4 }}>
          {seg.chord ? (
            <TouchableOpacity onPress={() => onChordTap(seg.chord!)}>
              <Text style={{ color: seg.chord === currentChord ? '#ff9800' : '#7c4dff', fontSize: 10, fontWeight: '800', lineHeight: 14, marginBottom: 1 }}>{seg.chord}</Text>
            </TouchableOpacity>
          ) : <View style={{ height: 15 }} />}
          <Text style={{ color: '#888', fontSize: 13, lineHeight: 18 }}>{seg.text || ' '}</Text>
        </View>
      ))}
    </View>
  );
}

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
  const [lyricsEditMode, setLyricsEditMode] = useState(false);

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

          {/* ① Chord input row */}
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

          {/* ② Diagram + chord info row */}
          <View style={styles.diagRow}>
            {/* Guitar diagram */}
            <View style={styles.diagBox}>
              <ChordDiagram name={practiceCurrentChord} />
            </View>

            {/* Chord name + tones + voice */}
            <View style={styles.diagInfo}>
              <Text style={styles.diagChordName}>{practiceCurrentChord || '—'}</Text>

              {/* Chord tones */}
              <View style={styles.chordTonesRow}>
                {chordTones.length > 0
                  ? chordTones.map((n, i) => (
                      <View key={i} style={[styles.chordTonePill, n === voiceNoteBase && styles.chordTonePillActive]}>
                        <Text style={[styles.chordToneText, n === voiceNoteBase && { color: '#00e676' }]}>{n}</Text>
                      </View>
                    ))
                  : <Text style={styles.chordTonesEmpty}>введите аккорды</Text>
                }
              </View>

              {/* Voice note */}
              <View style={styles.diagVoiceRow}>
                <Ionicons name="mic" size={11} color="#444" />
                <Text style={[styles.diagVoiceNote, { color: voiceNote === '—' ? '#333' : voiceInChord ? '#00e676' : '#ff9800' }]}>
                  {voiceNote}
                </Text>
                {voiceFreq > 0 && <Text style={styles.diagVoiceHz}>{voiceFreq}Hz</Text>}
                {voiceNote !== '—' && (
                  <Ionicons name={voiceInChord ? 'checkmark-circle' : 'alert-circle'} size={14} color={voiceInChord ? '#00e676' : '#ff9800'} />
                )}
              </View>

              {/* Cents bar */}
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
          </View>

          {/* ③ Chord navigation */}
          <View style={styles.chordNav}>
            <TouchableOpacity onPress={practicePrev} style={styles.chordNavArrow} disabled={practiceChordIdx <= 0}>
              <Ionicons name="chevron-back" size={24} color={practiceChordIdx > 0 ? '#ccc' : '#222'} />
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chordPillsScroll}
              contentContainerStyle={styles.chordPillsRow}>
              {practiceChords.map((c, i) => (
                <TouchableOpacity key={i}
                  style={[styles.chordPill, i === practiceChordIdx && styles.chordPillActive]}
                  onPress={() => setPracticeChordIdx(i)}>
                  <Text style={[styles.chordPillText, i === practiceChordIdx && { color: '#ff9800', fontSize: 16 }]}>{c}</Text>
                </TouchableOpacity>
              ))}
              {practiceChords.length === 0 && (
                <Text style={{ color: '#2a2a3a', fontSize: 11, alignSelf: 'center', paddingHorizontal: 8 }}>нет аккордов — введите выше</Text>
              )}
            </ScrollView>
            <TouchableOpacity onPress={practiceNext} style={styles.chordNavArrow}
              disabled={practiceChordIdx >= practiceChords.length - 1}>
              <Ionicons name="chevron-forward" size={24}
                color={practiceChordIdx < practiceChords.length - 1 ? '#ccc' : '#222'} />
            </TouchableOpacity>
          </View>

          {/* ④ Lyrics — toggle edit / chord-view */}
          <View style={styles.lyricsPanel}>
            <View style={styles.lyricsPanelHeader}>
              <Text style={styles.lyricsPanelTitle}>ТЕКСТ</Text>
              <TouchableOpacity onPress={() => setLyricsEditMode(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={lyricsEditMode ? 'eye-outline' : 'create-outline'} size={15} color="#555" />
                <Text style={{ color: '#555', fontSize: 10 }}>{lyricsEditMode ? 'просмотр' : 'ред.'}</Text>
              </TouchableOpacity>
            </View>
            {lyricsEditMode ? (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={styles.lyricsInput}
                  multiline
                  placeholder={'Вставьте текст.\nЧтобы показать аккорды над словами — используйте [Am]Привет [F]мир\nИли просто вставьте текст без аккордов.'}
                  placeholderTextColor="#2a2a3a"
                  value={practiceLyrics}
                  onChangeText={setPracticeLyrics}
                  scrollEnabled={false}
                />
              </ScrollView>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {practiceLyrics
                  ? practiceLyrics.split('\n').map((line, li) => (
                      <ChordLyricsLine key={li} line={line} currentChord={practiceCurrentChord}
                        onChordTap={(c) => {
                          const idx = practiceChords.indexOf(c);
                          if (idx >= 0) setPracticeChordIdx(idx);
                        }}
                      />
                    ))
                  : <Text style={{ color: '#2a2a3a', fontSize: 12, padding: 8 }}>
                      Нажмите карандаш чтобы добавить текст.{'\n'}Формат с аккордами: [Am]Слова [F]текст
                    </Text>
                }
              </ScrollView>
            )}
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

      {/* ── IDENTIFY MODE — flex layout, no empty space ── */}
      {mode === 'identify' && (
        <View style={{ flex: 1 }}>

          {/* Result card (scrollable, compact) */}
          {songResult && (
            <ScrollView
              ref={scrollRef}
              style={styles.identResultScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
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
            </ScrollView>
          )}

          {/* Source tabs — large, always visible */}
          <View style={styles.identTabRow}>
            {([
              ['mic',    'ear',          'Слушать',  '#7c4dff'],
              ['file',   'document',     'Файл',     '#ff9800'],
              ['yt',     'logo-youtube', 'YouTube',  '#ff0000'],
              ['manual', 'create',       'Вручную',  '#00e676'],
            ] as const).map(([src, icon, label, accent]) => (
              <TouchableOpacity key={src}
                style={[styles.identTab, identSource === src && { backgroundColor: accent + '22', borderColor: accent + '88' }]}
                onPress={() => setIdentSource(src)}
              >
                <Ionicons name={icon as any} size={22} color={identSource === src ? accent : '#444'} />
                <Text style={[styles.identTabText, identSource === src && { color: accent }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action area — fills the rest of the screen */}
          <View style={styles.identActionArea}>

            {identSource === 'mic' && (
              <>
                <Ionicons name="ear-outline" size={56} color="#7c4dff44" />
                <Text style={styles.identActionTitle}>Распознавание по звуку</Text>
                <Text style={styles.identActionSub}>Поднесите телефон к колонке.{'\n'}Запись 10 с → AudD (~100 запросов/день)</Text>
                {isRecognizing ? (
                  <View style={styles.recProgressBig}>
                    <ActivityIndicator color="#7c4dff" size="large" />
                    <Text style={styles.recSecsBig}>{recSecs} / 10 с</Text>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => { if (timerRef.current) clearInterval(timerRef.current); stopRec(); setIsRecognizing(false); }}>
                      <Text style={styles.cancelText}>Отмена</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.identBtnBig} onPress={startIdentify} activeOpacity={0.8}>
                    <Ionicons name="ear" size={28} color="#fff" />
                    <Text style={styles.identBtnBigText}>СЛУШАТЬ И РАСПОЗНАТЬ</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {identSource === 'file' && (
              <>
                <Ionicons name="musical-note-outline" size={56} color="#ff980044" />
                <Text style={styles.identActionTitle}>Распознать из файла</Text>
                <Text style={styles.identActionSub}>MP3, AAC, WAV с устройства.{'\n'}Файл отправляется в AudD для анализа.</Text>
                {fileLoading ? (
                  <View style={styles.recProgressBig}>
                    <ActivityIndicator color="#ff9800" size="large" />
                    <Text style={[styles.recSecsBig, { color: '#ff9800', fontSize: 16 }]}>Распознавание...</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.identBtnBig, { backgroundColor: '#ff980099' }]} onPress={pickFileAndIdentify} activeOpacity={0.8}>
                    <Ionicons name="folder-open" size={28} color="#fff" />
                    <Text style={styles.identBtnBigText}>ВЫБРАТЬ ФАЙЛ</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {identSource === 'yt' && (
              <>
                <Ionicons name="logo-youtube" size={56} color="#ff000033" />
                <Text style={styles.identActionTitle}>По ссылке YouTube</Text>
                <Text style={styles.identActionSub}>Вставьте ссылку — получим название{'\n'}и текст через oEmbed API.</Text>
                <TextInput style={[styles.urlInput, { width: '100%', marginBottom: 12 }]}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor="#333" value={ytUrl} onChangeText={setYtUrl}
                  autoCapitalize="none" autoCorrect={false} keyboardType="url"
                  returnKeyType="search" onSubmitEditing={handleYouTube} />
                {ytLoading ? (
                  <ActivityIndicator color="#ff0000" />
                ) : (
                  <TouchableOpacity style={[styles.identBtnBig, { backgroundColor: '#cc000099' }]} onPress={handleYouTube} activeOpacity={0.8}>
                    <Ionicons name="logo-youtube" size={28} color="#fff" />
                    <Text style={styles.identBtnBigText}>НАЙТИ ПО ССЫЛКЕ</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {identSource === 'manual' && (
              <>
                <Ionicons name="search-outline" size={56} color="#00e67633" />
                <Text style={styles.identActionTitle}>Поиск вручную</Text>
                <Text style={styles.identActionSub}>Введите исполнителя и название —{'\n'}найдём текст и аккорды.</Text>
                <TextInput style={[styles.urlInput, { width: '100%', marginBottom: 10 }]}
                  placeholder="Исполнитель (напр. The Beatles)"
                  placeholderTextColor="#333" value={manualArtist} onChangeText={setManualArtist}
                  autoCorrect={false} returnKeyType="next" />
                <TextInput style={[styles.urlInput, { width: '100%', marginBottom: 12 }]}
                  placeholder="Название трека"
                  placeholderTextColor="#333" value={manualTitle} onChangeText={setManualTitle}
                  autoCorrect={false} returnKeyType="search" onSubmitEditing={handleManualSearch} />
                <TouchableOpacity style={[styles.identBtnBig, { backgroundColor: '#00e67688' }]} onPress={handleManualSearch} activeOpacity={0.8}>
                  <Ionicons name="search" size={28} color="#fff" />
                  <Text style={styles.identBtnBigText}>НАЙТИ ТЕКСТ И АККОРДЫ</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.identFooter}>
              lyrics.ovh · Ultimate Guitar · AudD
            </Text>
          </View>

        </View>
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
  chordTonesRow:   { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginBottom: 4 },
  chordTonePill:   { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#1a1a24', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a3a' },
  chordTonePillActive: { backgroundColor: '#00e67622', borderColor: '#00e67655' },
  chordToneText:   { color: '#666', fontSize: 12, fontWeight: '700' },
  chordTonesEmpty: { color: '#2a2a3a', fontSize: 11 },
  centsWrap:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  centsEdge:  { color: '#333', fontSize: 8, width: 18 },
  centsTrack: { flex: 1, height: 6, backgroundColor: '#1a1a24', borderRadius: 3, position: 'relative' },
  centsMid:   { position: 'absolute', left: '50%' as any, top: 0, bottom: 0, width: 1, backgroundColor: '#333' },
  centsThumb: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff9800', marginLeft: -6 },
  centsVal:   { color: '#888', fontSize: 9, width: 32, textAlign: 'right' },
  voiceRight: { alignItems: 'center', justifyContent: 'center', width: 36 },

  /* Practice: diagram row */
  diagRow:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, gap: 12, backgroundColor: '#0d0d14', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a24' },
  diagBox:      { alignItems: 'center', justifyContent: 'center' },
  diagInfo:     { flex: 1, gap: 4, paddingTop: 4 },
  diagChordName:{ color: '#ff9800', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  diagVoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  diagVoiceNote:{ fontSize: 18, fontWeight: '800' },
  diagVoiceHz:  { color: '#444', fontSize: 9 },

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

  /* Identify mode — flex layout */
  identResultScroll: { maxHeight: '45%' as any, borderBottomWidth: 1, borderColor: '#1e1e28' },

  identTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1e1e28', backgroundColor: '#0d0d14' },
  identTab:    { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, borderRightWidth: 1, borderColor: '#1e1e28', borderWidth: 1, borderTopWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  identTabText:{ color: '#444', fontSize: 10, fontWeight: '700' },

  identActionArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24, paddingBottom: 20 },
  identActionTitle:{ color: '#ccc', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  identActionSub:  { color: '#444', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  identBtnBig:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16, backgroundColor: '#7c4dff88' },
  identBtnBigText:{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 1 },

  recProgressBig: { alignItems: 'center', gap: 12 },
  recSecsBig:     { color: '#7c4dff', fontSize: 28, fontWeight: '900' },

  identFooter:    { color: '#222', fontSize: 10, textAlign: 'center', position: 'absolute', bottom: 8 },

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
  cancelBtn:   { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a1a24', borderRadius: 10 },
  cancelText:  { color: '#888', fontSize: 13 },
  urlInput:    { backgroundColor: '#1a1a24', borderRadius: 10, padding: 10, color: '#ccc', fontSize: 13, borderWidth: 1, borderColor: '#2a2a3a' },

  /* Browser */
  browserHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderColor: '#1e1e28' },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:     { color: '#ccc', fontSize: 14 },
  browserTitle: { flex: 1, color: '#888', fontSize: 12, letterSpacing: 1 },
});
