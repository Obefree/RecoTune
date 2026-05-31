/**
 * AILabScreen — Two tools:
 *  1. АККОРДЫ: Analyse an audio file → chord progression timeline + key + BPM
 *     · Play/preview the loaded file before/after analysis
 *  2. ДОРОЖКИ: DSP (демо, WebView) или Demucs на ПК (нейросеть).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, FlatList, TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { applyPlaybackAudioMode } from '../utils/playbackAudioMode';
import { importStemsToStudio } from '../utils/studioImport';
import { assertPlaybackFileExists } from '../utils/playbackUri';
import { StemSeparateError, probeStemServer, separateStemsOnServer } from '../providers/stemSeparateClient';
import { resolveStemSeparateUrl, resolveStemSeparateUrlDetailed, stemSeparateSetupHint } from '../providers/stemSeparateUrl';

/* ─── Types ─── */
interface ChordEvent { time: number; chord: string; confidence: number }
type StemOutputMode = 'all' | 'vocals' | 'minus';
type StemEngine = 'dsp' | 'neural';

interface StemItem {
  id: string;
  label: string;
  color: string;
  b64: string;
  sizeKb: number;
  uri?: string;
  sound?: Audio.Sound;
  playing: boolean;
  position: number;
  duration: number;
  loadError?: string;
}

