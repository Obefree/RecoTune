import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform, Modal, FlatList,
  useWindowDimensions,
} from 'react-native';
import { SONGS, type SongEntry } from '../data/songDatabase';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

/* ─── Persistent storage paths ─── */
const CUSTOM_SONGS_FILE = (FileSystem.documentDirectory ?? '') + 'custom_songs.json';
const FAVORITES_FILE    = (FileSystem.documentDirectory ?? '') + 'song_favorites.json';

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return JSON.parse(await FileSystem.readAsStringAsync(path));
  } catch {}
  return fallback;
}
async function saveJson(path: string, data: unknown) {
  try { await FileSystem.writeAsStringAsync(path, JSON.stringify(data)); } catch {}
}
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
const SIMPLICITY={'':0.32,'m':0.32,'7':0.06,'maj7':-0.55,'m7':-0.45,'dim':0.06,'aug':-0.05,'sus2':0.06,'sus4':0.06};
const MAJOR_P=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_P=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

let ctx,analyser,src,running=false;

/* ── rolling window for averaged chromagram ── */
const WIN=18;         // ~0.9s window — responsive but not jittery
let   winBuf=[];

/* ── chord stability gate ── */
const STABLE_NEED=16; // must win 16 consecutive frames (~0.8s) before logging
const MIN_CONF=0.42;  // minimum score to count as a real chord (not noise)
let   candidate='?', stableCount=0, prevSegChord='?', segStart=0;

/* ── onset / transient detection ── */
let   energyHist=[], onsetCooldown=0;

function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}

