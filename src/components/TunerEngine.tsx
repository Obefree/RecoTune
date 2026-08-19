/**
 * Hidden WebView that runs pitch detection using the Web Audio API.
 * Posts messages back to React Native with pitch data.
 */
import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { MIC_MONITOR_ANTIHOWL_SHIFT_HZ, MIC_MONITOR_DEFAULT_GAIN, MIC_MONITOR_GATE } from '../utils/micLiveMonitor';

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
  /** Audio-clock ms from the engine loop (not RN receive time). */
  t?: number;
  sourceMode?: TunerEngineMode;
  message?: string;
}

export type TunerEngineMode = 'tuner' | 'melody' | 'monitor';

interface Props {
  onMessage: (msg: PitchMessage) => void;
  active: boolean;
  mode?: TunerEngineMode;
  /** Tuner only: limit detection to the selected tuning's range (fewer octave errors, less compute). */
  minHz?: number;
  maxHz?: number;
}

const ENGINE_PROFILES = {
  tuner: {
    name: 'tuner',
    minHz: 28,
    maxHz: 1400,
    rmsGate: 0.0035,
    maxYin: 0.2,
    ring: 3,
    jumpRatio: 1.28,
    jumpBlendNew: 0.72,
    frameMs: 45,
  },
  melody: {
    name: 'melody',
    minHz: 70,
    maxHz: 1200,
    rmsGate: 0.005,
    maxYin: 0.26,
    ring: 3,
    jumpRatio: 1.34,
    jumpBlendNew: 0.62,
    frameMs: 32,
    fftSize: 2048,
  },
} as const;

