import * as FileSystem from 'expo-file-system/legacy';
import type { WebView } from 'react-native-webview';

export type SnippetAudioAnalysis = {
  bpm: number;
  chroma: number[];
  estimatedKey: string;
  melodyMidi: number[];
};

const ANALYZE_TIMEOUT_MS = 45_000;

let webRef: WebView | null = null;
let engineReady = false;
let pending: {
  resolve: (v: SnippetAudioAnalysis) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

export function registerSnippetAnalyzerEngine(ref: WebView | null): void {
  webRef = ref;
}

export function setSnippetAnalyzerReady(ready: boolean): void {
  engineReady = ready;
}

export function handleSnippetAnalyzerMessage(raw: string): void {
  let msg: {
    type: string;
    bpm?: number;
    chroma?: number[];
    estimatedKey?: string;
    melodyMidi?: number[];
    msg?: string;
  };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.type === 'ready') {
    engineReady = true;
    return;
  }
  if (!pending) return;
  if (msg.type === 'error') {
    clearPending(new Error(msg.msg || 'Анализ записи не удался'));
    return;
  }
  if (msg.type === 'done') {
    const chroma = Array.isArray(msg.chroma) ? msg.chroma : [];
    const sum = chroma.reduce((s, v) => s + v, 0);
    if (!pending) return;
    const p = pending;
    clearTimeout(p.timer);
    pending = null;
    const melodyMidi = Array.isArray(msg.melodyMidi)
      ? msg.melodyMidi.filter((n): n is number => typeof n === 'number' && n >= 36 && n <= 96)
      : [];
    p.resolve({
      bpm: typeof msg.bpm === 'number' ? msg.bpm : 0,
      chroma: sum >= 0.25 ? chroma : [],
      estimatedKey: typeof msg.estimatedKey === 'string' ? msg.estimatedKey : '',
      melodyMidi,
    });
  }
}

function clearPending(err: Error | null): void {
  if (!pending) return;
  clearTimeout(pending.timer);
  const p = pending;
  pending = null;
  if (err) p.reject(err);
}

/** Decode snippet via hidden WebView; empty chroma when signal too weak. */
export async function analyzeRecordingUri(
  uri: string,
  maxSec = 12,
): Promise<SnippetAudioAnalysis> {
  if (!webRef || !engineReady) {
    return { bpm: 0, chroma: [], estimatedKey: '', melodyMidi: [] };
  }

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return { bpm: 0, chroma: [], estimatedKey: '', melodyMidi: [] };

  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return new Promise((resolve, reject) => {
    if (pending) {
      reject(new Error('Анализ записи уже выполняется'));
      return;
    }
    const timer = setTimeout(() => {
      clearPending(new Error('Таймаут анализа записи'));
    }, ANALYZE_TIMEOUT_MS);

    pending = {
      resolve: v => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: e => {
        clearTimeout(timer);
        reject(e);
      },
      timer,
    };

    webRef?.postMessage(
      JSON.stringify({ cmd: 'analyze', b64, maxSec: Math.min(Math.max(maxSec, 4), 15) }),
    );
  });
}
