/**
 * Hidden WebView — synthesized melody playback via Web Audio API.
 */
import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import type { MelodyPlaybackPayload } from '../utils/melodyPlayback';

export type MelodyInstrument = 'piano' | 'sine';

export interface MelodyPlayerMessage {
  type: 'ready' | 'done' | 'error' | 'progress' | 'noteStart' | 'rendered';
  message?: string;
  elapsedMs?: number;
  noteIndex?: number;
  index?: number;
  startMs?: number;
  b64?: string;
  durationMs?: number;
}

export interface MelodyPlayerHandle {
  playMelody(payload: MelodyPlaybackPayload, instrument: MelodyInstrument): void;
  stopMelody(): void;
  renderMelodyWav(payload: MelodyPlaybackPayload): Promise<{ b64: string; durationMs: number }>;
}

interface Props {
  onMessage?: (msg: MelodyPlayerMessage) => void;
}

const HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  var ctx = null;
  var nodes = [];
  var doneTimer = null;
  var progressTimer = null;
  var noteStartTimers = [];
  var playbackNotes = [];
  var wallStartMs = 0;
  var anchorLeadMs = 60;

  var MIN_DUR_SEC = 0.04;
  var MAX_DUR_SEC = 4.0;
  var A4_MIDI = 69;
  var A4_HZ = 440;

  function post(obj) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  }

  function midiToFreq(midi) {
    return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
  }

  function clampDurSec(ms) {
    var sec = (ms || 400) / 1000;
    return Math.min(MAX_DUR_SEC, Math.max(MIN_DUR_SEC, sec));
  }

  function scheduleTone(start, freq, durSec, instrument, peakMul) {
    if (!ctx) return;
    peakMul = peakMul == null ? 1 : peakMul;

    var attack = 0.008;
    var decay = 0.07;
    var sustainRatio = instrument === 'sine' ? 0.65 : 0.52;
    var release = instrument === 'piano' ? 0.1 : 0.14;
    var legatoRatio = instrument === 'piano' ? 0.92 : 1.0;
    var peak = (instrument === 'sine' ? 0.2 : 0.26) * peakMul;
    var voicedDur = durSec * legatoRatio;
    var sustainAt = start + attack + decay;
    var releaseAt = start + voicedDur;
    var releaseStart = Math.max(sustainAt + 0.01, releaseAt - release);
    var stopAt = releaseAt + 0.05;

    function applyAdsr(g) {
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack);
      g.gain.exponentialRampToValueAtTime(Math.max(peak * sustainRatio, 0.0002), sustainAt);
      g.gain.setValueAtTime(Math.max(peak * sustainRatio, 0.0002), releaseStart);
      g.gain.exponentialRampToValueAtTime(0.0001, releaseAt);
    }

    if (instrument === 'sine') {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var g = ctx.createGain();
      applyAdsr(g);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(stopAt);
      nodes.push(osc, g);
      return;
    }

    var freqs = [freq, freq * 2, freq * 3];
    var gains = [1, 0.32, 0.1];
    for (var i = 0; i < freqs.length; i++) {
      var o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = freqs[i];
      var gi = ctx.createGain();
      var p = peak * gains[i];
      gi.gain.setValueAtTime(0.0001, start);
      gi.gain.exponentialRampToValueAtTime(Math.max(p, 0.0002), start + attack);
      gi.gain.exponentialRampToValueAtTime(Math.max(p * sustainRatio, 0.0002), sustainAt);
      gi.gain.setValueAtTime(Math.max(p * sustainRatio, 0.0002), releaseStart);
      gi.gain.exponentialRampToValueAtTime(0.0001, releaseAt);
      o.connect(gi);
      gi.connect(ctx.destination);
      o.start(start);
      o.stop(stopAt);
      nodes.push(o, gi);
    }
  }

  function scheduleChordBlock(startSec, durSec, midiNotes) {
    if (!ctx || !midiNotes || !midiNotes.length) return;
    var dur = Math.max(MIN_DUR_SEC, durSec);
    var chordGain = 0.12;
    var attack = 0.04;
    var release = 0.12;
    var releaseAt = startSec + dur;

    for (var k = 0; k < midiNotes.length; k++) {
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToFreq(midiNotes[k]);
      var g = ctx.createGain();
      var peak = 0.05 * chordGain;
      g.gain.setValueAtTime(0.0001, startSec);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startSec + attack);
      g.gain.setValueAtTime(peak * 0.75, Math.max(startSec + attack, releaseAt - release));
      g.gain.exponentialRampToValueAtTime(0.0001, releaseAt);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(startSec);
      osc.stop(releaseAt + 0.05);
      nodes.push(osc, g);
    }
  }

  function clearProgressTimers() {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    for (var t = 0; t < noteStartTimers.length; t++) { clearTimeout(noteStartTimers[t]); }
    noteStartTimers = [];
    playbackNotes = [];
  }

  function findNoteIndex(elapsedMs) {
    var idx = 0;
    for (var j = playbackNotes.length - 1; j >= 0; j--) {
      if ((playbackNotes[j].startMs || 0) <= elapsedMs) { idx = j; break; }
    }
    return idx;
  }

  function scheduleProgress(totalMs) {
    clearProgressTimers();
    wallStartMs = Date.now();
    for (var j = 0; j < playbackNotes.length; j++) {
      (function(i, startMs) {
        noteStartTimers.push(setTimeout(function() {
          post({ type: 'noteStart', index: i, startMs: startMs });
          post({ type: 'progress', elapsedMs: startMs, noteIndex: i });
        }, anchorLeadMs + startMs));
      })(j, playbackNotes[j].startMs || 0);
    }
    progressTimer = setInterval(function() {
      var elapsed = Date.now() - wallStartMs - anchorLeadMs;
      if (elapsed < 0) return;
      if (elapsed > totalMs + 80) return;
      post({ type: 'progress', elapsedMs: elapsed, noteIndex: findNoteIndex(elapsed) });
    }, 48);
  }

  window.stopMelody = function() {
    clearProgressTimers();
    if (doneTimer) { clearTimeout(doneTimer); doneTimer = null; }
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].stop && nodes[i].stop(0); nodes[i].disconnect && nodes[i].disconnect(); } catch(e) {}
    }
    nodes = [];
    if (ctx) {
      try { ctx.close(); } catch(e) {}
      ctx = null;
    }
  };

  window.playMelody = function(payloadJson, instrument) {
    window.stopMelody();

    var payload;
    try { payload = JSON.parse(payloadJson); } catch(e) {
      post({ type: 'error', message: 'parse' });
      return;
    }

    var notes = payload.notes || payload;
    var chords = payload.chords || [];
    if (!Array.isArray(notes)) notes = [];
    if (!notes.length && !chords.length) {
      post({ type: 'done' });
      return;
    }

    instrument = instrument === 'sine' ? 'sine' : 'piano';
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    var anchor = ctx.currentTime + anchorLeadMs / 1000;
    var totalMs = 0;
    playbackNotes = notes;

    for (var j = 0; j < notes.length; j++) {
      var n = notes[j];
      var startMs = n.startMs || 0;
      var durMs = n.durationMs || 400;
      var startSec = anchor + startMs / 1000;
      var durSec = clampDurSec(durMs);
      scheduleTone(startSec, midiToFreq(n.midi), durSec, instrument, 1);
      totalMs = Math.max(totalMs, startMs + durMs);
    }

    for (var c = 0; c < chords.length; c++) {
      var ch = chords[c];
      var cStartMs = ch.startMs || 0;
      var cDurMs = ch.durationMs || 400;
      var cStart = anchor + cStartMs / 1000;
      var cDur = clampDurSec(cDurMs);
      scheduleChordBlock(cStart, cDur, ch.midiNotes || []);
      totalMs = Math.max(totalMs, cStartMs + cDurMs);
    }

    post({ type: 'ready' });
    scheduleProgress(totalMs);
    doneTimer = setTimeout(function() {
      post({ type: 'progress', elapsedMs: totalMs, noteIndex: Math.max(0, notes.length - 1) });
      post({ type: 'done' });
      window.stopMelody();
    }, anchorLeadMs + totalMs + 220);
  };

  function encodeWAV(samples, sr, bits) {
    var mono = true;
    var nc = 1;
    var bps = bits / 8;
    var n = samples.length;
    var dataLen = n * nc * bps;
    var buf = new ArrayBuffer(44 + dataLen);
    var v = new DataView(buf);
    var wr = function(off, str) {
      for (var i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
    };
    wr(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); wr(8, 'WAVE');
    wr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, nc, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * nc * bps, true);
    v.setUint16(32, nc * bps, true); v.setUint16(34, bits, true);
    wr(36, 'data'); v.setUint32(40, dataLen, true);
    var off = 44;
    var clamp = function(x) { return Math.max(-1, Math.min(1, x)); };
    for (var i = 0; i < n; i++) {
      v.setInt16(off, clamp(samples[i]) * 32767, true);
      off += 2;
    }
    return buf;
  }

  function ab64(ab) {
    var u8 = new Uint8Array(ab);
    var s = '';
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }

  window.renderMelodyWav = function(payloadJson) {
    window.stopMelody();
    var payload;
    try { payload = JSON.parse(payloadJson); } catch(e) {
      post({ type: 'error', message: 'parse' });
      return;
    }
    var notes = payload.notes || [];
    if (!notes.length) {
      post({ type: 'error', message: 'empty' });
      return;
    }
    var totalMs = 400;
    for (var j = 0; j < notes.length; j++) {
      totalMs = Math.max(totalMs, (notes[j].startMs || 0) + (notes[j].durationMs || 400));
    }
    var sr = 44100;
    var len = Math.ceil((totalMs + 300) / 1000 * sr);
    var off = new OfflineAudioContext(1, len, sr);
    var anchor = 0.05;
    for (var k = 0; k < notes.length; k++) {
      var n = notes[k];
      var startSec = anchor + (n.startMs || 0) / 1000;
      var durSec = clampDurSec(n.durationMs || 400);
      scheduleTone(startSec, midiToFreq(n.midi), durSec, 'piano', 0.85);
    }
    off.startRendering().then(function(buf) {
      var wav = encodeWAV(buf.getChannelData(0), sr, 16);
      post({ type: 'rendered', b64: ab64(wav), durationMs: totalMs });
    }).catch(function(e) {
      post({ type: 'error', message: String(e) });
    });
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;

const RENDER_TIMEOUT_MS = 60_000;

const MelodyPlayerEngine = forwardRef<MelodyPlayerHandle, Props>(({ onMessage }, ref) => {
  const webRef = useRef<WebView>(null);
  const renderPendingRef = useRef<{
    resolve: (v: { b64: string; durationMs: number }) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const stopMelody = useCallback(() => {
    webRef.current?.injectJavaScript('window.stopMelody && window.stopMelody(); true;');
  }, []);

  const playMelody = useCallback((payload: MelodyPlaybackPayload, instrument: MelodyInstrument) => {
    const json = JSON.stringify(payload);
    const inst = instrument === 'sine' ? 'sine' : 'piano';
    webRef.current?.injectJavaScript(
      `window.playMelody && window.playMelody(${JSON.stringify(json)}, ${JSON.stringify(inst)}); true;`,
    );
  }, []);

  const renderMelodyWav = useCallback((payload: MelodyPlaybackPayload) => {
    if (!payload.notes.length) {
      return Promise.reject(new Error('Нет нот для экспорта в Studio'));
    }
    return new Promise<{ b64: string; durationMs: number }>((resolve, reject) => {
      if (renderPendingRef.current) {
        reject(new Error('Рендер уже выполняется'));
        return;
      }
      const timer = setTimeout(() => {
        renderPendingRef.current = null;
        reject(new Error('Таймаут рендера мелодии'));
      }, RENDER_TIMEOUT_MS);
      renderPendingRef.current = {
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
      const json = JSON.stringify(payload);
      webRef.current?.injectJavaScript(
        `window.renderMelodyWav && window.renderMelodyWav(${JSON.stringify(json)}); true;`,
      );
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({ playMelody, stopMelody, renderMelodyWav }),
    [playMelody, stopMelody, renderMelodyWav],
  );

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg: MelodyPlayerMessage = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'rendered' && msg.b64 && renderPendingRef.current) {
        const p = renderPendingRef.current;
        renderPendingRef.current = null;
        p.resolve({
          b64: msg.b64,
          durationMs: msg.durationMs ?? 0,
        });
        return;
      }
      if (msg.type === 'error' && renderPendingRef.current) {
        const p = renderPendingRef.current;
        renderPendingRef.current = null;
        p.reject(new Error(msg.message || 'Ошибка рендера'));
        return;
      }
      onMessage?.(msg);
    } catch {
      /* ignore */
    }
  };

  return (
    <WebView
      ref={webRef}
      source={{ html: HTML, baseUrl: 'https://localhost' }}
      style={styles.hidden}
      onMessage={handleMessage}
      javaScriptEnabled
      originWhitelist={['*']}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      onError={ev => onMessage?.({ type: 'error', message: ev.nativeEvent.description })}
    />
  );
});

export default MelodyPlayerEngine;

const styles = StyleSheet.create({
  hidden: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
  },
});