const buildMonitorHTML = () => {
  const monitorCfg = JSON.stringify({
    defaultGain: MIC_MONITOR_DEFAULT_GAIN,
    gate: MIC_MONITOR_GATE,
    shiftHz: MIC_MONITOR_ANTIHOWL_SHIFT_HZ,
  });
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  var MONITOR = ${monitorCfg};
  var METER_MS = 50;
  function post(obj) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }
  var ctx, stream, gainNode, shifter, analyser, buf, spec, active = false, meterId = null;
  var userGain = MONITOR.defaultGain;
  var gatedOpen = false;
  var holdUntil = 0;
  var noiseFloor = 0.008;
  var howlCount = 0;
  var howlDuckUntil = 0;

  function makeShifter(ac, shiftHz) {
    var proc;
    try {
      proc = ac.createScriptProcessor(512, 1, 1);
    } catch (_) {
      return null;
    }
    var hist = new Float32Array(64);
    var hi = 0;
    var phase = 0;
    var dPhase = 2 * Math.PI * shiftHz / ac.sampleRate;
    var h = new Float32Array(31);
    for (var n = 0; n < 31; n++) {
      var k = n - 15;
      if (k !== 0 && (k % 2)) h[n] = 2 / (k * Math.PI);
    }
    proc.onaudioprocess = function(ev) {
      var inn = ev.inputBuffer.getChannelData(0);
      var out = ev.outputBuffer.getChannelData(0);
      for (var i = 0; i < inn.length; i++) {
        hist[hi & 63] = inn[i];
        var im = 0;
        for (var t = 0; t < 31; t++) im += h[t] * hist[(hi - t) & 63];
        var re = hist[(hi - 15) & 63];
        out[i] = re * Math.cos(phase) - im * Math.sin(phase);
        phase += dPhase;
        if (phase > 6.283185307179586) phase -= 6.283185307179586;
        hi++;
      }
    };
    return proc;
  }

  function applyGate(rms) {
    var g = MONITOR.gate;
    if (!gatedOpen) {
      noiseFloor = noiseFloor * 0.9 + rms * 0.1;
    } else {
      noiseFloor = noiseFloor * 0.997 + Math.min(rms, 0.05) * 0.003;
    }
    var openTh = Math.max(g.open, noiseFloor * g.openMul + g.openBias);
    var closeTh = Math.max(g.close, noiseFloor * g.closeMul + g.closeBias);
    var nowMs = Date.now();
    if (rms >= openTh) {
      gatedOpen = true;
      holdUntil = nowMs + g.holdMs;
    } else if (gatedOpen && rms < closeTh && nowMs > holdUntil) {
      gatedOpen = false;
    }
    if (spec && analyser) {
      analyser.getFloatFrequencyData(spec);
      var maxV = -200, sum = 0, n = spec.length;
      for (var i = 2; i < n; i++) {
        sum += spec[i];
        if (spec[i] > maxV) maxV = spec[i];
      }
      var mean = sum / n;
      if (gatedOpen && maxV - mean > 16) howlCount++;
      else howlCount = Math.max(0, howlCount - 1);
      if (howlCount >= 5) {
        howlDuckUntil = nowMs + 800;
        howlCount = 0;
      }
    }
    if (!gainNode) return;
    var duck = nowMs < howlDuckUntil ? 0.1 : 1;
    var target = gatedOpen ? userGain * duck : 0;
    var cur = gainNode.gain.value;
    var mix = gatedOpen ? 0.5 : 0.22;
    gainNode.gain.value = cur + (target - cur) * mix;
  }

  function meterLoop() {
    if (!active || !analyser) return;
    analyser.getFloatTimeDomainData(buf);
    var rms = 0;
    for (var i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    applyGate(rms);
    post({ type: 'signal', signal: Math.min(1, rms * 10), sourceMode: 'monitor' });
    meterId = setTimeout(meterLoop, METER_MS);
  }

  async function startMonitor() {
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            channelCount: { ideal: 1 },
            googEchoCancellation: true,
            googNoiseSuppression: true,
            googAutoGainControl: false,
          },
          video: false
        });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            channelCount: { ideal: 1 },
          },
          video: false
        });
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0;
      buf = new Float32Array(analyser.fftSize);
      spec = new Float32Array(analyser.frequencyBinCount);
      var src = ctx.createMediaStreamSource(stream);
      src.connect(gainNode);
      shifter = makeShifter(ctx, MONITOR.shiftHz || 6);
      if (shifter) {
        gainNode.connect(shifter);
        shifter.connect(ctx.destination);
      } else {
        gainNode.connect(ctx.destination);
      }
      src.connect(analyser);
      if (ctx.state === 'suspended') await ctx.resume();
      active = true;
      post({ type: 'ready', sourceMode: 'monitor' });
      meterLoop();
    } catch (e) {
      post({ type: 'error', message: e.message || String(e), sourceMode: 'monitor' });
    }
  }

  window.stopTuner = function() {
    active = false;
    if (meterId) clearTimeout(meterId);
    try {
      if (stream) stream.getTracks().forEach(function(t) { t.stop(); });
    } catch (_) {}
    stream = null;
    try {
      if (shifter) shifter.disconnect();
    } catch (_) {}
    shifter = null;
    if (ctx) ctx.close();
    ctx = null;
  };

  document.addEventListener('message', function(e) {
    if (e.data === 'stop') window.stopTuner();
    try {
      var msg = typeof e.data === 'string' ? JSON.parse(e.data) : null;
      if (msg && msg.type === 'gain') {
        userGain = Math.max(0, Math.min(2, msg.value));
        if (gatedOpen && gainNode) gainNode.gain.value = userGain;
      }
    } catch (_) {}
  });

  startMonitor();
})();
</script>
</body>
</html>`;
};

const buildHTML = (mode: 'tuner' | 'melody', range: { minHz: number; maxHz: number }) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  var ENGINE = ${JSON.stringify({ ...ENGINE_PROFILES[mode], ...range })};
  var NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  /** YIN CMNDF with octave-error guard: take the *smallest* lag whose CMNDF dips below a
   *  threshold anchored to the global minimum, then a local-minimum refine + parabolic interp.
   *  Global-min-only locked onto sub-harmonics (octave-down) → note flicker; first-dip-only
   *  chased noise. This combines both: noise-robust AND octave-stable. */
  function detectPitch(buf, sr) {
    var minP = Math.floor(sr / ENGINE.maxHz);
    var maxP = Math.floor(sr / ENGINE.minHz);
    var len  = Math.min(buf.length, 4096);
    if (minP < 2) minP = 2;
    if (len < maxP + 16) return null;

    var win = len - maxP;
    var yin = new Float32Array(maxP);
    yin[0] = 1;
    var rs = 0;
    for (var tau = 1; tau < maxP; tau++) {
      var s = 0;
      for (var i = 0; i < win; i++) {
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

    // Prefer the earliest (highest-freq) local minimum within tolerance of the deepest dip —
    // this is the true fundamental, not its octave-down sub-harmonic.
    var thresh = Math.min(ENGINE.maxYin, bestY + 0.08);
    var chosen = bestTau;
    for (var k = minP + 1; k < maxP - 1; k++) {
      if (yin[k] < thresh && yin[k] <= yin[k - 1] && yin[k] <= yin[k + 1]) {
        chosen = k;
        break;
      }
    }

    var bt = chosen;
    if (chosen > 0 && chosen < maxP - 1) {
      var s0 = yin[chosen - 1], s1 = yin[chosen], s2 = yin[chosen + 1];
      var dv = s0 - 2 * s1 + s2;
      if (Math.abs(dv) > 1e-10) bt = chosen + (s0 - s2) / (2 * dv);
    }
    var f = sr / bt;
    // Humming often locks onto H2. If the octave-down lag is also a YIN dip, take it.
    if (ENGINE.name === 'melody' && f > 520) {
      var tauOct = Math.round(bt * 2);
      if (tauOct < maxP && yin[tauOct] <= ENGINE.maxYin + 0.06) {
        f = sr / tauOct;
        chosen = tauOct;
      }
    }
    if (f < ENGINE.minHz || f > ENGINE.maxHz) return null;
    return { freq: f, yin: yin[chosen] };
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

  function engineT() {
    return ctx ? Math.round(ctx.currentTime * 1000) : Date.now();
  }

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
        var fRaw = det.freq;
        var fUse = ENGINE.name === 'melody' ? stabilizeFreq(fRaw) : fRaw;
        var rawN = freqToNote(fRaw);
        var n = freqToNote(fUse);
        post({
          type: 'pitch',
          t: engineT(),
          frequency: fUse,
          rawFrequency: fRaw,
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
        post({ type: 'signal', t: engineT(), signal: signal });
      }
    } else {
      freqRing.length = 0;
      lastStableF = null;
      post({ type: 'silent', t: engineT(), signal: 0 });
    }
    rafId = setTimeout(loop, ENGINE.frameMs);
  }

  async function startTuner() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      ctx      = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = ENGINE.fftSize || 4096;
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

const TunerEngine = forwardRef<WebView, Props>(({ onMessage, mode = 'tuner', minHz, maxHz }, ref) => {
  const range = useMemo(() => {
    if (mode === 'monitor') return { minHz: 0, maxHz: 0 };
    const base = ENGINE_PROFILES[mode];
    if (mode !== 'tuner') return { minHz: base.minHz, maxHz: base.maxHz };
    return {
      minHz: minHz != null ? Math.max(28, minHz) : base.minHz,
      maxHz: maxHz != null ? Math.min(2200, maxHz) : base.maxHz,
    };
  }, [mode, minHz, maxHz]);
  const html = useMemo(
    () => (mode === 'monitor' ? buildMonitorHTML() : buildHTML(mode, range)),
    [mode, range.minHz, range.maxHz],
  );

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
