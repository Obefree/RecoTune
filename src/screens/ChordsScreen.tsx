import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

/* ─── Types ─── */
interface ChordMsg {
  type: 'chord';
  chord: string;
  confidence: number;
  key: string;
  notes: string[];
}
interface AuddResult {
  artist: string;
  title: string;
  album?: string;
  release_date?: string;
  song_link?: string;
}

/* ─── Chord colours ─── */
function chordColor(conf: number): string {
  if (conf > 2.5) return '#00e676';
  if (conf > 1.5) return '#ffeb3b';
  return '#ff5252';
}

/* ─── WebView HTML for real-time chord detection ─── */
const CHORD_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#000"><script>
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
  const c=new Float32Array(12);
  const bHz=sr/fftSz;
  for(let i=1;i<fft.length;i++){
    const f=i*bHz;
    if(f<80||f>2200)continue;
    const db=fft[i];if(db<-65)continue;
    const e=Math.pow(10,db/20);
    const m=Math.round(12*Math.log2(f/440)+69);
    const pc=((m%12)+12)%12;
    c[pc]+=e;
  }
  const mx=Math.max(...c);
  if(mx>0)for(let i=0;i<12;i++)c[i]/=mx;
  return c;
}
function detectChord(c){
  let best={name:'?',conf:-Infinity};
  for(let r=0;r<12;r++){
    for(const[t,ivs]of Object.entries(TEMPLATES)){
      let sc=0;
      for(let i=0;i<12;i++){
        const ct=ivs.some(iv=>(r+iv)%12===i);
        sc+=ct?c[i]:-0.4*c[i];
      }
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
async function start(){
  if(running)return;running=true;
  try{
    const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    ctx=new AudioContext();
    analyser=ctx.createAnalyser();
    analyser.fftSize=8192;analyser.smoothingTimeConstant=0.85;
    src=ctx.createMediaStreamSource(st);
    src.connect(analyser);
    const fft=new Float32Array(analyser.frequencyBinCount);
    const A=0.12;
    function loop(){
      if(!running)return;
      analyser.getFloatFrequencyData(fft);
      const c=chroma(fft,ctx.sampleRate,analyser.fftSize);
      for(let i=0;i<12;i++)smooth[i]=A*c[i]+(1-A)*smooth[i];
      const chord=detectChord(smooth);
      const key=estimateKey(smooth);
      const notes=topNotes(smooth,4);
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'chord',chord:chord.name,confidence:chord.conf,key,notes}));
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

export default function ChordsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [mode, setMode]               = useState<'live' | 'identify'>('live');
  const [liveActive, setLiveActive]   = useState(false);

  // Live chord state
  const [chord, setChord]             = useState('—');
  const [confidence, setConfidence]   = useState(0);
  const [key, setKey]                 = useState('');
  const [notes, setNotes]             = useState<string[]>([]);
  const [history, setHistory]         = useState<string[]>([]);

  // Identify state
  const [recSecs, setRecSecs]         = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [songResult, setSongResult]   = useState<AuddResult | null>(null);
  const [showChordBrowser, setShowChordBrowser] = useState(false);
  const [chordUrl, setChordUrl]       = useState('');

  const wvRef     = useRef<WebView>(null);
  const recRef    = useRef<Audio.Recording | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── stop live on blur ── */
  useFocusEffect(useCallback(() => {
    return () => {
      stopLive();
      stopRec();
    };
  }, []));

  function sendCmd(cmd: string) {
    wvRef.current?.injectJavaScript(`
      (function(){
        window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({cmd:'${cmd}'})}));
      })(); true;
    `);
  }

  function startLive() {
    setLiveActive(true);
    setChord('—'); setKey(''); setNotes([]); setHistory([]);
    setTimeout(() => sendCmd('start'), 300);
  }

  function stopLive() {
    setLiveActive(false);
    sendCmd('stop');
  }

  function handleWVMessage(e: any) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as ChordMsg | { type: string; msg?: string };
      if (msg.type === 'chord') {
        const cm = msg as ChordMsg;
        setChord(cm.chord);
        setConfidence(cm.confidence);
        setKey(cm.key);
        setNotes(cm.notes);
        setHistory(prev => {
          const last = prev[prev.length - 1];
          if (cm.chord !== last && cm.chord !== '?') {
            const next = [...prev, cm.chord];
            return next.length > 12 ? next.slice(-12) : next;
          }
          return prev;
        });
      }
    } catch {}
  }

  /* ── Identify: record 10 s then send to AudD ── */
  async function startIdentify() {
    if (isRecognizing) return;
    setSongResult(null);
    setShowChordBrowser(false);

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Нет доступа к микрофону'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recRef.current = rec;
      setIsRecognizing(true);
      setRecSecs(0);

      let s = 0;
      timerRef.current = setInterval(() => {
        s++;
        setRecSecs(s);
        if (s >= 10) {
          if (timerRef.current) clearInterval(timerRef.current);
          finishIdentify(rec);
        }
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
      await rec.stopAndUnloadAsync();
      recRef.current = null;
      const uri = rec.getURI();
      if (!uri) throw new Error('No recording URI');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // AudD recognition API (free tier — 100 req/day without API key)
      const form = new FormData();
      (form as any).append('api_token', 'test');
      (form as any).append('audio', base64);
      (form as any).append('return', 'timecode');

      const res  = await fetch('https://api.audd.io/', { method: 'POST', body: form as any });
      const data = await res.json();

      if (data.status === 'success' && data.result) {
        setSongResult(data.result as AuddResult);
      } else {
        setSongResult(null);
        Alert.alert('Не распознано', 'Попробуйте ещё раз или дольше держите инструмент у микрофона.');
      }
    } catch (e) {
      Alert.alert('Ошибка распознавания', String(e));
    }
    setIsRecognizing(false);
    setRecSecs(0);
    // cleanup tmp recording
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {}
  }

  function openChords(artist: string, title: string) {
    const q = encodeURIComponent(`${artist} ${title} chords`);
    setChordUrl(`https://duckduckgo.com/?q=${q}&ia=web`);
    setShowChordBrowser(true);
  }

  /* ─── UI ─── */
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>CHORDS</Text>
        <View style={styles.modePills}>
          <TouchableOpacity
            style={[styles.pill, mode === 'live' && styles.pillActive]}
            onPress={() => { stopLive(); setMode('live'); }}
          >
            <Ionicons name="mic" size={13} color={mode === 'live' ? '#0a0a0f' : '#555'} />
            <Text style={[styles.pillText, mode === 'live' && styles.pillTextActive]}>LIVE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, mode === 'identify' && styles.pillActive]}
            onPress={() => { stopLive(); setMode('identify'); }}
          >
            <Ionicons name="search" size={13} color={mode === 'identify' ? '#0a0a0f' : '#555'} />
            <Text style={[styles.pillText, mode === 'identify' && styles.pillTextActive]}>IDENTIFY</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── LIVE MODE ── */}
      {mode === 'live' && (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {/* Big chord display */}
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

            {/* Confidence bar */}
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

          {/* Chord history */}
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

          {/* Start / Stop */}
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

      {/* ── IDENTIFY MODE ── */}
      {mode === 'identify' && (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={styles.identCard}>
            <Ionicons name="musical-notes" size={40} color="#7c4dff" style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.identTitle}>Распознавание трека</Text>
            <Text style={styles.identSub}>
              Поднесите телефон к музыке и нажмите кнопку.{'\n'}
              Запись займёт 10 секунд, затем будет отправлена в AudD.
            </Text>

            {isRecognizing ? (
              <View style={styles.recProgress}>
                <ActivityIndicator color="#7c4dff" size="large" />
                <Text style={styles.recSecs}>{recSecs} / 10 с</Text>
                <Text style={styles.recNote}>Идёт запись...</Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  stopRec();
                  setIsRecognizing(false);
                }}>
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

          {/* Result */}
          {songResult && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="checkmark-circle" size={22} color="#00e676" />
                <Text style={styles.resultFound}>Найдено!</Text>
              </View>
              <Text style={styles.resultTitle}>{songResult.title}</Text>
              <Text style={styles.resultArtist}>{songResult.artist}</Text>
              {songResult.album && <Text style={styles.resultMeta}>{songResult.album}{songResult.release_date ? ` · ${songResult.release_date.slice(0, 4)}` : ''}</Text>}

              <View style={styles.resultActions}>
                <TouchableOpacity
                  style={styles.chordsBtn}
                  onPress={() => openChords(songResult.artist, songResult.title)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={16} color="#fff" />
                  <Text style={styles.chordsBtnText}>Найти аккорды</Text>
                </TouchableOpacity>

                {songResult.song_link ? (
                  <TouchableOpacity
                    style={[styles.chordsBtn, { backgroundColor: '#1db95444' }]}
                    onPress={() => {
                      setChordUrl(songResult.song_link!);
                      setShowChordBrowser(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="link" size={16} color="#1db954" />
                    <Text style={[styles.chordsBtnText, { color: '#1db954' }]}>Открыть</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}

          <Text style={styles.hint}>
            Используется AudD Music Recognition API (бесплатный tier).{'\n'}
            Интернет-соединение обязательно.
          </Text>
        </ScrollView>
      )}

      {/* Hidden WebView for chord detection engine */}
      <WebView
        ref={wvRef}
        source={{ html: CHORD_HTML }}
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
  modePills:  { flexDirection: 'row', gap: 6 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  pillActive: { backgroundColor: '#00e676', borderColor: '#00e676' },
  pillText:   { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  pillTextActive: { color: '#0a0a0f' },

  /* Live mode */
  chordCard:  { backgroundColor: '#111118', borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#1e1e28', gap: 8 },
  chordBig:   { fontSize: 72, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'] as any },
  chordKey:   { color: '#555', fontSize: 14, letterSpacing: 1 },
  notesRow:   { flexDirection: 'row', gap: 6, marginTop: 4 },
  notePill:   { backgroundColor: '#1e1e2e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  noteText:   { color: '#7c4dff', fontSize: 12, fontWeight: '700' },
  confRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: 8 },
  confLabel:  { color: '#333', fontSize: 9, width: 44, letterSpacing: 1 },
  confTrack:  { flex: 1, height: 3, backgroundColor: '#1e1e28', borderRadius: 2, overflow: 'hidden' },
  confBar:    { height: 3, borderRadius: 2 },

  histWrap:   { backgroundColor: '#111118', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e1e28' },
  histLabel:  { color: '#333', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  histRow:    { flexDirection: 'row', gap: 6 },
  histPill:   { backgroundColor: '#1e1e28', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  histPillActive: { backgroundColor: '#00e67622', borderWidth: 1, borderColor: '#00e67644' },
  histPillText:   { color: '#555', fontSize: 13, fontWeight: '700' },

  mainBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#00e676', borderRadius: 16, paddingVertical: 16 },
  mainBtnStop:{ backgroundColor: '#ff5252' },
  mainBtnText:{ color: '#0a0a0f', fontSize: 16, fontWeight: '800', letterSpacing: 2 },

  hint:       { color: '#2a2a3a', fontSize: 11, textAlign: 'center', lineHeight: 18 },

  /* Identify mode */
  identCard:  { backgroundColor: '#111118', borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#1e1e28', gap: 8 },
  identTitle: { color: '#ccc', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  identSub:   { color: '#444', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  identBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7c4dff', borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  identBtnText:{ color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  recProgress:{ alignItems: 'center', gap: 8, paddingVertical: 12 },
  recSecs:    { color: '#7c4dff', fontSize: 32, fontWeight: '900' },
  recNote:    { color: '#555', fontSize: 12 },
  cancelBtn:  { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginTop: 4 },
  cancelText: { color: '#555', fontSize: 12 },

  resultCard:  { backgroundColor: '#111118', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#00e67622', gap: 4 },
  resultHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  resultFound: { color: '#00e676', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  resultTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  resultArtist:{ color: '#7c4dff', fontSize: 14, fontWeight: '600' },
  resultMeta:  { color: '#444', fontSize: 12 },
  resultActions:{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  chordsBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7c4dff44', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#7c4dff44' },
  chordsBtnText:{ color: '#fff', fontSize: 13, fontWeight: '700' },

  /* Chord browser */
  browserHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#1e1e28' },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:    { color: '#ccc', fontSize: 14 },
  browserTitle:{ flex: 1, color: '#666', fontSize: 12, letterSpacing: 1 },

  hiddenWV:    { width: 0, height: 0, opacity: 0, position: 'absolute' },
});
