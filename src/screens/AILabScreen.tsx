/**
 * AILabScreen — Two tools:
 *  1. АККОРДЫ: Analyse an audio file → chord progression timeline + key + BPM
 *     · Play/preview the loaded file before/after analysis
 *  2. ДОРОЖКИ: Improved stem separation:
 *     Bass / Mid / Hi (frequency bands)
 *     + Голос (vocal isolation via center-channel extraction)
 *     + Минус  (karaoke: vocal-suppressed stereo)
 *     Each stem is playable directly, then exportable as WAV.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, FlatList, TouchableWithoutFeedback,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─── Types ─── */
interface ChordEvent { time: number; chord: string; confidence: number }
interface StemItem {
  label: string;
  color: string;
  b64: string;
  sizeKb: number;
  uri?: string;
  sound?: Audio.Sound;
  playing: boolean;
  position: number;
  duration: number;
}

/* ─── Chord analysis WebView ─── */
const CHORD_ANALYSIS_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#000"><script>
const NOTE=[' C','C#',' D','D#',' E',' F','F#',' G','G#',' A','A#',' B'];
const TEMPLATES={'':  [0,4,7],'m':[0,3,7],'7':[0,4,7,10],'maj7':[0,4,7,11],'m7':[0,3,7,10],'dim':[0,3,6],'aug':[0,4,8]};
const MAJOR_P=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_P=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}
function b64ToAB(b64){const bin=atob(b64);const ab=new ArrayBuffer(bin.length);const u8=new Uint8Array(ab);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return ab;}
function chroma(fftData,sr,fftSz){
  const c=new Float32Array(12);const bHz=sr/fftSz;
  for(let i=1;i<fftData.length;i++){const f=i*bHz;if(f<80||f>2200)continue;const db=fftData[i];if(db<-65)continue;const e=Math.pow(10,db/20);const m=Math.round(12*Math.log2(f/440)+69);c[((m%12)+12)%12]+=e;}
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
      const chord=detectChord(c);events.push({time:parseFloat((step*segSec).toFixed(2)),chord:chord.name,confidence:parseFloat(chord.conf.toFixed(2))});
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
async function separate(b64){
  try{
    post({type:'progress',msg:'Декодирование аудио...'});
    const ab=b64ToAB(b64);
    const tmpCtx=new OfflineAudioContext(1,1,44100);
    const origBuf=await tmpCtx.decodeAudioData(ab);
    const sr=origBuf.sampleRate;const len=origBuf.length;
    const stereo=origBuf.numberOfChannels>1;
    const results=[];

    // ── 1. Bass (20-250 Hz)
    post({type:'progress',msg:'Бас...'});
    const bassR=await applyBandFilter(origBuf,20,250,sr,len,stereo);
    const bL=bassR.getChannelData(0);const bR=stereo?bassR.getChannelData(1):null;
    results.push({label:'Бас',color:'#7c4dff',b64:ab64(encodeWAV(bL,bR,sr,16)),sizeKb:Math.round((44+len*(stereo?4:2))/1024)});

    // ── 2. Mid (250-4000 Hz)
    post({type:'progress',msg:'Средние частоты...'});
    const midR=await applyBandFilter(origBuf,250,4000,sr,len,stereo);
    const mL=midR.getChannelData(0);const mR=stereo?midR.getChannelData(1):null;
    results.push({label:'Середина',color:'#00e676',b64:ab64(encodeWAV(mL,mR,sr,16)),sizeKb:Math.round((44+len*(stereo?4:2))/1024)});

    // ── 3. Hi (4000+ Hz)
    post({type:'progress',msg:'Высокие частоты...'});
    const hiR=await applyBandFilter(origBuf,4000,20000,sr,len,stereo);
    const hL=hiR.getChannelData(0);const hR=stereo?hiR.getChannelData(1):null;
    results.push({label:'Высокие',color:'#40c4ff',b64:ab64(encodeWAV(hL,hR,sr,16)),sizeKb:Math.round((44+len*(stereo?4:2))/1024)});

    // ── 4. Vocal isolation (center channel of 200-5000 Hz band)
    post({type:'progress',msg:'Выделение голоса...'});
    const L=origBuf.getChannelData(0);
    const R=stereo?origBuf.getChannelData(1):origBuf.getChannelData(0);
    // Center = (L+R)/2 in mono
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
    const vocalData=vocalR.getChannelData(0);
    results.push({label:'Голос',color:'#ff9800',b64:ab64(encodeWAV(vocalData,null,sr,16)),sizeKb:Math.round((44+len*2)/1024)});

    // ── 5. Karaoke (vocal-suppressed stereo)
    post({type:'progress',msg:'Минус (без голоса)...'});
    const karL=new Float32Array(len);const karR=new Float32Array(len);
    for(let i=0;i<len;i++){karL[i]=L[i]-vocalData[i];karR[i]=R[i]-vocalData[i];}
    results.push({label:'Минус',color:'#ff5252',b64:ab64(encodeWAV(karL,karR,sr,16)),sizeKb:Math.round((44+len*4)/1024)});

    post({type:'done',stems:results});
  }catch(e){post({type:'error',msg:String(e)});}
}
window.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='separate')separate(m.b64);}catch{}});
document.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='separate')separate(m.b64);}catch{}});
</script></body></html>`;

/* ─── App sandbox audio folders (same as RecorderScreen / StudioScreen) ─── */
const RECORDINGS_DIR = (FileSystem.documentDirectory ?? '') + 'recordings/';
const STUDIO_DIR     = (FileSystem.documentDirectory ?? '') + 'studio/';
const APP_AUDIO_EXT  = /\.(m4a|wav|mp3|aac|caf)$/i;

interface AppAudioRow { uri: string; name: string; badge: string }

/* ─── Helpers ─── */
function fmt(s: number) { return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }
function fmtMs(ms: number) { return fmt(ms / 1000); }

export default function AILabScreen() {
  const insets = useSafeAreaInsets();
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
  const [stemStatus, setStemStatus]       = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [stemMsg, setStemMsg]             = useState('');
  const [stemItems, setStemItems]         = useState<StemItem[]>([]);
  const [stemHtml, setStemHtml]           = useState<string | null>(null);

  const chordsWvRef = useRef<WebView>(null);
  const stemsWvRef  = useRef<WebView>(null);

  const [appModalVisible, setAppModalVisible] = useState(false);
  const [appAudioRows, setAppAudioRows]     = useState<AppAudioRow[]>([]);

  /* ── Cleanup sounds on unmount ── */
  useEffect(() => {
    return () => {
      previewSound?.unloadAsync();
      stemItems.forEach(s => s.sound?.unloadAsync());
    };
  }, [previewSound, stemItems]);

  /* ── File preview: load and toggle ── */
  const loadPreview = useCallback(async (uri: string, name: string) => {
    try {
      await previewSound?.unloadAsync();
      setPreviewPlaying(false);
      const { sound } = await Audio.Sound.createAsync({ uri }, {}, (status) => {
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

  const separateWithUri = useCallback(async (uri: string) => {
    try {
      setStemStatus('loading');
      setStemMsg('Чтение файла...');
      setStemItems(prev => {
        prev.forEach(s => s.sound?.unloadAsync());
        return [];
      });

      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && (info as any).size > 20 * 1024 * 1024) {
        Alert.alert('Большой файл', 'Файл > 20 МБ — обработка займёт несколько минут.');
      }
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      setStemHtml(STEM_HTML);
      setTimeout(() => {
        stemsWvRef.current?.injectJavaScript(`
          (function(){window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({cmd:'separate',b64:${JSON.stringify(b64)}})}));}());true;
        `);
      }, 600);
    } catch (e) {
      Alert.alert('Ошибка', String(e));
      setStemStatus('error');
    }
  }, []);

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
        setStemMsg('Сохранение дорожек...');
        const items: StemItem[] = [];
        for (const s of msg.stems as { label: string; color: string; b64: string; sizeKb: number }[]) {
          const path = `${FileSystem.cacheDirectory}stem_${s.label.toLowerCase().replace(/[^a-zа-я]/gi, '_')}_${Date.now()}.wav`;
          await FileSystem.writeAsStringAsync(path, s.b64, { encoding: FileSystem.EncodingType.Base64 });
          const item: StemItem = { ...s, uri: path, playing: false, position: 0, duration: 0 };
          try {
            const { sound } = await Audio.Sound.createAsync({ uri: path }, {}, (status) => {
              if (!status.isLoaded) return;
              setStemItems(prev => prev.map(si =>
                si.uri === path
                  ? { ...si, playing: status.isPlaying ?? false, position: status.positionMillis ?? 0, duration: status.durationMillis ?? 0 }
                  : si
              ));
            });
            item.sound = sound;
            const st = await sound.getStatusAsync();
            if (st.isLoaded) item.duration = st.durationMillis ?? 0;
          } catch {}
          items.push(item);
        }
        setStemItems(items);
        setStemStatus('done');
        setStemHtml(null);
      } else if (msg.type === 'error') {
        setStemStatus('error');
        setStemMsg(msg.msg);
        setStemHtml(null);
      }
    } catch {}
  }, []);

  /* ── Play / pause a stem ── */
  const toggleStem = useCallback(async (item: StemItem) => {
    if (!item.sound) return;
    try {
      if (item.playing) {
        await item.sound.pauseAsync();
      } else {
        // Stop all others
        for (const si of stemItems) {
          if (si.uri !== item.uri && si.playing && si.sound) await si.sound.pauseAsync();
        }
        await item.sound.playAsync();
      }
    } catch {}
  }, [stemItems]);

  /* ── Export a stem ── */
  const exportStem = useCallback(async (item: StemItem) => {
    try {
      if (!item.uri) throw new Error('Файл не найден');
      await Sharing.shareAsync(item.uri, { mimeType: 'audio/wav', dialogTitle: `Экспорт: ${item.label}` });
    } catch (e) { Alert.alert('Ошибка', String(e)); }
  }, []);

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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 12 }} showsVerticalScrollIndicator={false}>

          <View style={[styles.infoCard, { borderColor: '#40c4ff33' }]}>
            <Ionicons name="information-circle-outline" size={18} color="#40c4ff" />
            <Text style={styles.infoText}>
              Разделение на 5 дорожек:{'\n'}
              <Text style={{ color: '#7c4dff' }}>Бас</Text> (20–250 Гц) · <Text style={{ color: '#00e676' }}>Середина</Text> (250–4к) · <Text style={{ color: '#40c4ff' }}>Высокие</Text> (4к+){'\n'}
              <Text style={{ color: '#ff9800' }}>Голос</Text> (центральный канал 200–5к Гц) · <Text style={{ color: '#ff5252' }}>Минус</Text> (оригинал без голоса){'\n'}
              Голос и Минус лучше работают на стерео треках.{'\n'}
              <Text style={{ color: '#666' }}>Тот же список Recorder/Studio, что и во вкладке «Аккорды».</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#40c4ff88' }]}
            onPress={pickAndSeparate}
            disabled={stemStatus === 'loading'}
          >
            <Ionicons name="git-branch" size={22} color="#fff" />
            <Text style={styles.actionBtnText}>ФАЙЛ С ТЕЛЕФОНА (ЛЮБОЙ)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary, { borderColor: '#40c4ff44' }]}
            onPress={openAppFilesModal}
            disabled={stemStatus === 'loading'}
          >
            <Ionicons name="mic" size={20} color="#40c4ff" />
            <Text style={[styles.actionBtnTextSecondary, { color: '#40c4ff' }]}>ИЗ RECORDER / STUDIO</Text>
          </TouchableOpacity>

          {stemStatus === 'loading' && (
            <View style={styles.progressCard}>
              <ActivityIndicator color="#40c4ff" size="large" />
              <Text style={styles.progressText}>{stemMsg}</Text>
              <Text style={styles.progressHint}>Для треков ≥ 3 мин — займёт несколько минут.</Text>
            </View>
          )}

          {stemStatus === 'error' && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color="#ff5252" />
              <Text style={styles.errorText}>{stemMsg}</Text>
            </View>
          )}

          {/* Playable stem strips */}
          {stemStatus === 'done' && stemItems.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>ДОРОЖКИ — нажмите ▶ для прослушивания</Text>
              {stemItems.map(item => (
                <View key={item.label} style={[styles.stemStrip, { borderLeftColor: item.color }]}>
                  {/* Play/Pause button */}
                  <TouchableOpacity
                    style={[styles.stemPlayBtn, { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}
                    onPress={() => toggleStem(item)}
                  >
                    <Ionicons name={item.playing ? 'pause' : 'play'} size={20} color={item.color} />
                  </TouchableOpacity>

                  {/* Info + progress */}
                  <View style={styles.stemStripInfo}>
                    <View style={styles.stemStripRow}>
                      <Text style={[styles.stemName, { color: item.color }]}>{item.label}</Text>
                      <Text style={styles.stemSize}>{item.sizeKb} KB · WAV</Text>
                    </View>
                    {/* Progress bar */}
                    <View style={styles.stemProgress}>
                      <View style={[styles.stemProgressFill, {
                        width: item.duration > 0 ? `${(item.position / item.duration) * 100}%` as any : '0%',
                        backgroundColor: item.color,
                      }]} />
                    </View>
                    <View style={styles.stemTimeRow}>
                      <Text style={styles.stemTime}>{fmtMs(item.position)}</Text>
                      <Text style={styles.stemTime}>{fmtMs(item.duration)}</Text>
                    </View>
                  </View>

                  {/* Export */}
                  <TouchableOpacity
                    style={[styles.stemExportBtn, { borderColor: item.color + '55' }]}
                    onPress={() => exportStem(item)}
                  >
                    <Ionicons name="share-outline" size={18} color={item.color} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.footerNote}>
            Частотное разделение (не ML-сепарация).{'\n'}
            Demucs/Spleeter уровень: lalal.ai · moises.ai
          </Text>
        </ScrollView>
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

  /* Stem strips */
  stemStrip:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0d0d14', borderRadius: 12, padding: 10, borderLeftWidth: 3, borderWidth: 1, borderColor: '#1e1e28', marginBottom: 6 },
  stemPlayBtn:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stemStripInfo:  { flex: 1, gap: 4 },
  stemStripRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stemName:       { fontSize: 14, fontWeight: '700' },
  stemSize:       { color: '#444', fontSize: 10 },
  stemProgress:   { height: 3, backgroundColor: '#1a1a24', borderRadius: 2, overflow: 'hidden' },
  stemProgressFill:{ height: 3, borderRadius: 2 },
  stemTimeRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  stemTime:       { color: '#333', fontSize: 9 },
  stemExportBtn:  { padding: 8, borderRadius: 10, borderWidth: 1 },

  footerNote: { color: '#333', fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  hiddenWV:   { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
