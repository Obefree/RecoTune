import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Modal, ScrollView,
  Pressable, Platform, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import WebView from 'react-native-webview';

import TunerEngine, { PitchMessage } from '../components/TunerEngine';
import {
  centsToColor, frequencyToNote, INSTRUMENTS, TUNINGS, getTuningsForInstrument,
  type Tuning,
} from '../utils/noteUtils';
import TunerNeedle from '../components/TunerNeedle';
import FrequencyChart, { HistoryPoint, TUNER_CHART_BLOCK_MIN_H } from '../components/FrequencyChart';
import MiniCentsStrip from '../components/MiniCentsStrip';
import { useLocale } from '../context/LocaleContext';
import type { RegisteredNoteEvent } from '../hooks/useSungNoteHistory';
import { SungNoteDetector } from '../utils/sungNoteDetector';

const EMA_ALPHA_FREQ_LOW = 0.14;
const EMA_ALPHA_CENTS_LOW = 0.16;
const EMA_ALPHA_FREQ_HIGH = 0.11;
const EMA_ALPHA_CENTS_HIGH = 0.14;
const HIGH_NOTE_HZ = 280;

function emaAlphaFreq(hz: number) {
  return hz >= HIGH_NOTE_HZ ? EMA_ALPHA_FREQ_HIGH : EMA_ALPHA_FREQ_LOW;
}
function emaAlphaCents(hz: number) {
  return hz >= HIGH_NOTE_HZ ? EMA_ALPHA_CENTS_HIGH : EMA_ALPHA_CENTS_LOW;
}
const A4_FREQ    = 440;
const A4_MIDI    = 69;

const MAX_HISTORY = 80;
const MAX_REGISTERED = 64;
const INSTRUMENT_ICONS: Record<string, string> = { Guitar: '🎸', 'Guitar 7': '🎸', Ukulele: '🪗', Bass: '🎸', Mandolin: '🪕' };

interface NoteState { name: string; octave: number; cents: number; frequency: number }

const MINI_STRIP_H = 68 + 6;
const NEEDLE_PAD = 24;

