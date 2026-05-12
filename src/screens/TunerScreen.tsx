import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Modal, FlatList, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import WebView from 'react-native-webview';

import TunerEngine, { PitchMessage } from '../components/TunerEngine';
import { centsToColor, frequencyToNote, INSTRUMENTS, TUNINGS, getTuningsForInstrument, type Tuning } from '../utils/noteUtils';
import TunerNeedle from '../components/TunerNeedle';
import FrequencyChart, { HistoryPoint } from '../components/FrequencyChart';
import MiniCentsStrip from '../components/MiniCentsStrip';

const EMA_ALPHA  = 0.28;   // 0=frozen, 1=raw — lower = smoother
const A4_FREQ    = 440;
const A4_MIDI    = 69;

const MAX_HISTORY = 80;
const INSTRUMENT_ICONS: Record<string, string> = { Guitar: '🎸', Ukulele: '🪗', Bass: '🎸' };

interface NoteState { name: string; octave: number; cents: number; frequency: number }

export default function TunerScreen() {
  const insets = useSafeAreaInsets();

  const [isActive, setIsActive]       = useState(false);
  const [note, setNote]               = useState<NoteState | null>(null);
  const [frequency, setFrequency]     = useState<number | null>(null);
  const [signalLevel, setSignalLevel] = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [showGraph, setShowGraph]     = useState(false);
  const [history, setHistory]         = useState<HistoryPoint[]>([]);
  const [instrument, setInstrument]   = useState('Guitar');
  const [tuning, setTuning]           = useState<Tuning>(TUNINGS[0]);
  const [showPicker, setShowPicker]   = useState(false);

  const webViewRef      = useRef<WebView>(null);
  const pulseAnim       = useRef(new Animated.Value(1)).current;
  const signalAnim      = useRef(new Animated.Value(0)).current;
  const pulseLoop       = useRef<Animated.CompositeAnimation | null>(null);
  const smoothedFreqRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      pulseLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ]));
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [isActive]);

  useEffect(() => {
    Animated.timing(signalAnim, { toValue: signalLevel, duration: 80, useNativeDriver: false }).start();
  }, [signalLevel]);

  const handleMessage = useCallback((msg: PitchMessage) => {
    if (msg.type === 'ready') {
      setError(null);
    } else if (msg.type === 'pitch' && msg.frequency && msg.note) {
      // EMA smoothing — reduces jitter on needle and chart
      const raw  = msg.frequency;
      const prev = smoothedFreqRef.current;
      const freq = prev == null ? raw : EMA_ALPHA * raw + (1 - EMA_ALPHA) * prev;
      smoothedFreqRef.current = freq;

      const info = frequencyToNote(freq);
      const midi = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
      const n: NoteState = { name: info.name, octave: info.octave, cents: info.cents, frequency: freq };

      setFrequency(freq);
      setNote(n);
      setSignalLevel(msg.signal ?? 0);
      setHistory(prev => {
        const pt: HistoryPoint = {
          cents: info.cents, freq, midi,
          note: info.name, octave: info.octave, ts: Date.now(),
        };
        const next = [...prev, pt];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    } else if (msg.type === 'signal') {
      smoothedFreqRef.current = null;
      setNote(null); setFrequency(null); setSignalLevel(msg.signal ?? 0);
    } else if (msg.type === 'silent') {
      smoothedFreqRef.current = null;
      setNote(null); setFrequency(null); setSignalLevel(0);
    } else if (msg.type === 'error') {
      setError(msg.message ?? 'Microphone error'); setIsActive(false);
    }
  }, []);

  const start = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { setError('Microphone permission denied'); return; }
    setError(null); setHistory([]); setIsActive(true);
  }, []);

  const stop = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.stopTuner && window.stopTuner(); true;');
    setIsActive(false); setNote(null); setFrequency(null); setSignalLevel(0);
  }, []);

  useFocusEffect(useCallback(() => () => stop(), [stop]));

  const signalWidth = signalAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const tuneColor   = note ? centsToColor(note.cents) : '#3a3a4a';
  const inTune      = note && Math.abs(note.cents) <= 5;

  const closestId = (() => {
    if (!frequency || !note || !isActive) return null;
    const best = tuning.strings.reduce((b, gs) =>
      Math.abs(1200 * Math.log2(frequency / gs.frequency)) <
      Math.abs(1200 * Math.log2(frequency / b.frequency)) ? gs : b,
      tuning.strings[0]
    );
    return Math.abs(1200 * Math.log2(frequency / best.frequency)) < 50 ? best.string : null;
  })();

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      {isActive && <TunerEngine ref={webViewRef} onMessage={handleMessage} active={isActive} />}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.instrumentBtn} activeOpacity={0.8}>
            <Text style={styles.instEmoji}>{INSTRUMENT_ICONS[instrument] ?? '🎵'}</Text>
            <View>
              <Text style={styles.instName}>{instrument}</Text>
              <Text style={styles.instTuning}>{tuning.label}</Text>
            </View>
            <Ionicons name="chevron-down" size={13} color="#555" />
          </TouchableOpacity>

          {/* Toggle: needle ↔ graph */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => setShowGraph(false)}
              style={[styles.viewBtn, !showGraph && styles.viewBtnActive]}
            >
              <Ionicons name="radio-button-on-outline" size={15} color={!showGraph ? '#00e676' : '#555'} />
              <Text style={[styles.viewBtnText, !showGraph && { color: '#00e676' }]}>NEEDLE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowGraph(true)}
              style={[styles.viewBtn, showGraph && styles.viewBtnActive]}
            >
              <Ionicons name="analytics-outline" size={15} color={showGraph ? '#7c4dff' : '#555'} />
              <Text style={[styles.viewBtnText, showGraph && { color: '#7c4dff' }]}>GRAPH</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Main display area (needle OR graph) ── */}
        <View style={styles.mainCard}>
          {showGraph ? (
            <FrequencyChart history={history} active={isActive} />
          ) : (
            <>
              <TunerNeedle cents={isActive ? (note?.cents ?? null) : null} color={tuneColor} />
              <MiniCentsStrip history={history} />
            </>
          )}
        </View>

        {/* ── Note info strip (always visible) ── */}
        <View style={styles.infoStrip}>
          {/* Note name */}
          <View style={styles.noteBlock}>
            <Text style={[styles.noteName, { color: note && isActive ? tuneColor : '#2a2a3a' }]}>
              {note?.name ?? 'A'}
              <Text style={styles.octave}>{note?.octave ?? '4'}</Text>
            </Text>
          </View>

          {/* Center: cents + status */}
          <View style={styles.centsBlock}>
            <Text style={[styles.centsVal, { color: note && isActive ? tuneColor : '#2a2a3a' }]}>
              {note ? `${note.cents > 0 ? '+' : ''}${note.cents}` : '0'}
              <Text style={styles.centsSuffix}> ¢</Text>
            </Text>
            <View style={styles.statusRow}>
              {note && isActive
                ? inTune
                  ? <Text style={styles.inTuneText}>✓ IN TUNE</Text>
                  : <Text style={styles.offTuneText}>{note.cents > 0 ? '▶ sharp' : '◀ flat'}</Text>
                : <Text style={styles.waitText}>{isActive ? '· · ·' : '–'}</Text>
              }
            </View>
          </View>

          {/* Frequency */}
          <View style={styles.freqBlock}>
            <Text style={[styles.freqVal, { color: frequency && isActive ? '#888' : '#2a2a3a' }]}>
              {frequency?.toFixed(1) ?? '–'}
            </Text>
            <Text style={styles.freqUnit}>Hz</Text>
          </View>
        </View>

        {/* ── Signal + Start/Stop ── */}
        <View style={styles.controlRow}>
          {/* Signal bar */}
          <View style={styles.signalWrap}>
            <Text style={styles.signalLabel}>SIG</Text>
            <View style={styles.signalTrack}>
              <Animated.View style={[styles.signalBar, { width: signalWidth }]} />
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity
            onPress={isActive ? stop : start}
            style={[styles.btn, isActive && styles.btnActive]}
            activeOpacity={0.8}
          >
            <Animated.View style={{ opacity: isActive ? pulseAnim : 1 }}>
              <Ionicons name={isActive ? 'mic' : 'mic-outline'} size={24} color={isActive ? '#0a0a0f' : '#e0e0e0'} />
            </Animated.View>
            <Text style={[styles.btnText, isActive && styles.btnTextActive]}>
              {isActive ? 'STOP' : 'START'}
            </Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* ── Strings ── */}
        <View style={styles.stringsCard}>
          <View style={styles.stringsGrid}>
            {tuning.strings.map(gs => {
              const active = closestId === gs.string;
              return (
                <View key={`${gs.string}${gs.note}`} style={[styles.pill, active && styles.pillActive]}>
                  <Text style={[styles.pillNum, active && styles.pillNumActive]}>{gs.string}</Text>
                  <Text style={[styles.pillNote, active && styles.pillNoteActive]}>{gs.note}</Text>
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>

      {/* ── Tuning picker ── */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Instrument & Tuning</Text>

            <View style={styles.instTabRow}>
              {INSTRUMENTS.map(inst => (
                <TouchableOpacity
                  key={inst}
                  onPress={() => setInstrument(inst)}
                  style={[styles.instTab, instrument === inst && styles.instTabActive]}
                >
                  <Text style={styles.instTabEmoji}>{INSTRUMENT_ICONS[inst] ?? '🎵'}</Text>
                  <Text style={[styles.instTabText, instrument === inst && { color: '#00e676' }]}>{inst}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={getTuningsForInstrument(instrument)}
              keyExtractor={t => t.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setTuning(item); setShowPicker(false); }}
                  style={[styles.tuningRow, tuning.id === item.id && styles.tuningRowActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tuningLabel, tuning.id === item.id && { color: '#00e676' }]}>{item.label}</Text>
                    <Text style={styles.tuningNotes}>{item.strings.map(s => s.note).join('  ')}</Text>
                  </View>
                  {tuning.id === item.id && <Ionicons name="checkmark-circle" size={18} color="#00e676" />}
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll:  { paddingHorizontal: 16, paddingBottom: 24 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 12 },
  instrumentBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111118', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: '#222' },
  instEmoji: { fontSize: 18 },
  instName:  { color: '#ccc', fontSize: 13, fontWeight: '700' },
  instTuning:{ color: '#555', fontSize: 10 },

  viewToggle: { flexDirection: 'row', backgroundColor: '#111118', borderRadius: 12, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
  viewBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7 },
  viewBtnActive:{ backgroundColor: '#1e1e2a' },
  viewBtnText: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Main card - just padding, no fixed height
  mainCard: { backgroundColor: '#111118', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 8, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e28' },

  // Note info strip
  infoStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e28' },
  noteBlock:  { width: 72, alignItems: 'flex-start' },
  noteName:   { fontSize: 42, fontWeight: '800', letterSpacing: -1, lineHeight: 46 },
  octave:     { fontSize: 22, fontWeight: '400' },
  centsBlock: { flex: 1, alignItems: 'center' },
  centsVal:   { fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  centsSuffix:{ fontSize: 16, fontWeight: '400' },
  statusRow:  { height: 20, justifyContent: 'center', marginTop: 2 },
  inTuneText: { color: '#00e676', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  offTuneText:{ color: '#ffeb3b', fontSize: 11, fontWeight: '600' },
  waitText:   { color: '#2a2a3a', fontSize: 16 },
  freqBlock:  { width: 72, alignItems: 'flex-end' },
  freqVal:    { fontSize: 20, fontWeight: '600' },
  freqUnit:   { color: '#555', fontSize: 11 },

  // Controls row
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  signalWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  signalLabel:{ color: '#444', fontSize: 9, letterSpacing: 1.5, fontWeight: '700', width: 24 },
  signalTrack:{ flex: 1, height: 4, backgroundColor: '#1e1e28', borderRadius: 2, overflow: 'hidden' },
  signalBar:  { height: 4, backgroundColor: '#00e676', borderRadius: 2 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e1e28', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50, borderWidth: 1, borderColor: '#2a2a38' },
  btnActive:  { backgroundColor: '#00e676', borderColor: '#00e676' },
  btnText:    { color: '#e0e0e0', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  btnTextActive: { color: '#0a0a0f' },
  errorText:  { color: '#ff5252', fontSize: 12, marginBottom: 8, textAlign: 'center' },

  // Strings
  stringsCard: { backgroundColor: '#111118', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e1e28' },
  stringsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  pill:        { alignItems: 'center', backgroundColor: '#1a1a24', borderRadius: 9, paddingVertical: 6, paddingHorizontal: 9, borderWidth: 1, borderColor: '#2a2a38', minWidth: 40 },
  pillActive:  { backgroundColor: '#00e67618', borderColor: '#00e676' },
  pillNum:     { color: '#555', fontSize: 9, fontWeight: '700' },
  pillNumActive:{ color: '#00e676' },
  pillNote:    { color: '#888', fontSize: 12, fontWeight: '600', marginTop: 1 },
  pillNoteActive:{ color: '#00e676', fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: '#222' },
  handle:       { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { color: '#888', fontSize: 12, letterSpacing: 2, fontWeight: '700', textAlign: 'center', marginBottom: 14, textTransform: 'uppercase' },
  instTabRow:   { flexDirection: 'row', gap: 8, marginBottom: 14 },
  instTab:      { flex: 1, alignItems: 'center', paddingVertical: 9, backgroundColor: '#1a1a24', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a38', gap: 3 },
  instTabActive:{ borderColor: '#00e67644', backgroundColor: '#00e67618' },
  instTabEmoji: { fontSize: 18 },
  instTabText:  { color: '#555', fontSize: 10, fontWeight: '700' },
  tuningRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#161620' },
  tuningRowActive: {},
  tuningLabel:  { color: '#ccc', fontSize: 15, fontWeight: '600' },
  tuningNotes:  { color: '#555', fontSize: 11, marginTop: 2, letterSpacing: 0.8 },
  closeBtn:     { marginTop: 14, alignItems: 'center', paddingVertical: 12, backgroundColor: '#1e1e28', borderRadius: 14 },
  closeBtnText: { color: '#888', fontWeight: '600' },
});