/* ─── Chord analysis WebView ─── */
const CHORD_ANALYSIS_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#000"><script>
const NOTE=[' C','C#',' D','D#',' E',' F','F#',' G','G#',' A','A#',' B'];
const TEMPLATES={'':  [0,4,7],'m':[0,3,7],'7':[0,4,7,10],'maj7':[0,4,7,11],'m7':[0,3,7,10],'dim':[0,3,6],'aug':[0,4,8]};
const MIN_CONF=0.45,CHROMA_BIN_DB=-68,MIN_CHROMA_SUM=0.32;
const MAJOR_P=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_P=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}
function b64ToAB(b64){const bin=atob(b64);const ab=new ArrayBuffer(bin.length);const u8=new Uint8Array(ab);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return ab;}
function chroma(fftData,sr,fftSz){
  const c=new Float32Array(12);const bHz=sr/fftSz;
  for(let i=1;i<fftData.length;i++){const f=i*bHz;if(f<80||f>2200)continue;const db=fftData[i];if(db<CHROMA_BIN_DB)continue;const e=Math.pow(10,db/20);const m=Math.round(12*Math.log2(f/440)+69);c[((m%12)+12)%12]+=e;}
  const mx=Math.max(...c);if(mx>0)for(let i=0;i<12;i++)c[i]/=mx;return c;
}
function detectChord(c){let best={name:'?',conf:-Infinity};for(let r=0;r<12;r++){for(const[t,ivs]of Object.entries(TEMPLATES)){let sc=0;for(let i=0;i<12;i++){const ct=ivs.some(iv=>(r+iv)%12===i);sc+=ct?c[i]:-0.4*c[i];}if(sc>best.conf)best={name:NOTE[r].trim()+t,conf:sc};}}return best;}
function estimateKey(c){let bk='',bs=-Infinity;for(let r=0;r<12;r++){let mj=0,mn=0;for(let i=0;i<12;i++){mj+=c[(i+r)%12]*MAJOR_P[i];mn+=c[(i+r)%12]*MINOR_P[i];}if(mj>bs){bs=mj;bk=NOTE[r].trim()+' major';}if(mn>bs){bs=mn;bk=NOTE[r].trim()+' minor';}}return bk;}
function detectBpm(buf){const sr=buf.sampleRate;const ch=buf.getChannelData(0);const hop=Math.round(sr*0.01);const frames=Math.floor(ch.length/hop);const energy=new Float32Array(frames);for(let i=0;i<frames;i++){let e=0;for(let s=0;s<hop;s++)e+=ch[i*hop+s]**2;energy[i]=e/hop;}const onsets=[];for(let i=2;i<frames-1;i++){if(energy[i]>energy[i-1]*2&&energy[i]>energy[i-2]*2&&energy[i]>0.001){onsets.push(i*hop/sr);i+=10;}}if(onsets.length<4)return 0;const ioi=[];for(let i=1;i<onsets.length;i++)ioi.push(onsets[i]-onsets[i-1]);ioi.sort((a,b)=>a-b);const med=ioi[Math.floor(ioi.length/2)];if(med<=0)return 0;let bpm=Math.round(60/med);while(bpm<60&&bpm>0)bpm*=2;while(bpm>240)bpm=Math.round(bpm/2);return bpm;}
async function analyze(b64,segSec){
  try{
    post({type:'progress',msg:'Декодирование аудио...'});
    const ab=b64ToAB(b64);const tmpCtx=new OfflineAudioContext(1,1,44100);
    const buf=await tmpCtx.decodeAudioData(ab);const sr=buf.sampleRate;const dur=buf.duration;
    post({type:'progress',msg:'Анализ темпа...'});
    const bpm=detectBpm(buf);
    const fftSz=8192;const events=[];const globalChroma=new Float32Array(12);
    const stepSamples=Math.round(sr*segSec);const steps=Math.floor(buf.length/stepSamples);
    for(let step=0;step<steps;step++){
      const segLen=Math.min(stepSamples,buf.length-step*stepSamples);
      const segCtx=new OfflineAudioContext(1,Math.max(segLen,fftSz),sr);
      const src=segCtx.createBufferSource();const segBuf=segCtx.createBuffer(1,Math.max(segLen,fftSz),sr);
      const src0=buf.getChannelData(0);const dst=segBuf.getChannelData(0);
      for(let i=0;i<segLen;i++)dst[i]=src0[step*stepSamples+i];
      src.buffer=segBuf;const analyserNode=segCtx.createAnalyser();analyserNode.fftSize=fftSz;analyserNode.smoothingTimeConstant=0;
      src.connect(analyserNode);analyserNode.connect(segCtx.destination);src.start(0);await segCtx.startRendering();
      const fft=new Float32Array(analyserNode.frequencyBinCount);analyserNode.getFloatFrequencyData(fft);
      const c=chroma(fft,sr,fftSz);for(let i=0;i<12;i++)globalChroma[i]+=c[i];
      const sum=c.reduce((s,v)=>s+v,0);
      const chord=detectChord(c);
      const ok=chord.conf>=MIN_CONF&&sum>=MIN_CHROMA_SUM;
      events.push({time:parseFloat((step*segSec).toFixed(2)),chord:ok?chord.name:'?',confidence:parseFloat(chord.conf.toFixed(2))});
      if(step%5===0)post({type:'progress',msg:'Анализ '+Math.round((step/steps)*100)+'%...'});
    }
    const mx=Math.max(...globalChroma);if(mx>0)for(let i=0;i<12;i++)globalChroma[i]/=mx;
    const key=estimateKey(globalChroma);
    post({type:'done',events,key,bpm,duration:parseFloat(dur.toFixed(1))});
  }catch(e){post({type:'error',msg:String(e)});}
}
window.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='analyze')analyze(m.b64,m.segSec||2);}catch{}});
document.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='analyze')analyze(m.b64,m.segSec||2);}catch{}});
</script></body></html>`;

/* ─── Stem separation WebView — frequency bands + vocal isolation ─── */
const STEM_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#000"><script>
function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}
function b64ToAB(b64){const bin=atob(b64);const ab=new ArrayBuffer(bin.length);const u8=new Uint8Array(ab);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return ab;}
function ab64(ab){const u8=new Uint8Array(ab);let s='';for(let i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);return btoa(s);}
function encodeWAV(L,R,sr,bits){
  const mono=!R;const nc=mono?1:2;const bps=bits/8;
  const samples=L.length;const dataLen=samples*nc*bps;
  const buf=new ArrayBuffer(44+dataLen);const v=new DataView(buf);
  const wr=(off,str)=>{for(let i=0;i<str.length;i++)v.setUint8(off+i,str.charCodeAt(i));};
  wr(0,'RIFF');v.setUint32(4,36+dataLen,true);wr(8,'WAVE');
  wr(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,nc,true);v.setUint32(24,sr,true);v.setUint32(28,sr*nc*bps,true);
  v.setUint16(32,nc*bps,true);v.setUint16(34,bits,true);
  wr(36,'data');v.setUint32(40,dataLen,true);
  let off=44;const clamp=(x)=>Math.max(-1,Math.min(1,x));
  const write=(val)=>{if(bits===16){v.setInt16(off,clamp(val)*32767,true);off+=2;}else{v.setInt32(off,clamp(val)*2147483647,true);off+=4;}};
  for(let i=0;i<samples;i++){write(L[i]);if(!mono)write(R[i]);}
  return buf;
}
async function applyBandFilter(origBuf,lo,hi,sr,len,stereo){
  const offCtx=new OfflineAudioContext(stereo?2:1,len,sr);
  const src=offCtx.createBufferSource();src.buffer=origBuf;
  const lpF=offCtx.createBiquadFilter();lpF.type='highpass';lpF.frequency.value=lo;lpF.Q.value=0.7;
  const hpF=offCtx.createBiquadFilter();hpF.type='lowpass'; hpF.frequency.value=hi;hpF.Q.value=0.7;
  src.connect(lpF);lpF.connect(hpF);hpF.connect(offCtx.destination);
  src.start(0);return offCtx.startRendering();
}
async function separate(b64,mode){
  try{
    const m=mode||'all';
    const wantBands=m==='all';
    const wantVocals=m==='all'||m==='vocals';
    const wantMinus=m==='all'||m==='minus';
    post({type:'progress',msg:'Декодирование аудио...'});
    const ab=b64ToAB(b64);
    const tmpCtx=new OfflineAudioContext(1,1,44100);
    const origBuf=await tmpCtx.decodeAudioData(ab);
    const sr=origBuf.sampleRate;const len=origBuf.length;
    const stereo=origBuf.numberOfChannels>1;
    const results=[];
    const L=origBuf.getChannelData(0);
    const R=stereo?origBuf.getChannelData(1):origBuf.getChannelData(0);
    let vocalData=null;

    if(wantBands){
      post({type:'progress',msg:'Бас...'});
      const bassR=await applyBandFilter(origBuf,20,250,sr,len,stereo);
      const bL=bassR.getChannelData(0);const bR=stereo?bassR.getChannelData(1):null;
      results.push({id:'bass',label:'Бас',color:'#7c4dff',b64:ab64(encodeWAV(bL,bR,sr,16)),sizeKb:Math.round((44+len*(stereo?4:2))/1024)});
      post({type:'progress',msg:'Средние частоты...'});
      const midR=await applyBandFilter(origBuf,250,4000,sr,len,stereo);
      const mL=midR.getChannelData(0);const mR=stereo?midR.getChannelData(1):null;
      results.push({id:'mid',label:'Середина',color:'#00e676',b64:ab64(encodeWAV(mL,mR,sr,16)),sizeKb:Math.round((44+len*(stereo?4:2))/1024)});
      post({type:'progress',msg:'Высокие частоты...'});
      const hiR=await applyBandFilter(origBuf,4000,20000,sr,len,stereo);
      const hL=hiR.getChannelData(0);const hR=stereo?hiR.getChannelData(1):null;
      results.push({id:'hi',label:'Высокие',color:'#40c4ff',b64:ab64(encodeWAV(hL,hR,sr,16)),sizeKb:Math.round((44+len*(stereo?4:2))/1024)});
    }

    if(wantVocals||wantMinus){
      post({type:'progress',msg:'Выделение вокала...'});
      const centerCtx=new OfflineAudioContext(1,len,sr);
      const centerBuf=centerCtx.createBuffer(1,len,sr);
      const centerData=centerBuf.getChannelData(0);
      for(let i=0;i<len;i++)centerData[i]=(L[i]+R[i])*0.5;
      const vSrc=centerCtx.createBufferSource();vSrc.buffer=centerBuf;
      const vHP=centerCtx.createBiquadFilter();vHP.type='highpass';vHP.frequency.value=200;vHP.Q.value=0.5;
      const vLP=centerCtx.createBiquadFilter();vLP.type='lowpass'; vLP.frequency.value=5000;vLP.Q.value=0.5;
      vSrc.connect(vHP);vHP.connect(vLP);vLP.connect(centerCtx.destination);
      vSrc.start(0);
      const vocalR=await centerCtx.startRendering();
      vocalData=vocalR.getChannelData(0);
      if(wantVocals){
        results.push({id:'vocals',label:'Вокал',color:'#ff9800',b64:ab64(encodeWAV(vocalData,null,sr,16)),sizeKb:Math.round((44+len*2)/1024)});
      }
    }

    if(wantMinus){
      if(!vocalData){
        const centerCtx=new OfflineAudioContext(1,len,sr);
        const centerBuf=centerCtx.createBuffer(1,len,sr);
        const centerData=centerBuf.getChannelData(0);
        for(let i=0;i<len;i++)centerData[i]=(L[i]+R[i])*0.5;
        const vSrc=centerCtx.createBufferSource();vSrc.buffer=centerBuf;
        const vHP=centerCtx.createBiquadFilter();vHP.type='highpass';vHP.frequency.value=200;vHP.Q.value=0.5;
        const vLP=centerCtx.createBiquadFilter();vLP.type='lowpass'; vLP.frequency.value=5000;vLP.Q.value=0.5;
        vSrc.connect(vHP);vHP.connect(vLP);vLP.connect(centerCtx.destination);
        vSrc.start(0);
        vocalData=(await centerCtx.startRendering()).getChannelData(0);
      }
      post({type:'progress',msg:'Минус (инструментал)...'});
      const karL=new Float32Array(len);const karR=new Float32Array(len);
      for(let i=0;i<len;i++){karL[i]=L[i]-vocalData[i];karR[i]=R[i]-vocalData[i];}
      results.push({id:'minus',label:'Минус',color:'#ff5252',b64:ab64(encodeWAV(karL,karR,sr,16)),sizeKb:Math.round((44+len*4)/1024)});
    }

    post({type:'done',stems:results});
  }catch(e){post({type:'error',msg:String(e)});}
}
window.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='separate')separate(m.b64,m.mode);}catch{}});
document.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='separate')separate(m.b64,m.mode);}catch{}});
</script></body></html>`;

