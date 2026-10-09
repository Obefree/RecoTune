/**
 * Playable piano + mic detector (hit / miss vs the pressed key), not a tuner.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import {
  Audio, playReferenceTone, stopReferenceTone, startMetronomeClick, stopMetronomeClick,
  preloadReferenceTones,
} from '../utils/audio';
import TunerEngine, { type PitchMessage } from '../components/TunerEngine';
import MiniCentsStrip from '../components/MiniCentsStrip';
import MetronomeBar from '../components/MetronomeBar';
import type { HistoryPoint } from '../components/FrequencyChart';
import {
  centsFromTargetHz, centsToColor, frequencyToNote, midiToHz, NOTE_NAMES,
} from '../utils/noteUtils';
import { TunerPitchDisplay, TUNER_DISPLAY_UI_MS } from '../utils/tunerDisplay';
import { clampMetronomeBpm, METRONOME_BPM_DEFAULT } from '../utils/metronomeClick';
import { useLocale } from '../context/LocaleContext';

const MIDI_MIN = 36;
const PITCH_MAX = 80;

type Timbre = 'piano' | 'sine';

const PianoKey = React.memo(function PianoKey({
  hz, label, midi, sharp, hit, width, height, left, onPlay, onStop,
}: {
  hz: number;
  label: string;
  midi: number;
  sharp: boolean;
  hit: boolean;
  width: number;
  height: number;
  left?: number;
  onPlay: (hz: number, label: string) => void;
  onStop: () => void;
}) {
  const [on, setOn] = useState(false);
  const showOct = NOTE_NAMES[midi % 12] === 'C';
  return (
    <Pressable
      onPressIn={() => {
        setOn(true);
        onPlay(hz, label);
      }}
      onPressOut={() => {
        setOn(false);
        onStop();
      }}
      pointerEvents="box-only"
      style={[
        sharp ? styles.black : styles.white,
        hit && !on && (sharp ? styles.blackHeard : styles.whiteHeard),
        on && (sharp ? styles.blackOn : styles.whiteOn),
        sharp
          ? { width, height, left: left ?? 0 }
          : width > 0
            ? { width, height }
            : { flex: 1, height },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {sharp ? null : (
        <Text style={[styles.whiteLbl, (on || hit) && styles.lblOn]}>
          {showOct ? label : NOTE_NAMES[midi % 12]}
        </Text>
      )}
    </Pressable>
  );
});

export default function PianoScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { height: windowH } = useWindowDimensions();
  const [octaves, setOctaves] = useState<1 | 2>(2);
  const [startMidi, setStartMidi] = useState(48);
  const [timbre, setTimbre] = useState<Timbre>('piano');
  const timbreRef = useRef<Timbre>('piano');
  timbreRef.current = timbre;
  const [sounding, setSounding] = useState<{ hz: number; label: string } | null>(null);
  const [kbW, setKbW] = useState(0);
  const [clickOn, setClickOn] = useState(false);
  const [clickBpm, setClickBpm] = useState(METRONOME_BPM_DEFAULT);
  const [isActive, setIsActive] = useState(false);
  const [heard, setHeard] = useState<{ name: string; octave: number; cents: number; hz: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const webViewRef = useRef<WebView>(null);
  const displayRef = useRef(new TunerPitchDisplay());
  const lastUiMs = useRef(0);
  const targetHzRef = useRef<number | null>(null);
  const span = octaves * 12;
  const maxStart = octaves === 1 ? 84 : 72;

  const keys = useMemo(() => {
    const out: { midi: number; hz: number; label: string; sharp: boolean }[] = [];
    for (let midi = startMidi; midi < startMidi + span; midi++) {
      const pc = midi % 12;
      out.push({
        midi,
        hz: midiToHz(midi),
        label: `${NOTE_NAMES[pc]}${Math.floor(midi / 12) - 1}`,
        sharp: pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10,
      });
    }
    return out;
  }, [startMidi, span]);

  const detectRange = useMemo(() => {
    const lo = midiToHz(startMidi);
    const hi = midiToHz(startMidi + span - 1);
    return { minHz: Math.max(40, lo * 0.75), maxHz: Math.min(1400, hi * 2.2) };
  }, [startMidi, span]);

  const whites = keys.filter(k => !k.sharp);
  const blacks = keys.filter(k => k.sharp);
  const whiteW = kbW > 0 ? kbW / whites.length : 0;
  const blackW = whiteW * 0.62;
  const whiteH = Math.max(octaves === 1 ? 188 : 156, Math.min(octaves === 1 ? 260 : 210, Math.round(windowH * (octaves === 1 ? 0.36 : 0.3))));
  const blackH = Math.round(whiteH * 0.62);

  const stopListen = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.stopTuner && window.stopTuner(); true;');
    displayRef.current.reset();
    lastUiMs.current = 0;
    setIsActive(false);
    setHeard(null);
  }, []);

  useFocusEffect(useCallback(() => () => {
    stopListen();
    stopMetronomeClick();
    void stopReferenceTone();
    setClickOn(false);
    setSounding(null);
    targetHzRef.current = null;
  }, [stopListen]));

  const handleMessage = useCallback((msg: PitchMessage) => {
    if (msg.type === 'ready') {
      setError(null);
      return;
    }
    if (msg.type === 'error') {
      setError(msg.message ?? t('micError'));
      setIsActive(false);
      return;
    }
    if (msg.type === 'silent' || msg.type === 'signal') {
      displayRef.current.reset();
      lastUiMs.current = 0;
      setHeard(null);
      return;
    }
    if (msg.type !== 'pitch' || !msg.frequency) return;
    const raw = msg.rawFrequency ?? msg.frequency;
    const ts = Date.now();
    const disp = displayRef.current.process(raw, ts, msg.yinConfidence);
    if (!disp) return;
    if (ts - lastUiMs.current < TUNER_DISPLAY_UI_MS) return;
    lastUiMs.current = ts;
    const targetHz = targetHzRef.current;
    const cents = targetHz
      ? centsFromTargetHz(disp.frequency, targetHz)
      : frequencyToNote(disp.frequency).cents;
    const nn = frequencyToNote(disp.frequency);
    setHeard({ name: nn.name, octave: nn.octave, cents, hz: disp.frequency });
    setHistory(prev => {
      const pt: HistoryPoint = {
        cents,
        freq: disp.frequency,
        midi: 69 + 12 * Math.log2(disp.frequency / 440),
        note: nn.name,
        octave: nn.octave,
        ts,
        voiced: true,
      };
      const next = [...prev, pt];
      return next.length > PITCH_MAX ? next.slice(-PITCH_MAX) : next;
    });
  }, [t]);

  const startListen = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { setError(t('micDenied')); return; }
    setError(null);
    setHistory([]);
    displayRef.current.reset();
    lastUiMs.current = 0;
    setIsActive(true);
  }, [t]);

  const onKeyIn = useCallback((hz: number, label: string) => {
    targetHzRef.current = hz;
    void playReferenceTone(hz, { piano: timbreRef.current === 'piano', loop: true });
    requestAnimationFrame(() => setSounding({ hz, label }));
  }, []);

  const onKeyOut = useCallback(() => {
    void stopReferenceTone();
  }, []);

  const toggleClick = useCallback(() => {
    if (clickOn) {
      stopMetronomeClick();
      setClickOn(false);
      return;
    }
    void startMetronomeClick(clickBpm).then(ok => setClickOn(!!ok)).catch(() => setClickOn(false));
  }, [clickOn, clickBpm]);

  const bumpClickBpm = useCallback((delta: number) => {
    const next = clampMetronomeBpm(clickBpm + delta);
    setClickBpm(next);
    if (clickOn) void startMetronomeClick(next);
  }, [clickBpm, clickOn]);

  const setOct = useCallback((n: 1 | 2) => {
    setOctaves(n);
    setStartMidi(m => Math.min(m, n === 1 ? 84 : 72));
  }, []);

  useEffect(() => {
    void preloadReferenceTones(keys.map(k => k.hz), { piano: timbre === 'piano', loop: true });
  }, [keys, timbre]);

  const displayCents = heard?.cents ?? 0;
  const tuneColor = heard && isActive ? centsToColor(displayCents) : '#3a3a4a';
  const inTune = heard && isActive && Math.abs(displayCents) <= 5;
  const loName = keys[0]?.label ?? '';
  const hiName = keys[keys.length - 1]?.label ?? '';
  const heardMidi = heard ? 69 + 12 * Math.log2(heard.hz / 440) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      {isActive && (
        <TunerEngine
          ref={webViewRef}
          onMessage={handleMessage}
          active={isActive}
          mode="tuner"
          minHz={detectRange.minHz}
          maxHz={detectRange.maxHz}
        />
      )}

      <View style={styles.topRow}>
        <Text style={styles.title}>{t('tabKeys')}</Text>
        <MetronomeBar
          bpm={clickBpm}
          running={clickOn}
          onToggle={toggleClick}
          onBump={bumpClickBpm}
          label={t('metronomeLabel')}
        />
      </View>

      <View style={styles.chipRow}>
        <Pressable onPress={() => setTimbre('piano')} style={[styles.chip, timbre === 'piano' && styles.chipOn]}>
          <Text style={[styles.chipText, timbre === 'piano' && styles.chipTextOn]}>{t('pianoTimbrePiano')}</Text>
        </Pressable>
        <Pressable onPress={() => setTimbre('sine')} style={[styles.chip, timbre === 'sine' && styles.chipOn]}>
          <Text style={[styles.chipText, timbre === 'sine' && styles.chipTextOn]}>{t('pianoTimbreSine')}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setOct(1)} style={[styles.chip, octaves === 1 && styles.chipOn]}>
          <Text style={[styles.chipText, octaves === 1 && styles.chipTextOn]}>{t('pianoOct1')}</Text>
        </Pressable>
        <Pressable onPress={() => setOct(2)} style={[styles.chip, octaves === 2 && styles.chipOn]}>
          <Text style={[styles.chipText, octaves === 2 && styles.chipTextOn]}>{t('pianoOct2')}</Text>
        </Pressable>
      </View>

      <View style={styles.detectCard}>
        <View style={styles.detectRow}>
          <View style={styles.detectCol}>
            <Text style={styles.detectLbl}>{t('noteLabel')}</Text>
            <Text style={[styles.detectNote, { color: heard && isActive ? tuneColor : '#2a2a3a' }]}>
              {heard && isActive ? `${heard.name}${heard.octave}` : '–'}
            </Text>
          </View>
          <View style={styles.detectMid}>
            <Text style={[styles.centsVal, { color: heard && isActive ? tuneColor : '#2a2a3a' }]}>
              {heard && isActive ? `${displayCents > 0 ? '+' : ''}${Math.round(displayCents)}` : '0'}
              <Text style={styles.centsSuffix}> ¢</Text>
            </Text>
            {heard && isActive
              ? inTune
                ? <Text style={styles.hit}>{t('inTune')}</Text>
                : <Text style={styles.miss}>{displayCents > 0 ? t('above') : t('below')}</Text>
              : <Text style={styles.wait}>{isActive ? t('waiting') : sounding ? sounding.label : '–'}</Text>}
          </View>
          <TouchableOpacity
            onPress={isActive ? stopListen : startListen}
            style={[styles.micBtn, isActive && styles.micBtnOn]}
            accessibilityLabel={isActive ? 'STOP' : 'START'}
          >
            <Ionicons name={isActive ? 'mic' : 'mic-outline'} size={20} color={isActive ? '#0a0a0f' : '#e0e0e0'} />
          </TouchableOpacity>
        </View>
        {sounding ? <Text style={styles.targetHint}>{t('pianoTarget')}: {sounding.label}</Text> : null}
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <MiniCentsStrip history={history} />
      </View>

      <View style={styles.octRow}>
        <Pressable
          onPress={() => setStartMidi(m => Math.max(MIDI_MIN, m - 12))}
          style={[styles.octBtn, startMidi <= MIDI_MIN && styles.octBtnOff]}
          disabled={startMidi <= MIDI_MIN}
        >
          <Text style={styles.octBtnText}>−8va</Text>
        </Pressable>
        <Text style={styles.range}>{loName} → {hiName}</Text>
        <Pressable
          onPress={() => setStartMidi(m => Math.min(maxStart, m + 12))}
          style={[styles.octBtn, startMidi >= maxStart && styles.octBtnOff]}
          disabled={startMidi >= maxStart}
        >
          <Text style={styles.octBtnText}>+8va</Text>
        </Pressable>
      </View>

      <View style={styles.spacer} />

      <View
        style={[styles.kbWrap, { height: whiteH, marginBottom: 10 }]}
        onLayout={e => setKbW(e.nativeEvent.layout.width)}
      >
        <View style={[styles.whiteRow, { height: whiteH }]}>
          {whites.map(k => (
            <PianoKey
              key={k.midi}
              hz={k.hz}
              label={k.label}
              midi={k.midi}
              sharp={false}
              hit={heardMidi != null && Math.abs(heardMidi - k.midi) < 0.45}
              width={whiteW}
              height={whiteH}
              onPlay={onKeyIn}
              onStop={onKeyOut}
            />
          ))}
        </View>
        {kbW > 0
          ? blacks.map(k => (
            <PianoKey
              key={k.midi}
              hz={k.hz}
              label={k.label}
              midi={k.midi}
              sharp
              hit={heardMidi != null && Math.abs(heardMidi - k.midi) < 0.45}
              width={blackW}
              height={blackH}
              left={whites.filter(wk => wk.midi < k.midi).length * whiteW - blackW / 2}
              onPlay={onKeyIn}
              onStop={onKeyOut}
            />
          ))
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f', paddingHorizontal: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: '#888', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '700' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#16161e', borderWidth: 1, borderColor: '#2a2a38' },
  chipOn: { borderColor: '#00e676', backgroundColor: '#00e67618' },
  chipText: { color: '#777', fontSize: 11, fontWeight: '800' },
  chipTextOn: { color: '#00e676' },
  detectCard: { backgroundColor: '#111118', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#1e1e28', marginBottom: 8 },
  detectRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detectCol: { width: 72 },
  detectLbl: { color: '#444', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  detectNote: { fontSize: 28, fontWeight: '800', lineHeight: 32, marginTop: 2 },
  detectMid: { flex: 1, alignItems: 'center' },
  centsVal: { fontSize: 26, fontWeight: '700' },
  centsSuffix: { fontSize: 14, fontWeight: '400' },
  hit: { color: '#00e676', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  miss: { color: '#ffeb3b', fontSize: 11, fontWeight: '700', marginTop: 2 },
  wait: { color: '#2a2a3a', fontSize: 13, marginTop: 2 },
  targetHint: { color: '#555', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  err: { color: '#ff5252', fontSize: 11, marginBottom: 4 },
  micBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1e1e28', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a38' },
  micBtnOn: { backgroundColor: '#00e676', borderColor: '#00e676' },
  octRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  octBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#16161e', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a38' },
  octBtnOff: { opacity: 0.35 },
  octBtnText: { color: '#bbb', fontSize: 12, fontWeight: '800' },
  range: { color: '#555', fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  spacer: { flex: 1, minHeight: 6 },
  kbWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#2a2a32' },
  whiteRow: { flexDirection: 'row' },
  white: {
    backgroundColor: '#eceae3',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#c8c4b8',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 12,
  },
  whiteOn: { backgroundColor: '#b8f5d0' },
  whiteHeard: { backgroundColor: '#fff3bf' },
  whiteLbl: { color: '#6a665c', fontSize: 12, fontWeight: '800' },
  lblOn: { color: '#0a5c32' },
  black: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#121218',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a32',
    zIndex: 2,
  },
  blackOn: { backgroundColor: '#00e676' },
  blackHeard: { backgroundColor: '#c9a227' },
});
