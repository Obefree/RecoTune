/**
 * Hidden WebView that runs pitch detection using the Web Audio API.
 * Posts messages back to React Native with pitch data.
 */
import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

export interface PitchMessage {
  type: 'ready' | 'pitch' | 'signal' | 'silent' | 'error';
  /** Backward-compatible stable frequency used by existing screens. */
  frequency?: number;
  /** Direct detector output before frame smoothing. */
  rawFrequency?: number;
  /** WebView-smoothed frequency after median/jump filtering. */
  stableFrequency?: number;
  note?: string;
  octave?: number;
  cents?: number;
  rawCents?: number;
  stableCents?: number;
  signal?: number;
  /** YIN CMNDF minimum — lower is more confident */
  yinConfidence?: number;
  sourceMode?: TunerEngineMode;
  message?: string;
}

export type TunerEngineMode = 'tuner' | 'melody';

interface Props {
  onMessage: (msg: PitchMessage) => void;
  active: boolean;
  mode?: TunerEngineMode;
}

const ENGINE_PROFILES = {
  tuner: {
    name: 'tuner',
    minHz: 60,
    maxHz: 1400,
    rmsGate: 0.0035,
    maxYin: 0.2,
    ring: 5,
    jumpRatio: 1.32,
    jumpBlendNew: 0.55,
    frameMs: 55,
  },
  melody: {
    name: 'melody',
    minHz: 70,
    maxHz: 1200,
    rmsGate: 0.006,
    maxYin: 0.2,
    ring: 5,
    jumpRatio: 1.34,
    jumpBlendNew: 0.62,
    frameMs: 55,
  },
} as const;

const buildHTML = (mode: TunerEngineMode) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  var ENGINE = ${JSON.stringify(ENGINE_PROFILES[mode])};
  var NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  /** YIN CMNDF: ищем глобальный минимум в диапазоне лагов (как в типичных тюнерах), а не первый порог —
   *  «первый tau < 0.15» часто цепляется за шум/не ту гармонику → скачки и «не слышит». */
  function detectPitch(buf, sr) {
    var minP = Math.floor(sr / ENGINE.maxHz);
    var maxP = Math.floor(sr / ENGINE.minHz);
    var len  = Math.min(buf.length, 4096);
    if (len < maxP * 2) return null;

    var yin = new Float32Array(maxP);
    yin[0] = 1;
    var rs = 0;
    for (var tau = 1; tau < maxP; tau++) {
      var s = 0;
      for (var i = 0; i < len - maxP; i++) {
        var d = buf[i] - buf[i + tau];
        s += d * d;
      }
      rs += s;
      yin[tau] = s * tau / (rs || 1e-10);
    }
    var bestTau = minP;
    var bestY = yin[minP];
    for (var j = minP + 1; j < maxP; j++) {
      if (yin[j] < bestY) { bestY = yin[j]; bestTau = j; }
    }
    if (bestY > ENGINE.maxYin) return null;
    var bt = bestTau;
    if (bestTau > 0 && bestTau < maxP - 1) {
      var s0 = yin[bestTau - 1], s1 = yin[bestTau], s2 = yin[bestTau + 1];
      var dv = s0 - 2 * s1 + s2;
      if (Math.abs(dv) > 1e-10) bt = bestTau + (s0 - s2) / (2 * dv);
    }
    var f = sr / bt;
    if (f < ENGINE.minHz || f > ENGINE.maxHz) return null;
    return { freq: f, yin: bestY };
  }

  var freqRing = [];
  var RING = ENGINE.ring;
  var lastStableF = null;

  function medianRing(arr) {
    var a = arr.slice().sort(function(x, y) { return x - y; });
    return a[Math.floor(a.length / 2)];
  }

  /** Медиана по кадрам + подавление скачка > ~4 тона (часто смена гармоники) */
  function stabilizeFreq(f) {
    freqRing.push(f);
    if (freqRing.length > RING) freqRing.shift();
    if (freqRing.length < 3) return f;
    var m = medianRing(freqRing);
    if (lastStableF != null) {
      var lo = lastStableF / ENGINE.jumpRatio;
      var hi = lastStableF * ENGINE.jumpRatio;
      if (m < lo || m > hi) m = ENGINE.jumpBlendNew * m + (1 - ENGINE.jumpBlendNew) * lastStableF;
    }
    lastStableF = m;
    return m;
  }

  function freqToNote(freq) {
    var midi  = 12 * Math.log2(freq / 440) + 69;
    var round = Math.round(midi);
    var cents = Math.round((midi - round) * 100);
    var name  = NOTE_NAMES[((round % 12) + 12) % 12];
    var oct   = Math.floor(round / 12) - 1;
    return { name: name, octave: oct, cents: cents };
  }

  function post(obj) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  }

  var ctx, analyser, buf, rafId, active = false;

  function loop() {
    if (!active) return;
    analyser.getFloatTimeDomainData(buf);
    var rms = 0;
    for (var i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    var signal = Math.min(1, rms * 8);

    if (rms > ENGINE.rmsGate) {
      var det = detectPitch(buf, ctx.sampleRate);
      if (det) {
        var fUse = stabilizeFreq(det.freq);
        var rawN = freqToNote(det.freq);
        var n = freqToNote(fUse);
        post({
          type: 'pitch',
          frequency: fUse,
          rawFrequency: det.freq,
          stableFrequency: fUse,
          note: n.name,
          octave: n.octave,
          cents: n.cents,
          rawCents: rawN.cents,
          stableCents: n.cents,
          signal: signal,
          yinConfidence: det.yin,
          sourceMode: ENGINE.name
        });
      } else {
        freqRing.length = 0;
        lastStableF = null;
        post({ type: 'signal', signal: signal });
      }
    } else {
      freqRing.length = 0;
      lastStableF = null;
      post({ type: 'silent', signal: 0 });
    }
    rafId = setTimeout(loop, ENGINE.frameMs);
  }

  async function startTuner() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      ctx      = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      ctx.createMediaStreamSource(stream).connect(analyser);
      buf    = new Float32Array(analyser.fftSize);
      active = true;
      post({ type: 'ready' });
      loop();
    } catch(e) {
      post({ type: 'error', message: e.message || String(e) });
    }
  }

  window.stopTuner = function() {
    active = false;
    if (rafId) clearTimeout(rafId);
    if (ctx) ctx.close();
  };

  document.addEventListener('message', function(e) {
    if (e.data === 'stop') window.stopTuner();
  });

  startTuner();
})();
</script>
</body>
</html>`;

const TunerEngine = forwardRef<WebView, Props>(({ onMessage, mode = 'tuner' }, ref) => {
  const html = useMemo(() => buildHTML(mode), [mode]);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg: PitchMessage = JSON.parse(e.nativeEvent.data);
      onMessage(msg);
    } catch {}
  };

  return (
    <WebView
      ref={ref}
      source={{ html, baseUrl: 'https://localhost' }}
      style={styles.hidden}
      onMessage={handleMessage}
      javaScriptEnabled
      originWhitelist={['*']}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      onError={(e) => onMessage({ type: 'error', message: e.nativeEvent.description })}
    />
  );
});

export default TunerEngine;

const styles = StyleSheet.create({
  hidden: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    left: -9999,
    top: 0,
    zIndex: -1,
  },
});
