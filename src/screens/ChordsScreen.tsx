import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform, Modal, FlatList, SectionList,
  useWindowDimensions, Pressable, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBarVisibility } from '../context/TabBarVisibility';
import { type SongEntry } from '../data/songDatabase';
import {
  initSongLibrary,
  listSongs,
  listUserSongs,
  getSongById,
  upsertUserSong,
  deleteUserSong,
  getFavoriteIds,
  setFavorite,
} from '../services/initSongLibrary';
import { importLegacyArchiveCatalog } from '../db/legacyArchiveImport';
import {
  contentQualityScore,
  hasVerifiedPracticeLyrics,
  libraryListChordSnippet,
  needsOnDemandChordFetch,
  PROGRESSION_ONLY_HINT,
  resolveLyricsText,
  resolveSongEntry,
  songContentBadge,
  songContentBadgeLabel,
} from '../utils/songContent';
import { isTablatureLine } from '../utils/chordLyricsNormalize';
import {
  formatTransposeLabel,
  transposeChordProText,
  transposeChordProgression,
  transposeChordSymbol,
} from '../utils/chordTranspose';
import {
  getPracticeDisplaySettings,
  getSongTranspose,
  PRACTICE_LYRICS_ZOOM_MAX,
  PRACTICE_LYRICS_ZOOM_MIN,
  setPracticeLyricsZoom,
  setSongTranspose,
} from '../settings/practiceDisplaySettings';
import { probeRemoteChordSearch } from '../providers/remoteChordSearch';
import { getMetadataTrackCount } from '../metadata/metadataDb';
import {
  formatMetadataSyncError,
  isMetadataSyncRunning,
  startBackgroundIndex,
  syncAllMetadata,
  type MetadataSyncProgress,
} from '../metadata/metadataSync';
import {
  ChordFetchError,
  CHORD_FETCH_STAGE_LABEL,
  probeChordFetchEndpoint,
} from '../providers/chordFetchProxy';
import {
  fetchOnDemandChordSheetAuto,
  type OnDemandAutoProgress,
} from '../providers/onDemandChordAuto';
import {
  pesniSlugFromResultId,
  PESNI_FETCH_STAGE_LABEL,
} from '../providers/pesniRuProvider';
import type { ProviderAttribution } from '../providers/types';
import {
  LIBRARY_SEARCH_PAGE_SIZE,
  searchProviders,
  searchResultToSongEntry,
} from '../providers/registry';
import type { SongSearchResult } from '../providers/types';
import { combinedArtistTitle } from '../utils/searchNormalize';
import {
  Gesture,
  GestureDetector,
  ScrollView as GestureScrollView,
  TouchableOpacity as GestureTouchableOpacity,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ensureAutoChordProxySettings } from '../providers/autoChordProxy';
import {
  CHORD_FETCH_DEV_PROXY_CMD,
  chordFetchSetupHint,
  getEffectiveChordFetchUrl,
  normalizeChordFetchUrl,
  resolveChordFetchUrl,
  resolveChordFetchUrlDetailed,
  resolveChordFetchUrlForAutoFill,
  resolveChordFetchUrlForAutoFillDetailed,
} from '../providers/chordFetchUrl';
import {
  getProviderSettings,
  saveProviderSettings,
  type ProviderSettings,
} from '../providers/providerSettings';
import {
  PROVIDER_BADGE_COLORS,
  type ProviderId,
} from '../providers/types';
import { parseChordProText, chordProToSongEntry } from '../utils/chordProParse';
import { normalizeLyricsChords } from '../utils/chordLyricsNormalize';
import {
  createPitchFrame,
  pushPitchFrameRing,
  type PitchFrame,
} from '../utils/pitchFrame';
import { transcribeFromPitchFrames } from '../utils/melodyTranscription';
import { appendVoicedChartPoint, PITCH_CHART_MAX_POINTS } from '../utils/pitchChartHistory';
import {
  shareLibraryBackup,
  importLibraryBackupJson,
  importChordProFilesFromUris,
} from '../library/importExport';
import { ensureSongInUserLibrary } from '../library/persistProviderSong';
import { CHORD_DIAGRAM_OPTIONS, getDiagramOption } from '../data/chordShapes';
import { getFullChordReferenceCatalog } from '../data/basicChordCatalog';
import { resolveChordShape } from '../data/chordShapeResolve';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

import FrequencyChart, { type HistoryPoint, type PitchSegmentOverlay } from '../components/FrequencyChart';
import { useLocale } from '../context/LocaleContext';
import { frequencyToNote } from '../utils/noteUtils';
import { findBestSongMatch } from '../utils/songMatch';
import { fetchLyricsForTrack } from '../utils/lyricsApi';
import {
  formatHintCandidateLabel,
  localSongRecognizer,
  type IdentifyTrackResult,
  type RecognitionAudioHints,
  type RecognizeCandidate,
  type RecognizeOutcome,
} from '../recognition';

function recognizeOutcomeMessage(outcome: RecognizeOutcome): string {
  if (outcome.status === 'match') return '';
  return outcome.message;
}

/* ─── Types ─── */

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
let practiceVoiceMode=false;

/* ── настройки (см. docs/features/2026-05-19-chords-engine-*.md) ── */
const ENGINE_CFG={
  WIN:18,
  STABLE_NEED:18,
  MIN_CONF:0.46,
  SILENCE_PEAK_DB:-68,
  CHROMA_BIN_DB:-65,
  MIN_CHROMA_SUM:0.34,
  ONSET_RATIO:2.5,
  DISPLAY_HOLD:5,
};
const ONSET_RATIO=ENGINE_CFG.ONSET_RATIO;
const DISPLAY_HOLD=ENGINE_CFG.DISPLAY_HOLD;
const WIN=ENGINE_CFG.WIN;
const STABLE_NEED=ENGINE_CFG.STABLE_NEED;
const MIN_CONF=ENGINE_CFG.MIN_CONF;
const SILENCE_PEAK_DB=ENGINE_CFG.SILENCE_PEAK_DB;
const CHROMA_BIN_DB=ENGINE_CFG.CHROMA_BIN_DB;
const MIN_CHROMA_SUM=ENGINE_CFG.MIN_CHROMA_SUM;

let   winBuf=[];

let   candidate='?', stableCount=0, prevSegChord='?', segStart=0;
let   lastDisplayChord='?', displayHoldLeft=0;

/* ── onset / transient detection ── */
let   energyHist=[], onsetCooldown=0;

function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}

