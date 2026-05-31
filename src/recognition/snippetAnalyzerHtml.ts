/** Hidden WebView: decode recording → BPM + 12-bin chroma + key hint (≤15 s). */
export const SNIPPET_ANALYZER_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#000"><script>
const MAJOR_P=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_P=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const NOTE=[' C','C#',' D','D#',' E',' F','F#',' G','G#',' A','A#',' B'];
const CHROMA_BIN_DB=-68;
function post(obj){window.ReactNativeWebView.postMessage(JSON.stringify(obj));}
function b64ToAB(b64){const bin=atob(b64);const ab=new ArrayBuffer(bin.length);const u8=new Uint8Array(ab);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return ab;}
function chroma(fft,sr,fftSz){
  const c=new Float32Array(12);const bHz=sr/fftSz;
  for(let i=1;i<fft.length;i++){const f=i*bHz;if(f<80||f>2200)continue;const db=fft[i];if(db<CHROMA_BIN_DB)continue;const e=Math.pow(10,db/20);const m=Math.round(12*Math.log2(f/440)+69);c[((m%12)+12)%12]+=e;}
  const mx=Math.max(...c);if(mx>0)for(let i=0;i<12;i++)c[i]/=mx;return c;
}
function estimateKey(c){
  let bk='',bs=-Infinity;
  for(let r=0;r<12;r++){let mj=0,mn=0;for(let i=0;i<12;i++){mj+=c[(i+r)%12]*MAJOR_P[i];mn+=c[(i+r)%12]*MINOR_P[i];}
    if(mj>bs){bs=mj;bk=NOTE[r].trim()+' major';}
    if(mn>bs){bs=mn;bk=NOTE[r].trim()+' minor';}
  }
  return bk;
}
function pitchMidiFromWindow(samples,sr){
  const n=samples.length;if(n<512)return 0;
  let rms=0;for(let i=0;i<n;i++)rms+=samples[i]*samples[i];rms=Math.sqrt(rms/n);
  if(rms<0.008)return 0;
  const minLag=Math.round(sr/900),maxLag=Math.round(sr/70);
  let bestLag=0,best=0;
  for(let lag=minLag;lag<=maxLag&&lag<n/2;lag++){
    let sum=0;for(let i=0;i<n-lag;i++)sum+=samples[i]*samples[i+lag];
    if(sum>best){best=sum;bestLag=lag;}
  }
  if(bestLag<=0)return 0;
  const hz=sr/bestLag;if(hz<70||hz>900)return 0;
  return Math.round(12*Math.log2(hz/440)+69);
}
function extractMelodyMidi(clip,sr){
  const hop=Math.round(sr*0.28),out=[];let last=0;
  for(let o=0;o+hop<clip.length;o+=hop){
    const m=pitchMidiFromWindow(clip.subarray(o,o+hop),sr);
    if(m>0&&m!==last){out.push(m);last=m;}
    if(out.length>=24)break;
  }
  return out;
}
function detectBpm(buf){
  const sr=buf.sampleRate;const ch=buf.getChannelData(0);const hop=Math.round(sr*0.01);
  const frames=Math.floor(ch.length/hop);const energy=new Float32Array(frames);
  for(let i=0;i<frames;i++){let e=0;for(let s=0;s<hop;s++)e+=ch[i*hop+s]**2;energy[i]=e/hop;}
  const onsets=[];for(let i=2;i<frames-1;i++){if(energy[i]>energy[i-1]*2&&energy[i]>energy[i-2]*2&&energy[i]>0.001){onsets.push(i*hop/sr);i+=10;}}
  if(onsets.length<4)return 0;const ioi=[];for(let i=1;i<onsets.length;i++)ioi.push(onsets[i]-onsets[i-1]);
  ioi.sort((a,b)=>a-b);const med=ioi[Math.floor(ioi.length/2)];if(med<=0)return 0;
  let bpm=Math.round(60/med);while(bpm<60&&bpm>0)bpm*=2;while(bpm>240)bpm=Math.round(bpm/2);return bpm;
}
async function analyze(b64,maxSec){
  try{
    const ab=b64ToAB(b64);const tmpCtx=new OfflineAudioContext(1,1,44100);
    const buf=await tmpCtx.decodeAudioData(ab);
    const sr=buf.sampleRate;const maxSamples=Math.min(buf.length,Math.round(maxSec*sr));
    const clip=buf.getChannelData(0).subarray(0,maxSamples);
    const clipBuf=tmpCtx.createBuffer(1,maxSamples,sr);
    clipBuf.copyToChannel(clip,0);
    const bpm=detectBpm(clipBuf);
    const fftSz=8192;const globalChroma=new Float32Array(12);
    const stepSamples=Math.round(sr*1.5);const steps=Math.max(1,Math.floor(maxSamples/stepSamples));
    for(let step=0;step<steps;step++){
      const segLen=Math.min(stepSamples,maxSamples-step*stepSamples);
      const segCtx=new OfflineAudioContext(1,Math.max(segLen,fftSz),sr);
      const src=segCtx.createBufferSource();const segBuf=segCtx.createBuffer(1,Math.max(segLen,fftSz),sr);
      const dst=segBuf.getChannelData(0);for(let i=0;i<segLen;i++)dst[i]=clip[step*stepSamples+i];
      src.buffer=segBuf;const an=segCtx.createAnalyser();an.fftSize=fftSz;an.smoothingTimeConstant=0;
      src.connect(an);an.connect(segCtx.destination);src.start(0);await segCtx.startRendering();
      const fft=new Float32Array(an.frequencyBinCount);an.getFloatFrequencyData(fft);
      const c=chroma(fft,sr,fftSz);for(let i=0;i<12;i++)globalChroma[i]+=c[i];
    }
    const mx=Math.max(...globalChroma);if(mx>0)for(let i=0;i<12;i++)globalChroma[i]/=mx;
    const sum=globalChroma.reduce((s,v)=>s+v,0);
    const melodyMidi=extractMelodyMidi(clip,sr);
    if(sum<0.25){post({type:'done',bpm:0,chroma:[],estimatedKey:'',melodyMidi});return;}
    const estimatedKey=estimateKey(globalChroma);
    post({type:'done',bpm,chroma:Array.from(globalChroma),estimatedKey,melodyMidi});
  }catch(e){post({type:'error',msg:String(e)});}
}
window.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='analyze')analyze(m.b64,m.maxSec||12);}catch{}});
document.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.cmd==='analyze')analyze(m.b64,m.maxSec||12);}catch{}});
post({type:'ready'});
</script></body></html>`;