export default function TunerScreen() {
  const insets = useSafeAreaInsets();
  const { locale, setLocale, t } = useLocale();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const tunerPickerScrollMaxH = Math.max(200, Math.round(windowH * 0.58) - insets.bottom - 32);
  const needleBlockH = Math.round((windowW - 32) * 0.58) + MINI_STRIP_H + NEEDLE_PAD;
  const mainCardMinH = Math.max(needleBlockH, TUNER_CHART_BLOCK_MIN_H);

  const [isActive, setIsActive]       = useState(false);
  const [note, setNote]               = useState<NoteState | null>(null);
  const [frequency, setFrequency]     = useState<number | null>(null);
  const [signalLevel, setSignalLevel] = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [showGraph, setShowGraph]     = useState(false);
  const [history, setHistory]         = useState<HistoryPoint[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredNoteEvent[]>([]);
  const sungDetectorRef = useRef(new SungNoteDetector());
  const [instrument, setInstrument]   = useState('Guitar');
  const [tuning, setTuning]           = useState<Tuning>(TUNINGS[0]);
  const [showPicker, setShowPicker]   = useState(false);

  const webViewRef      = useRef<WebView>(null);
  const pulseAnim       = useRef(new Animated.Value(1)).current;
  const signalAnim      = useRef(new Animated.Value(0)).current;
  const pulseLoop       = useRef<Animated.CompositeAnimation | null>(null);
  const smoothedFreqRef = useRef<number | null>(null);
  const smoothedCentsRef = useRef<number | null>(null);
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
      const raw  = msg.frequency;
      const prevF = smoothedFreqRef.current;
      const alphaF = emaAlphaFreq(prevF ?? raw);
      const freq = prevF == null ? raw : alphaF * raw + (1 - alphaF) * prevF;
      smoothedFreqRef.current = freq;

      const info = frequencyToNote(freq);
      const midi = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
      const rawCents = info.cents;
      const prevC = smoothedCentsRef.current;
      let dispCents = rawCents;
      if (prevC != null) {
        const next = prevC + emaAlphaCents(freq) * (rawCents - prevC);
        smoothedCentsRef.current = next;
        dispCents = Math.round(next);
      } else {
        smoothedCentsRef.current = rawCents;
      }

      const n: NoteState = {
        name: info.name,
        octave: info.octave,
        cents: dispCents,
        frequency: freq,
      };

      setFrequency(freq);
      setNote(n);
      setSignalLevel(msg.signal ?? 0);
      const ts = Date.now();
      setHistory(prev => {
        const pt: HistoryPoint = {
          cents: dispCents,
          freq, midi,
          note: info.name, octave: info.octave, ts,
        };
        const next = [...prev, pt];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
      const detected = sungDetectorRef.current.process({
        frequency: freq,
        signal: msg.signal ?? 0,
        cents: dispCents,
        ts,
        yinConfidence: msg.yinConfidence,
      });
      if (detected) {
        setRegisteredEvents(prev => {
          const ev: RegisteredNoteEvent = {
            name: detected.name,
            octave: detected.octave,
            midi: detected.midi,
            ts: detected.ts,
            freq: detected.freq,
          };
          const next = [...prev, ev];
          return next.length > MAX_REGISTERED ? next.slice(-MAX_REGISTERED) : next;
        });
      }
    } else if (msg.type === 'signal') {
      sungDetectorRef.current.process({ frequency: null, signal: msg.signal ?? 0 });
      smoothedFreqRef.current = null;
      smoothedCentsRef.current = null;
      setNote(null); setFrequency(null); setSignalLevel(msg.signal ?? 0);
    } else if (msg.type === 'silent') {
      sungDetectorRef.current.process({ frequency: null, signal: 0 });
      smoothedFreqRef.current = null;
      smoothedCentsRef.current = null;
      setNote(null); setFrequency(null); setSignalLevel(0);
    } else if (msg.type === 'error') {
      setError(msg.message ?? t('micError')); setIsActive(false);
    }
  }, [t]);

  const start = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { setError(t('micDenied')); return; }
    setError(null); setHistory([]); setRegisteredEvents([]);
    sungDetectorRef.current.reset();
    smoothedFreqRef.current = null;
    smoothedCentsRef.current = null;
    setIsActive(true);
  }, [t]);

  const stop = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.stopTuner && window.stopTuner(); true;');
    sungDetectorRef.current.reset();
    smoothedFreqRef.current = null;
    smoothedCentsRef.current = null;
    setIsActive(false); setNote(null); setFrequency(null); setSignalLevel(0);
  }, []);

  useFocusEffect(useCallback(() => () => stop(), [stop]));

  const signalWidth = signalAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const displayCents = note?.cents ?? 0;
  const tuneColor   = note && isActive ? centsToColor(displayCents) : '#3a3a4a';
  const inTune      = note && isActive && Math.abs(displayCents) <= 5;

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

          <View style={styles.langToggle}>
            <TouchableOpacity
              onPress={() => setLocale('ru')}
              style={[styles.langBtn, locale === 'ru' && styles.langBtnActive]}
              accessibilityLabel={t('langRu')}
            >
              <Text style={[styles.langBtnText, locale === 'ru' && styles.langBtnTextActive]}>{t('langRu')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLocale('en')}
              style={[styles.langBtn, locale === 'en' && styles.langBtnActive]}
              accessibilityLabel={t('langEn')}
            >
              <Text style={[styles.langBtnText, locale === 'en' && styles.langBtnTextActive]}>{t('langEn')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => setShowGraph(false)}
              style={[styles.viewBtn, !showGraph && styles.viewBtnActive]}
            >
              <Ionicons name="radio-button-on-outline" size={20} color={!showGraph ? '#00e676' : '#555'} />
              <Text style={[styles.viewBtnText, !showGraph && { color: '#00e676' }]}>{t('viewNeedle')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowGraph(true)}
              style={[styles.viewBtn, showGraph && styles.viewBtnActive]}
            >
              <Ionicons name="analytics-outline" size={20} color={showGraph ? '#7c4dff' : '#555'} />
              <Text style={[styles.viewBtnText, showGraph && { color: '#7c4dff' }]}>{t('viewGraph')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Main display area (needle OR graph) ── */}
        <View style={[styles.mainCard, { minHeight: mainCardMinH }]}>
          {showGraph ? (
            <FrequencyChart
              history={history}
              active={isActive}
              registeredMarkers={registeredEvents.map(e => ({
                ts: e.ts,
                midi: e.midi,
                note: e.name,
                octave: e.octave,
              }))}
            />
          ) : (
            <>
              <TunerNeedle cents={isActive && note ? note.cents : null} color={tuneColor} />
              <MiniCentsStrip history={history} />
            </>
          )}
        </View>

        {/* ── Chromatic info strip ── */}
        <View style={styles.infoStrip}>
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>{t('noteLabel')}</Text>
            <Text style={[styles.noteName, { color: note && isActive ? tuneColor : '#2a2a3a' }]}>
              {note && isActive ? `${note.name}${note.octave}` : '–'}
            </Text>
          </View>

          <View style={styles.centsBlock}>
            <Text style={[styles.centsVal, { color: note && isActive ? tuneColor : '#2a2a3a' }]}>
              {note && isActive
                ? `${displayCents > 0 ? '+' : ''}${displayCents}`
                : '0'}
              <Text style={styles.centsSuffix}> ¢</Text>
            </Text>
            <View style={styles.statusRow}>
              {note && isActive
                ? inTune
                  ? <Text style={styles.inTuneText}>{t('inTune')}</Text>
                  : <Text style={styles.offTuneText}>
                      {displayCents > 0 ? t('above') : t('below')}
                    </Text>
                : <Text style={styles.waitText}>{isActive ? t('waiting') : '–'}</Text>
              }
            </View>
          </View>

          <View style={styles.freqBlock}>
            <Text style={[styles.freqVal, { color: frequency && isActive ? '#888' : '#2a2a3a' }]}>
              {frequency?.toFixed(1) ?? '–'}
            </Text>
            <Text style={styles.freqUnit}>Hz</Text>
          </View>
        </View>

        {/* ── Signal + Start/Stop ── */}
        <View style={styles.controlRow}>
          <View style={styles.signalWrap}>
            <Text style={styles.signalLabel}>SIG</Text>
            <View style={styles.signalTrack}>
              <Animated.View style={[styles.signalBar, { width: signalWidth }]} />
            </View>
            <Text style={styles.signalDb}>
              {signalLevel > 0
                ? `${Math.round(20 * Math.log10(signalLevel))} dB`
                : '–∞ dB'}
            </Text>
          </View>

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

      </ScrollView>

      {/* ── Tuning picker (instrument mode — future string targeting) ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPicker(false)} accessibilityLabel={t('closePicker')} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16, maxHeight: Math.round(windowH * 0.92) }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={{ maxHeight: tunerPickerScrollMaxH }}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
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

              {getTuningsForInstrument(instrument).map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => { setTuning(item); setShowPicker(false); }}
                  style={[styles.tuningRow, tuning.id === item.id && styles.tuningRowActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tuningLabel, tuning.id === item.id && { color: '#00e676' }]}>{item.label}</Text>
                    <Text style={styles.tuningNotes}>{item.strings.map(s => s.note).join('  ')}</Text>
                  </View>
                  {tuning.id === item.id && <Ionicons name="checkmark-circle" size={18} color="#00e676" />}
                </TouchableOpacity>
              ))}

              <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll:  { paddingHorizontal: 16, paddingBottom: 24 },

  topBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10, marginBottom: 12, gap: 8 },
  langToggle: { flexDirection: 'row', backgroundColor: '#111118', borderRadius: 12, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
  langBtn: { paddingHorizontal: 10, paddingVertical: 10, minWidth: 40, alignItems: 'center' },
  langBtnActive: { backgroundColor: '#1e1e2a' },
  langBtnText: { color: '#555', fontSize: 11, fontWeight: '800' },
  langBtnTextActive: { color: '#00e676' },
  instrumentBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111118', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: '#222', flexShrink: 1 },
  instEmoji: { fontSize: 18 },
  instName:  { color: '#ccc', fontSize: 13, fontWeight: '700' },
  instTuning:{ color: '#555', fontSize: 10 },

  viewToggle: { flexDirection: 'row', flex: 1, minWidth: 140, backgroundColor: '#111118', borderRadius: 14, borderWidth: 2, borderColor: '#2a2a38', overflow: 'hidden' },
  viewBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, paddingHorizontal: 12, paddingVertical: 14, minHeight: 50 },
  viewBtnActive:{ backgroundColor: '#1e1e2a' },
  viewBtnText: { color: '#555', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },

  mainCard: { backgroundColor: '#111118', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 8, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e28' },

  infoStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e28' },
  noteBlock: { width: 80, alignItems: 'flex-start' },
  noteLabel: { color: '#444', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  noteName:  { fontSize: 36, fontWeight: '800', lineHeight: 40, marginTop: 2 },
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

  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  signalWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  signalLabel:{ color: '#444', fontSize: 9, letterSpacing: 1.5, fontWeight: '700', width: 24 },
  signalTrack:{ flex: 1, height: 4, backgroundColor: '#1e1e28', borderRadius: 2, overflow: 'hidden' },
  signalBar:  { height: 4, backgroundColor: '#00e676', borderRadius: 2 },
  signalDb:   { color: '#444', fontSize: 10, fontWeight: '600', width: 52, textAlign: 'right' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e1e28', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50, borderWidth: 1, borderColor: '#2a2a38' },
  btnActive:  { backgroundColor: '#00e676', borderColor: '#00e676' },
  btnText:    { color: '#e0e0e0', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  btnTextActive: { color: '#0a0a0f' },
  errorText:  { color: '#ff5252', fontSize: 12, marginBottom: 8, textAlign: 'center' },

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