function chroma(fft,sr,fftSz){
  const c=new Float32Array(12);const bHz=sr/fftSz;
  for(let i=1;i<fft.length;i++){
    const f=i*bHz;if(f<80||f>2200)continue;
    const db=fft[i];if(db<-62)continue;
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
      for(let i=0;i<12;i++){const ct=ivs.some(iv=>(r+iv)%12===i);sc+=ct?c[i]:-0.55*c[i];}
      sc+=SIMPLICITY[t]||0;
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
  return c.map((v,i)=>({n:NOTE[i].trim(),v})).sort((a,b)=>b.v-a.v).slice(0,n).filter(x=>x.v>0.3).map(x=>x.n);
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
  if(best<0||fft[best]<-52)return-1;
  return best*bHz;
}
function avgWindow(){
  const avg=new Float32Array(12);
  const n=winBuf.length;if(!n)return avg;
  // Weighted average: recent frames count more (linear ramp)
  let wTotal=0;
  for(let j=0;j<n;j++){
    const w=(j+1); // weight grows with recency
    for(let i=0;i<12;i++)avg[i]+=winBuf[j][i]*w;
    wTotal+=w;
  }
  for(let i=0;i<12;i++)avg[i]/=wTotal;
  const mx=Math.max(...avg);
  if(mx>0)for(let i=0;i<12;i++)avg[i]/=mx;
  return avg;
}
function emitSegment(chord,durationMs){
  if(chord!=='?'&&durationMs>400)post({type:'segment',chord,durationMs});
}
async function start(){
  if(running)return;running=true;
  winBuf=[];energyHist=[];onsetCooldown=0;
  candidate='?';stableCount=0;prevSegChord='?';segStart=Date.now();
  try{
    const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    ctx=new AudioContext();
    analyser=ctx.createAnalyser();
    analyser.fftSize=8192;analyser.smoothingTimeConstant=0.4; // less pre-smoothing — let onset detection work
    src=ctx.createMediaStreamSource(st);src.connect(analyser);
    const fft=new Float32Array(analyser.frequencyBinCount);
    const bHz=ctx.sampleRate/analyser.fftSize;
    function loop(){
      if(!running)return;
      analyser.getFloatFrequencyData(fft);
      // Skip silence
      const peak=Math.max(...fft.slice(0,400));
      if(peak<-62){requestAnimationFrame(loop);return;}

      const c=chroma(fft,ctx.sampleRate,analyser.fftSize);

      // ── Onset detection: energy spike = new chord starting ──
      const totalE=c.reduce((s,v)=>s+v,0);
      energyHist.push(totalE);
      if(energyHist.length>8)energyHist.shift();
      if(onsetCooldown>0){onsetCooldown--;}
      else if(energyHist.length>=4){
        const prevAvg=energyHist.slice(0,-2).reduce((s,v)=>s+v,0)/(energyHist.length-2);
        // Energy jumped >2.2× → guitarist just struck a new chord
        if(totalE>prevAvg*2.2&&prevAvg>0.4){
          winBuf=winBuf.slice(-3); // flush most of old window, keep tiny tail
          stableCount=0;
          candidate='?';
          onsetCooldown=8; // wait ~400ms before next onset can trigger
        }
      }

      // Maintain rolling window
      winBuf.push(Array.from(c));
      if(winBuf.length>WIN)winBuf.shift();
      const avg=avgWindow();
      const chord=detectChord(avg);
      const key=estimateKey(avg);
      const notes=topNotes(avg,4);
      const pitchHz=pitchHPS(fft,bHz,4);

      // Display update every frame
      post({type:'update',chord:chord.conf>=MIN_CONF?chord.name:'?',confidence:chord.conf,key,notes,pitchHz});

      // ── Stability gate ──
      if(chord.conf>=MIN_CONF&&chord.name!=='?'&&chord.name===candidate){
        stableCount++;
        if(stableCount===STABLE_NEED&&candidate!==prevSegChord){
          const now=Date.now();
          emitSegment(prevSegChord,now-segStart);
          prevSegChord=candidate;
          segStart=now;
        }
      } else {
        if(chord.name!==candidate){candidate=chord.name;stableCount=0;}
      }
      requestAnimationFrame(loop);
    }
    loop();
    post({type:'ready'});
  }catch(e){
    post({type:'error',msg:e.message});
  }
}
function stop(){
  running=false;
  // Emit final segment
  emitSegment(prevSegChord,Date.now()-segStart);
  try{if(src)src.disconnect();if(ctx)ctx.close();}catch{}
  winBuf=[];
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
function ChordDiagram({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const def = CHORD_DB[name] ?? null;
  const S = 6; const NF = 4;
  // Size variants
  const G  = size === 'lg' ? 26 : size === 'sm' ? 16 : 22;   // gap between strings
  const FH = size === 'lg' ? 28 : size === 'sm' ? 18 : 24;   // fret height
  const PL = size === 'lg' ? 16 : size === 'sm' ? 10 : 14;   // left/right padding
  const PT = size === 'lg' ? 22 : size === 'sm' ? 14 : 18;   // top padding
  const W  = (S - 1) * G + PL * 2;
  const H  = NF * FH + PT + 14;
  const DOT = G * 0.40;   // finger dot radius

  if (!def) {
    // Show chord name hint if not in DB
    const label = (!name || name === '—' || name === '?') ? '?' : name + '\n?';
    return (
      <View style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#2a2a3a', borderRadius: 8 }}>
        <Text style={{ color: '#555', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>{label}</Text>
        <Text style={{ color: '#333', fontSize: 9, marginTop: 2 }}>нет схемы</Text>
      </View>
    );
  }

  const { frets, barre } = def;
  const fNums = frets.filter(f => f > 0);
  const minF  = fNums.length ? Math.min(...fNums) : 1;
  const base  = barre != null ? barre : (minF > 3 ? minF - 1 : 1);
  const showNum = base > 1;
  const gx = (si: number) => PL + si * G;
  const gy = (fi: number) => PT + fi * FH;

  return (
    <View style={{ width: W, height: H, borderWidth: 1, borderColor: '#2a2a3a', borderRadius: 8, overflow: 'hidden' }}>
      {/* Nut (thick bar at top) */}
      {!showNum ? (
        <View style={{ position:'absolute', left:PL, top:PT - 2, width:(S-1)*G, height:4, backgroundColor:'#aaa', borderRadius:2 }} />
      ) : (
        <Text style={{ position:'absolute', right: 4, top: PT + FH * 0.3, color:'#888', fontSize: size === 'lg' ? 11 : 9, fontWeight:'700' }}>{base}fr</Text>
      )}
      {/* Fret lines — visible medium gray */}
      {Array.from({ length: NF + 1 }).map((_, fi) => (
        <View key={fi} style={{ position:'absolute', left:PL, top:gy(fi), width:(S-1)*G, height:1, backgroundColor:'#3a3a55' }} />
      ))}
      {/* String lines — visible gray */}
      {Array.from({ length: S }).map((_, si) => (
        <View key={si} style={{ position:'absolute', left:gx(si), top:PT, width: si === 0 || si === 5 ? 2 : 1, height:NF*FH, backgroundColor:'#4a4a65' }} />
      ))}
      {/* Barre bar */}
      {barre != null && (
        <View style={{ position:'absolute', left:PL + DOT, top:gy(barre - base) + FH * 0.18, width:(S-1)*G - DOT*2, height:FH * 0.64, backgroundColor:'#ff980099', borderRadius: FH * 0.32 }} />
      )}
      {/* Per-string markers */}
      {frets.map((f, si) => {
        const x = gx(si);
        if (f < 0) {
          return <Text key={si} style={{ position:'absolute', left:x - 5, top: 3, color:'#ff5252', fontSize: size === 'lg' ? 12 : 10, fontWeight:'900' }}>✕</Text>;
        }
        if (f === 0) {
          return <Text key={si} style={{ position:'absolute', left:x - 5, top: 4, color:'#aaa', fontSize: size === 'lg' ? 12 : 10, fontWeight:'700' }}>○</Text>;
        }
        const rf = f - base + 1;
        if (rf < 1 || rf > NF) return null;
        const cy = gy(rf - 1) + FH * 0.5;
        const isBarre = barre != null && f === barre;
        return (
          <View key={si} style={{ position:'absolute', left:x - DOT, top:cy - DOT, width:DOT*2, height:DOT*2, borderRadius:DOT, backgroundColor: isBarre ? '#ff9800' : '#7c4dff' }} />
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
  if (segs.length === 0) return <Text style={{ color: '#777', fontSize: 15, lineHeight: 22, marginBottom: 2 }}>{line || ' '}</Text>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
      {segs.map((seg, i) => (
        <View key={i} style={{ alignItems: 'flex-start', marginRight: 4, marginBottom: 2 }}>
          {seg.chord ? (
            <TouchableOpacity onPress={() => onChordTap(seg.chord!)}>
              <Text style={{
                color: seg.chord === currentChord ? '#ff9800' : '#7c4dff',
                fontSize: 13, fontWeight: '900', lineHeight: 17, marginBottom: 1,
                backgroundColor: seg.chord === currentChord ? '#ff980022' : 'transparent',
                paddingHorizontal: 2, borderRadius: 3,
              }}>{seg.chord}</Text>
            </TouchableOpacity>
          ) : <View style={{ height: 18 }} />}
          <Text style={{ color: '#ccc', fontSize: 15, lineHeight: 20 }}>{seg.text || ' '}</Text>
        </View>
      ))}
    </View>
  );
}

type Mode = 'live' | 'practice' | 'identify';

export default function ChordsScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();

  // Must be declared before lyricsScrollH that uses it
  const [showDiagram, setShowDiagram] = useState(true);

  /* ── Practice view height: full screen minus surrounding chrome ── */
  const practiceViewH = Math.max(200,
    windowH
    - (insets.top + 8)       // container paddingTop
    - 46                      // CHORDS header row
    - (56 + insets.bottom)    // bottom tab bar
  );

  /* ── Lyrics scroll height: practice area minus all fixed elements ── */
  const lyricsScrollH = Math.max(80,
    practiceViewH
    - 60                      // bigLibBtn
    - 50                      // progInput
    - (showDiagram ? 148 : 0) // practiceTopPanel (collapsible)
    - 50                      // chordNav
    - 36                      // lyricsPanelHeader
    - 62                      // toolbar
  );

  const [mode, setMode]               = useState<Mode>('practice');
  const [liveActive, setLiveActive]   = useState(false);

  /* ── Chord state ── */
  const [chord, setChord]             = useState('—');
  const [confidence, setConfidence]   = useState(0);
  const [key, setKey]                 = useState('');
  const [notes, setNotes]             = useState<string[]>([]);

  /* chord segments: accumulated stable chords with duration */
  type ChordSegment = { chord: string; durationMs: number };
  const [segments, setSegments]       = useState<ChordSegment[]>([]);

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
  // showDiagram declared near top of component before lyricsScrollH

  /* ── Live mode error display ── */
  const [liveError, setLiveError] = useState<string | null>(null);
  const wvReadyRef = useRef(false);
  const pendingStartRef = useRef(false);

  /* ── Identify state ── */
  const [recSecs, setRecSecs]         = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [songResult, setSongResult]   = useState<AuddResult | null>(null);
  const [ytUrl, setYtUrl]             = useState('');
  const [ytLoading, setYtLoading]     = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [identSource, setIdentSource] = useState<'mic' | 'file' | 'yt' | 'manual'>('mic');
  const [lyrics, setLyrics]           = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
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
    setLiveError(null);
    setChord('—'); setKey(''); setNotes([]);
    setVoiceNote('—'); setVoiceFreq(0); setVoiceCents(0);
    if (wvReadyRef.current) {
      sendCmd('start');
    } else {
      pendingStartRef.current = true;
    }
  }
  function stopLive() {
    setLiveActive(false);
    pendingStartRef.current = false;
    sendCmd('stop');
  }

  function handleWVMessage(e: any) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') {
        setLiveError(null);
      } else if (msg.type === 'error') {
        setLiveActive(false);
        const errText: string = msg.msg || msg.message || 'Ошибка микрофона';
        if (errText.toLowerCase().includes('denied') || errText.toLowerCase().includes('permission')) {
          setLiveError('Нет доступа к микрофону. Разрешите в настройках телефона.');
        } else if (errText.toLowerCase().includes('notfound') || errText.toLowerCase().includes('devicenotfound')) {
          setLiveError('Микрофон не найден.');
        } else {
          setLiveError(`Ошибка: ${errText}`);
        }
      } else if (msg.type === 'segment') {
        // Stable chord segment detected by the engine
        if (msg.chord && msg.chord !== '?' && msg.durationMs > 400) {
          setSegments(prev => [...prev, { chord: msg.chord, durationMs: msg.durationMs }]);
        }
      } else if (msg.type === 'update') {
        setLiveError(null);
        setChord(msg.chord);
        setConfidence(msg.confidence);
        setKey(msg.key);
        setNotes(msg.notes ?? []);
        if (msg.pitchHz > 0) {
          const midi = Math.round(12 * Math.log2(msg.pitchHz / 440) + 69);
          const noteIdx = ((midi % 12) + 12) % 12;
          const octave = Math.floor(midi / 12) - 1;
          setVoiceNote(NOTE_NAMES_FLAT[noteIdx] + octave);
          setVoiceFreq(Math.round(msg.pitchHz));
          const exactMidi = 12 * Math.log2(msg.pitchHz / 440) + 69;
          setVoiceCents(Math.round((exactMidi - midi) * 100));
        } else {
          setVoiceNote('—'); setVoiceFreq(0); setVoiceCents(0);
        }
      }
    } catch {}
  }

  function handleWVLoad() {
    wvReadyRef.current = true;
    if (pendingStartRef.current) {
      pendingStartRef.current = false;
      sendCmd('start');
    }
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
    setSongResult(null);
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
      let data: any = null;
      try {
        const res = await fetch('https://api.audd.io/', { method: 'POST', body: form as any });
        data = await res.json();
      } catch (netErr) {
        Alert.alert('Нет интернета', 'Проверьте подключение и попробуйте снова. Также можно найти песню вручную.');
        return;
      }
      if (data.status === 'success' && data.result) {
        setResultAndFetch(data.result as AuddResult);
      } else if (data.status === 'error' && data.error?.error_code === 901) {
        Alert.alert(
          'Лимит API',
          'Бесплатный токен AudD исчерпан (~3 запроса/день).\n\nИспользуйте вкладку "Вручную" — введите исполнителя и название.'
        );
      } else {
        Alert.alert(
          'Не распознано',
          'Песня не найдена в базе AudD.\n\nСовет: поднесите телефон ближе к колонке, уберите шум. Или найдите вручную.'
        );
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

  /* ── Song library ── */
  const [showLibrary, setShowLibrary]         = useState(false);
  const [libSearch, setLibSearch]             = useState('');
  const [libGenre, setLibGenre]               = useState('');
  const [libDiff, setLibDiff]                 = useState<0|1|2|3>(0);
  const [libFavOnly, setLibFavOnly]           = useState(false);
  const [libSortBy, setLibSortBy]             = useState<'title'|'artist'|'bpm'>('title');

  /* ── Custom songs & favorites ── */
  const [customSongs, setCustomSongs]         = useState<SongEntry[]>([]);
  const [favorites, setFavorites]             = useState<Set<string>>(new Set());

  /* ── Add/Edit song modal ── */
  const [showAddSong, setShowAddSong]         = useState(false);
  const [editingSong, setEditingSong]         = useState<SongEntry | null>(null);
  const blankForm = () => ({ title:'', artist:'', genre:'', key:'', bpm:'', difficulty:'1' as '1'|'2'|'3', chords:'', lyrics:'' });
  const [addForm, setAddForm]                 = useState(blankForm());

  /* load on mount */
  useFocusEffect(useCallback(() => {
    loadJson<SongEntry[]>(CUSTOM_SONGS_FILE, []).then(setCustomSongs);
    loadJson<string[]>(FAVORITES_FILE, []).then(arr => setFavorites(new Set(arr)));
  }, []));

  const allSongs = [...SONGS, ...customSongs];
  const GENRES_ALL = ['', ...Array.from(new Set(allSongs.map(s => s.genre))).sort()];

  const libResults = (() => {
    let list = allSongs;
    const q = libSearch.toLowerCase();
    if (q) list = list.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.chords.toLowerCase().includes(q) ||
      s.genre.toLowerCase().includes(q)
    );
    if (libGenre)   list = list.filter(s => s.genre === libGenre);
    if (libDiff)    list = list.filter(s => s.difficulty === libDiff);
    if (libFavOnly) list = list.filter(s => favorites.has(s.id));
    if (libSortBy === 'title')  list = [...list].sort((a,b) => a.title.localeCompare(b.title));
    if (libSortBy === 'artist') list = [...list].sort((a,b) => a.artist.localeCompare(b.artist));
    if (libSortBy === 'bpm')    list = [...list].sort((a,b) => (b.bpm ?? 0) - (a.bpm ?? 0));
    return list;
  })();

  async function toggleFavorite(id: string) {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFavorites(next);
    await saveJson(FAVORITES_FILE, [...next]);
  }

  async function saveCustomSong(song: SongEntry) {
    const next = editingSong
      ? customSongs.map(s => s.id === song.id ? song : s)
      : [...customSongs, song];
    setCustomSongs(next);
    await saveJson(CUSTOM_SONGS_FILE, next);
  }

  async function deleteCustomSong(id: string) {
    const next = customSongs.filter(s => s.id !== id);
    setCustomSongs(next);
    await saveJson(CUSTOM_SONGS_FILE, next);
    const favNext = new Set(favorites);
    favNext.delete(id);
    setFavorites(favNext);
    await saveJson(FAVORITES_FILE, [...favNext]);
  }

  function openAddSong(existing?: SongEntry) {
    if (existing) {
      setEditingSong(existing);
      setAddForm({
        title: existing.title,
        artist: existing.artist,
        genre: existing.genre,
        key: existing.key ?? '',
        bpm: existing.bpm ? String(existing.bpm) : '',
        difficulty: String(existing.difficulty) as '1'|'2'|'3',
        chords: existing.chords,
        lyrics: existing.lyrics ?? '',
      });
    } else {
      setEditingSong(null);
      setAddForm(blankForm());
    }
    setShowAddSong(true);
  }

  async function submitAddSong() {
    if (!addForm.title.trim() || !addForm.chords.trim()) {
      Alert.alert('Заполните название и аккорды'); return;
    }
    const song: SongEntry = {
      id: editingSong?.id ?? `custom_${Date.now()}`,
      title: addForm.title.trim(),
      artist: addForm.artist.trim() || 'Мои песни',
      genre: addForm.genre.trim() || 'Мои песни',
      key: addForm.key.trim() || undefined,
      bpm: addForm.bpm ? Number(addForm.bpm) : undefined,
      difficulty: Number(addForm.difficulty) as 1|2|3,
      chords: addForm.chords.trim(),
      lyrics: addForm.lyrics.trim() || undefined,
    };
    await saveCustomSong(song);
    setShowAddSong(false);
  }

  function pickSong(song: SongEntry) {
    setPracticeInput(song.chords);
    parsePracticeInput(song.chords);
    setPracticeChordIdx(0);
    setLyricsEditMode(false); // always show view mode after picking
    setShowLibrary(false);
    if (song.lyrics) {
      setPracticeLyrics(song.lyrics);
    } else {
      setPracticeLyrics('');
      fetchLyrics(song.artist, song.title);
    }
  }

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
    if (wvReadyRef.current) {
      sendCmd('start');
    } else {
      pendingStartRef.current = true;
    }
  }
  function stopPitchDetection() {
    setPitchActive(false);
    pendingStartRef.current = false;
    sendCmd('stop');
  }

  /* ── Switch mode helper ── */
  function switchMode(m: Mode) {
    if (liveActive) stopLive();
    if (pitchActive) stopPitchDetection();
    setMode(m);
    if (m === 'live') {
      setChord('—'); setKey(''); setNotes([]);
      setVoiceNote('—'); setVoiceFreq(0); setVoiceCents(0);
      if (wvReadyRef.current) { sendCmd('start'); } else { pendingStartRef.current = true; }
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
        <View style={{ flex: 1 }}>

          {/* Current chord — big */}
          <View style={styles.liveTop}>
            <Text style={[styles.chordBig, { color: col }]}>{chord}</Text>
            <Text style={styles.chordKey}>{key || (liveActive ? 'Слушаю...' : 'Нажмите ▶ START')}</Text>
            {notes.length > 0 && (
              <View style={styles.notesRow}>
                {notes.map((n, i) => (
                  <View key={i} style={styles.notePill}><Text style={styles.noteText}>{n}</Text></View>
                ))}
              </View>
            )}
            {liveActive && (
              <View style={styles.confRow}>
                <Text style={styles.confLabel}>Уверенность</Text>
                <View style={styles.confTrack}>
                  <View style={[styles.confBar, {
                    width: `${Math.min(100, Math.max(0, (confidence / 4) * 100))}%`,
                    backgroundColor: col,
                  }]} />
                </View>
              </View>
            )}
          </View>

          {/* Error */}
          {liveError && (
            <View style={[styles.liveErrorCard, { marginHorizontal: 14 }]}>
              <Ionicons name="alert-circle" size={18} color="#ff5252" />
              <Text style={styles.liveErrorText}>{liveError}</Text>
            </View>
          )}

          {/* ── Chord log — scrollable, flex:1, NO overlapping buttons inside ── */}
          <View style={styles.liveSegOuter}>
            <View style={styles.liveSeqHeader}>
              <Text style={styles.liveSeqTitle}>
                {liveActive ? '● ЗАПИСЬ' : 'АККОРДЫ'}
              </Text>
              {segments.length > 0 && (
                <TouchableOpacity onPress={() => setSegments([])} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={14} color="#444" />
                </TouchableOpacity>
              )}
            </View>

            {segments.length === 0 ? (
              <View style={styles.liveSegEmpty}>
                <Ionicons name="mic-outline" size={32} color="#1e1e28" />
                <Text style={styles.liveSeqEmpty}>
                  {liveActive
                    ? 'Играйте — аккорды появятся\nпо мере распознавания'
                    : 'Нажмите СТАРТ и играйте.\nАккорды появятся один за другим.'}
                </Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 12, paddingBottom: 6 }}>
                {(() => {
                  const maxDur = Math.max(...segments.map(s => s.durationMs), 1);
                  return segments.map((seg, i) => {
                    const isLast = i === segments.length - 1;
                    return (
                      <View key={i} style={[styles.liveSegRow, isLast && { opacity: liveActive ? 0.8 : 1 }]}>
                        <Text style={[styles.liveSegChord, isLast && liveActive && { color: '#00e676' }]}>
                          {seg.chord}
                        </Text>
                        <View style={styles.liveSegBarWrap}>
                          <View style={[styles.liveSegBar, {
                            width: `${Math.max(6, (seg.durationMs / maxDur) * 100)}%` as any,
                            backgroundColor: isLast && liveActive ? '#00e67677' : '#7c4dff66',
                          }]} />
                        </View>
                        <Text style={styles.liveSegDur}>{(seg.durationMs / 1000).toFixed(1)}s</Text>
                      </View>
                    );
                  });
                })()}
              </ScrollView>
            )}
          </View>

          {/* ── Action bar — СТАРТ + В ПРАКТИКУ (no overlap) ── */}
          <View style={styles.liveActions}>
            <TouchableOpacity
              style={[styles.mainBtn, liveActive && styles.mainBtnStop, { flex: 1 }]}
              onPress={liveActive ? stopLive : startLive}
              activeOpacity={0.8}
            >
              <Ionicons name={liveActive ? 'stop-circle' : 'mic-circle'} size={24} color="#fff" />
              <Text style={styles.mainBtnText}>{liveActive ? '■ СТОП' : '▶ СТАРТ'}</Text>
            </TouchableOpacity>

            {segments.length >= 2 && !liveActive && (
              <TouchableOpacity
                style={styles.liveSaveBtn}
                onPress={() => {
                  const seq = segments.map(s => s.chord).join(' ');
                  setPracticeInput(seq);
                  parsePracticeInput(seq);
                  setPracticeChordIdx(0);
                  setPracticeLyrics('');
                  switchMode('practice');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                <Text style={styles.liveSaveBtnText}>В ПРАКТИКУ</Text>
              </TouchableOpacity>
            )}

            {segments.length > 0 && (
              <TouchableOpacity
                style={styles.liveClearBtn}
                onPress={() => { setSegments([]); setChord('—'); setKey(''); setNotes([]); }}
              >
                <Ionicons name="refresh" size={20} color="#555" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.hint, { textAlign: 'center', marginHorizontal: 12, marginBottom: 8 }]}>
            Аккорд фиксируется после ~0.7с стабильного звука
          </Text>
        </View>
      )}

      {/* ── PRACTICE MODE ── */}
      {mode === 'practice' && (
        <View style={{ height: practiceViewH, overflow: 'hidden' }}>

          {/* ── FIXED ELEMENTS top group ── */}
          <View>

          {/* ── БАЗА — big prominent button ── */}
          <TouchableOpacity style={styles.bigLibBtn} onPress={() => setShowLibrary(true)} activeOpacity={0.75}>
            <Ionicons name="library" size={18} color="#fff" />
            <Text style={styles.bigLibBtnText}>
              {practiceInput ? `📖 ${practiceInput.split(' ').slice(0,4).join(' ')}${practiceInput.split(' ').length > 4 ? '...' : ''}` : 'ВЫБРАТЬ ПЕСНЮ ИЗ БАЗЫ →'}
            </Text>
          </TouchableOpacity>

          {/* ── Chord input (compact, below БАЗА) ── */}
          <View style={styles.progInput}>
            <TextInput
              style={[styles.progTextField, { flex: 1 }]}
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

          {/* ── CHORD PANEL: diagram + name + tones + voice (collapsible) ── */}
          {showDiagram && <View style={styles.practiceTopPanel}>
            {/* Diagram — centered, medium size */}
            <View style={styles.practiceDiagLeft}>
              <ChordDiagram name={practiceCurrentChord} size="md" />
            </View>

            {/* Right: chord name, tones, voice */}
            <View style={styles.practiceDiagRight}>
              <Text style={styles.practiceChordName}>{practiceCurrentChord === '—' ? '← выберите' : practiceCurrentChord}</Text>

              {/* Tones */}
              <View style={styles.chordTonesRow}>
                {chordTones.length > 0
                  ? chordTones.map((n, i) => (
                      <View key={i} style={[styles.chordTonePill, n === voiceNoteBase && styles.chordTonePillActive]}>
                        <Text style={[styles.chordToneText, n === voiceNoteBase && { color: '#00e676' }]}>{n}</Text>
                      </View>
                    ))
                  : <Text style={styles.chordTonesEmpty}>{practiceChords.length === 0 ? 'введите аккорды выше' : ''}</Text>
                }
              </View>

              {/* Voice — always same height */}
              <View style={styles.diagVoiceRow}>
                <Ionicons name="mic" size={11} color={pitchActive ? '#666' : '#2a2a3a'} />
                <Text style={[styles.diagVoiceNote, {
                  color: !pitchActive ? '#2a2a3a' : voiceNote === '—' ? '#444' : voiceInChord ? '#00e676' : '#ff9800'
                }]}>
                  {pitchActive ? voiceNote : '—'}
                </Text>
                <Text style={styles.diagVoiceHz}>{pitchActive && voiceFreq > 0 ? `${voiceFreq}Hz` : ''}</Text>
                {pitchActive && voiceNote !== '—' && (
                  <Ionicons name={voiceInChord ? 'checkmark-circle' : 'alert-circle'} size={14}
                    color={voiceInChord ? '#00e676' : '#ff9800'} />
                )}
              </View>

              {/* Cents bar — fixed height, fades when mic off */}
              <View style={[styles.centsWrap, { opacity: pitchActive && voiceFreq > 0 ? 1 : 0.15 }]}>
                <Text style={styles.centsEdge}>−50</Text>
                <View style={styles.centsTrack}>
                  <View style={styles.centsMid} />
                  <View style={[styles.centsThumb, { left: `${pitchActive && voiceFreq > 0 ? centsBarPct : 50}%` as any }]} />
                </View>
                <Text style={styles.centsEdge}>+50</Text>
                <Text style={[styles.centsVal, { color: Math.abs(voiceCents) < 10 ? '#00e676' : '#ffeb3b' }]}>
                  {voiceCents > 0 ? '+' : ''}{voiceCents}¢
                </Text>
              </View>
            </View>
          </View>}

          {/* ── CHORD NAVIGATION strip ── */}
          <View style={styles.chordNav}>
            {/* If diagram is hidden, show current chord name inline */}
            {!showDiagram && (
              <Text style={{ color: '#ff9800', fontSize: 18, fontWeight: '800', paddingHorizontal: 6, minWidth: 48, textAlign: 'center' }}>
                {practiceCurrentChord === '—' ? '' : practiceCurrentChord}
              </Text>
            )}
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

          </View>{/* end fixed group */}

          {/* ── Lyrics header ── */}
          <View style={styles.lyricsPanelHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lyricsPanelTitle}>
                  {lyricsEditMode ? 'РЕДАКТИРОВАТЬ' : practiceLyrics ? 'ТЕКСТ + АККОРДЫ' : 'ТЕКСТ'}
                </Text>
                {!practiceLyrics && !lyricsEditMode && (
                  <Text style={{ color: '#444', fontSize: 9, marginTop: 1 }}>
                    Выберите из БАЗЫ или нажмите ред.
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowDiagram(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, marginRight: 4 }}>
                <Ionicons name={showDiagram ? 'chevron-up' : 'chevron-down'} size={14} color="#555" />
                <Text style={{ color: '#555', fontSize: 10 }}>{showDiagram ? 'скрыть' : 'схема'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLyricsEditMode(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}>
                <Ionicons name={lyricsEditMode ? 'eye-outline' : 'create-outline'} size={16} color="#666" />
                <Text style={{ color: '#666', fontSize: 11 }}>{lyricsEditMode ? 'просмотр' : 'ред.'}</Text>
              </TouchableOpacity>
            </View>

          {/* Lyrics content — explicit measured height */}
          {lyricsEditMode ? (
            <ScrollView style={[styles.lyricsScroll, { height: lyricsScrollH }]}
              contentContainerStyle={{ padding: 12, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.lyricsInput}
                multiline
                placeholder={'Вставьте текст.\n\nФормат: [Am]Слово [F]другое\nАккорд появится над словом.'}
                placeholderTextColor="#2a2a3a"
                value={practiceLyrics}
                onChangeText={setPracticeLyrics}
                scrollEnabled={false}
              />
            </ScrollView>
          ) : practiceLyrics ? (
            <ScrollView style={[styles.lyricsScroll, { height: lyricsScrollH }]}
              contentContainerStyle={{ padding: 10, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {practiceLyrics.split('\n').map((line, li) => (
                <ChordLyricsLine key={li} line={line} currentChord={practiceCurrentChord}
                  onChordTap={(c) => {
                    const idx = practiceChords.indexOf(c);
                    if (idx >= 0) setPracticeChordIdx(idx);
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <ScrollView style={[styles.lyricsScroll, { height: lyricsScrollH }]}
              contentContainerStyle={{ minHeight: lyricsScrollH, alignItems: 'center', justifyContent: 'center', padding: 28 }}
              showsVerticalScrollIndicator={false}>
              <Ionicons name="musical-notes-outline" size={36} color="#3a3a55" />
              <Text style={[styles.lyricsEmptyText, { marginTop: 12 }]}>Текст с аккордами</Text>
              <Text style={styles.lyricsEmptyHint}>
                Выберите песню из БАЗЫ (кнопка выше).{'\n'}
                Нажмите карандаш чтобы вставить текст.{'\n\n'}
                Формат: [Am]Слово [F]другое
              </Text>
              <TouchableOpacity style={styles.lyricsEmptyBtn} onPress={() => setLyricsEditMode(true)}>
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.lyricsEmptyBtnText}>Добавить текст</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── TOOLBAR — absolutely pinned at the bottom ── */}
          <View style={styles.practiceToolbarAbs}>
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
        <View style={{ flex: 1 }}>

          {/* ══ STATE A: Result found → full screen result view ══ */}
          {songResult ? (
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultPage}
              keyboardShouldPersistTaps="handled"
            >
              {/* Top bar */}
              <View style={styles.resultTopBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#00e676" />
                  <Text style={styles.resultFound}>НАЙДЕНО</Text>
                </View>
                <TouchableOpacity onPress={() => { setSongResult(null); setLyrics(null); }}
                  style={styles.resultNewSearchBtn}>
                  <Ionicons name="search" size={14} color="#7c4dff" />
                  <Text style={styles.resultNewSearchText}>Новый поиск</Text>
                </TouchableOpacity>
              </View>

              {/* Song info */}
              <Text style={styles.resultTitle}>{songResult.title}</Text>
              <Text style={styles.resultArtist}>{songResult.artist}</Text>
              {songResult.album && (
                <Text style={styles.resultMeta}>{songResult.album}{songResult.release_date ? ` · ${songResult.release_date.slice(0,4)}` : ''}</Text>
              )}

              {/* Action buttons */}
              <View style={styles.resultActions}>
                <TouchableOpacity style={[styles.chordsBtn, { backgroundColor: '#ff980022', borderColor: '#ff980066' }]}
                  onPress={() => switchMode('practice')}>
                  <Ionicons name="person" size={16} color="#ff9800" />
                  <Text style={[styles.chordsBtnText, { color: '#ff9800' }]}>В Практику</Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.resultDivider} />

              {/* Lyrics — full, no truncation */}
              <View style={styles.resultLyricsHeader}>
                <Ionicons name="document-text-outline" size={14} color="#555" />
                <Text style={styles.lyricsLabel}>ТЕКСТ ПЕСНИ</Text>
              </View>
              {lyricsLoading ? (
                <ActivityIndicator color="#555" size="large" style={{ marginTop: 24 }} />
              ) : lyrics ? (
                <Text style={styles.resultLyricsText}>{lyrics}</Text>
              ) : (
                <Text style={styles.lyricsEmpty}>Текст не найден (lyrics.ovh)</Text>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>

          ) : (
            /* ══ STATE B: No result → search UI fills the whole screen ══ */
            <>
              {/* Source tabs */}
              <View style={styles.identTabRow}>
                {([
                  ['mic',    'ear',          'Слушать',  '#7c4dff'],
                  ['file',   'document',     'Файл',     '#ff9800'],
                  ['yt',     'logo-youtube', 'YouTube',  '#ff0000'],
                  ['manual', 'create',       'Вручную',  '#00e676'],
                ] as const).map(([src, icon, label, accent]) => (
                  <TouchableOpacity key={src}
                    style={[styles.identTab, identSource === src && { backgroundColor: accent + '22', borderColor: accent + '88' }]}
                    onPress={() => setIdentSource(src)}>
                    <Ionicons name={icon as any} size={22} color={identSource === src ? accent : '#444'} />
                    <Text style={[styles.identTabText, identSource === src && { color: accent }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action area fills remaining space */}
              <View style={styles.identActionArea}>

                {identSource === 'mic' && (
                  <>
                    <Ionicons name="ear-outline" size={64} color="#7c4dff33" />
                    <Text style={styles.identActionTitle}>Распознать по звуку</Text>
                    <Text style={styles.identActionSub}>Поднесите телефон к колонке.{'\n'}Запись 10 с → AudD (~100 запросов/день)</Text>
                    {isRecognizing ? (
                      <View style={styles.recProgressBig}>
                        <ActivityIndicator color="#7c4dff" size="large" />
                        <Text style={styles.recSecsBig}>{recSecs} / 10 с</Text>
                        <TouchableOpacity style={styles.cancelBtn}
                          onPress={() => { if (timerRef.current) clearInterval(timerRef.current); stopRec(); setIsRecognizing(false); }}>
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
                    <Ionicons name="musical-note-outline" size={64} color="#ff980033" />
                    <Text style={styles.identActionTitle}>Распознать из файла</Text>
                    <Text style={styles.identActionSub}>MP3, AAC, WAV с устройства.{'\n'}Отправляется в AudD для анализа.</Text>
                    {fileLoading ? (
                      <View style={styles.recProgressBig}>
                        <ActivityIndicator color="#ff9800" size="large" />
                        <Text style={[styles.recSecsBig, { color: '#ff9800', fontSize: 16 }]}>Распознавание...</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.identBtnBig, { backgroundColor: '#ff980099' }]}
                        onPress={pickFileAndIdentify} activeOpacity={0.8}>
                        <Ionicons name="folder-open" size={28} color="#fff" />
                        <Text style={styles.identBtnBigText}>ВЫБРАТЬ ФАЙЛ</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {identSource === 'yt' && (
                  <>
                    <Ionicons name="logo-youtube" size={64} color="#ff000033" />
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
                      <TouchableOpacity style={[styles.identBtnBig, { backgroundColor: '#cc000099' }]}
                        onPress={handleYouTube} activeOpacity={0.8}>
                        <Ionicons name="logo-youtube" size={28} color="#fff" />
                        <Text style={styles.identBtnBigText}>НАЙТИ ПО ССЫЛКЕ</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {identSource === 'manual' && (
                  <>
                    <Ionicons name="search-outline" size={64} color="#00e67633" />
                    <Text style={styles.identActionTitle}>Поиск вручную</Text>
                    <Text style={styles.identActionSub}>Введите исполнителя и название —{'\n'}найдём текст песни.</Text>
                    <TextInput style={[styles.urlInput, { width: '100%', marginBottom: 10 }]}
                      placeholder="Исполнитель (напр. The Beatles)"
                      placeholderTextColor="#333" value={manualArtist} onChangeText={setManualArtist}
                      autoCorrect={false} returnKeyType="next" />
                    <TextInput style={[styles.urlInput, { width: '100%', marginBottom: 14 }]}
                      placeholder="Название трека"
                      placeholderTextColor="#333" value={manualTitle} onChangeText={setManualTitle}
                      autoCorrect={false} returnKeyType="search" onSubmitEditing={handleManualSearch} />
                    <TouchableOpacity style={[styles.identBtnBig, { backgroundColor: '#00e67688' }]}
                      onPress={handleManualSearch} activeOpacity={0.8}>
                      <Ionicons name="search" size={28} color="#fff" />
                      <Text style={styles.identBtnBigText}>НАЙТИ ТЕКСТ</Text>
                    </TouchableOpacity>
                  </>
                )}

                <Text style={styles.identFooter}>lyrics.ovh · AudD</Text>
              </View>
            </>
          )}

        </View>
      )}

      {/* ── Song Library Modal ── */}
      <Modal visible={showLibrary} animationType="slide" onRequestClose={() => setShowLibrary(false)}>
        <View style={[styles.libModal, { paddingTop: insets.top + 8 }]}>
          {/* Header */}
          <View style={styles.libHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.libTitle}>БАЗА ПЕСЕН</Text>
              <Text style={styles.libSubtitle}>{allSongs.length} песен ({customSongs.length} своих)</Text>
            </View>
            <TouchableOpacity onPress={() => openAddSong()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7c4dff22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#7c4dff44', marginRight: 8 }}>
              <Ionicons name="add-circle-outline" size={16} color="#7c4dff" />
              <Text style={{ color: '#7c4dff', fontSize: 11, fontWeight: '700' }}>ДОБАВИТЬ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowLibrary(false)} style={styles.libClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.libSearchRow}>
            <Ionicons name="search" size={16} color="#444" style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.libSearchInput}
              placeholder="Название, исполнитель, аккорды..."
              placeholderTextColor="#333"
              value={libSearch}
              onChangeText={setLibSearch}
              autoCorrect={false}
            />
            {libSearch ? (
              <TouchableOpacity onPress={() => setLibSearch('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={16} color="#444" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter chips row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.libGenreScroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 5 }}>

            {/* Favourites toggle */}
            <TouchableOpacity onPress={() => setLibFavOnly(v => !v)}
              style={[styles.libGenrePill, libFavOnly && { backgroundColor: '#ff9800', borderColor: '#ff9800' }]}>
              <Text style={[styles.libGenreText, libFavOnly && { color: '#000' }]}>⭐ Избранное</Text>
            </TouchableOpacity>

            {/* Difficulty */}
            {([0,1,2,3] as const).map(d => {
              const labels = ['● Все', '● Легко', '● Средне', '● Сложно'];
              const colors = ['#555','#00e676','#ffeb3b','#ff5252'];
              return (
                <TouchableOpacity key={d} onPress={() => setLibDiff(d)}
                  style={[styles.libGenrePill, libDiff === d && { backgroundColor: colors[d], borderColor: colors[d] }]}>
                  <Text style={[styles.libGenreText, libDiff === d && { color: '#0a0a0f', fontWeight: '800' }]}>{labels[d]}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Genre separator */}
            <View style={{ width: 1, backgroundColor: '#1e1e28', marginVertical: 4 }} />

            {/* Genre pills */}
            {GENRES_ALL.map(g => (
              <TouchableOpacity key={g} onPress={() => setLibGenre(g)}
                style={[styles.libGenrePill, libGenre === g && styles.libGenrePillActive]}>
                <Text style={[styles.libGenreText, libGenre === g && { color: '#0a0a0f' }]}>
                  {g || 'Все жанры'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sort + count row */}
          <View style={styles.libLegend}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['title','artist','bpm'] as const).map(s => (
                <TouchableOpacity key={s} onPress={() => setLibSortBy(s)}
                  style={[{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#1e1e28' },
                    libSortBy === s && { borderColor: '#7c4dff44', backgroundColor: '#7c4dff15' }]}>
                  <Text style={{ color: libSortBy === s ? '#7c4dff' : '#444', fontSize: 10, fontWeight: '700' }}>
                    {s === 'title' ? 'А→Я' : s === 'artist' ? 'Автор' : 'BPM'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.libCount}>{libResults.length} из {allSongs.length}</Text>
          </View>

          {/* Song list */}
          <FlatList
            data={libResults}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item }) => {
              const diffColor = item.difficulty === 1 ? '#00e676' : item.difficulty === 2 ? '#ffeb3b' : '#ff5252';
              const isFav = favorites.has(item.id);
              const isCustom = item.id.startsWith('custom_');
              return (
                <TouchableOpacity style={styles.libItem} onPress={() => pickSong(item)} activeOpacity={0.7}>
                  <View style={[styles.libItemDot, { backgroundColor: diffColor }]} />
                  <View style={styles.libItemInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={styles.libItemTitle}>{item.title}</Text>
                      {isCustom && <Text style={{ color: '#7c4dff', fontSize: 9, fontWeight: '800' }}>МОЯ</Text>}
                    </View>
                    <Text style={styles.libItemArtist}>{item.artist}</Text>
                    <Text style={styles.libItemChords} numberOfLines={1}>{item.chords}</Text>
                  </View>
                  <View style={styles.libItemRight}>
                    {item.lyrics ? <Text style={styles.libItemHasLyrics}>♪ текст</Text> : null}
                    <Text style={styles.libItemGenre}>{item.genre}</Text>
                    {item.bpm ? <Text style={styles.libItemBpm}>{item.bpm} BPM</Text> : null}
                    {item.key ? <Text style={styles.libItemKey}>{item.key}</Text> : null}
                  </View>
                  {/* Favorite star */}
                  <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={{ padding: 6 }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name={isFav ? 'star' : 'star-outline'} size={18}
                      color={isFav ? '#ff9800' : '#333'} />
                  </TouchableOpacity>
                  {/* Edit/delete for custom songs */}
                  {isCustom && (
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      <TouchableOpacity onPress={() => openAddSong(item)} style={{ padding: 6 }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="create-outline" size={16} color="#555" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => Alert.alert('Удалить?', item.title, [
                        { text: 'Отмена' },
                        { text: 'Удалить', style: 'destructive', onPress: () => deleteCustomSong(item.id) },
                      ])} style={{ padding: 6 }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="trash-outline" size={16} color="#c0392b" />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      {/* ── Add / Edit Song Modal ── */}
      <Modal visible={showAddSong} animationType="slide" onRequestClose={() => setShowAddSong(false)}>
        <View style={[styles.libModal, { paddingTop: insets.top + 8 }]}>
          <View style={styles.libHeader}>
            <Text style={styles.libTitle}>{editingSong ? 'РЕДАКТИРОВАТЬ' : 'ДОБАВИТЬ ПЕСНЮ'}</Text>
            <TouchableOpacity onPress={() => setShowAddSong(false)} style={styles.libClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">

            {/* Title */}
            <Text style={styles.addFieldLabel}>Название *</Text>
            <TextInput style={styles.addFieldInput} value={addForm.title}
              onChangeText={v => setAddForm(f => ({ ...f, title: v }))}
              placeholder="Название песни" placeholderTextColor="#333" />

            {/* Artist */}
            <Text style={styles.addFieldLabel}>Исполнитель</Text>
            <TextInput style={styles.addFieldInput} value={addForm.artist}
              onChangeText={v => setAddForm(f => ({ ...f, artist: v }))}
              placeholder="Исполнитель / группа" placeholderTextColor="#333" />

            {/* Genre */}
            <Text style={styles.addFieldLabel}>Жанр</Text>
            <TextInput style={styles.addFieldInput} value={addForm.genre}
              onChangeText={v => setAddForm(f => ({ ...f, genre: v }))}
              placeholder="Рок, Поп, Бардовская..." placeholderTextColor="#333" />

            {/* Key + BPM row */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.addFieldLabel}>Тональность</Text>
                <TextInput style={styles.addFieldInput} value={addForm.key}
                  onChangeText={v => setAddForm(f => ({ ...f, key: v }))}
                  placeholder="Am, G, D..." placeholderTextColor="#333" autoCapitalize="none" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addFieldLabel}>BPM</Text>
                <TextInput style={styles.addFieldInput} value={addForm.bpm}
                  onChangeText={v => setAddForm(f => ({ ...f, bpm: v.replace(/[^0-9]/g,'') }))}
                  placeholder="120" placeholderTextColor="#333" keyboardType="number-pad" />
              </View>
            </View>

            {/* Difficulty */}
            <Text style={styles.addFieldLabel}>Сложность</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['1','Легко','#00e676'],['2','Средне','#ffeb3b'],['3','Сложно','#ff5252']] as const).map(([val,lbl,col]) => (
                <TouchableOpacity key={val} onPress={() => setAddForm(f => ({ ...f, difficulty: val }))}
                  style={[{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#1e1e28', backgroundColor: '#111118' },
                    addForm.difficulty === val && { borderColor: col, backgroundColor: col + '22' }]}>
                  <Text style={{ color: addForm.difficulty === val ? col : '#555', fontWeight: '700', fontSize: 12 }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Chords */}
            <Text style={styles.addFieldLabel}>Аккорды * <Text style={{ color: '#444', fontWeight: '400' }}>(через пробел)</Text></Text>
            <TextInput style={styles.addFieldInput} value={addForm.chords}
              onChangeText={v => setAddForm(f => ({ ...f, chords: v }))}
              placeholder="Am F C G Em7 Dm..." placeholderTextColor="#333"
              autoCapitalize="none" autoCorrect={false} />

            {/* Lyrics */}
            <Text style={styles.addFieldLabel}>Текст с аккордами <Text style={{ color: '#444', fontWeight: '400' }}>(необязательно)</Text></Text>
            <Text style={{ color: '#333', fontSize: 10, marginTop: -6, marginBottom: 4 }}>Формат: [Am]Слово [F]другое слово</Text>
            <TextInput style={[styles.addFieldInput, { minHeight: 120, textAlignVertical: 'top' }]}
              value={addForm.lyrics}
              onChangeText={v => setAddForm(f => ({ ...f, lyrics: v }))}
              placeholder={'[Am]Слово [F]другое слово\n[C]Следующая строка [G]'}
              placeholderTextColor="#333"
              multiline scrollEnabled={false} />

            {/* Save button */}
            <TouchableOpacity onPress={submitAddSong}
              style={{ backgroundColor: '#7c4dff', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 1 }}>
                {editingSong ? 'СОХРАНИТЬ' : 'ДОБАВИТЬ В БАЗУ'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowAddSong(false)}
              style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: '#444', fontSize: 13 }}>Отмена</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Hidden engine WebView — baseUrl required for getUserMedia on Android */}
      <WebView
        ref={wvRef}
        source={{ html: ENGINE_HTML, baseUrl: 'https://localhost' }}
        style={styles.hiddenWV}
        onMessage={handleWVMessage}
        onLoadEnd={handleWVLoad}
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
  hiddenWV:    { position: 'absolute', width: 1, height: 1, opacity: 0 },
  liveErrorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ff525211', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ff525244' },
  liveErrorText: { flex: 1, color: '#ff5252', fontSize: 12, lineHeight: 18 },

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

  /* Live mode layout */
  liveTop:    { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#0a0a0f', borderBottomWidth: 1, borderColor: '#1e1e28' },
  liveSegOuter:  { flex: 1, backgroundColor: '#0d0d14', borderTopWidth: 1, borderColor: '#1a1a24' },
  liveSeqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#1a1a24' },
  liveSeqTitle:  { color: '#555', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  liveSegEmpty:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  liveSeqEmpty:  { color: '#333', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  /* chord segment row */
  liveSegRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  liveSegChord:  { color: '#ccc', fontSize: 18, fontWeight: '900', width: 52, textAlign: 'right' },
  liveSegBarWrap:{ flex: 1, height: 8, backgroundColor: '#1a1a24', borderRadius: 4 },
  liveSegBar:    { height: 8, backgroundColor: '#7c4dff88', borderRadius: 4 },
  liveSegDur:    { color: '#444', fontSize: 11, width: 34, textAlign: 'right' },
  liveSaveBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#7c4dff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  liveSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  liveActions:   { flexDirection: 'row', gap: 8, padding: 10, paddingBottom: 10, borderTopWidth: 1, borderColor: '#1a1a24' },
  liveClearBtn:  { backgroundColor: '#1a1a24', borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center', width: 50 },

  /* Practice mode — chord input */
  bigLibBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#7c4dff', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 10, marginTop: 8, marginBottom: 4, borderRadius: 12 },
  bigLibBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  lyricsScroll: { backgroundColor: '#0a0a0f' },
  practiceToolbarAbs: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 8, padding: 10, paddingBottom: 10, backgroundColor: '#0a0a0f', borderTopWidth: 1, borderColor: '#1a1a24' },
  progInput:     { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderColor: '#1e1e28', backgroundColor: '#0d0d14' },
  progTextField: { flex: 1, backgroundColor: '#1a1a24', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, color: '#ccc', fontSize: 14, borderWidth: 1, borderColor: '#2a2a3a' },
  progParseBtn:  { backgroundColor: '#ff9800', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  progParseBtnText: { color: '#000', fontWeight: '800', fontSize: 12 },
  progImportBtn: { padding: 6 },

  /* Chord navigation */
  chordNav:        { flexShrink: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', borderBottomWidth: 1, borderColor: '#1e1e28', paddingVertical: 6 },
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
  chordTonePill:   { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#1e1e2e', borderRadius: 8, borderWidth: 1, borderColor: '#3a3a55' },
  chordTonePillActive: { backgroundColor: '#00e67633', borderColor: '#00e676' },
  chordToneText:   { color: '#aaa', fontSize: 12, fontWeight: '700' },
  chordTonesEmpty: { color: '#555', fontSize: 11 },
  centsWrap:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  centsEdge:  { color: '#333', fontSize: 8, width: 18 },
  centsTrack: { flex: 1, height: 6, backgroundColor: '#1a1a24', borderRadius: 3, position: 'relative' },
  centsMid:   { position: 'absolute', left: '50%' as any, top: 0, bottom: 0, width: 1, backgroundColor: '#333' },
  centsThumb: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff9800', marginLeft: -6 },
  centsVal:   { color: '#888', fontSize: 9, width: 32, textAlign: 'right' },
  voiceRight: { alignItems: 'center', justifyContent: 'center', width: 36 },

  /* Practice: diagram row */
  /* Fixed-height practice panel — no jitter */
  practiceTopPanel:  { flexShrink: 0, flexDirection: 'row', height: 148, backgroundColor: '#0d0d14', borderBottomWidth: 1, borderColor: '#2a2a3a', paddingHorizontal: 12, paddingVertical: 8, gap: 12 },
  practiceDiagLeft:  { alignItems: 'center', justifyContent: 'center' },
  practiceDiagRight: { flex: 1, justifyContent: 'space-between', paddingTop: 2 },
  practiceChordName: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  diagRow:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, gap: 12, backgroundColor: '#0d0d14', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a24' },
  diagBox:      { alignItems: 'center', justifyContent: 'center' },
  diagInfo:     { flex: 1, gap: 4, paddingTop: 4 },
  diagChordName:{ color: '#ff9800', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  diagVoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  diagVoiceNote:{ fontSize: 16, fontWeight: '800' },
  diagVoiceHz:  { color: '#666', fontSize: 10 },

  lyricsPanel: { flexGrow: 1, flexShrink: 1, flexBasis: 0, backgroundColor: '#0a0a0f', borderTopWidth: 1, borderColor: '#1a1a24', overflow: 'hidden' },
  lyricsPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderBottomWidth: 1, borderColor: '#1a1a24', backgroundColor: '#0d0d14' },
  lyricsPanelTitle: { color: '#555', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  lyricsEmpty: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  lyricsEmptyText: { color: '#888', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  lyricsEmptyHint: { color: '#555', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  lyricsEmptyBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#1e1e28', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 6 },
  lyricsEmptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  lyricsImportBtn:  { color: '#ff9800', fontSize: 10 },
  lyricsInput: { color: '#ccc', fontSize: 14, lineHeight: 24, padding: 12, minHeight: 200 },

  practiceToolbar: { flexShrink: 0, flexDirection: 'row', gap: 8, padding: 10, paddingBottom: 12, borderTopWidth: 1, borderColor: '#1a1a24' },
  recBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a24', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#2a2a3a' },
  recBtnActive:{ borderColor: '#ff525244', backgroundColor: '#ff525211' },
  recBtnText:  { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  recDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#555' },
  recDotActive:{ backgroundColor: '#ff5252' },

  /* Identify mode — search UI */
  identTabRow:  { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1e1e28', backgroundColor: '#0d0d14' },
  identTab:     { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, borderRightWidth: 1, borderColor: '#1e1e28', borderWidth: 1, borderTopWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  identTabText: { color: '#444', fontSize: 10, fontWeight: '700' },
  identActionArea:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24, paddingBottom: 20 },
  identActionTitle: { color: '#ccc', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  identActionSub:   { color: '#444', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  identBtnBig:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16, backgroundColor: '#7c4dff88' },
  identBtnBigText:  { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  recProgressBig:   { alignItems: 'center', gap: 12 },
  recSecsBig:       { color: '#7c4dff', fontSize: 28, fontWeight: '900' },
  identFooter:      { color: '#222', fontSize: 10, textAlign: 'center', position: 'absolute', bottom: 8 },

  /* Identify mode — full-screen result */
  resultPage:       { padding: 16, gap: 6 },
  resultTopBar:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  resultFound:      { color: '#00e676', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  resultNewSearchBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#7c4dff22', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#7c4dff44' },
  resultNewSearchText: { color: '#7c4dff', fontSize: 11, fontWeight: '700' },
  resultTitle:      { color: '#f0f0f0', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 2 },
  resultArtist:     { color: '#888', fontSize: 15, marginBottom: 2 },
  resultMeta:       { color: '#444', fontSize: 12, marginBottom: 8 },
  resultActions:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  chordsBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#7c4dff22', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#7c4dff44' },
  chordsBtnText:    { color: '#ccc', fontSize: 12, fontWeight: '700' },
  resultDivider:    { height: 1, backgroundColor: '#1e1e28', marginVertical: 14 },
  resultLyricsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  resultLyricsText: { color: '#aaa', fontSize: 14, lineHeight: 24 },
  lyricsLabel:      { color: '#444', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  lyricsEmpty:      { color: '#333', fontSize: 13, fontStyle: 'italic', marginTop: 12 },

  cancelBtn:  { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a1a24', borderRadius: 10 },
  cancelText: { color: '#888', fontSize: 13 },
  urlInput:   { backgroundColor: '#1a1a24', borderRadius: 10, padding: 10, color: '#ccc', fontSize: 13, borderWidth: 1, borderColor: '#2a2a3a' },

  /* Practice input: library button */
  libBtn:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#7c4dff22', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#7c4dff44' },
  libBtnText:  { color: '#7c4dff', fontSize: 9, fontWeight: '800' },

  /* Song Library Modal */
  libModal:    { flex: 1, backgroundColor: '#0a0a0f' },
  libHeader:   { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#1e1e28' },
  libTitle:    { color: '#7c4dff', fontSize: 13, fontWeight: '900', letterSpacing: 3 },
  libSubtitle: { color: '#333', fontSize: 11, marginTop: 2, marginBottom: 2 },
  libClose:    { position: 'absolute', right: 12, top: 0 },

  libSearchRow:  { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: '#111118', borderRadius: 12, borderWidth: 1, borderColor: '#1e1e28' },
  libSearchInput:{ flex: 1, color: '#ccc', fontSize: 14, padding: 10 },
  libGenreScroll:{ flexShrink: 0, maxHeight: 42 },
  libGenrePill:  { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#111118', borderRadius: 20, borderWidth: 1, borderColor: '#1e1e28' },
  libGenrePillActive: { backgroundColor: '#7c4dff', borderColor: '#7c4dff' },
  libGenreText:  { color: '#555', fontSize: 11, fontWeight: '600' },

  libLegend:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 4 },
  libDot:      { fontSize: 10 },
  libLegText:  { color: '#444', fontSize: 10, marginRight: 6 },
  libCount:    { color: '#333', fontSize: 10 },

  libItem:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: '#111118' },
  libItemDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  libItemInfo:  { flex: 1 },
  libItemTitle: { color: '#eee', fontSize: 14, fontWeight: '700' },
  libItemArtist:{ color: '#999', fontSize: 12, marginTop: 1 },
  libItemChords:{ color: '#9c7cff', fontSize: 11, marginTop: 3 },
  libItemRight: { alignItems: 'flex-end', gap: 3 },
  libItemGenre: { color: '#666', fontSize: 10 },
  libItemBpm:   { color: '#555', fontSize: 10 },
  libItemKey:   { color: '#888', fontSize: 10, fontWeight: '700' },
  libItemHasLyrics: { color: '#00e676', fontSize: 9 },

  /* Add/Edit Song form */
  addFieldLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  addFieldInput: { backgroundColor: '#111118', borderRadius: 10, borderWidth: 1, borderColor: '#1e1e28', color: '#ddd', fontSize: 14, padding: 11 },
});
