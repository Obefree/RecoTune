/**
 * AILabScreen — Two tools:
 *  1. АККОРДЫ: Analyse an audio file → chord progression timeline + key + BPM
 *  2. ДОРОЖКИ: Frequency-band stem separation (Bass / Mid / Hi) and export each stem
 *
 * All processing runs in a hidden WebView using OfflineAudioContext (Web Audio API),
 * which is available in Expo Go without any native modules.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, FlatList,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─── Types ─── */
interface ChordEvent  { time: number; chord: string; confidence: number }
interface StemResult  { label: string; color: string; b64: string; sizeKb: number }

/* ─── Chord analysis WebView ─── */
const CHORD_ANALYSIS_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#000"><script>
const NOTE=[' C','C#',' D','D#',' E',' F','F#',' G','G#',' A','A#',' B'];
const TEMPLATES={'':  [0,4,7],'m':[0,3,7],'7':[0,4,7,10],'maj7':[0,4,7,11],'m7':[0,3,7,10],'dim':[0,3,6],'aug':[0,4,8]};
const MAJOR_P=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_P=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}

function b64ToAB(b64){
  const bin=atob(b64);const ab=new ArrayBuffer(bin.length);
  const u8=new Uint8Array(ab);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return ab;
}
function chroma(fftData,sr,fftSz){
  const c=new Float32Array(12);const bHz=sr/fftSz;
  for(let i=1;i<fftData.length;i++){
    const f=i*bHz;if(f<80||f>2200)continue;
    const db=fftData[i];if(db<-65)continue;
    const e=Math.pow(10,db/20);
    const m=Math.round(12*Math.log2(f/440)+69);
    c[((m%12)+12)%12]+=e;
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
function detectBpm(buf){
  // Simple energy-onset BPM detection
  const sr=buf.sampleRate;
  const ch=buf.getChannelData(0);
  const hop=Math.round(sr*0.01);// 10ms hop
  const frames=Math.floor(ch.length/hop);
  const energy=new Float32Array(frames);
  for(let i=0;i<frames;i++){
    let e=0;for(let s=0;s<hop;s++)e+=ch[i*hop+s]**2;
    energy[i]=e/hop;
  }
  // Find onsets (energy jumps)
  const onsets=[];
  for(let i=2;i<frames-1;i++){
    if(energy[i]>energy[i-1]*2&&energy[i]>energy[i-2]*2&&energy[i]>0.001){
      onsets.push(i*hop/sr);
      i+=10; // suppress nearby
    }
  }
  if(onsets.length<4)return 0;
  // Median inter-onset interval
  const ioi=[];for(let i=1;i<onsets.length;i++)ioi.push(onsets[i]-onsets[i-1]);
  ioi.sort((a,b)=>a-b);
  const med=ioi[Math.floor(ioi.length/2)];
  if(med<=0)return 0;
  let bpm=Math.round(60/med);
  // Clamp to 40-240 range; double/halve if out
  while(bpm<60&&bpm>0)bpm*=2;
  while(bpm>240)bpm=Math.round(bpm/2);
  return bpm;
}

async function analyze(b64,segSec){
  try{
    post({type:'progress',msg:'Декодирование аудио...'});
    const ab=b64ToAB(b64);
    const tmpCtx=new OfflineAudioContext(1,1,44100);
    const buf=await tmpCtx.decodeAudioData(ab);
    const sr=buf.sampleRate;
    const dur=buf.duration;
    post({type:'progress',msg:'Анализ высоты тона...'});
    
    const bpm=detectBpm(buf);
    
    const fftSz=8192;
    const analyCtx=new OfflineAudioContext(1,buf.length,sr);
    
    const events=[];
    const globalChroma=new Float32Array(12);
    const stepSamples=Math.round(sr*segSec);
    const steps=Math.floor(buf.length/stepSamples);
    
    for(let step=0;step<steps;step++){
      const segLen=Math.min(stepSamples,buf.length-step*stepSamples);
      const segCtx=new OfflineAudioContext(1,Math.max(segLen,fftSz),sr);
      const src=segCtx.createBufferSource();
      const segBuf=segCtx.createBuffer(1,Math.max(segLen,fftSz),sr);
      const src0=buf.getChannelData(0);
      const dst=segBuf.getChannelData(0);
      for(let i=0;i<segLen;i++)dst[i]=src0[step*stepSamples+i];
      src.buffer=segBuf;
      const analyserNode=segCtx.createAnalyser();
      analyserNode.fftSize=fftSz;analyserNode.smoothingTimeConstant=0;
      src.connect(analyserNode);analyserNode.connect(segCtx.destination);
      src.start(0);await segCtx.startRendering();
      const fft=new Float32Array(analyserNode.frequencyBinCount);
      analyserNode.getFloatFrequencyData(fft);
      const c=chroma(fft,sr,fftSz);
      for(let i=0;i<12;i++)globalChroma[i]+=c[i];
      const chord=detectChord(c);
      events.push({time:parseFloat((step*segSec).toFixed(2)),chord:chord.name,confidence:parseFloat(chord.conf.toFixed(2))});
      if(step%5===0)post({type:'progress',msg:`Анализ ${Math.round((step/steps)*100)}%...`});
    }
    const mx=Math.max(...globalChroma);if(mx>0)for(let i=0;i<12;i++)globalChroma[i]/=mx;
    const key=estimateKey(globalChroma);
    post({type:'done',events,key,bpm,duration:parseFloat(dur.toFixed(1))});
  }catch(e){
    post({type:'error',msg:String(e)});
  }
}
window.addEventListener('message',e=>{
  try{const m=JSON.parse(e.data);if(m.cmd==='analyze')analyze(m.b64,m.segSec||2);}catch{}
});
document.addEventListener('message',e=>{
  try{const m=JSON.parse(e.data);if(m.cmd==='analyze')analyze(m.b64,m.segSec||2);}catch{}
});
</script></body></html>`;

/* ─── Stem separation WebView ─── */
const STEM_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#000"><script>
function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}
function b64ToAB(b64){
  const bin=atob(b64);const ab=new ArrayBuffer(bin.length);
  const u8=new Uint8Array(ab);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return ab;
}
function ab64(ab){
  const u8=new Uint8Array(ab);let s='';
  for(let i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);
  return btoa(s);
}
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
  let off=44;
  const clamp=(x)=>Math.max(-1,Math.min(1,x));
  const write=(val)=>{
    if(bits===16){v.setInt16(off,clamp(val)*32767,true);off+=2;}
    else{v.setInt32(off,clamp(val)*2147483647,true);off+=4;}
  };
  for(let i=0;i<samples;i++){write(L[i]);if(!mono)write(R[i]);}
  return buf;
}
async function separate(b64){
  try{
    post({type:'progress',msg:'Декодирование аудио...'});
    const ab=b64ToAB(b64);
    const tmpCtx=new OfflineAudioContext(1,1,44100);
    const origBuf=await tmpCtx.decodeAudioData(ab);
    const sr=origBuf.sampleRate;const len=origBuf.length;
    const stereo=origBuf.numberOfChannels>1;
    
    const stems=[
      {label:'Bass',   lo:20,  hi:250,  color:'#7c4dff'},
      {label:'Mid',    lo:250, hi:4000, color:'#00e676'},
      {label:'Hi',     lo:4000,hi:20000,color:'#40c4ff'},
    ];
    const results=[];
    
    for(let si=0;si<stems.length;si++){
      const stem=stems[si];
      post({type:'progress',msg:'Фильтрация: '+stem.label+'...'});
      const offCtx=new OfflineAudioContext(stereo?2:1,len,sr);
      const src=offCtx.createBufferSource();
      src.buffer=origBuf;
      const lo=offCtx.createBiquadFilter();lo.type='highpass';lo.frequency.value=stem.lo;lo.Q.value=0.7;
      const hi=offCtx.createBiquadFilter();hi.type='lowpass'; hi.frequency.value=stem.hi;hi.Q.value=0.7;
      src.connect(lo);lo.connect(hi);hi.connect(offCtx.destination);
      src.start(0);
      const rendered=await offCtx.startRendering();
      const L=rendered.getChannelData(0);
      const R=stereo?rendered.getChannelData(1):null;
      const wav=encodeWAV(L,R,sr,16);
      results.push({label:stem.label,color:stem.color,b64:ab64(wav),sizeKb:Math.round(wav.byteLength/1024)});
    }
    post({type:'done',stems:results});
  }catch(e){
    post({type:'error',msg:String(e)});
  }
}
window.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='separate')separate(m.b64);}catch{}});
document.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='separate')separate(m.b64);}catch{}});
</script></body></html>`;

/* ─── Helpers ─── */
function fmt(s: number) { return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

export default function AILabScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'chords' | 'stems'>('chords');

  /* ── Chord analysis state ── */
  const [chordsStatus, setChordsStatus] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [chordsMsg, setChordsMsg]       = useState('');
  const [chordEvents, setChordEvents]   = useState<ChordEvent[]>([]);
  const [songKey, setSongKey]           = useState('');
  const [songBpm, setSongBpm]           = useState(0);
  const [songDur, setSongDur]           = useState(0);
  const [chordsHtml, setChordsHtml]     = useState<string | null>(null);

  /* ── Stem separation state ── */
  const [stemStatus, setStemStatus]     = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [stemMsg, setStemMsg]           = useState('');
  const [stems, setStems]               = useState<StemResult[]>([]);
  const [stemHtml, setStemHtml]         = useState<string | null>(null);

  const chordsWvRef = useRef<WebView>(null);
  const stemsWvRef  = useRef<WebView>(null);

  /* ── Pick file and run chord analysis ── */
  const pickAndAnalyse = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const uri = res.assets[0].uri;
      setChordsStatus('loading');
      setChordsMsg('Чтение файла...');
      setChordEvents([]); setSongKey(''); setSongBpm(0); setSongDur(0);

      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      setChordsHtml(CHORD_ANALYSIS_HTML);
      // Inject command after short delay for WebView to load
      setTimeout(() => {
        chordsWvRef.current?.injectJavaScript(`
          (function(){
            window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({cmd:'analyze',b64:${JSON.stringify(b64)},segSec:2})}));
          })();true;
        `);
      }, 600);
    } catch (e) {
      Alert.alert('Ошибка', String(e));
      setChordsStatus('error');
    }
  }, []);

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
      let txt = `Ключ: ${songKey}  BPM: ${songBpm || '—'}  Длительность: ${fmt(songDur)}\n\n`;
      let lastChord = '';
      for (const ev of chordEvents) {
        if (ev.chord !== lastChord && ev.chord !== '?') {
          txt += `${fmt(ev.time)}  ${ev.chord}\n`;
          lastChord = ev.chord;
        }
      }
      const path = `${FileSystem.documentDirectory}chords_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(path, txt);
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'Экспорт аккордов' });
    } catch (e) {
      Alert.alert('Ошибка экспорта', String(e));
    }
  }, [chordEvents, songKey, songBpm, songDur]);

  /* ── Pick file and run stem separation ── */
  const pickAndSeparate = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const uri = res.assets[0].uri;
      setStemStatus('loading');
      setStemMsg('Чтение файла...');
      setStems([]);

      // Check file size — warn if > 20MB
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && (info as any).size > 20 * 1024 * 1024) {
        Alert.alert('Большой файл', 'Файл более 20 МБ — обработка может занять несколько минут.');
      }

      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      setStemHtml(STEM_HTML);
      setTimeout(() => {
        stemsWvRef.current?.injectJavaScript(`
          (function(){
            window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({cmd:'separate',b64:${JSON.stringify(b64)}})}));
          })();true;
        `);
      }, 600);
    } catch (e) {
      Alert.alert('Ошибка', String(e));
      setStemStatus('error');
    }
  }, []);

  const handleStemsMsg = useCallback((e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'progress') {
        setStemMsg(msg.msg);
      } else if (msg.type === 'done') {
        setStems(msg.stems);
        setStemStatus('done');
        setStemHtml(null);
      } else if (msg.type === 'error') {
        setStemStatus('error');
        setStemMsg(msg.msg);
        setStemHtml(null);
      }
    } catch {}
  }, []);

  /* ── Export stem ── */
  const exportStem = useCallback(async (stem: StemResult) => {
    try {
      const path = `${FileSystem.documentDirectory}stem_${stem.label.toLowerCase()}_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(path, stem.b64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(path, { mimeType: 'audio/wav', dialogTitle: `Экспорт: ${stem.label}` });
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    }
  }, []);

  /* ── Chord progression — deduplicate for display ── */
  const dedupedChords = chordEvents.filter((ev, i) =>
    i === 0 || ev.chord !== chordEvents[i - 1].chord
  ).filter(ev => ev.chord !== '?');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI LAB</Text>
        <Text style={styles.subtitle}>Анализ и разделение аудио</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'chords' && styles.tabActive]}
          onPress={() => setTab('chords')}
        >
          <Ionicons name="musical-notes" size={15} color={tab === 'chords' ? '#0a0a0f' : '#555'} />
          <Text style={[styles.tabText, tab === 'chords' && styles.tabTextActive]}>АККОРДЫ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'stems' && styles.tabActive]}
          onPress={() => setTab('stems')}
        >
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
              Загрузите аудиофайл — получите аккорды, тональность и темп.
              Анализ идёт через Web Audio API прямо на телефоне.
            </Text>
          </View>

          <TouchableOpacity style={styles.actionBtn} onPress={pickAndAnalyse} disabled={chordsStatus === 'loading'}>
            <Ionicons name="folder-open" size={22} color="#fff" />
            <Text style={styles.actionBtnText}>ВЫБРАТЬ ФАЙЛ ДЛЯ АНАЛИЗА</Text>
          </TouchableOpacity>

          {/* Loading */}
          {chordsStatus === 'loading' && (
            <View style={styles.progressCard}>
              <ActivityIndicator color="#7c4dff" size="large" />
              <Text style={styles.progressText}>{chordsMsg}</Text>
              <Text style={styles.progressHint}>Анализ большого файла может занять 1–2 мин.</Text>
            </View>
          )}

          {/* Error */}
          {chordsStatus === 'error' && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color="#ff5252" />
              <Text style={styles.errorText}>{chordsMsg}</Text>
            </View>
          )}

          {/* Results */}
          {chordsStatus === 'done' && (
            <>
              {/* Summary */}
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

              {/* Chord timeline */}
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
                          <Text style={[styles.chordTimeName, { color: ev.confidence > 2.5 ? '#00e676' : '#ffeb3b' }]}>
                            {ev.chord}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {/* Chord frequency table */}
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
            Алгоритм: хромаграмма + шаблонное сопоставление (OfflineAudioContext).{'\n'}
            Точность выше для живых записей гитары/пианино.
          </Text>
        </ScrollView>
      )}

      {/* ── STEMS TAB ── */}
      {tab === 'stems' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 12 }} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color="#40c4ff" />
            <Text style={styles.infoText}>
              Частотное разделение на 3 диапазона:{'\n'}
              Bass (20–250 Гц) · Mid (250–4000 Гц) · Hi (4000+ Гц){'\n'}
              Каждую дорожку можно экспортировать как WAV.
            </Text>
          </View>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#40c4ff88' }]} onPress={pickAndSeparate} disabled={stemStatus === 'loading'}>
            <Ionicons name="git-branch" size={22} color="#fff" />
            <Text style={styles.actionBtnText}>ВЫБРАТЬ ФАЙЛ ДЛЯ РАЗДЕЛЕНИЯ</Text>
          </TouchableOpacity>

          {stemStatus === 'loading' && (
            <View style={styles.progressCard}>
              <ActivityIndicator color="#40c4ff" size="large" />
              <Text style={styles.progressText}>{stemMsg}</Text>
              <Text style={styles.progressHint}>Для длинных треков ≥ 3 мин — это займёт несколько минут.</Text>
            </View>
          )}

          {stemStatus === 'error' && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color="#ff5252" />
              <Text style={styles.errorText}>{stemMsg}</Text>
            </View>
          )}

          {stemStatus === 'done' && stems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>РЕЗУЛЬТАТ</Text>
              {stems.map(stem => (
                <View key={stem.label} style={[styles.stemCard, { borderLeftColor: stem.color }]}>
                  <View style={[styles.stemIcon, { backgroundColor: stem.color + '22' }]}>
                    <Ionicons name="musical-notes" size={20} color={stem.color} />
                  </View>
                  <View style={styles.stemInfo}>
                    <Text style={[styles.stemName, { color: stem.color }]}>{stem.label}</Text>
                    <Text style={styles.stemSize}>{stem.sizeKb} KB · WAV 16-bit</Text>
                  </View>
                  <TouchableOpacity style={[styles.stemExportBtn, { borderColor: stem.color + '66' }]} onPress={() => exportStem(stem)}>
                    <Ionicons name="share-outline" size={18} color={stem.color} />
                    <Text style={[styles.stemExportText, { color: stem.color }]}>Экспорт</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.footerNote}>
            Это частотное разделение, не ML-сепарация (Demucs/Spleeter).{'\n'}
            Для ИИ-разделения используйте: lalal.ai · moises.ai
          </Text>
        </ScrollView>
      )}

      {/* Hidden WebViews */}
      {chordsHtml && (
        <WebView
          ref={chordsWvRef}
          source={{ html: chordsHtml }}
          style={styles.hiddenWV}
          onMessage={handleChordsMsg}
          javaScriptEnabled
          originWhitelist={['*']}
        />
      )}
      {stemHtml && (
        <WebView
          ref={stemsWvRef}
          source={{ html: stemHtml }}
          style={styles.hiddenWV}
          onMessage={handleStemsMsg}
          javaScriptEnabled
          originWhitelist={['*']}
        />
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

  infoCard:  { flexDirection: 'row', gap: 10, backgroundColor: '#111118', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e1e28', alignItems: 'flex-start' },
  infoText:  { flex: 1, color: '#666', fontSize: 12, lineHeight: 18 },

  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7c4dff88', borderRadius: 14, padding: 14 },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },

  progressCard: { backgroundColor: '#111118', borderRadius: 14, padding: 20, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#1e1e28' },
  progressText: { color: '#888', fontSize: 13 },
  progressHint: { color: '#444', fontSize: 11, textAlign: 'center' },

  errorCard: { flexDirection: 'row', gap: 8, backgroundColor: '#ff525211', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#ff525244', alignItems: 'center' },
  errorText: { flex: 1, color: '#ff5252', fontSize: 12 },

  summaryRow:  { flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, backgroundColor: '#111118', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1e1e28' },
  summaryLabel:{ color: '#333', fontSize: 8, letterSpacing: 2, marginBottom: 4 },
  summaryValue:{ color: '#ccc', fontSize: 13, fontWeight: '700', textAlign: 'center' },

  section:     { backgroundColor: '#111118', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e1e28', gap: 8 },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#444', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  exportBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportBtnText:{ color: '#7c4dff', fontSize: 11, fontWeight: '700' },

  chordTimeline:{ flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chordTimeItem:{ alignItems: 'center', gap: 3 },
  chordTimeLabel:{ color: '#333', fontSize: 9 },
  chordTimePill:{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#1a1a24', borderRadius: 8, borderWidth: 1 },
  chordTimeName:{ fontSize: 13, fontWeight: '700' },

  freqTable:  { borderTopWidth: 1, borderColor: '#1e1e28', paddingTop: 8 },
  freqTitle:  { color: '#333', fontSize: 9, letterSpacing: 2, marginBottom: 6 },
  freqRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  freqItem:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1a1a24', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  freqChord:  { color: '#aaa', fontSize: 12, fontWeight: '700' },
  freqCount:  { color: '#444', fontSize: 10 },

  stemCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0d0d14', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderWidth: 1, borderColor: '#1e1e28', marginTop: 6 },
  stemIcon:   { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stemInfo:   { flex: 1 },
  stemName:   { fontSize: 14, fontWeight: '700' },
  stemSize:   { color: '#444', fontSize: 10, marginTop: 2 },
  stemExportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  stemExportText:{ fontSize: 11, fontWeight: '700' },

  footerNote: { color: '#333', fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  hiddenWV:   { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