/* ─── App sandbox audio folders (same as RecorderScreen / StudioScreen) ─── */
const RECORDINGS_DIR = (FileSystem.documentDirectory ?? '') + 'recordings/';
const STUDIO_DIR     = (FileSystem.documentDirectory ?? '') + 'studio/';
const APP_AUDIO_EXT  = /\.(m4a|wav|mp3|aac|caf)$/i;

interface AppAudioRow { uri: string; name: string; badge: string }

/* ─── Helpers ─── */
function fmt(s: number) { return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }
function fmtMs(ms: number) { return fmt(ms / 1000); }

const STEM_ENGINE_OPTIONS: { id: StemEngine; label: string; sub: string; color: string }[] = [
  { id: 'dsp', label: 'DSP (демо)', sub: 'быстро на устройстве', color: '#40c4ff' },
  { id: 'neural', label: 'Нейросеть (ПК)', sub: 'Demucs, нужен ПК', color: '#00e676' },
];

function stemModeOptions(engine: StemEngine): { id: StemOutputMode; label: string; sub: string; color: string }[] {
  const allSub = engine === 'neural' ? 'вокал + минус' : 'бас · сер · верх';
  return [
    { id: 'vocals', label: 'ВОКАЛ', sub: 'только голос', color: '#ff9800' },
    { id: 'minus', label: 'МИНУС', sub: 'без вокала', color: '#ff5252' },
    { id: 'all', label: engine === 'neural' ? 'ОБА' : 'ВСЕ 5', sub: allSub, color: '#40c4ff' },
  ];
}

