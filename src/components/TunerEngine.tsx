/**
 * Hidden WebView that runs pitch detection using the Web Audio API.
 * Posts messages back to React Native with pitch data.
 */
import React, { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

export interface PitchMessage {
  type: 'ready' | 'pitch' | 'signal' | 'silent' | 'error';
  frequency?: number;
  note?: string;
  octave?: number;
  cents?: number;
  signal?: number;
  message?: string;
}

interface Props {
  onMessage: (msg: PitchMessage) => void;
  active: boolean;
}

const HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  var NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function detectPitch(buf, sr) {
    var minP = Math.floor(sr / 1400);
    var maxP = Math.floor(sr / 60);
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
    for (var tau = minP; tau < maxP; tau++) {
      if (yin[tau] < 0.15) {
        var bt = tau;
        if (tau > 0 && tau < maxP - 1) {
          var s0 = yin[tau-1], s1 = yin[tau], s2 = yin[tau+1];
          var dv = s0 - 2*s1 + s2;
          if (Math.abs(dv) > 1e-10) bt = tau + (s0 - s2) / (2 * dv);
        }
        var f = sr / bt;
        return (f >= 60 && f <= 1400) ? f : null;
      }
    }
    return null;
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

    if (rms > 0.008) {
      var freq = detectPitch(buf, ctx.sampleRate);
      if (freq) {
        var n = freqToNote(freq);
        post({ type: 'pitch', frequency: freq, note: n.name, octave: n.octave, cents: n.cents, signal: signal });
      } else {
        post({ type: 'signal', signal: signal });
      }
    } else {
      post({ type: 'silent', signal: 0 });
    }
    rafId = setTimeout(loop, 80);
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

const TunerEngine = forwardRef<WebView, Props>(({ onMessage }, ref) => {
  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg: PitchMessage = JSON.parse(e.nativeEvent.data);
      onMessage(msg);
    } catch {}
  };

  return (
    <WebView
      ref={ref}
      source={{ html: HTML, baseUrl: 'https://localhost' }}
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
  },
});