function chroma(fft,sr,fftSz){
  const c=new Float32Array(12);const bHz=sr/fftSz;
  for(let i=1;i<fft.length;i++){
    const f=i*bHz;if(f<80||f>2200)continue;
    const db=fft[i];if(db<CHROMA_BIN_DB)continue;
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
function chordTonesFromName(name){
  if(!name||name==='?')return[];
  const roots=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  let rootIdx=-1,rlen=1;
  for(let len=2;len>=1;len--){
    const c=name.slice(0,len);
    const i=roots.indexOf(c);
    if(i>=0){rootIdx=i;rlen=len;break;}
  }
  if(rootIdx<0)return[];
  const suf=name.slice(rlen);
  const ivs=TEMPLATES[suf]||TEMPLATES[''];
  return ivs.map(iv=>roots[(rootIdx+iv)%12].trim());
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
/** HPS with low-string attenuation + coarse gate when bass/guitar dominates (not full separation). */
function pitchHPSVoice(fft,bHz,harmonics){
  const n=fft.length;
  let eLow=0,eVoice=0,eHi=0;
  for(let i=1;i<n;i++){
    const f=i*bHz;
    const raw=fft[i]>-100?Math.pow(10,fft[i]/20):0;
    if(f>=65&&f<=155)eLow+=raw;
    if(f>=165&&f<=1100)eVoice+=raw;
    if(f>=2200&&f<=4200)eHi+=raw;
  }
  if(eVoice<0.006)return-1;
  if(eLow*1.05>=eVoice)return-1;
  if(eVoice>0.03&&eHi<eVoice*0.018)return-1;

  const lin=new Float32Array(n);
  for(let i=0;i<n;i++){
    const f=i*bHz;
    let g=fft[i]>-100?Math.pow(10,fft[i]/20):0;
    if(f<135)g*=0.1;
    else if(f<190)g*=0.5;
    else if(f>4500)g*=0.65;
    lin[i]=g;
  }
  const mx=Math.floor(n/harmonics);
  const hps=new Float32Array(mx);
  for(let i=0;i<mx;i++){hps[i]=lin[i];for(let h=2;h<=harmonics;h++)hps[i]*=(i*h<n?lin[i*h]:0);}
  const minB=Math.max(1,Math.ceil(75/bHz));
  const maxB=Math.min(mx-1,Math.floor(1050/bHz));
  let best=-1,bestV=0;
  for(let i=minB;i<=maxB;i++){if(hps[i]>bestV){bestV=hps[i];best=i;}}
  if(best<0||bestV<1e-14||fft[best]<-50)return-1;
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
async function start(isVoicePractice){
  if(running)return;running=true;
  practiceVoiceMode=!!isVoicePractice;
  winBuf=[];energyHist=[];onsetCooldown=0;
  candidate='?';stableCount=0;prevSegChord='?';segStart=Date.now();
  lastDisplayChord='?';displayHoldLeft=0;
  try{
    const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    ctx=new AudioContext();
    if(ctx.state==='suspended') await ctx.resume();
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
      if(peak<SILENCE_PEAK_DB){requestAnimationFrame(loop);return;}

      const c=chroma(fft,ctx.sampleRate,analyser.fftSize);

      // ── Onset detection: energy spike = new chord starting ──
      const totalE=c.reduce((s,v)=>s+v,0);
      energyHist.push(totalE);
      if(energyHist.length>8)energyHist.shift();
      if(onsetCooldown>0){onsetCooldown--;}
      else if(energyHist.length>=4){
        const prevAvg=energyHist.slice(0,-2).reduce((s,v)=>s+v,0)/(energyHist.length-2);
        // Energy jumped >2.2× → guitarist just struck a new chord
        if(totalE>prevAvg*ONSET_RATIO&&prevAvg>0.4){
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
      const chromaSum=avg.reduce((s,v)=>s+v,0);
      const chord=detectChord(avg);
      const key=estimateKey(avg);
      const chordOk=chord.conf>=MIN_CONF&&chromaSum>=MIN_CHROMA_SUM;
      let chordName=chordOk?chord.name:'?';
      if(!chordOk&&lastDisplayChord!=='?'&&displayHoldLeft<DISPLAY_HOLD){
        displayHoldLeft++;
        chordName=lastDisplayChord;
      }else{
        displayHoldLeft=0;
        if(chordOk)lastDisplayChord=chord.name;
      }
      const notes=chordName!=='?'?chordTonesFromName(chordName):[];
      const pitchHz=practiceVoiceMode?pitchHPSVoice(fft,bHz,4):pitchHPS(fft,bHz,4);

      post({type:'update',chord:chordName,confidence:chord.conf,key,notes,pitchHz});

      const segOk=chordOk;
      // ── Stability gate ──
      if(segOk&&chord.name!=='?'&&chord.name===candidate){
        stableCount++;
        if(stableCount===STABLE_NEED&&candidate!==prevSegChord){
          const now=Date.now();
          emitSegment(prevSegChord,now-segStart);
          prevSegChord=candidate;
          segStart=now;
        }
      } else {
        if(!segOk||chord.name!==candidate){candidate=segOk?chord.name:'?';stableCount=0;}
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
  practiceVoiceMode=false;
  // Emit final segment
  emitSegment(prevSegChord,Date.now()-segStart);
  try{if(src)src.disconnect();if(ctx)ctx.close();}catch{}
  winBuf=[];
}
document.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='start')start(false);else if(m.cmd==='startPracticeVoice')start(true);else if(m.cmd==='stop')stop();}catch{}});
window.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='start')start(false);else if(m.cmd==='startPracticeVoice')start(true);else if(m.cmd==='stop')stop();}catch{}});
</script></body></html>`;

const RECORDINGS_DIR = (FileSystem.documentDirectory ?? '') + 'recordings/';

/* ─── Chord diagram (multi-instrument fingerings in ../data/chordShapes) ─── */
function ChordDiagram({ name, diagramId, size = 'md' }: { name: string; diagramId: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const resolved = resolveChordShape(diagramId, name);
  const def = resolved?.shape ?? null;
  const resolvedLabel = resolved && resolved.resolvedName !== name.trim() ? resolved.resolvedName : null;
  const opt = getDiagramOption(diagramId);
  const stringLabels = opt?.stringLabels ?? [];

  const S = def ? def.frets.length : (opt?.stringLabels.length ?? 6);
  const NF = 4;
  const G  = size === 'xl' ? 32 : size === 'lg' ? 26 : size === 'sm' ? 16 : 22;
  const FH = size === 'xl' ? 34 : size === 'lg' ? 28 : size === 'sm' ? 18 : 24;
  const PL = size === 'xl' ? 18 : size === 'lg' ? 16 : size === 'sm' ? 10 : 14;
  const PT = size === 'xl' ? 26 : size === 'lg' ? 22 : size === 'sm' ? 14 : 18;
  const LABEL_H = 14;
  const W  = (S - 1) * G + PL * 2;
  const H  = NF * FH + PT + 8 + LABEL_H;
  const DOT = G * 0.40;

  if (!def) {
    const label = (!name || name === '—' || name === '?') ? '?' : name;
    return (
      <View style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#2a2a3a', borderRadius: 8, paddingHorizontal: 4 }}>
        <Text style={{ color: '#555', fontSize: 11, textAlign: 'center', lineHeight: 16 }} numberOfLines={2}>{label}</Text>
        <Text style={{ color: '#444', fontSize: 9, marginTop: 2, textAlign: 'center' }}>нет схемы для {opt?.label ?? 'инструмента'}</Text>
      </View>
    );
  }

  const { frets, barre, barreFromString } = def;
  const bStart = barre != null ? (barreFromString ?? 0) : 0;
  const fNums = frets.filter(f => f > 0);
  const minF  = fNums.length ? Math.min(...fNums) : 1;
  const base  = barre != null ? barre : (minF > 3 ? minF - 1 : 1);
  const showNum = base > 1;
  const gx = (si: number) => PL + si * G;
  const gy = (fi: number) => PT + fi * FH;

  return (
    <View style={{ width: W, height: H, borderWidth: 1, borderColor: '#2a2a3a', borderRadius: 8, overflow: 'hidden' }}>
      {resolvedLabel ? (
        <Text style={{ position: 'absolute', left: 2, top: 1, color: '#666', fontSize: 7, zIndex: 2 }} numberOfLines={1}>
          ≈{resolvedLabel}
        </Text>
      ) : null}
      {!showNum ? (
        <View style={{ position:'absolute', left:PL, top:PT - 2, width:(S-1)*G, height:4, backgroundColor:'#aaa', borderRadius:2 }} />
      ) : (
        <Text style={{ position:'absolute', right: 4, top: PT + FH * 0.3, color:'#888', fontSize: size === 'xl' || size === 'lg' ? 11 : 9, fontWeight:'700' }}>{base}fr</Text>
      )}
      {Array.from({ length: NF + 1 }).map((_, fi) => (
        <View key={fi} style={{ position:'absolute', left:PL, top:gy(fi), width:(S-1)*G, height:1, backgroundColor:'#3a3a55' }} />
      ))}
      {Array.from({ length: S }).map((_, si) => (
        <View key={si} style={{ position:'absolute', left:gx(si), top:PT, width: si === 0 ? 2 : 1, height:NF*FH, backgroundColor:'#4a4a65' }} />
      ))}
      {barre != null && (
        <View style={{
          position:'absolute',
          left: gx(bStart) + DOT,
          top: gy(barre - base) + FH * 0.18,
          width: (S - 1 - bStart) * G - DOT * 2,
          height: FH * 0.64,
          backgroundColor:'#ff980099',
          borderRadius: FH * 0.32,
        }} />
      )}
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
        const isBarre = barre != null && f === barre && si >= bStart;
        return (
          <View key={si} style={{ position:'absolute', left:x - DOT, top:cy - DOT, width:DOT*2, height:DOT*2, borderRadius:DOT, backgroundColor: isBarre ? '#ff9800' : '#7c4dff' }} />
        );
      })}
      {Array.from({ length: S }).map((_, si) => (
        <Text
          key={`lbl-${si}`}
          style={{
            position: 'absolute',
            left: gx(si) - (size === 'sm' ? 5 : 6),
            top: PT + NF * FH + 1,
            color: '#555',
            fontSize: size === 'lg' ? 9 : 7,
            fontWeight: '700',
            width: G + 4,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {stringLabels[si] ?? ''}
        </Text>
      ))}
    </View>
  );
}

/* ─── Chord+lyrics line renderer ─── */
// Normalise any chord-annotation format to [Chord] before parsing.
// Handles: [Am]text  (Am)text  [Am] text  (Am) text
function normalizeLine(raw: string): string {
  // (Am)text or (Am) text → [Am]text
  return raw.replace(/\(([A-G][^)]{0,6})\)\s*/g, '[$1]');
}

// Input: "[Am]Hello [F]world" → renders chord names (orange/green) above words
// activeChordPos: if provided and matches a chord in this line, that chord glows green
/** Fixed row above lyric syllable — A, Am, C#m and empty spacer share the same box. */
const CHORD_INLINE_ROW_H = 21;
const CHORD_INLINE_SLOT_MIN_W = 26;

const chordInlineSlotStyle = {
  minHeight: CHORD_INLINE_ROW_H,
  minWidth: CHORD_INLINE_SLOT_MIN_W,
  justifyContent: 'flex-end' as const,
  alignItems: 'center' as const,
};

function chordChipTextStyle(
  _chord: string,
  cs: { color: string; bg: string },
  compact?: boolean,
  scale = 1,
) {
  const chordFs = Math.round(14 * scale);
  return {
    color: cs.color,
    fontSize: chordFs,
    fontWeight: '900' as const,
    lineHeight: Math.round(19 * scale),
    backgroundColor: cs.bg === 'transparent' ? '#7c4dff18' : cs.bg,
    paddingHorizontal: compact ? 3 : 7,
    paddingVertical: compact ? 0 : 2,
    borderRadius: compact ? 4 : 6,
    textAlign: 'center' as const,
  };
}

function ChordLyricsLine({
  line, currentChord, onChordTap, lineIdx, activeChordPos, chordPressDelay = 200, displayScale = 1,
}: {
  line: string;
  currentChord: string;
  onChordTap: (c: string) => void;
  lineIdx: number;
  activeChordPos: { lineIdx: number; posInLine: number } | null;
  /** Higher delay when auto-scroll off — vertical swipe wins over chord tap. */
  chordPressDelay?: number;
  /** Pinch / A± zoom for lyrics + chord row alignment */
  displayScale?: number;
}) {
  const chordRowH = Math.round(CHORD_INLINE_ROW_H * displayScale);
  const chordSlotMinW = Math.round(CHORD_INLINE_SLOT_MIN_W * displayScale);
  const chordSlotStyle = {
    minHeight: chordRowH,
    minWidth: chordSlotMinW,
    justifyContent: 'flex-end' as const,
    alignItems: 'center' as const,
  };
  const lyricFs = Math.round(16 * displayScale);
  const lyricLh = Math.round(24 * displayScale);
  if (isTablatureLine(line)) {
    return (
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        style={{ marginBottom: 10, maxHeight: Math.max(18, Math.round(22 * displayScale)) }}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        <Text
          selectable
          style={{
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: Math.round(13 * displayScale),
            lineHeight: Math.round(18 * displayScale),
            color: '#9c7cff',
          }}
        >
          {line}
        </Text>
      </ScrollView>
    );
  }

  const chordTapDelay = chordPressDelay ?? 200;
  const normalized = normalizeLine(line);
  const segs: { chord?: string; text: string }[] = [];
  let remaining = normalized;
  let chordPosInLine = 0;
  while (remaining.length > 0) {
    const chordAt = remaining.search(/\[[A-G]/);
    if (chordAt < 0) {
      if (remaining) segs.push({ text: remaining });
      break;
    }
    if (chordAt > 0) {
      segs.push({ text: remaining.slice(0, chordAt) });
      remaining = remaining.slice(chordAt);
      continue;
    }
    const m = remaining.match(/^\[([A-G][^\]]*)\](.*)/s);
    if (m) {
      const afterChord = m[2];
      const nextIdx = afterChord.search(/\[[A-G]/);
      const word = nextIdx >= 0 ? afterChord.slice(0, nextIdx) : afterChord;
      segs.push({ chord: m[1].trim(), text: word });
      remaining = nextIdx >= 0 ? afterChord.slice(nextIdx) : '';
    } else {
      segs.push({ text: remaining });
      remaining = '';
    }
  }
  if (segs.length === 0) return <View style={{ height: 8 }} />;

  const allChordsOnly = segs.every(s => s.chord && !s.text.trim());

  let posCounter = 0;
  const getChordStyle = (chord: string) => {
    const pos = posCounter++;
    const isActive = activeChordPos?.lineIdx === lineIdx && activeChordPos?.posInLine === pos;
    const isCurrent = chord === currentChord;
    if (isActive) return { color: '#00e676', bg: '#00e67630' };
    if (isCurrent) return { color: '#ff9800', bg: '#ff980022' };
    return { color: '#7c4dff', bg: 'transparent' };
  };

  if (allChordsOnly) {
    posCounter = 0;
    return (
      <View pointerEvents="box-none" style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, gap: 4 }}>
        {segs.filter(s => s.chord).map((seg, i) => {
          const cs = getChordStyle(seg.chord!);
          return (
            <GestureTouchableOpacity
              key={`chord-${i}-${seg.chord}`}
              activeOpacity={0.7}
              delayPressIn={chordTapDelay}
              onPress={() => onChordTap(seg.chord!)}
              hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
            >
              <View style={chordSlotStyle}>
                <Text style={chordChipTextStyle(seg.chord!, cs, false, displayScale)}>{seg.chord}</Text>
              </View>
            </GestureTouchableOpacity>
          );
        })}
      </View>
    );
  }

  posCounter = 0;
  return (
    <View pointerEvents="box-none" style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
      {segs.map((seg, i) => {
        const cs = seg.chord ? getChordStyle(seg.chord) : null;
        const hasLyricUnderChord = Boolean(seg.chord && seg.text.trim());
        const segmentChordSlot = hasLyricUnderChord
          ? {
              minHeight: chordRowH,
              justifyContent: 'flex-end' as const,
              alignItems: 'center' as const,
              alignSelf: 'stretch' as const,
            }
          : seg.chord
            ? chordSlotStyle
            : { minHeight: chordRowH };
        return (
          <View
            key={i}
            pointerEvents="box-none"
            style={{
              alignItems: hasLyricUnderChord ? 'center' : 'flex-start',
              marginRight: 4,
              marginBottom: 4,
              maxWidth: '100%',
            }}
          >
            <View pointerEvents="box-none" style={segmentChordSlot}>
              {seg.chord && cs ? (
                <GestureTouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={chordTapDelay}
                  onPress={() => onChordTap(seg.chord!)}
                  hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                >
                  <Text style={chordChipTextStyle(seg.chord!, cs, true, displayScale)}>{seg.chord}</Text>
                </GestureTouchableOpacity>
              ) : null}
            </View>
            <Text pointerEvents="none" style={{ color: '#ddd', fontSize: lyricFs, lineHeight: lyricLh }}>
              {seg.text || ' '}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type Mode = 'live' | 'practice' | 'identify';
const CHORDS_DEV_BUILD = 'search-scroll-2026-05-24b';

export default function ChordsScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowH, width: windowW } = useWindowDimensions();
  const { t } = useLocale();
  const { tabBarHidden, setTabBarHidden } = useTabBarVisibility();

  const [showPracticePanel, setShowPracticePanel] = useState(true);
  /** Высота док-бара Мик+REC (для padding у текста; док зафиксирован снизу области практики) */
  const [practiceDockHeight, setPracticeDockHeight] = useState(56);
  /** Док LIVE (СТАРТ / В практику) — та же схема, что у практики: список аккордов на flex:1 */
  const [liveDockHeight, setLiveDockHeight] = useState(56);
  /** Fretboard diagram vs voice chart can be toggled independently */
  const [showPracticeFretboard, setShowPracticeFretboard] = useState(true);
  const [showPracticePitchGraph, setShowPracticePitchGraph] = useState(true);
  /** D major / cents / voice row — optional to save space */
  const [showPracticeNoteMatch, setShowPracticeNoteMatch] = useState(false);
  /** Chord diagram instrument (guitar6, guitar7, ukulele, mandolin, bass4) */
  const [chordDiagramId, setChordDiagramId] = useState('guitar6');

  const [mode, setMode]               = useState<Mode>('practice');
  const [liveActive, setLiveActive]   = useState(false);
  /** Practice: mic on for voice pitch + chart */
  const [pitchActive, setPitchActive] = useState(false);

  /** Voice chart width: updated from layout so the graph uses remaining row space */
  const [practiceVoiceChartW, setPracticeVoiceChartW] = useState(() =>
    Math.min(340, Math.max(140, Math.round(windowW * 0.5))));

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
  const [voiceHistory, setVoiceHistory] = useState<HistoryPoint[]>([]);
  const [voicePitchFrames, setVoicePitchFrames] = useState<PitchFrame[]>([]);
  const practiceSmoothedFreqRef = useRef<number | null>(null);
  const practicePitchFrameRingRef = useRef<PitchFrame[]>([]);
  const lastVoiceChartPtMsRef = useRef(0);

  const VOICE_CHART_EMA = 0.20;

  const voiceTranscription = useMemo(
    () => transcribeFromPitchFrames(voicePitchFrames),
    [voicePitchFrames],
  );

  const voiceSegmentOverlays = useMemo<PitchSegmentOverlay[]>(
    () =>
      voiceTranscription.segments.map(s => ({
        startMs: s.startMs,
        endMs: s.endMs,
        midi: s.midi,
        note: s.noteName,
        octave: s.octave,
        confidence: s.confidenceMean,
      })),
    [voiceTranscription.segments],
  );

  /* ── Practice recording ── */
  const [isPracticeRec, setIsPracticeRec] = useState(false);
  const [practiceRecDur, setPracticeRecDur] = useState(0);
  const practiceRecRef = useRef<Audio.Recording | null>(null);
  const practiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Practice chord progression ── */
  const [practiceInput, setPracticeInput]     = useState('');
  const [practiceChords, setPracticeChords]   = useState<string[]>([]);
  const [practiceChordIdx, setPracticeChordIdx] = useState(0);
  const [practiceSong, setPracticeSong]       = useState<SongEntry | null>(null);
  const [chordFetchLoading, setChordFetchLoading] = useState(false);
  const [chordFetchProgress, setChordFetchProgress] = useState<OnDemandAutoProgress | null>(null);
  const [onDemandAttribution, setOnDemandAttribution] = useState<ProviderAttribution | null>(null);

  /* ── Lyrics in practice ── */
  const [practiceLyrics, setPracticeLyrics] = useState('');
  const [practiceLyricsZoom, setPracticeLyricsZoomState] = useState(1);
  const [practiceTranspose, setPracticeTranspose] = useState(0);
  /** Always normalized for display/scroll (edit mode keeps raw practiceLyrics). */
  const practiceLyricsDisplay = useMemo(() => {
    const t = practiceLyrics.trim();
    if (!t) return '';
    let base = '';
    if (practiceSong) {
      const entry = { ...practiceSong, lyrics: t };
      const verified = resolveLyricsText(entry);
      if (verified) base = verified;
      else if (hasVerifiedPracticeLyrics(entry)) base = t;
    }
    if (!base) return '';
    return practiceTranspose ? transposeChordProText(base, practiceTranspose) : base;
  }, [practiceLyrics, practiceSong, practiceTranspose]);

  const displayPracticeChords = useMemo(
    () =>
      practiceTranspose
        ? practiceChords.map(c => transposeChordSymbol(c, practiceTranspose))
        : practiceChords,
    [practiceChords, practiceTranspose],
  );
  const [practiceContentHint, setPracticeContentHint] = useState<string | null>(null);
  const [practiceFetchHint, setPracticeFetchHint] = useState<string | null>(null);
  const [autoChordFetchDone, setAutoChordFetchDone] = useState(false);
  const [catalogUpgradeToast, setCatalogUpgradeToast] = useState<string | null>(null);
  const [lyricsEditMode, setLyricsEditMode] = useState(false);
  /* ── Measured lyrics column height (auto-scroll + flex layout) ── */
  const [practiceLyricsViewportH, setPracticeLyricsViewportH] = useState(260);

  /* ── Auto-scroll ── */
  const [autoScroll, setAutoScroll]       = useState(false);
  const [practiceBpm, setPracticeBpm]     = useState(80);
  const practiceLyricsZoomRef             = useRef(1);
  const lyricsPinchOriginRef              = useRef(1);
  const lyricsScrollRef                   = useRef<GestureScrollView>(null);
  const autoScrollActiveRef               = useRef(false);
  const autoScrollFrameRef                = useRef<number | null>(null);
  const autoScrollLastTsRef               = useRef(0);
  const scrollYRef                        = useRef(0);
  const scrollContentHRef                 = useRef(0);
  const practiceLyricsViewportHRef        = useRef(260);
  /** Finger on lyrics — block auto-scroll interval + mic scrollTo until gesture ends */
  const lyricsUserScrollRef               = useRef(false);

  const scrollLyricsTo = useCallback((y: number, animated = false, force = false) => {
    if (!force && !autoScrollActiveRef.current) return;
    const viewH = Math.max(80, practiceLyricsViewportHRef.current);
    const maxY = Math.max(0, scrollContentHRef.current - viewH);
    const nextY = Math.max(0, Math.min(maxY, y));
    scrollYRef.current = nextY;
    lyricsScrollRef.current?.scrollTo({ y: nextY, animated });
  }, []);

  useEffect(() => {
    autoScrollActiveRef.current = autoScroll;
  }, [autoScroll]);

  const pauseAutoScrollInterval = useCallback(() => {
    if (autoScrollFrameRef.current != null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback((bpm: number) => {
    pauseAutoScrollInterval();
    autoScrollActiveRef.current = true;
    setAutoScroll(true);
    autoScrollLastTsRef.current = 0;
    const pxPerSec = Math.max(12, Math.min(46, bpm * 0.24));

    const tick = (ts: number) => {
      if (lyricsUserScrollRef.current) {
        autoScrollLastTsRef.current = ts;
        autoScrollFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      const maxY = Math.max(0, scrollContentHRef.current - Math.max(80, practiceLyricsViewportHRef.current));
      if (maxY <= 0) {
        if (scrollContentHRef.current <= 0) {
          autoScrollFrameRef.current = requestAnimationFrame(tick);
        } else {
          pauseAutoScrollInterval();
          setAutoScroll(false);
        }
        return;
      }
      const prevTs = autoScrollLastTsRef.current || ts;
      const dt = Math.max(0, Math.min(80, ts - prevTs));
      autoScrollLastTsRef.current = ts;
      const nextY = Math.min(maxY, scrollYRef.current + (pxPerSec * dt) / 1000);
      scrollLyricsTo(nextY, false);
      if (nextY < maxY - 1) {
        autoScrollFrameRef.current = requestAnimationFrame(tick);
      } else {
        pauseAutoScrollInterval();
        setAutoScroll(false);
      }
    };

    autoScrollFrameRef.current = requestAnimationFrame(tick);
  }, [pauseAutoScrollInterval, scrollLyricsTo]);

  const stopAutoScroll = useCallback(() => {
    pauseAutoScrollInterval();
    autoScrollActiveRef.current = false;
    setAutoScroll(false);
  }, [pauseAutoScrollInterval]);

  const toggleAutoScroll = useCallback(() => {
    if (autoScroll) {
      stopAutoScroll();
      return;
    }
    const viewH = Math.max(80, practiceLyricsViewportHRef.current);
    const maxY = Math.max(0, scrollContentHRef.current - viewH);
    if (scrollYRef.current >= maxY - 2) {
      scrollLyricsTo(0, false, true);
    }
    startAutoScroll(practiceBpm);
  }, [autoScroll, practiceBpm, scrollLyricsTo, startAutoScroll, stopAutoScroll]);

  const bumpPracticeBpm = useCallback((delta: number) => {
    const next = Math.min(240, Math.max(30, practiceBpm + delta));
    setPracticeBpm(next);
    if (autoScrollFrameRef.current != null) {
      startAutoScroll(next);
    }
  }, [practiceBpm, startAutoScroll]);

  const handleLyricsScrollEnd = useCallback(() => {
    lyricsUserScrollRef.current = false;
  }, []);

  const handleLyricsScrollBeginDrag = useCallback(() => {
    lyricsUserScrollRef.current = true;
    pauseAutoScrollInterval();
    autoScrollActiveRef.current = false;
    setAutoScroll(false);
  }, [pauseAutoScrollInterval]);

  const restoreLyricsScrollAfterLayout = useCallback(() => {
    if (!autoScrollActiveRef.current || lyricsUserScrollRef.current) return;
    const y = scrollYRef.current;
    if (y <= 0) return;
    requestAnimationFrame(() => {
      scrollLyricsTo(y, false, true);
    });
  }, [scrollLyricsTo]);

  useEffect(() => () => { stopAutoScroll(); }, [stopAutoScroll]);

  useEffect(() => {
    if (mode !== 'practice' || lyricsEditMode) stopAutoScroll();
  }, [mode, lyricsEditMode, stopAutoScroll]);

  /* ── Lyric chord-following (mic-driven scroll) ── */
  // Flat list of every chord in lyrics with line index and position within line
  const lyricChordList = useMemo(() => {
    if (!practiceLyricsDisplay) return [];
    return practiceLyricsDisplay.split('\n').flatMap((rawLine, li) => {
      const normalized = normalizeLine(rawLine);
      return [...normalized.matchAll(/\[([A-G][^\]]*)\]/g)].map((m, ci) => ({
        lineIdx: li, posInLine: ci, chord: m[1].trim(),
      }));
    });
  }, [practiceLyricsDisplay]);

  const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
  const activeLyricIdxRef = useRef(-1);
  const lyricChordListRef = useRef(lyricChordList);
  const lineYRef = useRef<Record<number, number>>({});

  useEffect(() => {
    lyricChordListRef.current = lyricChordList;
    activeLyricIdxRef.current = -1;
    setActiveLyricIdx(-1);
    lineYRef.current = {};
  }, [lyricChordList]);

  useEffect(() => {
    stopAutoScroll();
    scrollYRef.current = 0;
    lyricsScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [practiceSong?.id, stopAutoScroll]);

  const lyricsImmersiveRef = useRef(false);
  const immersiveLyrics =
    mode === 'practice' && practiceLyrics.trim().length > 0 && !lyricsEditMode;

  useEffect(() => {
    if (mode !== 'practice') {
      if (lyricsImmersiveRef.current) {
        lyricsImmersiveRef.current = false;
        setTabBarHidden(false);
      }
      return;
    }
    if (immersiveLyrics && !lyricsImmersiveRef.current) {
      lyricsImmersiveRef.current = true;
      setTabBarHidden(true);
      setShowPracticePanel(false);
    }
    if (!immersiveLyrics && lyricsImmersiveRef.current) {
      lyricsImmersiveRef.current = false;
      setTabBarHidden(false);
    }
  }, [mode, immersiveLyrics, setTabBarHidden]);

  const [liveError, setLiveError] = useState<string | null>(null);
  const wvReadyRef = useRef(false);
  const pendingStartRef = useRef(false);
  const pendingPracticeVoiceRef = useRef(false);
  const modeRef = useRef(mode);
  const pitchActiveRef = useRef(pitchActive);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { pitchActiveRef.current = pitchActive; }, [pitchActive]);

  /* ── Identify state ── */
  const [recSecs, setRecSecs]         = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [songResult, setSongResult]   = useState<IdentifyTrackResult | null>(null);
  const [ytUrl, setYtUrl]             = useState('');
  const [ytLoading, setYtLoading]     = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [identSource, setIdentSource] = useState<'mic' | 'file' | 'yt' | 'manual'>('mic');
  const [identifyHintCandidates, setIdentifyHintCandidates] = useState<RecognizeCandidate[] | null>(null);
  const [identifyAudioHints, setIdentifyAudioHints] = useState<RecognitionAudioHints | null>(null);
  const [lyrics, setLyrics]           = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsSource, setLyricsSource] = useState<'ovh' | 'library' | null>(null);
  const [libraryMatch, setLibraryMatch] = useState<SongEntry | null>(null);
  const identifyChordedLyrics = useMemo(() => lyrics?.trim() ?? '', [lyrics]);
  const [manualArtist, setManualArtist] = useState('');
  const [manualTitle, setManualTitle]   = useState('');
  const [metadataTrackCount, setMetadataTrackCount] = useState(0);
  const [metadataSyncProgress, setMetadataSyncProgress] = useState<MetadataSyncProgress | null>(null);
  const allSongsRef = useRef<SongEntry[]>([]);

  const wvRef    = useRef<WebView>(null);
  const recRef   = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    return () => {
      stopLive();
      stopRec();
      stopPracticeRec();
      setPitchActive(false);
      setVoiceHistory([]);
      setVoicePitchFrames([]);
      practicePitchFrameRingRef.current = [];
      practiceSmoothedFreqRef.current = null;
      lastVoiceChartPtMsRef.current = 0;
      setTabBarHidden(false);
      lyricsImmersiveRef.current = false;
    };
  }, [setTabBarHidden]));

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
    pendingPracticeVoiceRef.current = false;
    if (wvReadyRef.current) {
      sendCmd('start');
    } else {
      pendingStartRef.current = true;
    }
  }
  function stopLive() {
    setLiveActive(false);
    pendingStartRef.current = false;
    pendingPracticeVoiceRef.current = false;
    sendCmd('stop');
  }

  function handleWVMessage(e: any) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') {
        setLiveError(null);
      } else if (msg.type === 'error') {
        setLiveActive(false);
        setPitchActive(false);
        pendingStartRef.current = false;
        pendingPracticeVoiceRef.current = false;
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
          // Advance through lyric chords — find next matching chord and scroll to it
          const chordList = lyricChordListRef.current;
          if (chordList.length > 0) {
            const curPos = activeLyricIdxRef.current;
            const lookFrom = curPos + 1;
            const lookTo = Math.min(lookFrom + 6, chordList.length);
            const detected = msg.chord as string;
            for (let i = lookFrom; i < lookTo; i++) {
              const lc = chordList[i];
              // Exact match OR prefix match (e.g. detected "Am7" matches lyric "Am")
              if (detected === lc.chord || detected.startsWith(lc.chord) || lc.chord.startsWith(detected)) {
                activeLyricIdxRef.current = i;
                setActiveLyricIdx(i);
                if (
                  autoScrollActiveRef.current
                  && !lyricsUserScrollRef.current
                ) {
                  const lineY = lineYRef.current[lc.lineIdx] ?? 0;
                  scrollLyricsTo(Math.max(0, lineY - 64), false, true);
                }
                break;
              }
            }
          }
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

          if (modeRef.current === 'practice' && pitchActiveRef.current) {
            const raw = msg.pitchHz as number;
            const now = Date.now();
            const prev = practiceSmoothedFreqRef.current;
            const freq = prev == null ? raw : VOICE_CHART_EMA * raw + (1 - VOICE_CHART_EMA) * prev;
            practiceSmoothedFreqRef.current = freq;
            const info = frequencyToNote(freq);
            const rawInfo = frequencyToNote(raw);
            const frame = createPitchFrame({
              t: now,
              frequency: raw,
              signal: 0.08,
              cents: rawInfo.cents,
            });
            practicePitchFrameRingRef.current = pushPitchFrameRing(practicePitchFrameRingRef.current, frame);
            setVoicePitchFrames(practicePitchFrameRingRef.current);
            setVoiceHistory(hprev => {
              const result = appendVoicedChartPoint(hprev, {
                chartFreq: freq,
                frame,
                lastPtMs: lastVoiceChartPtMsRef.current,
                cents: info.cents,
                maxPoints: PITCH_CHART_MAX_POINTS,
              });
              if (result) {
                lastVoiceChartPtMsRef.current = result.lastPtMs;
                return result.history;
              }
              return hprev;
            });
          }
        } else {
          setVoiceNote('—'); setVoiceFreq(0); setVoiceCents(0);
          if (modeRef.current === 'practice' && pitchActiveRef.current) {
            practiceSmoothedFreqRef.current = null;
          }
        }
      }
    } catch {}
  }

  function handleWVLoad() {
    wvReadyRef.current = true;
    if (pendingPracticeVoiceRef.current) {
      pendingPracticeVoiceRef.current = false;
      sendCmd('startPracticeVoice');
    } else if (pendingStartRef.current) {
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
  function clearIdentifyHints() {
    setIdentifyHintCandidates(null);
    setIdentifyAudioHints(null);
  }

  function formatIdentifyAudioHintsLine(hints: RecognitionAudioHints | null): string | null {
    if (!hints) return null;
    const parts: string[] = [];
    if (hints.bpm && hints.bpm > 0) parts.push(`${hints.bpm} BPM`);
    if (hints.estimatedKey) parts.push(hints.estimatedKey);
    if (hints.melodyNoteCount && hints.melodyNoteCount >= 3) {
      parts.push(`напев ~${hints.melodyNoteCount} нот`);
    }
    return parts.length ? parts.join(' · ') : null;
  }

  async function handleIdentifyOutcome(
    outcome: RecognizeOutcome,
    opts?: { savedTitle?: string },
  ) {
    clearIdentifyHints();
    if (outcome.status === 'match' && outcome.candidates[0]) {
      await applyFromLibrarySong(outcome.candidates[0].song);
      return;
    }
    if (outcome.status === 'snippet_saved') {
      setIdentifyHintCandidates(outcome.hintCandidates ?? null);
      setIdentifyAudioHints(outcome.audioHints ?? null);
    }
    Alert.alert(
      outcome.status === 'snippet_saved' ? (opts?.savedTitle ?? 'Запись сохранена') : 'Не найдено',
      recognizeOutcomeMessage(outcome),
      [
        { text: 'База песен', onPress: () => { clearIdentifyResult(); openPracticeLibrary(); } },
        { text: 'Вручную', onPress: () => { clearIdentifyResult(); setIdentSource('manual'); } },
        { text: 'OK', style: 'cancel' },
      ],
    );
  }

  async function startIdentify() {
    if (isRecognizing) return;
    setSongResult(null);
    clearIdentifyHints();
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
    const secs = recSecs;
    try {
      await rec.stopAndUnloadAsync(); recRef.current = null;
      const uri = rec.getURI();
      if (!uri) throw new Error('No recording URI');
      const outcome = await localSongRecognizer.recognizeFromRecording(uri, {
        durationSec: secs || 10,
        source: 'mic',
      });
      await handleIdentifyOutcome(outcome);
    } catch (e) { Alert.alert('Ошибка записи', String(e)); }
    setIsRecognizing(false); setRecSecs(0);
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
  }

  async function fetchLyrics(artist: string, title: string) {
    setLyricsLoading(true);
    const { text, source } = await fetchLyricsForTrack(artist, title);
    if (text) {
      setLyrics(text);
      setLyricsSource(source);
    }
    setLyricsLoading(false);
  }

  async function loadSongForPractice(song: SongEntry): Promise<SongEntry> {
    await initSongLibrary();
    const fromDb = await getSongById(song.id);
    return resolveSongEntry(fromDb ?? song);
  }

  async function applyFromLibrarySong(song: SongEntry, provider?: ProviderId) {
    const persisted = await ensureSongInUserLibrary(song, provider);
    if (persisted.id !== song.id) await reloadLibrary();
    const full = await loadSongForPractice(persisted);
    await applyIdentifyResult(
      { artist: full.artist, title: full.title },
      full,
    );
  }

  async function applyIdentifyResult(r: IdentifyTrackResult, catalogMatch?: SongEntry | null) {
    setSongResult(r);
    setLyrics(null);
    setLyricsSource(null);

    const matchRaw = catalogMatch ?? findBestSongMatch(r.artist, r.title, allSongsRef.current);
    const match = matchRaw ? resolveSongEntry(matchRaw) : null;
    setLibraryMatch(match);

    if (match) {
      setPracticeInput(match.chords);
      parsePracticeInput(match.chords);
      const libLyrics = resolveLyricsText(match);
      if (libLyrics && hasVerifiedPracticeLyrics(match)) {
        setLyrics(libLyrics);
        setLyricsSource('library');
      }
    }

    const skipRemoteLyrics = match && needsOnDemandChordFetch(match);
    if (!skipRemoteLyrics) {
      setLyricsLoading(true);
      const { text, source } = await fetchLyricsForTrack(r.artist, r.title);
      const libText = match && hasVerifiedPracticeLyrics(match) ? resolveLyricsText(match) : undefined;
      if (text && !libText) {
        setLyrics(text);
        setLyricsSource(source);
      }
      setLyricsLoading(false);
    }
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 200);
  }

  function setResultAndFetch(r: IdentifyTrackResult) {
    void applyIdentifyResult(r);
  }

  async function retryMetadataCatalog() {
    try {
      setMetadataSyncProgress({
        phase: 'syncing',
        batchIndex: 0,
        batchTotal: 0,
        tracksImported: metadataTrackCount,
        message: 'Повтор индексации каталога…',
      });
      await syncAllMetadata(p => setMetadataSyncProgress(p));
      const n = await getMetadataTrackCount();
      setMetadataTrackCount(n);
    } catch (err) {
      setMetadataSyncProgress({
        phase: 'error',
        batchIndex: 0,
        batchTotal: 0,
        tracksImported: metadataTrackCount,
        message: formatMetadataSyncError(err),
      });
    }
  }

  function openIdentifyInPractice() {
    if (libraryMatch) {
      pickSong(libraryMatch);
      switchMode('practice');
      return;
    }
    switchMode('practice');
  }

  function clearIdentifyResult() {
    setSongResult(null);
    setLyrics(null);
    setLibraryMatch(null);
    setLyricsSource(null);
    clearIdentifyHints();
  }

  async function pickFileAndIdentify() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (result.canceled) return;
      setFileLoading(true); setSongResult(null);
      const uri = result.assets[0].uri;
      const outcome = await localSongRecognizer.recognizeFromRecording(uri, {
        durationSec: 0,
        source: 'file',
      });
      await handleIdentifyOutcome(outcome, { savedTitle: 'Файл сохранён' });
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

  /* ── Song library ── */
  const [showLibrary, setShowLibrary]         = useState(false);
  const [showInstrumentModal, setShowInstrumentModal] = useState(false);
  const [showBasicChordsModal, setShowBasicChordsModal] = useState(false);
  const [libSearch, setLibSearch]             = useState('');
  const [libSearchHits, setLibSearchHits]     = useState<SongEntry[]>([]);
  const [libProviderMeta, setLibProviderMeta] = useState<Map<string, ProviderId>>(new Map());
  const [libSearchRank, setLibSearchRank] = useState<Map<string, number>>(new Map());
  const [libSearchBusy, setLibSearchBusy]     = useState(false);
  const [libSearchHasMore, setLibSearchHasMore] = useState(false);
  const [libSearchLoadingMore, setLibSearchLoadingMore] = useState(false);
  const libSearchOffsetRef = useRef(0);
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [chordFetchProbeStatus, setChordFetchProbeStatus] = useState<string | null>(null);
  const [chordFetchProbeBusy, setChordFetchProbeBusy] = useState(false);
  const [showAdvancedChordFetchUrl, setShowAdvancedChordFetchUrl] = useState(false);
  const [showAdvancedProviders, setShowAdvancedProviders] = useState(false);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);
  const [libFavOnly, setLibFavOnly]           = useState(false);
  const [libFullTabsOnly, setLibFullTabsOnly] = useState(false);
  /** null = not probed yet; dev-only empty-search hint when false */
  const [libChordProxyReachable, setLibChordProxyReachable] = useState<boolean | null>(null);

  /* ── Song library (SQLite) ── */
  const [librarySongs, setLibrarySongs]       = useState<SongEntry[]>([]);
  const [libraryInitError, setLibraryInitError] = useState<string | null>(null);
  const [userSongCount, setUserSongCount]     = useState(0);
  const [favorites, setFavorites]             = useState<Set<string>>(new Set());

  /* ── Add/Edit song modal ── */
  const [showAddSong, setShowAddSong]         = useState(false);
  const [editingSong, setEditingSong]         = useState<SongEntry | null>(null);
  const blankForm = () => ({ title:'', artist:'', genre:'', key:'', bpm:'', difficulty:'1' as '1'|'2'|'3', chords:'', lyrics:'' });
  const [addForm, setAddForm]                 = useState(blankForm());

  async function reloadLibrary() {
    try {
      setLibraryInitError(null);
      const upgrade = await initSongLibrary();
      if (upgrade.upgraded) {
        const msg = `Каталог обновлён: ${upgrade.fullChordCount} с полными аккордами (из ${upgrade.totalBuiltin})`;
        setCatalogUpgradeToast(msg);
        setTimeout(() => setCatalogUpgradeToast(null), 6000);
      } else if (upgrade.pesniArchiveImported > 0) {
        const msg = `+${upgrade.pesniArchiveImported} офлайн-табов (pesni.ru). Фильтр «ТАБЫ» в базе.`;
        setCatalogUpgradeToast(msg);
        setTimeout(() => setCatalogUpgradeToast(null), 6000);
      }
      const [songs, favs, userSongs] = await Promise.all([
        listSongs(),
        getFavoriteIds(),
        listUserSongs(),
      ]);
      setLibrarySongs(songs);
      setFavorites(favs);
      setUserSongCount(userSongs.length);
      const metaN = await getMetadataTrackCount();
      setMetadataTrackCount(metaN);
      await ensureAutoChordProxySettings();
      const settings = await getProviderSettings();
      if (settings.metadataFullIndexOffline && !isMetadataSyncRunning()) {
        startBackgroundIndex(p => {
          setMetadataSyncProgress(p);
          if (p.phase === 'done' || p.phase === 'syncing') {
            void getMetadataTrackCount().then(setMetadataTrackCount);
          }
        });
      }
      if (__DEV__) {
        console.log(`[RecoTune] song library: ${songs.length} songs (${userSongs.length} user), metadata: ${metaN}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ошибка инициализации БД';
      setLibraryInitError(msg);
      setLibrarySongs([]);
      setFavorites(new Set());
      setUserSongCount(0);
      if (__DEV__) console.warn('[RecoTune] reloadLibrary failed', err);
    }
  }

  useFocusEffect(useCallback(() => {
    void reloadLibrary();
    if (practiceSong) {
      setShowLibrary(false);
    } else {
      setShowLibrary(true);
    }
  }, [practiceSong]));

  const allSongs = librarySongs;
  useEffect(() => { allSongsRef.current = allSongs; }, [allSongs]);

  const applyLibSearchResults = useCallback(
    (
      results: SongSearchResult[],
      opts?: { append?: boolean; prevHits?: SongEntry[]; prevMeta?: Map<string, ProviderId>; prevRank?: Map<string, number> },
    ) => {
      const meta = new Map<string, ProviderId>(
        opts?.append && opts.prevMeta ? opts.prevMeta : [],
      );
      const rank = new Map<string, number>(
        opts?.append && opts.prevRank ? opts.prevRank : [],
      );
      const songs: SongEntry[] = opts?.append && opts.prevHits ? [...opts.prevHits] : [];
      const seen = new Set(songs.map(s => combinedArtistTitle(s.artist, s.title)));
      for (const r of results) {
        const song = searchResultToSongEntry(r);
        if (!song) continue;
        const key = combinedArtistTitle(song.artist, song.title);
        if (seen.has(key)) continue;
        seen.add(key);
        rank.set(song.id, songs.length);
        songs.push(song);
        meta.set(song.id, r.provider);
      }
      setLibSearchHits(songs);
      setLibProviderMeta(meta);
      setLibSearchRank(rank);
      return songs.length;
    },
    [],
  );

  const loadMoreLibrarySearch = useCallback(async () => {
    const q = libSearch.trim();
    if (!q || libSearchBusy || libSearchLoadingMore || !libSearchHasMore) return;
    setLibSearchLoadingMore(true);
    try {
      await initSongLibrary();
      const offset = libSearchOffsetRef.current;
      const results = await searchProviders(q, {
        limit: LIBRARY_SEARCH_PAGE_SIZE,
        offset,
        includeRemote: false,
      });
      const prevLen = libSearchHits.length;
      applyLibSearchResults(results, {
        append: true,
        prevHits: libSearchHits,
        prevMeta: libProviderMeta,
        prevRank: libSearchRank,
      });
      libSearchOffsetRef.current = offset + LIBRARY_SEARCH_PAGE_SIZE;
      setLibSearchHasMore(results.length >= LIBRARY_SEARCH_PAGE_SIZE);
      if (results.length === 0 && prevLen > 0) setLibSearchHasMore(false);
    } catch (err) {
      if (__DEV__) console.warn('[RecoTune] library search load-more failed', err);
      setLibSearchHasMore(false);
    } finally {
      setLibSearchLoadingMore(false);
    }
  }, [
    libSearch,
    libSearchBusy,
    libSearchLoadingMore,
    libSearchHasMore,
    libSearchHits,
    libProviderMeta,
    libSearchRank,
    applyLibSearchResults,
  ]);

  useEffect(() => {
    let cancelled = false;
    const q = libSearch.trim();
    const run = async () => {
      libSearchOffsetRef.current = 0;
      setLibSearchHasMore(false);
      if (libraryInitError) {
        setLibSearchHits([]);
        setLibProviderMeta(new Map());
        setLibSearchRank(new Map());
        setLibSearchBusy(false);
        return;
      }
      if (!q) {
        setLibSearchHits([]);
        setLibProviderMeta(new Map());
        setLibSearchRank(new Map());
        setLibSearchBusy(false);
        return;
      }
      setLibSearchBusy(true);
      try {
        await initSongLibrary();
        const results = await searchProviders(q, {
          limit: LIBRARY_SEARCH_PAGE_SIZE,
          offset: 0,
          includeRemote: false,
        });
        if (cancelled) return;
        applyLibSearchResults(results);
        libSearchOffsetRef.current = LIBRARY_SEARCH_PAGE_SIZE;
        setLibSearchHasMore(results.length >= LIBRARY_SEARCH_PAGE_SIZE);
      } catch (err) {
        if (__DEV__) console.warn('[RecoTune] library search failed', err);
        if (!cancelled) applyLibSearchResults([]);
      } finally {
        if (!cancelled) setLibSearchBusy(false);
      }
    };
    const t = setTimeout(() => { void run(); }, 90);
    return () => { cancelled = true; clearTimeout(t); };
  }, [libSearch, libraryInitError, applyLibSearchResults]);

  useEffect(() => {
    if (!showLibrary) return;
    let cancelled = false;
    void (async () => {
      await ensureAutoChordProxySettings();
      const s = await getProviderSettings();
      if (!cancelled) setProviderSettings(s);
      const probe = await probeRemoteChordSearch(2500);
      if (!cancelled) setLibChordProxyReachable(probe.reachable);
    })();
    return () => {
      cancelled = true;
    };
  }, [showLibrary]);

  const libResults = (() => {
    const q = libSearch.trim();
    let list: SongEntry[];
    if (q) {
      // Search entire catalog (builtin + user + metadata); rank map from searchProviders.
      list = libSearchHits;
    } else if (libFavOnly) {
      list = librarySongs.filter(s => favorites.has(s.id));
    } else {
      list = allSongs;
    }
    if (libFullTabsOnly) list = list.filter(s => hasVerifiedPracticeLyrics(resolveSongEntry(s)));
    if (q) {
      list = [...list].sort((a, b) => {
        const ra = libSearchRank.get(a.id) ?? 99999;
        const rb = libSearchRank.get(b.id) ?? 99999;
        if (ra !== rb) return ra - rb;
        return a.title.localeCompare(b.title);
      });
    } else {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  })();

  const libCountLabel = (() => {
    const q = libSearch.trim();
    if (q) {
      const suffix = libSearchHasMore ? '+' : '';
      return `${libResults.length}${suffix} найдено`;
    }
    if (libFavOnly) return `${libResults.length} избранных`;
    return `${libResults.length} из ${allSongs.length}`;
  })();

  function providerForSong(item: SongEntry): ProviderId {
    return libProviderMeta.get(item.id) ?? (item.id.startsWith('custom_') ? 'user' : 'builtin');
  }

  async function openProviderSettings() {
    await ensureAutoChordProxySettings();
    const s = await getProviderSettings();
    setProviderSettings(s);
    setShowProviderSettings(true);
  }

  function effectiveChordFetchUrl(settings?: ProviderSettings | null): string {
    return getEffectiveChordFetchUrl(settings?.chordFetchProxyUrl, {
      userExplicit: settings?.chordFetchProxyUserSet === true,
    });
  }

  function chordFetchProgressLabel(progress: OnDemandAutoProgress | null): string {
    if (!progress) return '';
    if (progress.source === 'pesni_ru') {
      return PESNI_FETCH_STAGE_LABEL[progress.stage] ?? '';
    }
    return CHORD_FETCH_STAGE_LABEL[progress.stage] ?? '';
  }

  function chordFetchErrorHint(e: unknown): string {
    if (e instanceof ChordFetchError) {
      const msg = e.message.trim();
      if (msg === 'Не найдено') return msg;
      if (__DEV__ && msg.length <= 80) return msg;
    }
    return 'Не найдено';
  }

  function librarySearchEmptyHint(): string {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const proxy = effectiveChordFetchUrl(providerSettings);
      if (proxy && libChordProxyReachable === false) {
        return 'В офлайн-каталоге нет совпадений. Запустите npm start на ПК (:8787 табы, :8788 stems).';
      }
      if (!proxy) {
        return 'В офлайн-каталоге нет совпадений. Для AmDm/UG: npm start на ПК (:8787).';
      }
    }
    return 'Ничего не найдено. Проверьте написание.';
  }

  function libraryFavoritesEmptyHint(): string {
    return 'В избранном пусто. Введите название в поиске и нажмите ⭐ у песни — или снимите фильтр «Избранное», чтобы увидеть весь каталог.';
  }

  async function enrichSongForPractice(base: SongEntry): Promise<{
    song: SongEntry;
    lyrics?: string;
    hint: string | null;
    stillNeedsFetch: boolean;
  }> {
    const resolved = resolveSongEntry(base);
    if (hasVerifiedPracticeLyrics(resolved)) {
      return { song: resolved, lyrics: resolved.lyrics!, hint: null, stillNeedsFetch: false };
    }

    const catalogMatch = findBestSongMatch(resolved.artist, resolved.title, allSongsRef.current);
    if (catalogMatch && catalogMatch.id !== resolved.id) {
      const fromDb = await loadSongForPractice(catalogMatch);
      if (hasVerifiedPracticeLyrics(fromDb)) {
        return { song: fromDb, lyrics: fromDb.lyrics!, hint: null, stillNeedsFetch: false };
      }
    }

    const slugHint = pesniSlugFromResultId(resolved.id) ?? undefined;
    let working = resolved;
    let onlineFetchErr: string | null = null;

    try {
      const { detail, provider } = await fetchOnDemandChordSheetAuto(
        resolved.artist,
        resolved.title,
        {
          slugHint,
          onProgress: p => setChordFetchProgress(p),
        },
      );
      const persisted = await ensureSongInUserLibrary(detail, provider);
      await upsertUserSong(persisted);
      await reloadLibrary();
      const full = await loadSongForPractice(persisted);
      setOnDemandAttribution(detail.attribution ?? null);
      working = full;
      if (hasVerifiedPracticeLyrics(full)) {
        return { song: full, lyrics: full.lyrics!, hint: null, stillNeedsFetch: false };
      }
    } catch (e) {
      if (__DEV__) console.warn('[RecoTune] auto tab fetch', e);
      onlineFetchErr = chordFetchErrorHint(e);
    }

    if (hasVerifiedPracticeLyrics(working)) {
      return { song: working, lyrics: working.lyrics!, hint: null, stillNeedsFetch: false };
    }

    const stillNeedsFetch = needsOnDemandChordFetch(working);
    const hint = stillNeedsFetch ? onlineFetchErr : null;
    return {
      song: working,
      lyrics: hasVerifiedPracticeLyrics(working) ? working.lyrics : undefined,
      hint,
      stillNeedsFetch,
    };
  }

  async function runAutoChordEnrichment(initial: SongEntry) {
    if (chordFetchLoading) return;
    setChordFetchLoading(true);
    setChordFetchProgress({ source: 'amdm', stage: 'search' });
    setAutoChordFetchDone(false);
    try {
      const result = await enrichSongForPractice(initial);
      setPracticeSong(result.song);
      setPracticeInput(result.song.chords?.trim() || 'C G Am F');
      parsePracticeInput(result.song.chords?.trim() || 'C G Am F');
      setPracticeChordIdx(0);
      if (result.lyrics) {
        setPracticeLyrics(result.lyrics);
        setPracticeContentHint(null);
      } else if (result.stillNeedsFetch) {
        setPracticeLyrics('');
        setPracticeContentHint(PROGRESSION_ONLY_HINT);
      }
      setPracticeFetchHint(result.hint);
    } finally {
      setChordFetchLoading(false);
      setChordFetchProgress(null);
      setAutoChordFetchDone(true);
    }
  }

  async function persistProviderSettings(next: ProviderSettings) {
    const toSave: ProviderSettings = {
      ...next,
      chordFetchProxyUrl: normalizeChordFetchUrl(next.chordFetchProxyUrl),
      devProxyUrlHintDismissed:
        next.devProxyUrlHintDismissed === true
        || !!next.chordFetchProxyUrl.trim(),
    };
    await saveProviderSettings(toSave);
    setProviderSettings(toSave);
    if (libSearch.trim()) {
      libSearchOffsetRef.current = 0;
      const results = await searchProviders(libSearch, {
        limit: LIBRARY_SEARCH_PAGE_SIZE,
        offset: 0,
        includeRemote: false,
      });
      applyLibSearchResults(results);
      libSearchOffsetRef.current = LIBRARY_SEARCH_PAGE_SIZE;
      setLibSearchHasMore(results.length >= LIBRARY_SEARCH_PAGE_SIZE);
    }
  }

  async function saveIdentifyToLibrary() {
    if (!songResult) return;
    const chordFromLyrics = [...new Set((lyrics?.match(/\[([A-G][^\]]*)\]/g) ?? []).map(c => c.replace(/[\[\]]/g, '')))];
    const chords =
      libraryMatch?.chords ??
      (chordFromLyrics.length ? chordFromLyrics.slice(0, 8).join(' ') : 'C G Am F');
    const song: SongEntry = {
      id: `custom_${Date.now()}`,
      title: songResult.title.trim() || 'Без названия',
      artist: songResult.artist.trim() || 'Unknown',
      chords,
      key: libraryMatch?.key,
      bpm: libraryMatch?.bpm,
      difficulty: libraryMatch?.difficulty ?? (chordFromLyrics.length <= 3 ? 1 : chordFromLyrics.length <= 5 ? 2 : 3),
      genre: 'НАЙТИ',
      lyrics: identifyChordedLyrics || lyrics || libraryMatch?.lyrics,
    };
    await upsertUserSong(song);
    await reloadLibrary();
    Alert.alert('Сохранено', `"${song.title}" добавлена в «Мои песни»`);
  }

  async function toggleFavorite(id: string) {
    const on = !favorites.has(id);
    await setFavorite(id, on);
    const next = new Set(favorites);
    if (on) next.add(id); else next.delete(id);
    setFavorites(next);
  }

  async function saveCustomSong(song: SongEntry) {
    await upsertUserSong(song);
    await reloadLibrary();
  }

  async function importChordProFile(multiple = false) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
        multiple,
      });
      if (result.canceled || !result.assets?.length) return;
      if (multiple && result.assets.length > 1) {
        const batch = await importChordProFilesFromUris(result.assets);
        await reloadLibrary();
        Alert.alert(
          'Импорт',
          `Добавлено: ${batch.imported}${batch.failed ? `, ошибок: ${batch.failed}` : ''}`,
        );
        return;
      }
      const asset = result.assets[0];
      const raw = await FileSystem.readAsStringAsync(asset.uri);
      const fallbackTitle = asset.name?.replace(/\.(cho|txt|chordpro|pro|md)$/i, '') ?? 'Без названия';
      const parsed = parseChordProText(raw, fallbackTitle);
      const song = chordProToSongEntry(parsed, `custom_${Date.now()}`);
      await upsertUserSong(song);
      await reloadLibrary();
      Alert.alert('Импортировано', `"${song.title}" добавлена в библиотеку`);
    } catch (e) {
      Alert.alert('Ошибка импорта', String(e));
    }
  }

  async function exportLibraryJson() {
    try {
      await shareLibraryBackup();
    } catch (e) {
      Alert.alert('Экспорт', String(e));
    }
  }

  async function importLibraryJson() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const { imported, skipped } = await importLibraryBackupJson(raw);
      await reloadLibrary();
      Alert.alert('Импорт бэкапа', `Добавлено: ${imported}${skipped ? `, пропущено: ${skipped}` : ''}`);
    } catch (e) {
      Alert.alert('Ошибка импорта', String(e));
    }
  }

  async function deleteCustomSong(id: string) {
    await deleteUserSong(id);
    const favNext = new Set(favorites);
    favNext.delete(id);
    setFavorites(favNext);
    await reloadLibrary();
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
      chordProVerified: addForm.lyrics.trim()
        ? /\[[A-G][#b\d]/i.test(addForm.lyrics)
        : undefined,
    };
    await saveCustomSong(song);
    setShowAddSong(false);
  }

  function openPracticeLibrary(prefill?: string) {
    if (mode !== 'practice') {
      if (liveActive) stopLive();
      if (pitchActive) stopPitchDetection();
      setMode('practice');
    }
    if (prefill?.trim()) setLibSearch(prefill.trim());
    setShowLibrary(true);
    if (librarySongs.length === 0) void reloadLibrary();
  }

  async function pickSong(song: SongEntry) {
    const provider = providerForSong(song);
    const persisted = await ensureSongInUserLibrary(song, provider);
    if (persisted.id !== song.id) await reloadLibrary();
    const resolved = await loadSongForPractice(persisted);
    const savedTranspose = await getSongTranspose(resolved.id);
    setPracticeTranspose(savedTranspose);
    setPracticeSong(resolved);
    setOnDemandAttribution(null);
    setPracticeContentHint(null);
    setPracticeFetchHint(null);
    setAutoChordFetchDone(false);
    setPracticeInput(resolved.chords?.trim() || 'C G Am F');
    parsePracticeInput(resolved.chords?.trim() || 'C G Am F');
    setPracticeChordIdx(0);
    setLyricsEditMode(false);
    setShowLibrary(false);
    if (hasVerifiedPracticeLyrics(resolved)) {
      setPracticeLyrics(resolved.lyrics!);
      setAutoChordFetchDone(true);
    } else if (needsOnDemandChordFetch(resolved)) {
      setPracticeLyrics('');
      setPracticeContentHint(PROGRESSION_ONLY_HINT);
      void runAutoChordEnrichment(resolved);
    } else {
      setPracticeLyrics('');
      setAutoChordFetchDone(true);
    }
  }

  async function runOnDemandChordFetch(options?: { silent?: boolean }) {
    const base = practiceSong;
    if (!base || chordFetchLoading) return;
    const slugHint = pesniSlugFromResultId(base.id) ?? undefined;
    setChordFetchLoading(true);
    setChordFetchProgress({ source: 'amdm', stage: 'search' });
    try {
      const { detail, provider } = await fetchOnDemandChordSheetAuto(
        base.artist,
        base.title,
        {
          slugHint,
          onProgress: p => setChordFetchProgress(p),
        },
      );

      const persisted = await ensureSongInUserLibrary(detail, provider);
      await upsertUserSong(persisted);
      await reloadLibrary();
      setOnDemandAttribution(detail.attribution ?? null);
      const full = await loadSongForPractice(persisted);
      setPracticeSong(full);
      setPracticeInput(full.chords?.trim() || 'C G Am F');
      parsePracticeInput(full.chords?.trim() || 'C G Am F');
      setPracticeChordIdx(0);
      if (hasVerifiedPracticeLyrics(full)) {
        setPracticeLyrics(full.lyrics!);
        setPracticeContentHint(null);
        setPracticeFetchHint(null);
      }
      setAutoChordFetchDone(true);
      scrollYRef.current = 0;
      setTimeout(() => {
        lyricsScrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 350);
    } catch (e) {
      if (__DEV__) console.warn('[RecoTune] on-demand chord fetch', e);
      if (!options?.silent) {
        setPracticeFetchHint(chordFetchErrorHint(e));
      }
    } finally {
      setChordFetchLoading(false);
      setChordFetchProgress(null);
    }
  }

  function openOnDemandChordFetchManual() {
    if (!practiceSong || !needsOnDemandChordFetch(practiceSong)) return;
    void runOnDemandChordFetch();
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
    setVoiceHistory([]);
    setVoicePitchFrames([]);
    practicePitchFrameRingRef.current = [];
    practiceSmoothedFreqRef.current = null;
    lastVoiceChartPtMsRef.current = 0;
    pendingStartRef.current = false;
    if (wvReadyRef.current) {
      sendCmd('startPracticeVoice');
    } else {
      pendingPracticeVoiceRef.current = true;
    }
  }
  function stopPitchDetection() {
    setPitchActive(false);
    pendingStartRef.current = false;
    pendingPracticeVoiceRef.current = false;
    practiceSmoothedFreqRef.current = null;
    setVoiceHistory([]);
    setVoicePitchFrames([]);
    practicePitchFrameRingRef.current = [];
    lastVoiceChartPtMsRef.current = 0;
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
      pendingPracticeVoiceRef.current = false;
      if (wvReadyRef.current) { sendCmd('start'); } else { pendingStartRef.current = true; }
      setLiveActive(true);
    }
  }

  function clearPracticeSelection() {
    setPracticeSong(null);
    setPracticeInput('');
    setPracticeChords([]);
    setPracticeChordIdx(0);
    setPracticeLyrics('');
    setPracticeContentHint(null);
    setPracticeFetchHint(null);
    setOnDemandAttribution(null);
    setAutoChordFetchDone(false);
    setLyricsEditMode(false);
    stopAutoScroll();
  }

  const onHardwareBack = useCallback((): boolean => {
    if (showAddSong) {
      setShowAddSong(false);
      return true;
    }
    if (showProviderSettings) {
      setShowProviderSettings(false);
      return true;
    }
    if (showBasicChordsModal) {
      setShowBasicChordsModal(false);
      return true;
    }
    if (showInstrumentModal) {
      setShowInstrumentModal(false);
      return true;
    }
    if (showLibrary) {
      setShowLibrary(false);
      return true;
    }
    if (lyricsEditMode) {
      setLyricsEditMode(false);
      return true;
    }
    if (mode === 'practice' && (practiceSong || practiceInput.trim())) {
      // Back from a song → reset immersive/tab bar and return to the song list in one clean step
      lyricsImmersiveRef.current = false;
      setTabBarHidden(false);
      clearPracticeSelection();
      setShowLibrary(true);
      return true;
    }
    if (tabBarHidden) {
      lyricsImmersiveRef.current = false;
      setTabBarHidden(false);
      setShowPracticePanel(true);
      return true;
    }
    if (mode === 'identify') {
      if (isRecognizing) {
        if (timerRef.current) clearInterval(timerRef.current);
        void stopRec();
        setIsRecognizing(false);
        setRecSecs(0);
        return true;
      }
      if (
        songResult
        || lyrics
        || libraryMatch
        || ytUrl.trim()
        || manualArtist.trim()
        || manualTitle.trim()
        || fileLoading
        || ytLoading
      ) {
        clearIdentifyResult();
        setYtUrl('');
        setManualArtist('');
        setManualTitle('');
        setFileLoading(false);
        setYtLoading(false);
        return true;
      }
      if (identSource !== 'mic') {
        setIdentSource('mic');
        return true;
      }
      switchMode('practice');
      return true;
    }
    if (mode === 'live' && liveActive) {
      stopLive();
      return true;
    }
    if (mode === 'live') {
      switchMode('practice');
      return true;
    }
    return false;
  }, [
    showAddSong,
    showProviderSettings,
    showBasicChordsModal,
    showInstrumentModal,
    showLibrary,
    setShowLibrary,
    lyricsEditMode,
    tabBarHidden,
    setTabBarHidden,
    mode,
    practiceSong,
    practiceInput,
    isRecognizing,
    songResult,
    lyrics,
    libraryMatch,
    ytUrl,
    manualArtist,
    manualTitle,
    fileLoading,
    ytLoading,
    identSource,
  ]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [onHardwareBack]));

  /* ── Practice: voice vs manually-selected chord ── */
  const practiceCurrentChord = displayPracticeChords[practiceChordIdx] ?? '—';

  const applyPracticeLyricsZoom = useCallback((zoom: number) => {
    const z = Math.min(PRACTICE_LYRICS_ZOOM_MAX, Math.max(PRACTICE_LYRICS_ZOOM_MIN, zoom));
    practiceLyricsZoomRef.current = z;
    setPracticeLyricsZoomState(z);
    void setPracticeLyricsZoom(z);
  }, []);

  const beginLyricsPinch = useCallback(() => {
    lyricsPinchOriginRef.current = practiceLyricsZoomRef.current;
  }, []);

  const onLyricsPinchUpdate = useCallback((scale: number) => {
    applyPracticeLyricsZoom(lyricsPinchOriginRef.current * scale);
  }, [applyPracticeLyricsZoom]);

  const lyricsPinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          runOnJS(beginLyricsPinch)();
        })
        .onUpdate(e => {
          runOnJS(onLyricsPinchUpdate)(e.scale);
        }),
    [beginLyricsPinch, onLyricsPinchUpdate],
  );

  useEffect(() => {
    void getPracticeDisplaySettings().then(s => {
      practiceLyricsZoomRef.current = s.lyricsZoom;
      setPracticeLyricsZoomState(s.lyricsZoom);
    });
  }, []);

  const bumpPracticeTranspose = useCallback(
    (delta: number) => {
      if (!practiceSong) return;
      const next = Math.max(-11, Math.min(11, practiceTranspose + delta));
      setPracticeTranspose(next);
      void setSongTranspose(practiceSong.id, next);
    },
    [practiceSong, practiceTranspose],
  );

  const resetPracticeTranspose = useCallback(() => {
    if (!practiceSong) return;
    setPracticeTranspose(0);
    void setSongTranspose(practiceSong.id, 0);
  }, [practiceSong]);
  const chordTones    = parseChordTones(practiceCurrentChord);
  const voiceNoteBase = voiceNote.replace(/\d/, '');
  const voiceInChord  = chordTones.includes(voiceNoteBase);

  // Cents deviation display (clamp ±50)
  const centsClamped = Math.max(-50, Math.min(50, voiceCents));
  const centsBarPct  = ((centsClamped + 50) / 100) * 100;

  const col = chordColor(confidence);

  const fullChordSections = useMemo(
    () => getFullChordReferenceCatalog(chordDiagramId).map(s => ({ title: s.title, data: s.entries })),
    [chordDiagramId],
  );
  const fullChordCount = useMemo(
    () => fullChordSections.reduce((n, s) => n + s.data.length, 0),
    [fullChordSections],
  );

  const currentInstrumentLabel = CHORD_DIAGRAM_OPTIONS.find(o => o.id === chordDiagramId)?.label ?? '—';

  const hasLyricsBody = practiceLyrics.trim().length > 0;
  /** Гриф / график / ноты — если всё выкл., не держим пустую строку под шапкой панели */
  const practiceDiagAny =
    showPracticeFretboard || showPracticePitchGraph || showPracticeNoteMatch;
  /** Высота колонки практики (оценка): текст — ~70% при открытой панели, ~92% при свёрнутой (гриф+график скрыты) */
  const bottomTabsH = tabBarHidden ? 0 : 56 + (insets.bottom || 8);
  const practiceBodyApproxH = Math.max(
    220,
    windowH - insets.top - 8 - 44 - 52 - bottomTabsH - practiceDockHeight - 10,
  );
  const lyricsMinHeightRaw = hasLyricsBody
    ? Math.round(practiceBodyApproxH * (showPracticePanel ? 0.7 : 0.92))
    : 0;
  /** Верхняя панель не больше ~30% тела практики при тексте — больше места строкам */
  const practiceTopMaxH = hasLyricsBody && showPracticePanel
    ? Math.round(practiceBodyApproxH * (practiceDiagAny ? 0.3 : 0.18))
    : undefined;
  /** Резерв под бар + панель + шапку текста/BPM — чтобы minHeight не сжимал ScrollView в полоску */
  const practiceLyricsChromeH =
    52
    + (showPracticePanel && practiceTopMaxH != null ? practiceTopMaxH : 0)
    + 88;
  const lyricsMinHeightFit = hasLyricsBody
    ? Math.max(140, practiceBodyApproxH - practiceLyricsChromeH)
    : 0;
  /** При свёрнутой панели — нижний предел по полному экрану; при открытой — не больше оставшейся высоты */
  const lyricsMinHeightTarget =
    hasLyricsBody && !showPracticePanel
      ? Math.max(lyricsMinHeightRaw, Math.round(windowH * 0.76), lyricsMinHeightFit)
      : hasLyricsBody
        ? Math.max(
            Math.min(lyricsMinHeightRaw, lyricsMinHeightFit),
            Math.round(practiceBodyApproxH * 0.42),
          )
        : 0;
  /**
   * Жёсткий потолок = реально доступная высота тела практики.
   * `windowH * 0.76` не учитывает шапку/бар/док/insets, поэтому в immersive он
   * мог превысить высоту flex-родителя: колонка текста переполняла столбец, и на
   * Android оставался «маленький кусок аккордов + чёрная зона». minHeight — только
   * нижний предел, чтобы текст не сжимался в ленточку; выше доступного он не нужен.
   */
  const lyricsMinHeight = hasLyricsBody
    ? Math.min(lyricsMinHeightTarget, practiceBodyApproxH)
    : 0;

  useEffect(() => {
    restoreLyricsScrollAfterLayout();
  }, [lyricsMinHeight, showPracticePanel, restoreLyricsScrollAfterLayout]);

  /** С текстом песни — компактнее график, чтобы зона текста+аккордов занимала больше экрана */
  const practiceEmbedChartH = hasLyricsBody
    ? (immersiveLyrics ? 44 : 56)
    : (immersiveLyrics ? 108 : 128);

  /** LIVE: панель «АККОРДЫ» — было ~85% окна минус chrome; ×1.5 к запасу, не выше реального потолка под шапкой/доком */
  const liveChordTimelineMinH = useMemo(() => {
    const tabH = tabBarHidden ? 0 : 56 + (insets.bottom || 8);
    const aboveList =
      (insets.top + 8)
      + 50
      + 92
      + liveDockHeight
      + 10;
    const baseline = windowH * 0.85 - tabH - aboveList;
    const ceiling =
      windowH
      - tabH
      - (insets.top + 8)
      - 44
      - 78
      - liveDockHeight
      - 6;
    const boosted = Math.round(baseline * 1.5);
    return Math.max(300, Math.min(Math.max(280, Math.floor(ceiling)), boosted));
  }, [windowH, insets.top, insets.bottom, tabBarHidden, liveDockHeight]);

  const practiceTopPanelContent = (
    <View style={styles.practiceTopPanel}>
      <View style={styles.practicePanelBar}>
        <Text style={styles.practicePanelBarTitle} numberOfLines={1}>
          Практика · {currentInstrumentLabel}
        </Text>
        <View style={styles.practicePanelToggles}>
          <TouchableOpacity
            onPress={() => setShowPracticeFretboard(v => !v)}
            style={[styles.practicePanelToggle, showPracticeFretboard && styles.practicePanelToggleOn]}
            accessibilityLabel="Схема грифа"
          >
            <Ionicons name="hand-left-outline" size={15} color={showPracticeFretboard ? '#0a0a0f' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowPracticePitchGraph(v => !v)}
            style={[styles.practicePanelToggle, showPracticePitchGraph && styles.practicePanelToggleOn]}
            accessibilityLabel="График голоса"
          >
            <Ionicons name="pulse" size={15} color={showPracticePitchGraph ? '#0a0a0f' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowPracticeNoteMatch(v => !v)}
            style={[styles.practicePanelToggle, showPracticeNoteMatch && styles.practicePanelToggleOn]}
            accessibilityLabel="Попадание в ноты"
          >
            <Ionicons name="options" size={15} color={showPracticeNoteMatch ? '#0a0a0f' : '#888'} />
          </TouchableOpacity>
        </View>
      </View>
      {practiceDiagAny ? (
      <View style={styles.practiceDiagRow}>
        {showPracticeFretboard ? (
          <View style={styles.practiceDiagLeft}>
            <ChordDiagram name={practiceCurrentChord} diagramId={chordDiagramId} size={hasLyricsBody ? 'md' : 'lg'} />
          </View>
        ) : null}
        {showPracticeNoteMatch ? (
        <View
          style={
            showPracticeFretboard && showPracticePitchGraph
              ? styles.practiceDiagRight
              : styles.practiceDiagRightGrow
          }
        >
          <TouchableOpacity onPress={() => openPracticeLibrary()} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Text style={styles.practiceChordName}>{practiceCurrentChord === '—' ? '← выберите' : practiceCurrentChord}</Text>
          </TouchableOpacity>
          <View style={styles.chordTonesRowCompact}>
            {chordTones.length > 0
              ? chordTones.map((n, i) => (
                  <View key={i} style={[styles.chordTonePillSm, n === voiceNoteBase && styles.chordTonePillActive]}>
                    <Text style={[styles.chordToneTextSm, n === voiceNoteBase && { color: '#00e676' }]}>{n}</Text>
                  </View>
                ))
              : (
                <TouchableOpacity onPress={() => openPracticeLibrary()} activeOpacity={0.75}>
                  <Text style={styles.chordTonesEmpty}>БАЗА → выберите песню</Text>
                </TouchableOpacity>
              )
            }
          </View>
          <View style={styles.diagVoiceRow}>
            <Ionicons name="mic" size={10} color={pitchActive ? '#666' : '#2a2a3a'} />
            <Text style={[styles.diagVoiceNoteSm, {
              color: !pitchActive ? '#2a2a3a' : voiceNote === '—' ? '#444' : voiceInChord ? '#00e676' : '#ff9800'
            }]}>
              {pitchActive ? voiceNote : '—'}
            </Text>
            <Text style={styles.diagVoiceHzSm}>{pitchActive && voiceFreq > 0 ? `${voiceFreq}Hz` : ''}</Text>
            {pitchActive && voiceNote !== '—' && (
              <Ionicons name={voiceInChord ? 'checkmark-circle' : 'alert-circle'} size={13}
                color={voiceInChord ? '#00e676' : '#ff9800'} />
            )}
          </View>
          <View style={[styles.centsWrap, styles.centsWrapCompact, { opacity: pitchActive && voiceFreq > 0 ? 1 : 0.15 }]}>
            <Text style={styles.centsEdgeSm}>−50</Text>
            <View style={styles.centsTrackSm}>
              <View style={styles.centsMid} />
              <View style={[styles.centsThumbSm, { left: `${pitchActive && voiceFreq > 0 ? centsBarPct : 50}%` as any }]} />
            </View>
            <Text style={styles.centsEdgeSm}>+50</Text>
            <Text style={[styles.centsValSm, { color: Math.abs(voiceCents) < 10 ? '#00e676' : '#ffeb3b' }]}>
              {voiceCents > 0 ? '+' : ''}{voiceCents}¢
            </Text>
          </View>
        </View>
        ) : null}
        {showPracticePitchGraph ? (
          <View
            style={styles.practiceChartCol}
            onLayout={e => {
              const raw = e.nativeEvent.layout.width - 4;
              const w = Math.floor(Math.min(360, Math.max(120, raw)));
              setPracticeVoiceChartW(prev => (Math.abs(prev - w) > 6 ? w : prev));
            }}
          >
            <Text style={styles.practiceChartColTitle}>Голос</Text>
            <FrequencyChart
              history={voiceHistory}
              active={pitchActive}
              segmentOverlays={voiceSegmentOverlays}
              chartPlotWidth={practiceVoiceChartW}
              chartHeight={practiceEmbedChartH}
              compact
              timeAxis
              defaultHZoom={2}
              maxHistoryPoints={PITCH_CHART_MAX_POINTS}
            />
          </View>
        ) : null}
      </View>
      ) : null}

      <View style={styles.practiceChordNavRow}>
        <TouchableOpacity onPress={practicePrev} style={styles.practiceChordNavArrow} disabled={practiceChordIdx <= 0}>
          <Ionicons name="chevron-back" size={18} color={practiceChordIdx > 0 ? '#ccc' : '#222'} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.practiceChordPillsScroll}
          contentContainerStyle={styles.practiceChordPillsRow}>
          {displayPracticeChords.map((c, i) => {
            const hasShape = !!resolveChordShape(chordDiagramId, c);
            return (
            <TouchableOpacity key={`${c}-${i}`}
              style={[styles.practiceChordPill, i === practiceChordIdx && styles.practiceChordPillActive]}
              onPress={() => setPracticeChordIdx(i)}>
              <Text style={[
                styles.practiceChordPillText,
                i === practiceChordIdx && styles.practiceChordPillTextActive,
                !hasShape && styles.practiceChordPillMissing,
              ]}>{c}</Text>
            </TouchableOpacity>
            );
          })}
          {displayPracticeChords.length === 0 && (
            <Text style={{ color: '#2a2a3a', fontSize: 9, alignSelf: 'center', paddingHorizontal: 6 }}>нет аккордов — БАЗА</Text>
          )}
        </ScrollView>
        <TouchableOpacity onPress={practiceNext} style={styles.practiceChordNavArrow}
          disabled={practiceChordIdx >= displayPracticeChords.length - 1}>
          <Ionicons name="chevron-forward" size={18}
            color={practiceChordIdx < displayPracticeChords.length - 1 ? '#ccc' : '#222'} />
        </TouchableOpacity>
      </View>
      {practiceFetchHint ? (
        <Text style={styles.practiceFetchHint} numberOfLines={2}>
          {practiceFetchHint}
        </Text>
      ) : null}
      {__DEV__ && practiceSong && needsOnDemandChordFetch(practiceSong) ? (
        <Text style={styles.practiceFetchDevUrl} numberOfLines={2}>
          API: {effectiveChordFetchUrl(providerSettings) || '—'} (
          {resolveChordFetchUrlDetailed().sourceLabel})
        </Text>
      ) : null}
      {chordFetchLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <ActivityIndicator size="small" color="#7c4dff" />
          {chordFetchProgressLabel(chordFetchProgress) ? (
            <Text style={{ color: '#666', fontSize: 10, marginTop: 4 }}>
              {chordFetchProgressLabel(chordFetchProgress)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const practiceTopPanelWrapStyle = [
    { flexShrink: 0 },
    practiceTopMaxH != null && { maxHeight: practiceTopMaxH },
  ];

  return (
    <View style={styles.screenFill}>
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={[
        styles.mainScreenColumn,
        (mode === 'practice' || mode === 'live') && {
          paddingBottom: mode === 'practice' ? practiceDockHeight : liveDockHeight,
        },
      ]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>CHORDS</Text>
          {__DEV__ ? <Text style={styles.devBuildText}>{CHORDS_DEV_BUILD}</Text> : null}
        </View>
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
      {catalogUpgradeToast ? (
        <View style={{ backgroundColor: '#00e67622', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6, borderRadius: 8, marginHorizontal: 4 }}>
          <Text style={{ color: '#00e676', fontSize: 12, fontWeight: '600' }}>{catalogUpgradeToast}</Text>
        </View>
      ) : null}

      {/* ── LIVE MODE ── */}
      {mode === 'live' && (
        <View style={styles.liveRootColumn}>
          {/* Текущий аккорд — компактно, больше места списку */}
          <View style={styles.liveTopCompact}>
            <Text style={[styles.liveChordHero, { color: col }]} numberOfLines={1}>{chord}</Text>
            <View style={styles.liveTopMeta}>
              <Text style={styles.liveChordKeySm} numberOfLines={1}>
                {key || (liveActive ? 'Слушаю…' : '▶ START')}
              </Text>
              {notes.length > 0 && (
                <View style={styles.liveNotesRowSm}>
                  {notes.map((n, i) => (
                    <View key={i} style={styles.liveNotePillSm}><Text style={styles.liveNoteTextSm}>{n}</Text></View>
                  ))}
                </View>
              )}
              {liveActive && (
                <View style={styles.confRowCompact}>
                  <Text style={styles.confLabelCompact}>увер.</Text>
                  <View style={styles.confTrackCompact}>
                    <View style={[styles.confBar, {
                      width: `${Math.min(100, Math.max(0, (confidence / 4) * 100))}%`,
                      backgroundColor: col,
                    }]} />
                  </View>
                </View>
              )}
            </View>
          </View>

          {liveError && (
            <View style={[styles.liveErrorCard, { marginHorizontal: 10, marginBottom: 6 }]}>
              <Ionicons name="alert-circle" size={18} color="#ff5252" />
              <Text style={styles.liveErrorText}>{liveError}</Text>
            </View>
          )}

          <View style={[styles.liveSegOuter, { minHeight: liveChordTimelineMinH }]}>
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

            <View style={styles.liveSegBody}>
              {segments.length === 0 ? (
                <View style={styles.liveSegEmpty}>
                  <Ionicons name="mic-outline" size={28} color="#1e1e28" />
                  <Text style={styles.liveSeqEmpty}>
                    {liveActive
                      ? 'Играйте — аккорды появятся\nпо мере распознавания'
                      : 'Нажмите СТАРТ внизу и играйте.\nАккорды появятся по очереди.'}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.liveSegScroll}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ padding: 10, paddingBottom: 8, flexGrow: 1 }}
                >
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
          </View>
        </View>
      )}

      {/* ── PRACTICE MODE ── */}
      {mode === 'practice' && (
        <View style={styles.practiceRootColumn}>
          <View style={{ flexShrink: 0 }}>
            <View style={styles.practiceBarRow}>
              <TouchableOpacity
                style={styles.practiceBarBtnLib}
                onPress={() => openPracticeLibrary()}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="База песен"
              >
                <Ionicons name="library" size={17} color="#fff" />
                <Text style={styles.practiceBarBtnLibText} numberOfLines={1}>
                  {practiceInput
                    ? practiceInput.split(/\s+/).slice(0, 4).join(' ') + (practiceInput.split(/\s+/).length > 4 ? '…' : '')
                    : 'База песен'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.practiceBarBtnIcon, showPracticePanel && styles.practiceBarBtnIconActive]}
                onPress={() => setShowPracticePanel(v => !v)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={showPracticePanel ? 'Скрыть панель практики' : 'Показать панель практики'}
              >
                <Ionicons name={showPracticePanel ? 'chevron-up' : 'chevron-down'} size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.practiceBarBtnIcon}
                onPress={() => setShowInstrumentModal(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Инструмент"
              >
                <Ionicons name="musical-notes" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.practiceBarBtnRef}
                onPress={() => setShowBasicChordsModal(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Справочник аккордов"
              >
                <Ionicons name="grid-outline" size={16} color="#ff9800" />
                <Text style={styles.practiceBarBtnRefText}>Справочник</Text>
              </TouchableOpacity>
            </View>

            {showPracticePanel && (hasLyricsBody ? (
              <View style={practiceTopPanelWrapStyle}>
              {practiceTopPanelContent}
              </View>
            ) : (
              <ScrollView
                style={practiceTopPanelWrapStyle}
                scrollEnabled
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
              {practiceTopPanelContent}
              </ScrollView>
            ))}
          </View>

          <View
            style={[
              styles.practiceLyricsStack,
              hasLyricsBody && lyricsMinHeight > 0 && { minHeight: lyricsMinHeight },
            ]}
          >
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
              {/* Mic-following indicator — shows when mic is on and lyrics have chords */}
              {practiceLyrics && !lyricsEditMode && liveActive && lyricChordList.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4,
                  backgroundColor: '#00e67618', borderRadius: 8, marginRight: 4,
                  borderWidth: 1, borderColor: '#00e67666' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00e676' }} />
                  <Text style={{ color: '#00e676', fontSize: 9, fontWeight: '700' }}>MIC</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setLyricsEditMode(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}>
                <Ionicons name={lyricsEditMode ? 'eye-outline' : 'create-outline'} size={16} color="#666" />
                <Text style={{ color: '#666', fontSize: 11 }}>{lyricsEditMode ? 'просмотр' : 'ред.'}</Text>
              </TouchableOpacity>
              {immersiveLyrics && tabBarHidden && (
                <TouchableOpacity
                  onPress={() => setTabBarHidden(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  style={{ padding: 4, marginLeft: 2 }}
                  accessibilityLabel="Показать вкладки приложения"
                >
                  <Ionicons name="apps-outline" size={20} color="#7c4dff" />
                </TouchableOpacity>
              )}
            </View>

            {practiceLyricsDisplay && !lyricsEditMode ? (
              <View style={styles.practiceTransposeRow}>
                <TouchableOpacity
                  onPress={() => bumpPracticeTranspose(-1)}
                  style={styles.practiceAutoScrollBpmBtn}
                  accessibilityLabel="Тональность −½"
                >
                  <Text style={styles.practiceAutoScrollBpmBtnText}>−½</Text>
                </TouchableOpacity>
                <Text style={styles.practiceTransposeLabel}>
                  {formatTransposeLabel(practiceTranspose)}
                </Text>
                <TouchableOpacity
                  onPress={() => bumpPracticeTranspose(1)}
                  style={styles.practiceAutoScrollBpmBtn}
                  accessibilityLabel="Тональность +½"
                >
                  <Text style={styles.practiceAutoScrollBpmBtnText}>+½</Text>
                </TouchableOpacity>
                {practiceTranspose !== 0 ? (
                  <TouchableOpacity onPress={resetPracticeTranspose} style={styles.practiceTransposeReset}>
                    <Text style={{ color: '#7c4dff', fontSize: 10, fontWeight: '700' }}>ориг.</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => applyPracticeLyricsZoom(practiceLyricsZoom - 0.1)}
                  style={styles.practiceAutoScrollBpmBtn}
                  accessibilityLabel="Мельче текст"
                >
                  <Text style={styles.practiceAutoScrollBpmBtnText}>A−</Text>
                </TouchableOpacity>
                <Text style={styles.practiceZoomLabel}>{Math.round(practiceLyricsZoom * 100)}%</Text>
                <TouchableOpacity
                  onPress={() => applyPracticeLyricsZoom(practiceLyricsZoom + 0.1)}
                  style={styles.practiceAutoScrollBpmBtn}
                  accessibilityLabel="Крупнее текст"
                >
                  <Text style={styles.practiceAutoScrollBpmBtnText}>A+</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {practiceLyrics && !lyricsEditMode && (
              <View style={styles.practiceAutoScrollRow}>
                <TouchableOpacity
                  onPress={toggleAutoScroll}
                  style={[
                    styles.practiceAutoScrollPlayBtn,
                    autoScroll && styles.practiceAutoScrollPlayBtnOn,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={autoScroll ? 'Остановить автопрокрутку' : 'Запустить автопрокрутку'}
                >
                  <Ionicons
                    name={autoScroll ? 'pause' : 'play'}
                    size={22}
                    color={autoScroll ? '#00e676' : '#aaa'}
                  />
                </TouchableOpacity>
                <Text style={styles.practiceAutoScrollBpmLabel}>BPM</Text>
                <TouchableOpacity
                  onPress={() => bumpPracticeBpm(-10)}
                  style={styles.practiceAutoScrollBpmBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Уменьшить темп на 10"
                >
                  <Text style={styles.practiceAutoScrollBpmBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.practiceAutoScrollBpmValue}>{practiceBpm}</Text>
                <TouchableOpacity
                  onPress={() => bumpPracticeBpm(10)}
                  style={styles.practiceAutoScrollBpmBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Увеличить темп на 10"
                >
                  <Text style={styles.practiceAutoScrollBpmBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            )}

            <GestureDetector gesture={lyricsPinchGesture}>
            <View
              style={{ flex: 1, minHeight: 0, flexBasis: 0, flexGrow: 1 }}
              onLayout={e => {
                const h = e.nativeEvent.layout.height;
                if (h > 40 && Math.abs(h - practiceLyricsViewportHRef.current) > 6) {
                  practiceLyricsViewportHRef.current = h;
                  setPracticeLyricsViewportH(h);
                }
              }}
            >
          {lyricsEditMode ? (
            <ScrollView style={[styles.lyricsScroll, { flex: 1 }]}
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
          ) : practiceLyricsDisplay ? (
            <GestureScrollView
              ref={lyricsScrollRef}
              style={[styles.lyricsScroll, { flex: 1 }]}
              contentContainerStyle={{ padding: 10, paddingBottom: Math.max(16, practiceDockHeight + 8) }}
              showsVerticalScrollIndicator
              scrollEnabled
              nestedScrollEnabled
              overScrollMode="always"
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={e => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
              onScrollBeginDrag={handleLyricsScrollBeginDrag}
              onScrollEndDrag={handleLyricsScrollEnd}
              onMomentumScrollEnd={handleLyricsScrollEnd}
              onContentSizeChange={(_, h) => {
                scrollContentHRef.current = h;
                if (!autoScrollActiveRef.current) return;
                scrollLyricsTo(scrollYRef.current, false, true);
                if (autoScrollFrameRef.current == null) {
                  startAutoScroll(practiceBpm);
                }
              }}>
              {practiceLyricsDisplay.split('\n').map((line, li) => {
                const activeLyricEntry = activeLyricIdx >= 0 ? lyricChordList[activeLyricIdx] : null;
                const activeChordPos = activeLyricEntry?.lineIdx === li
                  ? { lineIdx: li, posInLine: activeLyricEntry.posInLine }
                  : null;
                return (
                  <View key={li} onLayout={e => { lineYRef.current[li] = e.nativeEvent.layout.y; }}>
                    <ChordLyricsLine
                      line={line}
                      currentChord={practiceCurrentChord}
                      lineIdx={li}
                      activeChordPos={activeChordPos}
                      displayScale={practiceLyricsZoom}
                      chordPressDelay={autoScroll ? 140 : 420}
                      onChordTap={(c) => {
                        if (autoScrollFrameRef.current != null) stopAutoScroll();
                        const idx = practiceChords.findIndex(ch =>
                          (practiceTranspose
                            ? transposeChordSymbol(ch, practiceTranspose)
                            : ch) === c,
                        );
                        if (idx >= 0) setPracticeChordIdx(idx);
                      }}
                    />
                  </View>
                );
              })}
            </GestureScrollView>
          ) : (
            <ScrollView style={[styles.lyricsScroll, { flex: 1 }]}
              contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}
              showsVerticalScrollIndicator={false}>
              <Ionicons name="musical-notes-outline" size={36} color="#3a3a55" />
              <Text style={[styles.lyricsEmptyText, { marginTop: 12 }]}>
                {practiceContentHint ? 'Нет строк с аккордами' : 'Текст с аккордами'}
              </Text>
              <Text style={styles.lyricsEmptyHint} numberOfLines={4}>
                {practiceContentHint ?? (
                  practiceSong
                    ? 'Выберите песню из БАЗЫ или вставьте текст (ред.).\nФормат: [Am]Слово [F]другое'
                    : 'Выберите песню из базы (кнопка «База песен» вверху).'
                )}
              </Text>
              {practiceFetchHint ? (
                <Text style={styles.lyricsEmptyFetchErr} numberOfLines={6}>
                  {practiceFetchHint}
                </Text>
              ) : null}
              {__DEV__ && practiceSong && needsOnDemandChordFetch(practiceSong) ? (
                <Text style={styles.practiceFetchDevUrl} numberOfLines={2}>
                  API: {effectiveChordFetchUrl(providerSettings) || 'не задан'}
                </Text>
              ) : null}
              {onDemandAttribution ? (
                <Text style={{ color: '#666', fontSize: 10, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 }}>
                  {onDemandAttribution.label}
                  {onDemandAttribution.licenseNote ? ` · ${onDemandAttribution.licenseNote}` : ''}
                </Text>
              ) : null}
              {practiceSong && needsOnDemandChordFetch(practiceSong) && autoChordFetchDone && !chordFetchLoading ? (
                <TouchableOpacity
                  style={[styles.lyricsEmptyBtn, { marginTop: 12, backgroundColor: '#1565c0' }]}
                  onPress={openOnDemandChordFetchManual}
                  disabled={chordFetchLoading}
                >
                  {chordFetchLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={16} color="#fff" />
                  )}
                  <Text style={styles.lyricsEmptyBtnText}>Подгрузить таб</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.lyricsEmptyBtn} onPress={() => setLyricsEditMode(true)}>
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.lyricsEmptyBtnText}>Добавить текст</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
            </View>
            </GestureDetector>
          </View>

        </View>
      )}

      {/* ── IDENTIFY MODE (НАЙТИ) ──
          Sub-tabs: mic=Запись (default), file=Файл, yt=YouTube, manual=Вручную (lyrics.ovh only).
          Full chord search → Практика → «База песен» (same modal as practice library). */}
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
                <TouchableOpacity onPress={clearIdentifyResult}
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

              {libraryMatch ? (
                <View style={styles.resultLibraryBadge}>
                  <Ionicons name="library-outline" size={14} color="#00e676" />
                  <Text style={styles.resultLibraryBadgeText}>Есть в библиотеке RecoTune</Text>
                </View>
              ) : (
                <Text style={styles.resultNoLibrary}>Аккорды в каталоге не найдены — только текст (если есть)</Text>
              )}

              <View style={styles.resultChordsBlock}>
                <Text style={styles.resultChordsLabel}>АККОРДЫ</Text>
                <Text style={styles.resultChordsValue}>
                  {libraryMatch?.chords ?? '—'}
                </Text>
                {libraryMatch?.key && (
                  <Text style={styles.resultChordsMeta}>Тональность: {libraryMatch.key}{libraryMatch.bpm ? ` · ${libraryMatch.bpm} BPM` : ''}</Text>
                )}
              </View>

              <View style={styles.resultActions}>
                <TouchableOpacity style={[styles.chordsBtn, { backgroundColor: '#ff980022', borderColor: '#ff980066' }]}
                  onPress={openIdentifyInPractice}>
                  <Ionicons name="person" size={16} color="#ff9800" />
                  <Text style={[styles.chordsBtnText, { color: '#ff9800' }]}>
                    {libraryMatch ? 'В практику с аккордами' : 'В практику'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chordsBtn, { backgroundColor: '#00e67618', borderColor: '#00e67655' }]}
                  onPress={() => { void saveIdentifyToLibrary(); }}>
                  <Ionicons name="bookmark-outline" size={16} color="#00e676" />
                  <Text style={[styles.chordsBtnText, { color: '#00e676' }]}>Сохранить в библиотеку</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.resultDivider} />

              <View style={styles.resultLyricsHeader}>
                <Ionicons name="document-text-outline" size={14} color="#555" />
                <Text style={styles.lyricsLabel}>ТЕКСТ ПЕСНИ</Text>
                {lyricsSource && !lyricsLoading && (
                  <Text style={styles.lyricsSourceTag}>
                    {lyricsSource === 'library' ? 'каталог' : 'lyrics.ovh'}
                  </Text>
                )}
              </View>
              {lyricsLoading ? (
                <ActivityIndicator color="#555" size="large" style={{ marginTop: 24 }} />
              ) : identifyChordedLyrics ? (
                lyricsSource === 'library' && libraryMatch && hasVerifiedPracticeLyrics(libraryMatch) ? (
                  <Text style={styles.identifyPlainLyrics}>
                    Текст с аккордами открывается в практике — нажмите «В практику с аккордами» выше.
                  </Text>
                ) : (
                  <Text style={styles.identifyPlainLyrics}>{identifyChordedLyrics}</Text>
                )
              ) : (
                <Text style={styles.identifyLyricsEmpty}>Текст не найден (каталог / lyrics.ovh)</Text>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>

          ) : (
            /* ══ STATE B: No result → search UI fills the whole screen ══ */
            <>
              {/* Source tabs */}
              <View style={styles.identTabRow}>
                {([
                  ['mic',     'ear',          'Запись',   '#7c4dff'],
                  ['file',    'document',     'Файл',     '#ff9800'],
                  ['yt',      'logo-youtube', 'YouTube',  '#ff0000'],
                  ['manual',  'create',       'Вручную',  '#888'],
                ] as const).map(([src, icon, label, accent]) => (
                  <TouchableOpacity key={src}
                    style={[styles.identTab, identSource === src && { backgroundColor: accent + '22', borderColor: accent + '88' }]}
                    onPress={() => { clearIdentifyHints(); setIdentSource(src); }}>
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
                    <Text style={styles.identActionTitle}>Запись для распознавания</Text>
                    <Text style={styles.identActionSub}>
                      10 с → анализ темпа/тональности и напева (локально).{'\n'}
                      Песня подставится только при уверенном совпадении; иначе — подсказки ниже.
                    </Text>
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
                    <Text style={styles.identActionSub}>
                      MP3, AAC, WAV — копия сохраняется локально.{'\n'}
                      Из имени «Исполнитель - Название» — подсказка для каталога; иначе ищите вручную.
                    </Text>
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
                    <Text style={styles.identActionSub}>
                      Только текст (lyrics.ovh) и сопоставление с базой.{'\n'}
                      Поиск песен с аккордами — «База песен» в Практике.
                    </Text>
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

                {(identifyHintCandidates?.length || identifyAudioHints) && (
                  <View style={styles.identHintsPanel}>
                    <Text style={styles.identHintsTitle}>Подсказки по записи</Text>
                    {formatIdentifyAudioHintsLine(identifyAudioHints) ? (
                      <Text style={styles.identHintsAudio}>
                        {formatIdentifyAudioHintsLine(identifyAudioHints)}
                      </Text>
                    ) : null}
                    {identifyHintCandidates?.map(c => (
                      <TouchableOpacity
                        key={c.song.id}
                        style={styles.identHintRow}
                        onPress={() => {
                          clearIdentifyHints();
                          void applyFromLibrarySong(c.song);
                        }}
                      >
                        <Ionicons name="musical-notes-outline" size={16} color="#7c4dff" />
                        <Text style={styles.identHintText} numberOfLines={2}>
                          {formatHintCandidateLabel(c)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <Text style={styles.identHintsDisclaimer}>
                      Не авто-распознавание — проверьте название перед практикой.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.identBtnBig, { backgroundColor: '#7c4dff33', borderWidth: 1, borderColor: '#7c4dff66', marginTop: 8 }]}
                  onPress={() => openPracticeLibrary()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="library" size={22} color="#7c4dff" />
                  <Text style={[styles.identBtnBigText, { color: '#7c4dff' }]}>БАЗА ПЕСЕН (ПРАКТИКА)</Text>
                </TouchableOpacity>
                <Text style={styles.identFooter}>база офлайн · lyrics.ovh · табы авто</Text>
              </View>
            </>
          )}

        </View>
      )}

      </View>

      {/* Мик/REC: привязка к низу экрана Chords (контейнер), а не к внутренней колонке практики —
          иначе при сбое flex-высоты остаётся пустая полоса между доком и нижними вкладками. */}
      {mode === 'practice' && (
        <View
          onLayout={e => {
            const h = Math.round(e.nativeEvent.layout.height);
            setPracticeDockHeight(prev => (Math.abs(prev - h) < 2 ? prev : h));
          }}
          style={[
            styles.practiceToolbarDockBar,
            styles.practiceToolbarDockFixed,
            {
              paddingBottom:
                tabBarHidden && immersiveLyrics ? Math.max(6, insets.bottom) : 0,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.mainBtnPracticeDock,
              pitchActive && styles.mainBtnStop,
              { flex: 1 },
            ]}
            onPress={pitchActive ? stopPitchDetection : startPitchDetection}
            activeOpacity={0.8}
          >
            <Ionicons name={pitchActive ? 'stop-circle' : 'mic-circle'} size={20} color="#fff" />
            <Text style={styles.mainBtnPracticeDockText}>
              {pitchActive ? 'Выкл' : 'Mic'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.recBtnPracticeDock,
              isPracticeRec && styles.recBtnActive,
            ]}
            onPress={isPracticeRec ? stopPracticeRec : startPracticeRec}
            activeOpacity={0.8}
          >
            <View style={[styles.recDot, isPracticeRec && styles.recDotActive]} />
            <Text style={[styles.recBtnPracticeDockText, isPracticeRec && { color: '#ff5252' }]}>
              {isPracticeRec
                ? `${Math.floor(practiceRecDur / 60)}:${(practiceRecDur % 60).toString().padStart(2, '0')}`
                : 'REC'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LIVE: нижний док как у практики — СТАРТ / В практику / сброс, список аккордов на flex:1 */}
      {mode === 'live' && (
        <View
          onLayout={e => {
            const h = Math.round(e.nativeEvent.layout.height);
            setLiveDockHeight(prev => (Math.abs(prev - h) < 2 ? prev : h));
          }}
          style={[
            styles.practiceToolbarDockBar,
            styles.practiceToolbarDockFixed,
            {
              paddingBottom:
                tabBarHidden && immersiveLyrics ? Math.max(6, insets.bottom) : 0,
            },
          ]}
        >
          <View style={styles.liveDockRow}>
            <TouchableOpacity
              style={[styles.mainBtnPracticeDock, liveActive && styles.mainBtnStop, { flex: 1 }]}
              onPress={liveActive ? stopLive : startLive}
              activeOpacity={0.8}
            >
              <Ionicons name={liveActive ? 'stop-circle' : 'mic-circle'} size={20} color="#fff" />
              <Text style={styles.mainBtnPracticeDockText}>{liveActive ? '■ СТОП' : '▶ СТАРТ'}</Text>
            </TouchableOpacity>

            {segments.length >= 2 && !liveActive && (
              <TouchableOpacity
                style={styles.liveDockSaveBtn}
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
                <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
                <Text style={styles.liveDockSaveBtnText}>В ПРАКТИКУ</Text>
              </TouchableOpacity>
            )}

            {segments.length > 0 && (
              <TouchableOpacity
                style={styles.liveDockClearBtn}
                onPress={() => { setSegments([]); setChord('—'); setKey(''); setNotes([]); }}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.liveDockHint}>Аккорд фиксируется после ~0.7 с стабильного звука</Text>
        </View>
      )}

      {/* ── Song Library Modal ── */}
      <Modal visible={showLibrary} animationType="slide" onRequestClose={() => setShowLibrary(false)}>
        <View style={[styles.libModal, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.libModalChrome}>
          {/* Header */}
          <View style={styles.libHeader}>
            <Pressable
              style={styles.libHeaderTitleBlock}
              onLongPress={() => { void openProviderSettings(); }}
              delayLongPress={500}
              accessibilityHint="Долгое нажатие — расширенные настройки источников"
            >
              <Text style={styles.libTitle}>БАЗА ПЕСЕН</Text>
              <Text style={styles.libSubtitle} numberOfLines={1}>
                {allSongs.length} песен ({userSongCount} своих)
              </Text>
              {libraryInitError ? (
                <Text style={{ color: '#ff6b6b', fontSize: 11, marginTop: 6 }} numberOfLines={2}>
                  {formatMetadataSyncError(new Error(libraryInitError))}
                </Text>
              ) : null}
            </Pressable>
            <View style={styles.libHeaderActions}>
              <TouchableOpacity onPress={() => { void importChordProFile(true); }} style={styles.libHeaderImportBtn}>
                <Ionicons name="document-text-outline" size={15} color="#00e676" />
                <Text style={{ color: '#00e676', fontSize: 10, fontWeight: '700' }}>ИМПОРТ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { void exportLibraryJson(); }} style={styles.libHeaderIconBtn}>
                <Ionicons name="share-outline" size={20} color="#888" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openAddSong()} style={styles.libHeaderAddBtn}>
                <Ionicons name="add-circle-outline" size={16} color="#7c4dff" />
                <Text style={{ color: '#7c4dff', fontSize: 11, fontWeight: '700' }}>ДОБАВИТЬ</Text>
              </TouchableOpacity>
            </View>
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
              autoCapitalize="none"
              returnKeyType="search"
            />
            {libSearchBusy ? (
              <ActivityIndicator size="small" color="#7c4dff" style={{ marginRight: 8 }} />
            ) : null}
            {libSearch ? (
              <TouchableOpacity onPress={() => setLibSearch('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={16} color="#444" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Избранное / табы; без поиска — сортировка А→Я по умолчанию (без отдельного чипа) */}
          <View style={styles.libFilterRow}>
            <TouchableOpacity onPress={() => setLibFavOnly(v => !v)}
              style={[styles.libFilterPill, libFavOnly && styles.libFilterPillActive]}>
              <Text style={[styles.libFilterPillText, libFavOnly && styles.libFilterPillTextActive]}>⭐ Избранное</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLibFullTabsOnly(v => !v)}
              style={[styles.libFilterPill, libFullTabsOnly && styles.libFilterPillTabsActive]}>
              <Text style={[styles.libFilterPillText, libFullTabsOnly && { color: '#00e676' }]}>ТАБЫ</Text>
            </TouchableOpacity>
            <Text style={styles.libCount}>{libCountLabel}</Text>
          </View>
          </View>

          {/* Song list */}
          <FlatList
            style={styles.libList}
            data={libResults}
            keyExtractor={item => item.id}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={() => {
              if (libSearch.trim() && libSearchHasMore) void loadMoreLibrarySearch();
            }}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              libSearchLoadingMore ? (
                <ActivityIndicator size="small" color="#7c4dff" style={{ marginVertical: 12 }} />
              ) : null
            }
            contentContainerStyle={libResults.length === 0 ? styles.libListEmptyContent : styles.libListContent}
            ListEmptyComponent={
              libSearch.trim() ? (
                <Text style={styles.identEmptyHint}>
                  {allSongs.length === 0
                    ? 'Каталог ещё загружается… Подождите секунду и повторите.'
                    : librarySearchEmptyHint()}
                </Text>
              ) : libFavOnly ? (
                <Text style={styles.identEmptyHint}>
                  {libraryInitError
                    ? libraryInitError
                    : allSongs.length === 0
                      ? 'Каталог ещё загружается…'
                      : libraryFavoritesEmptyHint()}
                </Text>
              ) : null
            }
            renderItem={({ item }) => {
              const diffColor = item.difficulty === 1 ? '#00e676' : item.difficulty === 2 ? '#ffeb3b' : '#ff5252';
              const isFav = favorites.has(item.id);
              const isCustom = item.id.startsWith('custom_');
              const resolved = resolveSongEntry(item);
              return (
                <TouchableOpacity style={styles.libItem} onPress={() => pickSong(item)} activeOpacity={0.7}>
                  <View style={[styles.libItemDot, { backgroundColor: diffColor }]} />
                  <View style={styles.libItemInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={styles.libItemTitle}>{item.title}</Text>
                      {isCustom && <Text style={{ color: '#7c4dff', fontSize: 9, fontWeight: '800' }}>МОЯ</Text>}
                    </View>
                    <Text style={styles.libItemArtist}>{item.artist}</Text>
                    {(() => {
                      const badge = songContentBadge(resolved);
                      const chordSnippet = libraryListChordSnippet(resolved);
                      const label =
                        badge === 'progression' && chordSnippet
                          ? `прогр.: ${chordSnippet}`
                          : chordSnippet || (badge === 'metadata' ? 'без аккордов' : '—');
                      return (
                        <Text
                          style={[styles.libItemChords, !chordSnippet && styles.libItemChordsMuted]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                      );
                    })()}
                  </View>
                  <View style={styles.libItemRight}>
                    <Text
                      style={[
                        styles.libItemHasLyrics,
                        songContentBadge(resolved) === 'chords' && { color: '#00e676' },
                      ]}
                    >
                      {songContentBadgeLabel(songContentBadge(resolved))}
                    </Text>
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

      {/* ── Provider settings ── */}
      <Modal visible={showProviderSettings} animationType="fade" transparent onRequestClose={() => setShowProviderSettings(false)}>
        <View style={{ flex: 1, backgroundColor: '#000c', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#12121a',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85%',
            minHeight: 120,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', flex: 1 }}>Подгрузка табов</Text>
              <TouchableOpacity onPress={() => setShowProviderSettings(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: Math.round(windowH * 0.72) }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
            <Text style={{ color: '#666', fontSize: 11, marginBottom: 10 }}>
              Табы подгружаются сами при выборе песни: AmDm → Ultimate Guitar → pesni.ru (с телефона, если прокси недоступен).
            </Text>
            {providerSettings && (
              <>
                <View
                  style={{
                    backgroundColor: '#1a2438',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: '#9cf', fontSize: 12, fontWeight: '700' }}>Авто</Text>
                  <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                    AmDm → Ultimate Guitar → pesni.ru
                  </Text>
                  <Text style={{ color: '#555', fontSize: 10, marginTop: 6 }}>
                    Прокси: {effectiveChordFetchUrl(providerSettings) || 'не задан (pesni.ru с телефона)'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAdvancedProviders(v => !v)}
                  style={{ marginBottom: 6, marginTop: 4 }}
                >
                  <Text style={{ color: '#666', fontSize: 11 }}>
                    {showAdvancedProviders ? '▼' : '▶'} Расширенные (для разработки)
                  </Text>
                </TouchableOpacity>
                {showAdvancedProviders ? (
                  <>
                    <View
                      style={{
                        backgroundColor: '#1a1a28',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ color: '#bbb', fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
                        Прокси на ПК
                      </Text>
                      <Text style={{ color: '#888', fontSize: 11, lineHeight: 16, marginBottom: 6 }}>
                        На ПК: <Text style={{ color: '#9cf' }}>{CHORD_FETCH_DEV_PROXY_CMD}</Text> или{' '}
                        <Text style={{ color: '#9cf' }}>npm start</Text> (поднимет сам). Expo Go — та же Wi‑Fi.
                      </Text>
                      <Text style={{ color: '#555', fontSize: 10, marginBottom: 8 }}>
                        Сейчас: {effectiveChordFetchUrl(providerSettings) || 'не задан'} ·{' '}
                        {resolveChordFetchUrlForAutoFillDetailed().sourceLabel}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.identBtnBig, { flex: 1, backgroundColor: '#1565c044' }]}
                          onPress={() => {
                            const detected = normalizeChordFetchUrl(resolveChordFetchUrlForAutoFill());
                            if (!detected) {
                              Alert.alert('Прокси не найден', chordFetchSetupHint());
                              return;
                            }
                            const next: ProviderSettings = {
                              ...providerSettings,
                              chordFetchProxyUrl: detected,
                              chordFetchProxyUserSet: false,
                              devProxyUrlHintDismissed: true,
                            };
                            void persistProviderSettings(next);
                            setChordFetchProbeStatus(null);
                          }}
                        >
                          <Text style={styles.identBtnBigText}>Подставить авто</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.identBtnBig, { flex: 1, backgroundColor: '#00e67633' }]}
                          disabled={chordFetchProbeBusy}
                          onPress={() => {
                            const url = effectiveChordFetchUrl(providerSettings);
                            if (!url) {
                              Alert.alert('Нет URL', chordFetchSetupHint());
                              return;
                            }
                            setChordFetchProbeBusy(true);
                            setChordFetchProbeStatus('Проверка Creep…');
                            void probeChordFetchEndpoint(url)
                              .then(msg => setChordFetchProbeStatus(msg))
                              .finally(() => setChordFetchProbeBusy(false));
                          }}
                        >
                          <Text style={styles.identBtnBigText}>
                            {chordFetchProbeBusy ? '…' : 'Проверить'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {chordFetchProbeStatus ? (
                        <Text
                          style={{
                            color: chordFetchProbeStatus.startsWith('OK') ? '#00e676' : '#ff9800',
                            fontSize: 11,
                            marginTop: 8,
                          }}
                          numberOfLines={4}
                        >
                          {chordFetchProbeStatus}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                      Принудительный источник (обычно не нужен)
                    </Text>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => {
                        void persistProviderSettings({
                          ...providerSettings,
                          onDemandChordSource: 'auto',
                        });
                      }}
                    >
                      <Ionicons
                        name={providerSettings.onDemandChordSource === 'auto' ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color="#7c4dff"
                      />
                      <Text style={{ color: '#ddd', marginLeft: 8 }}>Авто (AmDm → UG → pesni.ru)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => {
                        void persistProviderSettings({
                          ...providerSettings,
                          onDemandChordSource: 'pesni_ru',
                        });
                      }}
                    >
                      <Ionicons
                        name={providerSettings.onDemandChordSource === 'pesni_ru' ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={PROVIDER_BADGE_COLORS.pesni_ru}
                      />
                      <Text style={{ color: '#ddd', marginLeft: 8 }}>Только pesni.ru</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginBottom: 8 }}
                      onPress={() => {
                        void persistProviderSettings({
                          ...providerSettings,
                          onDemandChordSource: 'amdm',
                        });
                      }}
                    >
                      <Ionicons
                        name={providerSettings.onDemandChordSource === 'amdm' ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={PROVIDER_BADGE_COLORS.amdm}
                      />
                      <Text style={{ color: '#ddd', marginLeft: 8 }}>Только AmDm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e28' }}
                      onPress={() => {
                        const next = {
                          ...providerSettings,
                          enabled: { ...providerSettings.enabled, pesni_ru: !providerSettings.enabled.pesni_ru },
                        };
                        void persistProviderSettings(next);
                      }}
                    >
                      <Ionicons
                        name={providerSettings.enabled.pesni_ru === true ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={PROVIDER_BADGE_COLORS.pesni_ru}
                      />
                      <Text style={{ color: '#ddd', marginLeft: 10 }}>Включить pesni.ru в поиске</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1e1e28' }}
                      onPress={() => {
                        const next = {
                          ...providerSettings,
                          enabled: { ...providerSettings.enabled, amdm: !providerSettings.enabled.amdm },
                        };
                        void persistProviderSettings(next);
                      }}
                    >
                      <Ionicons
                        name={providerSettings.enabled.amdm !== false ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={PROVIDER_BADGE_COLORS.amdm}
                      />
                      <Text style={{ color: '#ddd', marginLeft: 10 }}>Отключить AmDm в цепочке</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowAdvancedChordFetchUrl(v => !v)}
                      style={{ marginBottom: 6 }}
                    >
                      <Text style={{ color: '#666', fontSize: 11 }}>
                        {showAdvancedChordFetchUrl ? '▼' : '▶'} Свой URL прокси (опционально)
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {showAdvancedProviders && showAdvancedChordFetchUrl ? (
                  <>
                    <Text style={{ color: '#666', fontSize: 10, marginBottom: 6 }}>
                      POST endpoint для AmDm. По умолчанию подставляется http://IP-ПК:8787/fetch при Expo Go.
                    </Text>
                    <TextInput
                      style={[styles.urlInput, { marginBottom: 6 }]}
                      placeholder="https://…/api/fetch-chords"
                      placeholderTextColor="#333"
                      value={providerSettings.chordFetchProxyUrl}
                      onChangeText={v => {
                        setChordFetchProbeStatus(null);
                        setProviderSettings(s =>
                          s ? { ...s, chordFetchProxyUrl: v } : s,
                        );
                      }}
                      onEndEditing={() => {
                        if (!providerSettings) return;
                        const normalized = normalizeChordFetchUrl(providerSettings.chordFetchProxyUrl);
                        setProviderSettings(s =>
                          s
                            ? {
                                ...s,
                                chordFetchProxyUrl: normalized,
                                chordFetchProxyUserSet: !!normalized.trim(),
                              }
                            : s,
                        );
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={{ color: '#555', fontSize: 10, marginBottom: 8 }}>
                      Полный авто: {resolveChordFetchUrlDetailed().sourceLabel}
                      {resolveChordFetchUrl() ? ` → ${resolveChordFetchUrl()}` : ''}
                    </Text>
                  </>
                ) : null}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e1e28' }}
                  onPress={() => {
                    const next = {
                      ...providerSettings,
                      enabled: {
                        ...providerSettings.enabled,
                        ultimate_guitar: !providerSettings.enabled.ultimate_guitar,
                      },
                    };
                    void persistProviderSettings(next);
                  }}
                >
                  <Ionicons
                    name={providerSettings.enabled.ultimate_guitar !== false ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={PROVIDER_BADGE_COLORS.ultimate_guitar}
                  />
                  <Text style={{ color: '#ddd', marginLeft: 10, flex: 1 }}>Ultimate Guitar в цепочке</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e1e28' }}
                  onPress={() => {
                    const next = {
                      ...providerSettings,
                      enabled: { ...providerSettings.enabled, lyrics: !providerSettings.enabled.lyrics },
                    };
                    void persistProviderSettings(next);
                  }}
                >
                  <Ionicons
                    name={providerSettings.enabled.lyrics !== false ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={PROVIDER_BADGE_COLORS.lyrics}
                  />
                  <Text style={{ color: '#ddd', marginLeft: 10, flex: 1 }}>Текст онлайн</Text>
                </TouchableOpacity>
              </>
            )}
            {providerSettings && (
              <>
                <Text style={{ color: '#888', fontSize: 11, marginTop: 14, marginBottom: 6 }}>ChordPro raw URL</Text>
                <TextInput
                  style={[styles.urlInput, { marginBottom: 8 }]}
                  placeholder="https://gist.githubusercontent.com/.../song.cho"
                  placeholderTextColor="#333"
                  value={providerSettings.chordProUrl}
                  onChangeText={v => setProviderSettings(s => s ? { ...s, chordProUrl: v } : s)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={{ color: '#888', fontSize: 11, marginTop: 8, marginBottom: 6 }}>
                  Сервер каталога метаданных (GET …/metadata/batch). Пусто = встроенные MusicBrainz chunks
                </Text>
                <TextInput
                  style={[styles.urlInput, { marginBottom: 8 }]}
                  placeholder="http://192.168.x.x:8790"
                  placeholderTextColor="#333"
                  value={providerSettings.metadataSyncBaseUrl}
                  onChangeText={v => setProviderSettings(s => s ? { ...s, metadataSyncBaseUrl: v } : s)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.identBtnBig, { backgroundColor: '#00e67633', marginBottom: 8 }]}
                  onPress={() => {
                    if (!providerSettings) return;
                    const next = { ...providerSettings, metadataFullIndexOffline: true };
                    setProviderSettings(next);
                    void saveProviderSettings(next).then(() => {
                      startBackgroundIndex(p => setMetadataSyncProgress(p));
                    });
                  }}
                >
                  <Text style={styles.identBtnBigText}>Скачать полный индекс офлайн</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.identBtnBig, { backgroundColor: '#44444455', marginBottom: 8 }]}
                  onPress={() => {
                    void syncAllMetadata(p => setMetadataSyncProgress(p))
                      .then(async () => {
                        setMetadataTrackCount(await getMetadataTrackCount());
                        await reloadLibrary();
                      })
                      .catch(() => {});
                  }}
                >
                  <Text style={styles.identBtnBigText}>Синхронизировать каталог (сервер URL)</Text>
                </TouchableOpacity>
                {providerSettings?.metadataFullIndexOffline ? (
                  <Text style={{ color: '#00e676', fontSize: 11, marginBottom: 8 }}>
                    Офлайн-индекс включён — фоновая загрузка в SQLite
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.identBtnBig, { backgroundColor: '#7c4dff55', marginBottom: 8 }]}
                  onPress={() => {
                    if (!providerSettings) return;
                    const next: ProviderSettings = {
                      ...providerSettings,
                      devProxyUrlHintDismissed: true,
                    };
                    void persistProviderSettings(next);
                  }}
                >
                  <Text style={styles.identBtnBigText}>Сохранить настройки</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.identBtnBig, { backgroundColor: '#ff980022', marginBottom: 8 }]}
                  disabled={providerSettings?.legacyArchiveImported}
                  onPress={() => {
                    if (!providerSettings) return;
                    Alert.alert(
                      'Архивный каталог (536)',
                      'Старый встроенный список с черновыми текстами. Восстановить в SQLite для офлайн-поиска по прогрессиям?',
                      [
                        { text: 'Отмена', style: 'cancel' },
                        {
                          text: 'Импортировать',
                          onPress: () => {
                            void (async () => {
                              try {
                                const { imported } = await importLegacyArchiveCatalog();
                                const next = { ...providerSettings, legacyArchiveImported: true };
                                await saveProviderSettings(next);
                                setProviderSettings(next);
                                await reloadLibrary();
                                Alert.alert('Готово', `Импортировано ${imported} песен из архива.`);
                              } catch (e) {
                                Alert.alert('Ошибка', String(e));
                              }
                            })();
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.identBtnBigText}>
                    {providerSettings?.legacyArchiveImported
                      ? 'Архив 536 уже импортирован'
                      : 'Импорт архивного каталога (536)'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ paddingVertical: 10 }}
                  onPress={() => { void importLibraryJson(); }}
                >
                  <Text style={{ color: '#00e676', fontWeight: '700' }}>Импорт JSON-бэкапа библиотеки</Text>
                </TouchableOpacity>
              </>
            )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Song Modal ── */}
      <Modal visible={showAddSong} animationType="slide" onRequestClose={() => setShowAddSong(false)}>
        <View style={[styles.libModal, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.libHeader}>
            <Text style={[styles.libTitle, { flex: 1, minWidth: 0 }]}>{editingSong ? 'РЕДАКТИРОВАТЬ' : 'ДОБАВИТЬ ПЕСНЮ'}</Text>
            <TouchableOpacity onPress={() => setShowAddSong(false)} style={styles.libClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.libFormScroll}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
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

      {/* ── Instrument picker + basic chords catalog ── */}
      <Modal visible={showInstrumentModal} transparent animationType="fade" onRequestClose={() => setShowInstrumentModal(false)}>
        <View style={styles.instrumentModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowInstrumentModal(false)} />
          <View style={styles.instrumentModalCenter} pointerEvents="box-none">
            <View style={styles.instrumentModalCard}>
            <Text style={styles.instrumentModalTitle}>Инструмент</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {CHORD_DIAGRAM_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.instrumentModalRow, chordDiagramId === opt.id && styles.instrumentModalRowActive]}
                  onPress={() => { setChordDiagramId(opt.id); setShowInstrumentModal(false); }}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.instrumentModalRowLabel, chordDiagramId === opt.id && { color: '#00e676' }]}>{opt.label}</Text>
                    <Text style={styles.instrumentModalRowHint}>{opt.tuningHint}</Text>
                  </View>
                  {chordDiagramId === opt.id ? (
                    <Ionicons name="checkmark-circle" size={22} color="#00e676" />
                  ) : null}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.instrumentModalBasicBtn}
                onPress={() => {
                  setShowInstrumentModal(false);
                  setShowBasicChordsModal(true);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="grid-outline" size={20} color="#ff9800" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.instrumentModalBasicTitle}>Справочник аккордов</Text>
                  <Text style={styles.instrumentModalBasicSub}>Все схемы · гитара / укулеле / …</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={styles.instrumentModalClose} onPress={() => setShowInstrumentModal(false)}>
              <Text style={{ color: '#888', fontSize: 14 }}>Закрыть</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBasicChordsModal} animationType="slide" onRequestClose={() => setShowBasicChordsModal(false)}>
        <View style={[styles.libModal, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.libHeader}>
            <View style={styles.libHeaderTitleBlock}>
              <Text style={styles.libTitle}>СПРАВОЧНИК</Text>
              <Text style={styles.libSubtitle}>
                {currentInstrumentLabel} · {fullChordCount} схем · не только из песни
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowBasicChordsModal(false)} style={styles.libClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={[styles.libGenreScroll, { borderBottomWidth: 1, borderColor: '#1e1e28' }]}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' }}>
            {CHORD_DIAGRAM_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setChordDiagramId(opt.id)}
                style={[styles.catalogInstChip, chordDiagramId === opt.id && styles.catalogInstChipActive]}
              >
                <Text style={[styles.catalogInstChipText, chordDiagramId === opt.id && { color: '#00e676' }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <SectionList
            sections={fullChordSections}
            keyExtractor={(item, index) => `${item.name}-${item.label}-${index}`}
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.basicChordSectionHead}>
                <Text style={styles.basicChordSectionTitle}>{title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.basicChordRow}>
                <View style={styles.basicChordMeta}>
                  <Text style={styles.basicChordName}>{item.name}</Text>
                  <Text style={styles.basicChordKind}>{item.label}</Text>
                </View>
                <ChordDiagram name={item.name} diagramId={chordDiagramId} size="sm" />
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: '#444', padding: 24, textAlign: 'center' }}>
                Для этого инструмента нет записей в справочнике.
              </Text>
            }
          />
        </View>
      </Modal>

      {/* Hidden engine WebView — baseUrl required for getUserMedia on Android */}
      <WebView
        ref={wvRef}
        source={{ html: ENGINE_HTML, baseUrl: 'https://localhost' }}
        style={styles.hiddenWV}
        pointerEvents="none"
        onMessage={handleWVMessage}
        onLoadEnd={handleWVLoad}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenFill: { flex: 1, minHeight: 0, width: '100%' },
  /** relative — абсолютный док практики (Мик/REC) позиционируется от низа этого контейнера */
  container:  { flex: 1, minHeight: 0, backgroundColor: '#0a0a0f', position: 'relative' },
  /** Шапка + режимы — без модалок/WebView как соседей во flex (иначе снизу «пустая зона» до таб-бара) */
  mainScreenColumn: { flex: 1, minHeight: 0, flexDirection: 'column' },
  header:     { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  title:      { color: '#888', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  devBuildText: { color: '#333', fontSize: 9, fontWeight: '700', marginTop: 2 },
  modePills:  { flexDirection: 'row', gap: 5 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  pillActive: { backgroundColor: '#ff9800', borderColor: '#ff9800' },
  pillText:   { color: '#555', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  pillTextActive: { color: '#0a0a0f' },
  hiddenWV:    { position: 'absolute', left: -9999, top: 0, width: 1, height: 1, opacity: 0, zIndex: -1 },
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
  liveRootColumn: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  /** Компактный «текущий аккорд» — строка, больше высоты списку */
  liveTopCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0a0a0f',
    borderBottomWidth: 1,
    borderColor: '#1e1e28',
    flexShrink: 0,
  },
  liveChordHero: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    minWidth: 72,
    textAlign: 'center',
  },
  liveTopMeta: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 },
  liveChordKeySm: { color: '#555', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  liveNotesRowSm: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  liveNotePillSm: { paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#1e1e28', borderRadius: 8 },
  liveNoteTextSm: { color: '#888', fontSize: 11, fontWeight: '700' },
  confRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  confLabelCompact: { color: '#333', fontSize: 8, width: 34, letterSpacing: 0.5 },
  confTrackCompact: { flex: 1, height: 3, backgroundColor: '#1e1e28', borderRadius: 2 },
  liveSegOuter: {
    flex: 1,
    minHeight: 0,
    flexGrow: 1,
    flexBasis: 0,
    flexDirection: 'column',
    backgroundColor: '#0d0d14',
    borderTopWidth: 1,
    borderColor: '#1a1a24',
  },
  /** Обёртка под заголовком «АККОРДЫ» — без неё ScrollView/empty не забирают остаток высоты */
  liveSegBody: { flex: 1, minHeight: 0 },
  liveSegScroll: { flex: 1, minHeight: 0 },
  liveDockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDockSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#7c4dff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDockSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.2 },
  liveDockClearBtn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  liveDockHint: { color: '#444', fontSize: 9, textAlign: 'center', marginTop: 6, lineHeight: 13 },
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

  /* Practice mode — top bar (3 buttons) */
  practiceBarRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginHorizontal: 10, marginTop: 8, marginBottom: 4 },
  practiceBarBtnLib: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7c4dff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    minHeight: 46,
  },
  practiceBarBtnLibText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  practiceBarBtnIcon: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6a3dd9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9575ff44',
  },
  practiceBarBtnIconActive: { backgroundColor: '#9575ff', borderColor: '#fff7' },
  practiceBarBtnRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff980066',
    minHeight: 46,
  },
  practiceBarBtnRefText: { color: '#ff9800', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  instrumentModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  instrumentModalCenter: { flex: 1, justifyContent: 'center', paddingHorizontal: 14 },
  instrumentModalCard: {
    backgroundColor: '#12121c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 10,
    maxHeight: 520,
  },
  instrumentModalTitle: { color: '#ccc', fontSize: 16, fontWeight: '800', marginBottom: 10, paddingHorizontal: 4 },
  instrumentModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  instrumentModalRowActive: { borderColor: '#00e67655', backgroundColor: '#00e6760d' },
  instrumentModalRowLabel: { color: '#ddd', fontSize: 15, fontWeight: '700' },
  instrumentModalRowHint: { color: '#555', fontSize: 11, marginTop: 2, fontWeight: '600' },
  instrumentModalBasicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#ff980018',
    borderWidth: 1,
    borderColor: '#ff980066',
  },
  instrumentModalBasicTitle: { color: '#ff9800', fontSize: 14, fontWeight: '800' },
  instrumentModalBasicSub: { color: '#888', fontSize: 10, marginTop: 2, fontWeight: '600' },
  instrumentModalClose: { alignItems: 'center', paddingVertical: 10 },

  catalogInstChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  catalogInstChipActive: { borderColor: '#00e676', backgroundColor: '#00e67612' },
  catalogInstChipText: { color: '#aaa', fontSize: 11, fontWeight: '800' },
  basicChordSectionHead: { backgroundColor: '#0d0d14', paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: '#1e1e28' },
  basicChordSectionTitle: { color: '#ff9800', fontSize: 13, fontWeight: '900' },
  basicChordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#1a1a24',
    backgroundColor: '#0a0a0f',
  },
  basicChordMeta: { flex: 1, paddingRight: 8 },
  basicChordName: { color: '#fff', fontSize: 16, fontWeight: '900' },
  basicChordKind: { color: '#666', fontSize: 11, fontWeight: '700', marginTop: 2 },

  lyricsScroll: { flex: 1, backgroundColor: '#0a0a0f' },
  /** Колонка практики: верх + текст; Мик/REC вынесен в container (абсолют снизу экрана). */
  practiceRootColumn: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  /** D: при загруженном тексте — flex:1 + minHeight, чтобы полоска текста не сжималась в «ленточку» */
  practiceLyricsStack: {
    flex: 1,
    minHeight: 0,
    flexBasis: 0,
    flexGrow: 1,
    flexDirection: 'column',
  },
  practiceToolbarDockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderColor: '#1a1a24',
  },
  practiceToolbarDockFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 8,
  },
  /** Мик в доке практики — без огромного padding:14 от live-экрана */
  mainBtnPracticeDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00e67688',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 0,
  },
  mainBtnPracticeDockText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  recBtnPracticeDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1a1a24',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  recBtnPracticeDockText: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  practiceChordNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#1e1e28',
    backgroundColor: '#0d0d14',
  },
  practiceFetchDevUrl: {
    color: '#5a5a78',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lyricsEmptyFetchErr: {
    color: '#ff9800',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  practiceFetchHint: {
    color: '#888',
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 10,
    paddingBottom: 4,
    lineHeight: 14,
  },
  practiceChordNavArrow: { paddingHorizontal: 4, paddingVertical: 4 },
  practiceChordPillsScroll: { flex: 1 },
  practiceChordPillsRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 2, paddingVertical: 2 },
  practiceChordPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#1a1a24',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  practiceChordPillActive: { backgroundColor: '#ff980022', borderColor: '#ff9800' },
  practiceChordPillText: { color: '#666', fontSize: 11, fontWeight: '700' },
  practiceChordPillTextActive: { color: '#ff9800', fontSize: 12, fontWeight: '800' },
  practiceChordPillMissing: { color: '#ff525288' },

  /* Practice mode */
  voicePanel: { flexDirection: 'row', backgroundColor: '#111118', borderBottomWidth: 1, borderColor: '#1e1e28', padding: 10, gap: 10, alignItems: 'center' },
  voiceLeft:  { alignItems: 'center', minWidth: 60 },
  voiceLabel: { color: '#333', fontSize: 8, letterSpacing: 2, marginBottom: 2 },
  voiceNote:  { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  voiceHz:    { color: '#444', fontSize: 9 },
  voiceMid:   { flex: 1 },
  chordTonesRow:   { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginBottom: 4 },
  chordTonesRowCompact: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', marginBottom: 2 },
  chordTonePill:   { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#1e1e2e', borderRadius: 8, borderWidth: 1, borderColor: '#3a3a55' },
  chordTonePillSm: { paddingHorizontal: 5, paddingVertical: 2, backgroundColor: '#1e1e2e', borderRadius: 6, borderWidth: 1, borderColor: '#3a3a55' },
  chordTonePillActive: { backgroundColor: '#00e67633', borderColor: '#00e676' },
  chordToneText:   { color: '#aaa', fontSize: 12, fontWeight: '700' },
  chordToneTextSm: { color: '#aaa', fontSize: 10, fontWeight: '700' },
  chordTonesEmpty: { color: '#555', fontSize: 10 },
  centsWrap:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  centsWrapCompact: { marginTop: 2, gap: 2 },
  centsEdge:  { color: '#333', fontSize: 8, width: 18 },
  centsEdgeSm:{ color: '#333', fontSize: 7, width: 14 },
  centsTrack: { flex: 1, height: 6, backgroundColor: '#1a1a24', borderRadius: 3, position: 'relative' },
  centsTrackSm: { flex: 1, height: 4, backgroundColor: '#1a1a24', borderRadius: 2, position: 'relative' },
  centsMid:   { position: 'absolute', left: '50%' as any, top: 0, bottom: 0, width: 1, backgroundColor: '#333' },
  centsThumb: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff9800', marginLeft: -6 },
  centsThumbSm:{ position: 'absolute', top: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: '#ff9800', marginLeft: -5 },
  centsVal:   { color: '#888', fontSize: 9, width: 32, textAlign: 'right' },
  centsValSm: { color: '#888', fontSize: 8, width: 28, textAlign: 'right' },
  voiceRight: { alignItems: 'center', justifyContent: 'center', width: 36 },

  /* Practice: diagram row */
  /* Fixed-height practice panel — no jitter */
  practiceTopPanel:  { flexShrink: 0, flexDirection: 'column', backgroundColor: '#0d0d14', borderBottomWidth: 1, borderColor: '#2a2a3a', paddingHorizontal: 8, paddingVertical: 4, gap: 2 },
  practicePanelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
    gap: 8,
  },
  practicePanelBarTitle: { flex: 1, color: '#555', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  practicePanelToggles: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  practicePanelToggle: {
    width: 34,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  practicePanelToggleOn: { backgroundColor: '#ff9800', borderColor: '#ff9800' },
  practiceChartCol: {
    flex: 1,
    minWidth: 130,
    minHeight: 0,
    alignSelf: 'stretch',
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#2a2a3a',
  },
  practiceChartColTitle: { color: '#666', fontSize: 8, fontWeight: '800', letterSpacing: 0.6, marginBottom: 1 },
  chordInstScroll:     { maxHeight: 28, flexGrow: 0 },
  chordInstScrollContent: { alignItems: 'center', paddingRight: 6, gap: 4 },
  chordInstChip:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#111118', borderWidth: 1, borderColor: '#222', minWidth: 52 },
  chordInstChipActive:{ backgroundColor: '#00e67614', borderColor: '#00e67655' },
  chordInstChipText: { color: '#888', fontSize: 8, fontWeight: '800' },
  chordInstChipTextActive: { color: '#00e676' },
  chordInstChipHint: { color: '#333', fontSize: 6, marginTop: 0, fontWeight: '600' },
  practiceDiagRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 4, minHeight: 0 },
  practiceDiagLeft:  { alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0 },
  practiceDiagRight: {
    width: 100,
    maxWidth: 100,
    flexShrink: 0,
    justifyContent: 'flex-start',
    paddingTop: 2,
    gap: 2,
  },
  practiceDiagRightGrow: {
    flex: 1,
    minWidth: 96,
    flexShrink: 1,
    justifyContent: 'flex-start',
    paddingTop: 2,
    gap: 2,
  },
  practiceChordName: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  diagRow:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, gap: 12, backgroundColor: '#0d0d14', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a24' },
  diagBox:      { alignItems: 'center', justifyContent: 'center' },
  diagInfo:     { flex: 1, gap: 4, paddingTop: 4 },
  diagChordName:{ color: '#ff9800', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  diagVoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  diagVoiceNote:{ fontSize: 16, fontWeight: '800' },
  diagVoiceNoteSm:{ fontSize: 13, fontWeight: '800' },
  diagVoiceHz:  { color: '#666', fontSize: 10 },
  diagVoiceHzSm:{ color: '#666', fontSize: 9 },

  lyricsPanel: { flexGrow: 1, flexShrink: 1, flexBasis: 0, backgroundColor: '#0a0a0f', borderTopWidth: 1, borderColor: '#1a1a24', overflow: 'hidden' },
  lyricsPanelHeader: { flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4, borderBottomWidth: 1, borderColor: '#1a1a24', backgroundColor: '#0d0d14' },
  practiceTransposeRow: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: '#1a1a24',
    backgroundColor: '#0a0a10',
  },
  practiceTransposeLabel: {
    color: '#00e676',
    fontSize: 12,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },
  practiceTransposeReset: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  practiceZoomLabel: {
    color: '#888',
    fontSize: 10,
    minWidth: 36,
    textAlign: 'center',
  },
  practiceAutoScrollRow: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#1a1a24',
    backgroundColor: '#0d0d14',
  },
  practiceAutoScrollPlayBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a28',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  practiceAutoScrollPlayBtnOn: {
    backgroundColor: '#00e67622',
    borderColor: '#00e676',
  },
  practiceAutoScrollBpmLabel: { color: '#666', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginRight: 2 },
  practiceAutoScrollBpmBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a28',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  practiceAutoScrollBpmBtnText: { color: '#ccc', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  practiceAutoScrollBpmValue: { color: '#fff', fontSize: 17, fontWeight: '800', minWidth: 36, textAlign: 'center' },
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
  identActionArea:  { flex: 1, alignItems: 'stretch', justifyContent: 'flex-start', gap: 14, paddingHorizontal: 0, paddingBottom: 20, minWidth: 0 },
  identCatalogPanel: {
    flexShrink: 0,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 10,
  },
  catalogHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 },
  catalogHeaderTitle: { flex: 1, flexShrink: 1, minWidth: 0, textAlign: 'left', fontSize: 17 },
  catalogStatusPill: { flexShrink: 0, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  catalogStatusReady: { backgroundColor: '#00e67618', borderColor: '#00e67655' },
  catalogStatusLoading: { backgroundColor: '#ff980018', borderColor: '#ff980055' },
  catalogStatusText: { fontSize: 11, fontWeight: '800', color: '#ccc' },
  catalogSubtitleOne: { color: '#555', fontSize: 12, lineHeight: 17, width: '100%' },
  catalogProgressWrap: { width: '100%', gap: 6 },
  catalogProgressTrack: { height: 4, backgroundColor: '#1e1e28', borderRadius: 2, overflow: 'hidden' },
  catalogProgressFill: { height: 4, backgroundColor: '#7c4dff', borderRadius: 2 },
  catalogProgressLabel: { color: '#7c4dff', fontSize: 11, fontWeight: '600' },
  catalogErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#ff525218',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff525244',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  catalogErrorText: { flex: 1, color: '#ff8a80', fontSize: 12, lineHeight: 16 },
  catalogRetryBtn: {
    backgroundColor: '#ff525233',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff525266',
  },
  catalogRetryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  catalogSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#12121c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    minHeight: 48,
    overflow: 'hidden',
  },
  catalogSearchInput: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: '#eee',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  catalogClearBtn: { flexShrink: 0, paddingRight: 10, paddingLeft: 4 },
  catalogBusyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, justifyContent: 'center' },
  catalogBusyText: { color: '#888', fontSize: 13, fontWeight: '600' },
  catalogResultsScroll: { width: '100%', flex: 1, minHeight: 0 },
  catalogHitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
  },
  catalogHitMain: { flex: 1, minWidth: 0 },
  catalogHitTitle: { color: '#f0f0f0', fontSize: 15, fontWeight: '800' },
  catalogHitArtist: { color: '#777', fontSize: 13, marginTop: 2 },
  catalogHitBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  catalogEmptyBox: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 8 },
  catalogEmptyTitle: { color: '#aaa', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  catalogEmptyHint: { color: '#555', fontSize: 12, textAlign: 'center' },
  catalogExampleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  catalogExampleChip: {
    backgroundColor: '#1a1a24',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00e67644',
  },
  catalogExampleChipText: { color: '#00e676', fontSize: 12, fontWeight: '700' },
  identActionTitle: { color: '#ccc', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  identActionSub:   { color: '#444', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  identBtnBig:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16, backgroundColor: '#7c4dff88' },
  identBtnBigText:  { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  recProgressBig:   { alignItems: 'center', gap: 12 },
  recSecsBig:       { color: '#7c4dff', fontSize: 28, fontWeight: '900' },
  identFooter:      { color: '#222', fontSize: 10, textAlign: 'center', position: 'absolute', bottom: 8 },
  identCatalogHit:  { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e28' },
  identCatalogHitTitle: { color: '#eee', fontSize: 14, fontWeight: '700' },
  identCatalogHitArtist: { color: '#666', fontSize: 12, marginTop: 2 },
  identEmptyHint: { color: '#888', fontSize: 12, textAlign: 'center', padding: 16 },

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
  resultLibraryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: '#00e67614', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#00e67644', alignSelf: 'flex-start',
  },
  resultLibraryBadgeText: { color: '#00e676', fontSize: 11, fontWeight: '700' },
  resultNoLibrary: { color: '#555', fontSize: 11, marginTop: 10, lineHeight: 16 },
  resultChordsBlock: {
    marginTop: 12, backgroundColor: '#15151e', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#2a2a38',
  },
  resultChordsLabel: { color: '#555', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  resultChordsValue: { color: '#e0e0e0', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  resultChordsMeta: { color: '#666', fontSize: 11, marginTop: 6 },
  resultLyricsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  lyricsSourceTag: { color: '#444', fontSize: 9, fontWeight: '700', marginLeft: 'auto' as const },
  resultLyricsText: { color: '#aaa', fontSize: 14, lineHeight: 24 },
  lyricsLabel:      { color: '#444', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  identifyLyricsEmpty: { color: '#333', fontSize: 13, fontStyle: 'italic', marginTop: 12 },
  identifyPlainLyrics: { color: '#bbb', fontSize: 14, lineHeight: 22, marginTop: 8 },
  identHintsPanel: {
    width: '100%',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: '#7c4dff44',
  },
  identHintsTitle: { color: '#7c4dff', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  identHintsAudio: { color: '#888', fontSize: 12, marginBottom: 10 },
  identHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#1e1e28',
  },
  identHintText: { color: '#ccc', fontSize: 13, flex: 1 },
  identHintsDisclaimer: { color: '#555', fontSize: 10, marginTop: 8, fontStyle: 'italic' },

  cancelBtn:  { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a1a24', borderRadius: 10 },
  cancelText: { color: '#888', fontSize: 13 },
  urlInput:   { backgroundColor: '#1a1a24', borderRadius: 10, padding: 10, color: '#ccc', fontSize: 13, borderWidth: 1, borderColor: '#2a2a3a' },

  /* Practice input: library button */
  libBtn:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#7c4dff22', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#7c4dff44' },
  libBtnText:  { color: '#7c4dff', fontSize: 9, fontWeight: '800' },

  /* Song Library Modal */
  libModal:    { flex: 1, minHeight: 0, backgroundColor: '#0a0a0f' },
  libModalChrome: { flexShrink: 0 },
  libHeader:   {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingRight: 44,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#1e1e28',
    gap: 6,
  },
  libHeaderTitleBlock: { flex: 1, minWidth: 140 },
  libHeaderActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  libHeaderIconBtn: { padding: 8 },
  libHeaderImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00e67618',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#00e67644',
  },
  libHeaderAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7c4dff22',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#7c4dff44',
  },
  libTitle:    { color: '#7c4dff', fontSize: 13, fontWeight: '900', letterSpacing: 3 },
  libSubtitle: { color: '#333', fontSize: 11, marginTop: 2, marginBottom: 2 },
  libClose:    { position: 'absolute', right: 12, top: 2 },

  libSearchRow:  {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    minWidth: 0,
    backgroundColor: '#111118',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e1e28',
  },
  libSearchInput:{ flex: 1, minWidth: 0, color: '#ccc', fontSize: 14, paddingVertical: 10, paddingHorizontal: 8 },
  libGenreScroll:{ flexShrink: 0, maxHeight: 42 },
  libGenrePill:  { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#111118', borderRadius: 20, borderWidth: 1, borderColor: '#1e1e28' },
  libGenrePillActive: { backgroundColor: '#7c4dff', borderColor: '#7c4dff' },
  libGenreText:  { color: '#555', fontSize: 11, fontWeight: '600' },
  libFilterRow:  { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6 },
  libFilterPill: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#111118', borderRadius: 20, borderWidth: 1, borderColor: '#1e1e28' },
  libFilterPillActive: { backgroundColor: '#ff9800', borderColor: '#ff9800' },
  libFilterPillTabsActive: { borderColor: '#00e67655', backgroundColor: '#00e67612' },
  libFilterPillText: { color: '#555', fontSize: 11, fontWeight: '600' },
  libFilterPillTextActive: { color: '#0a0a0f', fontWeight: '800' },

  libLegend:   { flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 4 },
  libList:     { flex: 1, minHeight: 0 },
  libListContent: { paddingBottom: 24 },
  libListEmptyContent: { flexGrow: 1, paddingBottom: 24 },
  libFormScroll: { flex: 1, minHeight: 0 },
  libDot:      { fontSize: 10 },
  libLegText:  { color: '#444', fontSize: 10, marginRight: 6 },
  libCount:    { color: '#444', fontSize: 11, marginLeft: 'auto' },

  libItem:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: '#111118' },
  libItemDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  libItemInfo:  { flex: 1 },
  libItemTitle: { color: '#eee', fontSize: 14, fontWeight: '700' },
  libItemArtist:{ color: '#999', fontSize: 12, marginTop: 1 },
  libItemChords:{ color: '#9c7cff', fontSize: 11, marginTop: 3 },
  libItemChordsMuted: { color: '#555' },
  libItemRight: { alignItems: 'flex-end', gap: 3 },
  libItemGenre: { color: '#666', fontSize: 10 },
  libItemBpm:   { color: '#555', fontSize: 10 },
  libItemKey:   { color: '#888', fontSize: 10, fontWeight: '700' },
  libItemHasLyrics: { color: '#00e676', fontSize: 9 },

  /* Add/Edit Song form */
  addFieldLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  addFieldInput: { backgroundColor: '#111118', borderRadius: 10, borderWidth: 1, borderColor: '#1e1e28', color: '#ddd', fontSize: 14, padding: 11 },
});