export default function AILabScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<Record<string, object | undefined>>>();
  const { height: windowHeight } = useWindowDimensions();
  const [tab, setTab] = useState<'chords' | 'stems'>('chords');

  /* ── Chord analysis state ── */
  const [chordsStatus, setChordsStatus]   = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [chordsMsg, setChordsMsg]         = useState('');
  const [chordEvents, setChordEvents]     = useState<ChordEvent[]>([]);
  const [songKey, setSongKey]             = useState('');
  const [songBpm, setSongBpm]             = useState(0);
  const [songDur, setSongDur]             = useState(0);
  const [chordsHtml, setChordsHtml]       = useState<string | null>(null);

  /* ── File preview (chord analysis tab) ── */
  const [previewUri, setPreviewUri]       = useState<string | null>(null);
  const [previewSound, setPreviewSound]   = useState<Audio.Sound | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewName, setPreviewName]     = useState('');

  /* ── Stem separation state ── */
  const [stemEngine, setStemEngine]       = useState<StemEngine>('dsp');
  const [stemServerReady, setStemServerReady] = useState(false);
  const [stemServerHint, setStemServerHint]   = useState('');
  const [stemServerUrl, setStemServerUrl]     = useState('');
  const [stemServerSource, setStemServerSource] = useState('');
  const [stemOutputMode, setStemOutputMode] = useState<StemOutputMode>('minus');
  const [stemStatus, setStemStatus]       = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [stemMsg, setStemMsg]             = useState('');
  const [stemItems, setStemItems]         = useState<StemItem[]>([]);
  const [stemHtml, setStemHtml]           = useState<string | null>(null);

  const chordsWvRef = useRef<WebView>(null);
  const stemsWvRef  = useRef<WebView>(null);
  const stemItemsRef = useRef<StemItem[]>([]);

  const [appModalVisible, setAppModalVisible] = useState(false);
  const [appAudioRows, setAppAudioRows]     = useState<AppAudioRow[]>([]);

  useEffect(() => {
    stemItemsRef.current = stemItems;
  }, [stemItems]);

  useEffect(() => {
    if (tab !== 'stems') return;
    let cancelled = false;
    (async () => {
      const resolved = resolveStemSeparateUrlDetailed();
      const url = resolved.separateUrl;
      if (!cancelled) {
        setStemServerUrl(url);
        setStemServerSource(resolved.sourceLabel);
      }
      if (!url) {
        if (!cancelled) {
          setStemServerReady(false);
          setStemServerHint('Сервер не найден (запустите npm start на ПК в той же Wi‑Fi — :8788)');
        }
        return;
      }
      const health = await probeStemServer(url);
      if (cancelled) return;
      if (health.ok && health.demucs) {
        setStemServerReady(true);
        setStemServerHint(resolved.sourceLabel);
      } else {
        setStemServerReady(false);
        setStemServerHint(
          health.demucsError || health.error || 'Demucs не установлен на ПК',
        );
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  /* ── Cleanup sounds on unmount ── */
  useEffect(() => {
    return () => {
      previewSound?.unloadAsync();
      stemItemsRef.current.forEach(s => s.sound?.unloadAsync());
    };
  }, [previewSound]);

  /* ── File preview: load and toggle ── */
  const loadPreview = useCallback(async (uri: string, name: string) => {
    try {
      await previewSound?.unloadAsync();
      setPreviewPlaying(false);
      await applyPlaybackAudioMode();
      const playbackUri = await assertPlaybackFileExists(uri);
      const { sound } = await Audio.Sound.createAsync({ uri: playbackUri }, {}, (status) => {
        if (status.isLoaded) setPreviewPlaying(status.isPlaying ?? false);
      });
      setPreviewSound(sound);
      setPreviewUri(uri);
      setPreviewName(name);
    } catch {}
  }, [previewSound]);

  const togglePreview = useCallback(async () => {
    if (!previewSound) return;
    if (previewPlaying) {
      await previewSound.pauseAsync();
    } else {
      await previewSound.playAsync();
    }
  }, [previewSound, previewPlaying]);

  const analyseWithUri = useCallback(async (uri: string, displayName: string) => {
    try {
      setChordsStatus('loading');
      setChordsMsg('Чтение файла...');
      setChordEvents([]); setSongKey(''); setSongBpm(0); setSongDur(0);

      await loadPreview(uri, displayName);
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      setChordsHtml(CHORD_ANALYSIS_HTML);
      setTimeout(() => {
        chordsWvRef.current?.injectJavaScript(`
          (function(){window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({cmd:'analyze',b64:${JSON.stringify(b64)},segSec:2})}));}());true;
        `);
      }, 600);
    } catch (e) {
      Alert.alert('Ошибка', String(e));
      setChordsStatus('error');
    }
  }, [loadPreview]);

  const loadAppAudioRows = useCallback(async (): Promise<AppAudioRow[]> => {
    const rows: AppAudioRow[] = [];
    const scan = async (dir: string, badge: string) => {
      try {
        const info = await FileSystem.getInfoAsync(dir);
        if (!info.exists || !info.isDirectory) return;
        const files = await FileSystem.readDirectoryAsync(dir);
        for (const f of files) {
          if (!APP_AUDIO_EXT.test(f)) continue;
          rows.push({ uri: dir + f, name: f, badge });
        }
      } catch {}
    };
    await scan(RECORDINGS_DIR, 'REC');
    await scan(STUDIO_DIR, 'STUDIO');
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, []);

  const openAppFilesModal = useCallback(async () => {
    const rows = await loadAppAudioRows();
    if (!rows.length) {
      Alert.alert(
        'Нет файлов',
        'Записи Recorder и Studio хранятся внутри приложения. Сначала сделайте запись в Recorder или экспортируйте дорожку в Studio.',
      );
      return;
    }
    setAppAudioRows(rows);
    setAppModalVisible(true);
  }, [loadAppAudioRows]);

  /* ── Pick file and run chord analysis ── */
  const pickAndAnalyse = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    const { uri, name } = res.assets[0];
    await analyseWithUri(uri, name ?? 'аудиофайл');
  }, [analyseWithUri]);

  const handleChordsMsg = useCallback((e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'progress') {
        setChordsMsg(msg.msg);
      } else if (msg.type === 'done') {
        setChordEvents(msg.events);
        setSongKey(msg.key);
        setSongBpm(msg.bpm);
        setSongDur(msg.duration);
        setChordsStatus('done');
        setChordsHtml(null);
      } else if (msg.type === 'error') {
        setChordsStatus('error');
        setChordsMsg(msg.msg);
        setChordsHtml(null);
      }
    } catch {}
  }, []);

  /* ── Export chord sheet ── */
  const exportChordSheet = useCallback(async () => {
    if (!chordEvents.length) return;
    try {
      let txt = `Тональность: ${songKey}  BPM: ${songBpm || '—'}  Длина: ${fmt(songDur)}\n\n`;
      let last = '';
      for (const ev of chordEvents) {
        if (ev.chord !== last && ev.chord !== '?') { txt += `${fmt(ev.time)}  ${ev.chord}\n`; last = ev.chord; }
      }
      const path = `${FileSystem.documentDirectory}chords_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(path, txt);
      await Sharing.shareAsync(path, { mimeType: 'text/plain' });
    } catch (e) { Alert.alert('Ошибка', String(e)); }
  }, [chordEvents, songKey, songBpm, songDur]);

  const persistStemItems = useCallback(async (
    rawStems: { id?: string; label: string; color: string; b64: string; sizeKb: number }[],
  ) => {
    setStemMsg('Сохранение дорожек...');
    await applyPlaybackAudioMode();
    const items: StemItem[] = [];
    const batchTs = Date.now();
    for (let i = 0; i < rawStems.length; i++) {
      const s = rawStems[i];
      const stemId = s.id ?? `stem_${i}`;
      const path = `${FileSystem.cacheDirectory}stem_${stemId}_${batchTs}_${i}.wav`;
      await FileSystem.writeAsStringAsync(path, s.b64, { encoding: FileSystem.EncodingType.Base64 });
      const item: StemItem = {
        id: stemId,
        label: s.label,
        color: s.color,
        b64: s.b64,
        sizeKb: s.sizeKb,
        uri: path,
        playing: false,
        position: 0,
        duration: 0,
      };
      try {
        const playbackUri = await assertPlaybackFileExists(path);
        const { sound } = await Audio.Sound.createAsync(
          { uri: playbackUri },
          { progressUpdateIntervalMillis: 200 },
          (status) => {
            if (!status.isLoaded) return;
            setStemItems(prev => prev.map(si =>
              si.id === stemId
                ? {
                    ...si,
                    playing: status.isPlaying ?? false,
                    position: status.positionMillis ?? 0,
                    duration: status.durationMillis ?? si.duration,
                  }
                : si
            ));
          },
        );
        item.sound = sound;
        const st = await sound.getStatusAsync();
        if (st.isLoaded) item.duration = st.durationMillis ?? 0;
      } catch (err) {
        item.loadError = String(err);
      }
      items.push(item);
    }
    setStemItems(items);
    stemItemsRef.current = items;
    setStemStatus('done');
    setStemHtml(null);
    const failed = items.filter(it => it.loadError);
    if (failed.length) {
      Alert.alert(
        'Воспроизведение',
        `Не удалось подготовить: ${failed.map(f => f.label).join(', ')}. Экспорт WAV всё ещё доступен.`,
      );
    }
  }, []);

  const separateWithUri = useCallback(async (
    uri: string,
    mode: StemOutputMode = stemOutputMode,
    engine: StemEngine = stemEngine,
  ) => {
    try {
      setStemStatus('loading');
      setStemMsg('Чтение файла...');
      stemItemsRef.current.forEach(s => s.sound?.unloadAsync());
      setStemItems([]);

      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && (info as any).size > 20 * 1024 * 1024) {
        Alert.alert('Большой файл', 'Файл > 20 МБ — обработка займёт несколько минут.');
      }

      if (engine === 'neural') {
        const separateUrl = resolveStemSeparateUrl();
        if (!separateUrl) {
          setStemStatus('error');
          setStemMsg(stemSeparateSetupHint());
          return;
        }
        const health = await probeStemServer(separateUrl);
        if (!health.ok || !health.demucs) {
          setStemStatus('error');
          setStemMsg(health.demucsError || health.error || 'Demucs на ПК недоступен');
          return;
        }
        const stems = await separateStemsOnServer(separateUrl, uri, mode, setStemMsg);
        await persistStemItems(stems);
        return;
      }

      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      setStemHtml(STEM_HTML);
      setTimeout(() => {
        stemsWvRef.current?.injectJavaScript(`
          (function(){window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({cmd:'separate',b64:${JSON.stringify(b64)},mode:${JSON.stringify(mode)}})}));}());true;
        `);
      }, 600);
    } catch (e) {
      const msg = e instanceof StemSeparateError ? e.message : String(e);
      setStemStatus('error');
      setStemMsg(msg);
      setStemHtml(null);
    }
  }, [stemOutputMode, stemEngine, persistStemItems]);

  /* ── Pick file and run stem separation ── */
  const pickAndSeparate = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    const { uri } = res.assets[0];
    await separateWithUri(uri);
  }, [separateWithUri]);

  const onPickAppAudioRow = useCallback((row: AppAudioRow) => {
    setAppModalVisible(false);
    if (tab === 'chords') void analyseWithUri(row.uri, `${row.badge} · ${row.name}`);
    else void separateWithUri(row.uri);
  }, [tab, analyseWithUri, separateWithUri]);

  /* ── After stems done: save to temp files + create Sound objects ── */
  const handleStemsMsg = useCallback(async (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'progress') {
        setStemMsg(msg.msg);
      } else if (msg.type === 'done') {
        await persistStemItems(msg.stems as { id?: string; label: string; color: string; b64: string; sizeKb: number }[]);
      } else if (msg.type === 'error') {
        setStemStatus('error');
        setStemMsg(msg.msg);
        setStemHtml(null);
      }
    } catch {}
  }, [persistStemItems]);

  /* ── Play / pause a stem ── */
  const toggleStem = useCallback(async (stemId: string) => {
    const item = stemItemsRef.current.find(s => s.id === stemId);
    if (!item?.sound) {
      Alert.alert('Воспроизведение', item?.loadError ?? 'Аудио не загружено. Попробуйте разделить файл снова.');
      return;
    }
    try {
      await applyPlaybackAudioMode();
      const st = await item.sound.getStatusAsync();
      if (!st.isLoaded) return;
      if (st.isPlaying) {
        await item.sound.pauseAsync();
      } else {
        for (const si of stemItemsRef.current) {
          if (si.id !== stemId && si.sound) {
            const other = await si.sound.getStatusAsync();
            if (other.isLoaded && other.isPlaying) await si.sound.pauseAsync();
          }
        }
        await item.sound.playAsync();
      }
    } catch (err) {
      Alert.alert('Воспроизведение', String(err));
    }
  }, []);

  /* ── Export a stem ── */
  const exportStem = useCallback(async (item: StemItem) => {
    try {
      if (!item.uri) throw new Error('Файл не найден');
      await Sharing.shareAsync(item.uri, { mimeType: 'audio/wav', dialogTitle: `Экспорт: ${item.label}` });
    } catch (e) { Alert.alert('Ошибка', String(e)); }
  }, []);

  const openStemsInStudio = useCallback(async () => {
    const importable = stemItemsRef.current.filter(s => s.uri && !s.loadError);
    if (!importable.length) {
      Alert.alert('Studio', 'Нет готовых дорожек для импорта.');
      return;
    }
    const preferIds = ['minus', 'vocals'];
    const ordered = [
      ...importable.filter(s => preferIds.includes(s.id)),
      ...importable.filter(s => !preferIds.includes(s.id)),
    ].slice(0, 2);
    try {
      await importStemsToStudio(
        ordered.map(s => ({ uri: s.uri!, label: s.label, color: s.color })),
        'Demucs',
      );
      navigation.navigate('Studio');
      Alert.alert(
        'Studio',
        `Импортировано дорожек: ${ordered.length}. Вкладка Studio — сессия «Demucs».`,
      );
    } catch (e) {
      Alert.alert('Studio', String(e));
    }
  }, [navigation]);

  /* ── Chord timeline (deduped) ── */
  const dedupedChords = chordEvents.filter((ev, i) =>
    i === 0 || ev.chord !== chordEvents[i - 1].chord
  ).filter(ev => ev.chord !== '?');

  /* ══════════════════════════════════════════ */
  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI LAB</Text>
        <Text style={styles.subtitle}>Анализ и разделение аудио</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'chords' && styles.tabActive]} onPress={() => setTab('chords')}>
          <Ionicons name="musical-notes" size={15} color={tab === 'chords' ? '#0a0a0f' : '#555'} />
          <Text style={[styles.tabText, tab === 'chords' && styles.tabTextActive]}>АККОРДЫ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'stems' && styles.tabActive]} onPress={() => setTab('stems')}>
          <Ionicons name="git-branch" size={15} color={tab === 'stems' ? '#0a0a0f' : '#555'} />
          <Text style={[styles.tabText, tab === 'stems' && styles.tabTextActive]}>ДОРОЖКИ</Text>
        </TouchableOpacity>
      </View>

      {/* ── CHORD ANALYSIS TAB ── */}
      {tab === 'chords' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 12 }} showsVerticalScrollIndicator={false}>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color="#7c4dff" />
            <Text style={styles.infoText}>
              Загрузите аудиофайл — получите аккорды, тональность и темп.{'\n'}
              Анализ через хромаграмму + шаблонное сопоставление (офлайн, без интернета).{'\n'}
              Точность выше для живых записей гитары/пианино.{'\n'}
              <Text style={{ color: '#666' }}>
                Записи Recorder и Studio лежат внутри приложения (не в папке «Музыка»). Открыть их как обычную папку в проводнике нельзя — выберите файл ниже или через «Другое устройство».
              </Text>
            </Text>
          </View>

          <TouchableOpacity style={styles.actionBtn} onPress={pickAndAnalyse} disabled={chordsStatus === 'loading'}>
            <Ionicons name="folder-open" size={22} color="#fff" />
            <Text style={styles.actionBtnText}>ФАЙЛ С ТЕЛЕФОНА (ЛЮБОЙ)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={openAppFilesModal}
            disabled={chordsStatus === 'loading'}
          >
            <Ionicons name="mic" size={20} color="#7c4dff" />
            <Text style={styles.actionBtnTextSecondary}>ИЗ RECORDER / STUDIO</Text>
          </TouchableOpacity>

          {/* File preview strip */}
          {previewUri && (
            <View style={styles.previewStrip}>
              <Ionicons name="musical-note" size={18} color="#7c4dff" />
              <Text style={styles.previewName} numberOfLines={1}>{previewName}</Text>
              <TouchableOpacity onPress={togglePreview} style={styles.previewPlayBtn}>
                <Ionicons name={previewPlaying ? 'pause' : 'play'} size={20} color="#7c4dff" />
              </TouchableOpacity>
            </View>
          )}

          {chordsStatus === 'loading' && (
            <View style={styles.progressCard}>
              <ActivityIndicator color="#7c4dff" size="large" />
              <Text style={styles.progressText}>{chordsMsg}</Text>
              <Text style={styles.progressHint}>Анализ большого файла может занять 1–2 мин.</Text>
            </View>
          )}

          {chordsStatus === 'error' && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color="#ff5252" />
              <Text style={styles.errorText}>{chordsMsg}</Text>
            </View>
          )}

          {chordsStatus === 'done' && (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>ТОНАЛЬНОСТЬ</Text>
                  <Text style={styles.summaryValue}>{songKey || '—'}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>ТЕМП</Text>
                  <Text style={styles.summaryValue}>{songBpm > 0 ? `${songBpm} BPM` : '—'}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>ДЛИНА</Text>
                  <Text style={styles.summaryValue}>{fmt(songDur)}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>ПРОГРЕССИЯ АККОРДОВ ({dedupedChords.length})</Text>
                  <TouchableOpacity onPress={exportChordSheet} style={styles.exportBtn}>
                    <Ionicons name="share-outline" size={16} color="#7c4dff" />
                    <Text style={styles.exportBtnText}>Экспорт</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                  <View style={styles.chordTimeline}>
                    {dedupedChords.map((ev, i) => (
                      <View key={i} style={styles.chordTimeItem}>
                        <Text style={styles.chordTimeLabel}>{fmt(ev.time)}</Text>
                        <View style={[styles.chordTimePill, { borderColor: ev.confidence > 2.5 ? '#00e67655' : '#ffeb3b44' }]}>
                          <Text style={[styles.chordTimeName, { color: ev.confidence > 2.5 ? '#00e676' : '#ffeb3b' }]}>{ev.chord}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {(() => {
                  const freq: Record<string, number> = {};
                  dedupedChords.forEach(ev => { freq[ev.chord] = (freq[ev.chord] || 0) + 1; });
                  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
                  return (
                    <View style={styles.freqTable}>
                      <Text style={styles.freqTitle}>Частые аккорды:</Text>
                      <View style={styles.freqRow}>
                        {sorted.map(([c, n]) => (
                          <View key={c} style={styles.freqItem}>
                            <Text style={styles.freqChord}>{c}</Text>
                            <Text style={styles.freqCount}>{n}×</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
              </View>
            </>
          )}

          <Text style={styles.footerNote}>
            Аккорды определяются офлайн — точность ~60–75% для простой музыки.{'\n'}
            Для высокой точности: chordify.net, moises.ai
          </Text>
        </ScrollView>
      )}

      {/* ── STEMS TAB ── */}
      {tab === 'stems' && (
        <View style={styles.stemsRoot}>
          <View style={styles.stemsToolbar}>
            <Text style={styles.stemModeTitle}>ДВИЖОК</Text>
            <View style={styles.stemModeRow}>
              {STEM_ENGINE_OPTIONS.map(opt => {
                const disabled = opt.id === 'neural' && !stemServerReady;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.stemModeChip,
                      stemEngine === opt.id && { borderColor: opt.color, backgroundColor: opt.color + '18' },
                      disabled && styles.stemModeChipDisabled,
                    ]}
                    onPress={() => {
                      if (disabled) {
                        Alert.alert('Нейросеть недоступна', stemServerHint || stemSeparateSetupHint());
                        return;
                      }
                      setStemEngine(opt.id);
                      if (opt.id === 'neural' && stemOutputMode === 'all') {
                        /* neural "all" = vocals + minus only — keep mode */
                      }
                    }}
                    disabled={stemStatus === 'loading' || disabled}
                  >
                    <Text style={[styles.stemModeChipLabel, stemEngine === opt.id && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.stemModeChipSub}>{opt.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {stemEngine === 'neural' && stemServerUrl ? (
              <Text
                style={[styles.stemServerHint, stemServerReady ? styles.stemServerHintOk : undefined]}
                numberOfLines={3}
              >
                {stemServerReady ? 'Сервер OK' : 'Сервер недоступен'}
                {stemServerSource ? ` · ${stemServerSource}` : ''}
                {'\n'}
                {stemServerUrl}
              </Text>
            ) : stemServerHint ? (
              <Text style={[styles.stemServerHint, stemServerReady ? styles.stemServerHintOk : undefined]} numberOfLines={2}>
                {stemServerReady ? `Сервер: ${stemServerHint}` : stemServerHint}
              </Text>
            ) : null}

            <Text style={[styles.stemModeTitle, { marginTop: 4 }]}>ЧТО ИЗВЛЕЧЬ</Text>
            <View style={styles.stemModeRow}>
              {stemModeOptions(stemEngine).map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.stemModeChip,
                    stemOutputMode === opt.id && { borderColor: opt.color, backgroundColor: opt.color + '18' },
                  ]}
                  onPress={() => setStemOutputMode(opt.id)}
                  disabled={stemStatus === 'loading'}
                >
                  <Text style={[styles.stemModeChipLabel, stemOutputMode === opt.id && { color: opt.color }]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.stemModeChipSub}>{opt.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, styles.stemPickBtn]}
              onPress={pickAndSeparate}
              disabled={stemStatus === 'loading'}
            >
              <Ionicons name="git-branch" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>ВЫБРАТЬ ФАЙЛ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary, styles.stemPickBtnSecondary]}
              onPress={openAppFilesModal}
              disabled={stemStatus === 'loading'}
            >
              <Ionicons name="mic" size={18} color="#40c4ff" />
              <Text style={[styles.actionBtnTextSecondary, { color: '#40c4ff', fontSize: 11 }]}>REC / STUDIO</Text>
            </TouchableOpacity>

            {stemStatus === 'loading' && (
              <View style={styles.progressCardCompact}>
                <ActivityIndicator color="#40c4ff" />
                <Text style={styles.progressText} numberOfLines={2}>{stemMsg}</Text>
              </View>
            )}
            {stemStatus === 'error' && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle" size={18} color="#ff5252" />
                <Text style={styles.errorText}>{stemMsg}</Text>
              </View>
            )}
          </View>

          {stemStatus === 'done' && stemItems.length > 0 ? (
            <FlatList
              style={styles.stemsList}
              contentContainerStyle={[
                styles.stemsListContent,
                { minHeight: Math.max(220, windowHeight * 0.42) },
              ]}
              data={stemItems}
              keyExtractor={it => it.id}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View>
                  <Text style={[styles.sectionTitle, styles.stemsListHeader]}>
                    ▶ прослушать · ↗ экспорт WAV
                  </Text>
                  <TouchableOpacity
                    style={styles.studioImportBtn}
                    onPress={() => { void openStemsInStudio(); }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="layers" size={18} color="#7c4dff" />
                    <Text style={styles.studioImportBtnText}>ОТКРЫТЬ В STUDIO</Text>
                  </TouchableOpacity>
                </View>
              }
              ListFooterComponent={
                <Text style={styles.footerNoteCompact}>
                  {stemEngine === 'neural'
                    ? 'Demucs на ПК — качественное разделение вокал/минус.'
                    : 'DSP (демо): фильтры и центр-канал, не нейросеть. Для качества — «Нейросеть (ПК)».'}
                </Text>
              }
              renderItem={({ item }) => (
                <View style={[styles.stemStrip, { borderLeftColor: item.color }]}>
                  <TouchableOpacity
                    style={[styles.stemPlayBtn, { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}
                    onPress={() => toggleStem(item.id)}
                  >
                    <Ionicons name={item.playing ? 'pause' : 'play'} size={22} color={item.color} />
                  </TouchableOpacity>
                  <View style={styles.stemStripInfo}>
                    <View style={styles.stemStripRow}>
                      <Text style={[styles.stemName, { color: item.color }]}>{item.label}</Text>
                      <Text style={styles.stemSize}>{item.sizeKb} KB</Text>
                    </View>
                    <View style={styles.stemWaveArea}>
                      <View style={styles.stemProgress}>
                        <View style={[styles.stemProgressFill, {
                          width: item.duration > 0 ? `${(item.position / item.duration) * 100}%` as `${number}%` : '0%',
                          backgroundColor: item.color,
                        }]} />
                      </View>
                    </View>
                    <View style={styles.stemTimeRow}>
                      <Text style={styles.stemTime}>{fmtMs(item.position)}</Text>
                      <Text style={styles.stemTime}>{fmtMs(item.duration)}</Text>
                    </View>
                    {item.loadError ? (
                      <Text style={styles.stemLoadErr} numberOfLines={1}>{item.loadError}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.stemExportBtn, { borderColor: item.color + '55' }]}
                    onPress={() => exportStem(item)}
                  >
                    <Ionicons name="share-outline" size={20} color={item.color} />
                  </TouchableOpacity>
                </View>
              )}
            />
          ) : stemStatus !== 'loading' ? (
            <View style={[styles.stemsIdlePane, { minHeight: Math.max(180, windowHeight * 0.38) }]}>
              <Ionicons name="git-branch-outline" size={40} color="#2a2a36" />
              <Text style={styles.stemsIdleText}>
                Выберите движок (DSP или Demucs на ПК), режим вокал/минус, затем файл.
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <Modal visible={appModalVisible} animationType="slide" transparent onRequestClose={() => setAppModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setAppModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Записи в RecoTune</Text>
                  <TouchableOpacity onPress={() => setAppModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="close" size={26} color="#888" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalHint}>
                  Это не папка «Загрузки»: Android и iOS хранят данные приложения отдельно. Чтобы скинуть дорожку из Studio, в Studio есть «Поделиться» у трека или экспорт микса.
                </Text>
                <FlatList
                  data={appAudioRows}
                  keyExtractor={it => it.uri}
                  style={{ maxHeight: 360 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.modalRow} onPress={() => onPickAppAudioRow(item)}>
                      <Text style={styles.modalBadge}>{item.badge}</Text>
                      <Text style={styles.modalFileName} numberOfLines={2}>{item.name}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#444" />
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Hidden WebViews */}
      {chordsHtml && (
        <WebView ref={chordsWvRef} source={{ html: chordsHtml }} style={styles.hiddenWV}
          onMessage={handleChordsMsg} javaScriptEnabled originWhitelist={['*']} />
      )}
      {stemHtml && (
        <WebView ref={stemsWvRef} source={{ html: stemHtml }} style={styles.hiddenWV}
          onMessage={handleStemsMsg} javaScriptEnabled originWhitelist={['*']} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header:    { paddingHorizontal: 16, paddingBottom: 6 },
  title:     { color: '#888', fontSize: 13, letterSpacing: 3, fontWeight: '700' },
  subtitle:  { color: '#333', fontSize: 11, marginTop: 2 },

  tabs:      { flexDirection: 'row', marginHorizontal: 14, marginBottom: 8, backgroundColor: '#111118', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#1e1e28' },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  tabActive: { backgroundColor: '#7c4dff' },
  tabText:   { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  tabTextActive: { color: '#fff' },

  infoCard:  { flexDirection: 'row', gap: 10, backgroundColor: '#111118', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#7c4dff22', alignItems: 'flex-start' },
  infoText:  { flex: 1, color: '#555', fontSize: 12, lineHeight: 18 },

  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7c4dff88', borderRadius: 14, padding: 14 },
  actionBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#7c4dff44' },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  actionBtnTextSecondary: { color: '#7c4dff', fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  modalBackdrop: { flex: 1, backgroundColor: '#000c', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: '#12121a', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 12, borderWidth: 1, borderColor: '#2a2a36', maxHeight: '72%' },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle:    { color: '#ccc', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  modalHint:     { color: '#555', fontSize: 11, lineHeight: 16, marginBottom: 12 },
  modalRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: '#1e1e28' },
  modalBadge:    { color: '#7c4dff', fontSize: 10, fontWeight: '800', width: 56 },
  modalFileName: { flex: 1, color: '#aaa', fontSize: 13 },

  /* File preview strip */
  previewStrip:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111118', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#7c4dff33' },
  previewName:    { flex: 1, color: '#888', fontSize: 12 },
  previewPlayBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7c4dff22', alignItems: 'center', justifyContent: 'center' },

  progressCard: { backgroundColor: '#111118', borderRadius: 14, padding: 20, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#1e1e28' },
  progressText: { color: '#888', fontSize: 13 },
  progressHint: { color: '#444', fontSize: 11, textAlign: 'center' },

  errorCard: { flexDirection: 'row', gap: 8, backgroundColor: '#ff525211', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#ff525244', alignItems: 'center' },
  errorText: { flex: 1, color: '#ff5252', fontSize: 12 },

  summaryRow:  { flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, backgroundColor: '#111118', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1e1e28' },
  summaryLabel:{ color: '#333', fontSize: 8, letterSpacing: 2, marginBottom: 4 },
  summaryValue:{ color: '#ccc', fontSize: 13, fontWeight: '700', textAlign: 'center' },

  section:      { backgroundColor: '#111118', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e1e28', gap: 8 },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#444', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  exportBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportBtnText:{ color: '#7c4dff', fontSize: 11, fontWeight: '700' },

  chordTimeline:  { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chordTimeItem:  { alignItems: 'center', gap: 3 },
  chordTimeLabel: { color: '#333', fontSize: 9 },
  chordTimePill:  { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#1a1a24', borderRadius: 8, borderWidth: 1 },
  chordTimeName:  { fontSize: 13, fontWeight: '700' },

  freqTable: { borderTopWidth: 1, borderColor: '#1e1e28', paddingTop: 8 },
  freqTitle: { color: '#333', fontSize: 9, letterSpacing: 2, marginBottom: 6 },
  freqRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  freqItem:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1a1a24', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  freqChord: { color: '#aaa', fontSize: 12, fontWeight: '700' },
  freqCount: { color: '#444', fontSize: 10 },

  stemsRoot: { flex: 1, paddingHorizontal: 12 },
  stemsToolbar: { gap: 8, paddingBottom: 8 },
  stemModeTitle: { color: '#444', fontSize: 9, letterSpacing: 2, fontWeight: '700', marginTop: 2 },
  stemModeRow: { flexDirection: 'row', gap: 8 },
  stemModeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e1e28',
    backgroundColor: '#111118',
  },
  stemModeChipLabel: { color: '#888', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  stemModeChipSub: { color: '#444', fontSize: 9, marginTop: 2, textAlign: 'center' },
  stemModeChipDisabled: { opacity: 0.45 },
  stemServerHint: { color: '#ff9800', fontSize: 10, lineHeight: 14 },
  stemServerHintOk: { color: '#00e676' },
  stemPickBtn: { backgroundColor: '#40c4ff88', paddingVertical: 12 },
  stemPickBtnSecondary: { borderColor: '#40c4ff44', paddingVertical: 10 },
  progressCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e1e28',
  },
  stemsList: { flex: 1 },
  stemsListContent: { paddingBottom: 16, gap: 0 },
  stemsListHeader: { marginBottom: 8, marginTop: 4 },
  studioImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7c4dff55',
    backgroundColor: '#7c4dff18',
  },
  studioImportBtnText: { color: '#b39ddb', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  stemsIdlePane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: '#0d0d12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a24',
    marginBottom: 8,
  },
  stemsIdleText: { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  /* Stem strips */
  stemStrip:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0d0d14', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderWidth: 1, borderColor: '#1e1e28', marginBottom: 8 },
  stemPlayBtn:    { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stemStripInfo:  { flex: 1, gap: 6 },
  stemStripRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stemName:       { fontSize: 15, fontWeight: '700' },
  stemSize:       { color: '#444', fontSize: 10 },
  stemWaveArea:   { paddingVertical: 4 },
  stemProgress:   { height: 8, backgroundColor: '#1a1a24', borderRadius: 4, overflow: 'hidden' },
  stemProgressFill:{ height: 8, borderRadius: 4 },
  stemTimeRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  stemTime:       { color: '#555', fontSize: 10 },
  stemLoadErr:    { color: '#ff5252', fontSize: 9 },
  stemExportBtn:  { padding: 10, borderRadius: 10, borderWidth: 1 },

  footerNote: { color: '#333', fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  footerNoteCompact: { color: '#333', fontSize: 10, textAlign: 'center', lineHeight: 16, marginTop: 12, marginBottom: 4 },
  hiddenWV:   { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
