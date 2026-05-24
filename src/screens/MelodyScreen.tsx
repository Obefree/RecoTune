import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  FlatList, useWindowDimensions, Switch,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import WebView from 'react-native-webview';

import TunerEngine, { PitchMessage } from '../components/TunerEngine';
import MelodyPlayerEngine, {
  type MelodyInstrument,
  type MelodyPlayerHandle,
} from '../components/MelodyPlayerEngine';
import { applyPlaybackAudioMode } from '../utils/playbackAudioMode';
import {
  buildMelodyPlaybackPayload,
  buildMelodyPlaybackPayloadFromSegments,
  buildStaffPlaybackTimings,
  chordSegmentsForPlayback,
  getMelodyPlaybackTotalMs,
  MELODY_PLAYBACK,
  staffIndicesPerPlaybackNote,
} from '../utils/melodyPlayback';
import {
  isTranscriptionConfidenceOk,
  segmentsToRegisteredEvents,
  transcribeFromPitchFrames,
} from '../utils/melodyTranscription';
import type { MelodyPlayerMessage } from '../components/MelodyPlayerEngine';
import { centsToColor, frequencyToNote } from '../utils/noteUtils';
import SungNoteStrip from '../components/SungNoteStrip';
import MelodyPitchChart from '../components/MelodyPitchChart';
import MelodyAnalysisPanel from '../components/MelodyAnalysisPanel';
import DualStaffView from '../components/DualStaffView';
import { useLocale } from '../context/LocaleContext';
import { useSungNoteHistory } from '../hooks/useSungNoteHistory';
import { estimateKey, estimateRhythm } from '../utils/melodyAnalysis';
import {
  quantizeNotesToKey,
  quantizeLabels,
  quantizeChanges,
  keyFromEstimate,
  asStaffNotes,
  annotateScaleDegrees,
} from '../utils/melodyKeyQuantize';
import {
  suggestMelodyChords,
  chordStripText,
  chordSymbols,
  chordsFromAppliedSymbols,
  type SuggestedChord,
} from '../utils/melodyChords';
import {
  listSavedMelodies,
  loadMelodyFile,
  saveMelodyFile,
  updateMelodyFile,
  type SavedMelodyMeta,
} from '../utils/melodyStorage';

/** Display/chart smoothing — raw pitch still goes to detector + pitchFrames for contour. */
const DISPLAY_EMA = 0.20;
const CHART_PAD = 32 + 16;

interface NoteState { name: string; octave: number; cents: number; frequency: number }

export default function MelodyScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { t } = useLocale();
  const chartPlotWidth = windowW - CHART_PAD - 30;

  const [isActive, setIsActive] = useState(false);
  const [note, setNote] = useState<NoteState | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [signalLevel, setSignalLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedMelodies, setSavedMelodies] = useState<SavedMelodyMeta[]>([]);
  const [selectedMelodyId, setSelectedMelodyId] = useState<string | null>(null);
  const [fitToKey, setFitToKey] = useState(true);
  const [showRoman, setShowRoman] = useState(false);
  const [showStaff, setShowStaff] = useState(true);
  const [appliedChords, setAppliedChords] = useState<string[] | null>(null);
  const [suggestedChords, setSuggestedChords] = useState<SuggestedChord[]>([]);
  const [isPlayingMelody, setIsPlayingMelody] = useState(false);
  const [playbackElapsedMs, setPlaybackElapsedMs] = useState(0);
  const [playbackNoteIndex, setPlaybackNoteIndex] = useState(-1);
  const [quantizeRhythm, setQuantizeRhythm] = useState(false);
  const [instrument, setInstrument] = useState<MelodyInstrument>('piano');
  /** contour = transcription from pitch frames; classic = SungNoteDetector */
  const [recognitionMode, setRecognitionMode] = useState<'contour' | 'classic'>('contour');

  const webViewRef = useRef<WebView>(null);
  const playerRef = useRef<MelodyPlayerHandle>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const signalAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const smoothedFreqRef = useRef<number | null>(null);

  const {
    notes: sungNotes,
    pitchHistory,
    pitchFrames,
    registeredEvents,
    feed: feedSungNote,
    reset: resetSungNotes,
    loadSnapshot,
  } = useSungNoteHistory();

  const transcription = useMemo(
    () => transcribeFromPitchFrames(pitchFrames),
    [pitchFrames],
  );

  const useContourRecognition = recognitionMode === 'contour'
    && isTranscriptionConfidenceOk(transcription);

  const activeEvents = useMemo(() => {
    if (useContourRecognition) {
      return segmentsToRegisteredEvents(transcription.segments);
    }
    return registeredEvents;
  }, [useContourRecognition, transcription.segments, registeredEvents]);

  const segmentOverlays = useMemo(
    () =>
      transcription.segments.map(s => ({
        startMs: s.startMs,
        endMs: s.endMs,
        midi: s.midi,
        note: s.noteName,
        octave: s.octave,
        confidence: s.confidenceMean,
      })),
    [transcription.segments],
  );

  const stripNotes = useMemo(
    () => activeEvents.map(e => ({
      name: e.name,
      octave: e.octave,
      midi: e.midi,
      freq: e.freq,
      ts: e.ts,
    })),
    [activeEvents],
  );

  const keyEst = useMemo(() => estimateKey(activeEvents), [activeEvents]);

  const quantizeInputs = useMemo(
    () => activeEvents.map(e => ({ name: e.name, octave: e.octave, midi: e.midi })),
    [activeEvents],
  );

  const quantizedNotes = useMemo(() => {
    if (!fitToKey || activeEvents.length === 0) return [];
    const key = keyFromEstimate(keyEst);
    return quantizeNotesToKey(quantizeInputs, key);
  }, [fitToKey, activeEvents.length, quantizeInputs, keyEst]);

  const eventTimestamps = useMemo(
    () => activeEvents.map(e => e.ts),
    [activeEvents],
  );

  const chordSuggestions = useMemo(() => {
    if (suggestedChords.length > 0) return suggestedChords;
    if (activeEvents.length === 0 || !keyEst) return [];
    const forChords = annotateScaleDegrees(quantizeInputs, keyEst);
    return suggestMelodyChords(forChords, keyEst, 6, eventTimestamps);
  }, [suggestedChords, activeEvents.length, keyEst, quantizeInputs, eventTimestamps]);

  const staffNotes = useMemo(() => {
    if (activeEvents.length === 0) return [];
    if (fitToKey && quantizedNotes.length > 0) return quantizedNotes;
    return asStaffNotes(quantizeInputs);
  }, [activeEvents.length, fitToKey, quantizedNotes, quantizeInputs]);

  const activeChords = appliedChords ?? (chordSuggestions.length ? chordSymbols(chordSuggestions) : null);

  const staffChords = useMemo(() => {
    if (chordSuggestions.length > 0) return chordSuggestions;
    if (appliedChords?.length && staffNotes.length > 0) {
      return chordsFromAppliedSymbols(appliedChords, staffNotes.length, eventTimestamps);
    }
    return [];
  }, [chordSuggestions, appliedChords, staffNotes.length, eventTimestamps]);

  const refreshSaved = useCallback(async () => {
    const list = await listSavedMelodies();
    setSavedMelodies(list);
  }, []);

  useEffect(() => {
    if (isActive) {
      pulseLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
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
      const stable = msg.stableFrequency ?? msg.frequency;
      const raw = msg.rawFrequency ?? stable;
      const prevF = smoothedFreqRef.current;
      const freq = prevF == null ? stable : DISPLAY_EMA * stable + (1 - DISPLAY_EMA) * prevF;
      smoothedFreqRef.current = freq;

      const info = frequencyToNote(freq);
      const rawInfo = frequencyToNote(raw);
      const stableInfo = frequencyToNote(stable);
      const n: NoteState = {
        name: info.name,
        octave: info.octave,
        cents: info.cents,
        frequency: freq,
      };
      setFrequency(freq);
      setNote(n);
      setSignalLevel(msg.signal ?? 0);
      feedSungNote({
        frequency: stable,
        frameFrequency: raw,
        chartFrequency: freq,
        signal: msg.signal ?? 0,
        cents: stableInfo.cents,
        frameCents: rawInfo.cents,
        yinConfidence: msg.yinConfidence,
      });
    } else if (msg.type === 'signal') {
      feedSungNote({ frequency: null, signal: msg.signal ?? 0 });
      smoothedFreqRef.current = null;
      setNote(null);
      setFrequency(null);
      setSignalLevel(msg.signal ?? 0);
    } else if (msg.type === 'silent') {
      feedSungNote({ frequency: null, signal: 0 });
      smoothedFreqRef.current = null;
      setNote(null);
      setFrequency(null);
      setSignalLevel(0);
    } else if (msg.type === 'error') {
      setError(msg.message ?? t('micError'));
      setIsActive(false);
    }
  }, [t, feedSungNote]);

  const start = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      setError(t('micDenied'));
      return;
    }
    setError(null);
    smoothedFreqRef.current = null;
    setIsActive(true);
  }, [t]);

  const resetPlaybackVisual = useCallback(() => {
    setPlaybackElapsedMs(0);
    setPlaybackNoteIndex(-1);
  }, []);

  const stopMelodyPlayback = useCallback(() => {
    playerRef.current?.stopMelody();
    setIsPlayingMelody(false);
    resetPlaybackVisual();
  }, [resetPlaybackVisual]);

  const stop = useCallback(() => {
    stopMelodyPlayback();
    webViewRef.current?.injectJavaScript('window.stopTuner && window.stopTuner(); true;');
    smoothedFreqRef.current = null;
    setIsActive(false);
    setNote(null);
    setFrequency(null);
    setSignalLevel(0);
  }, [stopMelodyPlayback]);

  const rhythmEst = useMemo(() => estimateRhythm(activeEvents), [activeEvents]);

  const playbackPitchHistory = useMemo(
    () => pitchHistory.map(p => ({ ts: p.ts, midi: p.midi })),
    [pitchHistory],
  );

  const playbackPayload = useMemo(() => {
    const chordSegs = appliedChords?.length
      ? chordSegmentsForPlayback(appliedChords, chordSuggestions, activeEvents.length, eventTimestamps)
      : [];
    const playOpts = {
      bpmApprox: quantizeRhythm ? (rhythmEst?.bpmApprox ?? null) : null,
      quantizeRhythm,
      pitchHistory: playbackPitchHistory,
    };

    if (useContourRecognition && transcription.segments.length > 0) {
      const playSegments = transcription.segments.map(s => ({
        startMs: s.startMs,
        endMs: s.endMs,
        midi: s.midi,
      }));
      return buildMelodyPlaybackPayloadFromSegments(
        playSegments,
        fitToKey,
        quantizedNotes,
        activeEvents.length,
        chordSegs,
        playOpts,
      );
    }

    return buildMelodyPlaybackPayload(
      fitToKey,
      quantizedNotes,
      registeredEvents,
      chordSegs,
      playOpts,
    );
  }, [
    fitToKey,
    quantizedNotes,
    registeredEvents,
    activeEvents.length,
    appliedChords,
    chordSuggestions,
    rhythmEst,
    quantizeRhythm,
    eventTimestamps,
    playbackPitchHistory,
    useContourRecognition,
    transcription.segments,
  ]);

  const playbackTotalMs = useMemo(
    () => getMelodyPlaybackTotalMs(playbackPayload.notes, playbackPayload.chords),
    [playbackPayload],
  );

  const staffPlaybackTimings = useMemo(
    () =>
      buildStaffPlaybackTimings(
        staffNotes.length,
        playbackPayload.notes,
        activeEvents,
      ),
    [staffNotes.length, playbackPayload.notes, activeEvents],
  );

  const playbackStaffGroups = useMemo(
    () => staffIndicesPerPlaybackNote(activeEvents),
    [activeEvents],
  );

  const activeStaffIndices = useMemo(() => {
    if (!isPlayingMelody || playbackNoteIndex < 0) return undefined;
    return playbackStaffGroups[playbackNoteIndex];
  }, [isPlayingMelody, playbackNoteIndex, playbackStaffGroups]);

  const playbackUsesQuantized = playbackPayload.pitchSource === 'quantized';
  const fewNotesWarning = activeEvents.length > 0
    && activeEvents.length < MELODY_PLAYBACK.MIN_NOTES_WARNING;
  const singleNoteHint = activeEvents.length === 1;
  const quantizeMismatch = fitToKey
    && quantizedNotes.length > 0
    && quantizedNotes.length !== activeEvents.length;

  const handlePlayMelody = useCallback(async () => {
    if (isPlayingMelody) {
      stopMelodyPlayback();
      return;
    }
    if (playbackPayload.notes.length === 0) return;
    await applyPlaybackAudioMode();
    resetPlaybackVisual();
    setIsPlayingMelody(true);
    playerRef.current?.playMelody(playbackPayload, instrument);
  }, [isPlayingMelody, playbackPayload, instrument, stopMelodyPlayback, resetPlaybackVisual]);

  const handlePlayerMessage = useCallback((msg: MelodyPlayerMessage) => {
    if (msg.type === 'progress') {
      setPlaybackElapsedMs(msg.elapsedMs ?? 0);
      if (msg.noteIndex != null) setPlaybackNoteIndex(msg.noteIndex);
    } else if (msg.type === 'noteStart') {
      if (msg.index != null) setPlaybackNoteIndex(msg.index);
      if (msg.startMs != null) setPlaybackElapsedMs(msg.startMs);
    } else if (msg.type === 'done' || msg.type === 'error') {
      setIsPlayingMelody(false);
      resetPlaybackVisual();
    }
  }, [resetPlaybackVisual]);

  useFocusEffect(
    useCallback(() => {
      refreshSaved();
      return () => stop();
    }, [refreshSaved, stop]),
  );

  const handleSaveMelody = useCallback(async () => {
    if (sungNotes.length === 0) return;
    const rhythm = estimateRhythm(activeEvents);
    const name = `${t('melodyDefaultName')} ${new Date().toLocaleString()}`;
    const q = fitToKey && keyEst ? quantizeNotesToKey(quantizeInputs, keyEst) : undefined;
    const chords = activeChords ?? undefined;
    const saved = await saveMelodyFile({
      name,
      notes: sungNotes,
      key: keyEst?.label,
      bpm: rhythm?.bpmApprox ?? undefined,
      chords,
      quantizedNotes: q,
    });
    setSelectedMelodyId(saved.id);
    await refreshSaved();
  }, [sungNotes, activeEvents, t, refreshSaved, fitToKey, keyEst, quantizeInputs, activeChords]);

  const handleSuggestChords = useCallback(() => {
    if (!keyEst || activeEvents.length === 0) return;
    const forChords = annotateScaleDegrees(quantizeInputs, keyEst);
    setSuggestedChords(suggestMelodyChords(forChords, keyEst, 6, eventTimestamps));
    setAppliedChords(null);
  }, [keyEst, activeEvents.length, quantizeInputs, eventTimestamps]);

  const handleApplyChords = useCallback(async () => {
    const symbols = chordSymbols(chordSuggestions);
    if (symbols.length === 0) return;
    setAppliedChords(symbols);
    if (selectedMelodyId) {
      const q = fitToKey && keyEst ? quantizeNotesToKey(quantizeInputs, keyEst) : undefined;
      await updateMelodyFile(selectedMelodyId, { chords: symbols, quantizedNotes: q, key: keyEst?.label });
      await refreshSaved();
    }
  }, [chordSuggestions, selectedMelodyId, fitToKey, keyEst, quantizeInputs, refreshSaved]);

  const handleLoadMelody = useCallback(async (id: string) => {
    const data = await loadMelodyFile(id);
    if (!data) return;
    stop();
    loadSnapshot({
      notes: data.notes,
      pitchHistory: [],
      registeredEvents: data.notes.map(n => ({
        name: n.name,
        octave: n.octave,
        midi: n.midi,
        ts: n.ts,
        freq: n.freq,
      })),
    });
    setSelectedMelodyId(id);
    setAppliedChords(data.chords ?? null);
    setSuggestedChords([]);
    setFitToKey(!!data.quantizedNotes?.length);
  }, [loadSnapshot, stop]);

  const signalWidth = signalAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const tuneColor = note && isActive ? centsToColor(note.cents) : '#3a3a4a';

  const renderMicControl = (compact = false) => (
    <TouchableOpacity
      onPress={isActive ? stop : start}
      style={[styles.topBtn, compact && styles.bottomMicBtn, isActive && styles.topBtnActive]}
      activeOpacity={0.8}
    >
      <Animated.View style={{ opacity: isActive ? pulseAnim : 1 }}>
        <Ionicons
          name={isActive ? 'mic' : 'mic-outline'}
          size={compact ? 18 : 20}
          color={isActive ? '#0a0a0f' : '#e0e0e0'}
        />
      </Animated.View>
      <Text style={[styles.topBtnText, compact && styles.bottomMicBtnText, isActive && styles.topBtnTextActive]}>
        {isActive ? t('melodyStopPlayback') : 'START'}
      </Text>
    </TouchableOpacity>
  );

  const renderSavedItem = ({ item }: { item: SavedMelodyMeta }) => {
    const selected = item.id === selectedMelodyId;
    return (
      <TouchableOpacity
        style={[styles.savedRow, selected && styles.savedRowActive]}
        onPress={() => handleLoadMelody(item.id)}
        activeOpacity={0.85}
      >
        <Text style={styles.savedName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.savedMeta}>
          {item.noteCount} {t('melodyNotesShort')}
          {item.key ? ` · ${item.key}` : ''}
          {item.bpm ? ` · ~${item.bpm} BPM` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      {isActive && <TunerEngine ref={webViewRef} onMessage={handleMessage} active={isActive} mode="melody" />}
      <MelodyPlayerEngine ref={playerRef} onMessage={handlePlayerMessage} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('tabMelody')}</Text>
        <Text style={styles.hint}>{t('melodyPlayTimingHint')}</Text>
        <Text style={styles.hintSecondary}>{t('melodySingDetectionHint')}</Text>

        <View style={styles.topRow}>
          <View style={styles.noteCol}>
            <Text style={styles.pitchLabel}>{t('noteLabel')}</Text>
            <Text style={[styles.pitchNoteBig, { color: note && isActive ? tuneColor : '#2a2a3a' }]}>
              {note && isActive ? `${note.name}${note.octave}` : '–'}
            </Text>
            <Text style={[styles.pitchMeta, { color: note && isActive ? tuneColor : '#444' }]}>
              {note && isActive
                ? `${note.cents > 0 ? '+' : ''}${note.cents} ¢`
                : isActive ? t('waiting') : '–'}
            </Text>
            <Text style={styles.pitchHz}>
              {frequency && isActive ? `${frequency.toFixed(1)} Hz` : ' '}
            </Text>
          </View>

          <View style={styles.controlsCol}>
            {renderMicControl()}

            <TouchableOpacity
              onPress={handlePlayMelody}
              style={[
                styles.topBtn,
                styles.playBtn,
                (playbackPayload.notes.length === 0 && !isPlayingMelody) && styles.btnDisabled,
                isPlayingMelody && styles.playBtnActive,
              ]}
              disabled={playbackPayload.notes.length === 0 && !isPlayingMelody}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isPlayingMelody ? 'stop' : 'play'}
                size={18}
                color={isPlayingMelody ? '#0a0a0f' : '#e0e0e0'}
              />
              <Text style={[styles.topBtnText, isPlayingMelody && styles.topBtnTextActive]}>
                {isPlayingMelody ? t('melodyStopPlayback') : t('melodyPlay')}
              </Text>
            </TouchableOpacity>

            <View style={styles.instrumentRow}>
              <Text style={styles.instrumentLabel}>{t('melodyInstrument')}</Text>
              <View style={styles.instrumentChips}>
                {(['piano', 'sine'] as MelodyInstrument[]).map(inst => (
                  <TouchableOpacity
                    key={inst}
                    style={[styles.instChip, instrument === inst && styles.instChipActive]}
                    onPress={() => setInstrument(inst)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.instChipText, instrument === inst && styles.instChipTextActive]}>
                      {inst === 'piano' ? t('melodyInstrumentPiano') : t('melodyInstrumentSine')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {playbackPayload.notes.length > 0 ? (
              <Text style={styles.playSourceHint}>
                {playbackUsesQuantized ? t('melodyPlaySourceQuantized') : t('melodyPlaySourceRaw')}
                {quantizeRhythm && rhythmEst?.bpmApprox ? ` · ~${rhythmEst.bpmApprox} BPM` : ''}
                {!quantizeRhythm ? ` · ${t('melodyPlaySungTiming')}` : ''}
              </Text>
            ) : null}
            <View style={styles.quantizeRhythmRow}>
              <Text style={styles.quantizeRhythmLabel}>{t('melodyQuantizeRhythm')}</Text>
              <Switch
                value={quantizeRhythm}
                onValueChange={setQuantizeRhythm}
                trackColor={{ false: '#252532', true: '#7c4dff88' }}
                thumbColor={quantizeRhythm ? '#7c4dff' : '#555'}
              />
            </View>
            {singleNoteHint ? (
              <Text style={styles.playHint}>{t('melodyPlaySingleNoteHint')}</Text>
            ) : null}
            {fewNotesWarning ? (
              <Text style={styles.playWarning}>{t('melodyPlayFewNotesWarning')}</Text>
            ) : null}
            {quantizeMismatch ? (
              <Text style={styles.playWarning}>{t('melodyPlayQuantizedMismatch')}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.signalWrap}>
          <Text style={styles.signalLabel}>SIG</Text>
          <View style={styles.signalTrack}>
            <Animated.View style={[styles.signalBar, { width: signalWidth }]} />
          </View>
        </View>

        <View style={styles.recognitionRow}>
          <Text style={styles.recognitionLabel}>
            Распознавание: {recognitionMode === 'contour' ? 'контур' : 'классика'}
          </Text>
          <Switch
            value={recognitionMode === 'contour'}
            onValueChange={v => setRecognitionMode(v ? 'contour' : 'classic')}
            trackColor={{ false: '#252532', true: '#7c4dff88' }}
            thumbColor={recognitionMode === 'contour' ? '#7c4dff' : '#555'}
          />
        </View>
        {(isActive || pitchFrames.length > 0) ? (
          <Text style={styles.recognitionStats}>
            кадры {pitchFrames.length}
            {' · '}
            ноты {transcription.segments.length}
            {recognitionMode === 'classic' ? '' : ` / классика ${registeredEvents.length}`}
            {useContourRecognition ? ' · PLAY: контур (как на графике)' : recognitionMode === 'contour' ? ' · PLAY: классика (fallback)' : ' · PLAY: классика'}
          </Text>
        ) : null}

        <MelodyPitchChart
          history={pitchHistory}
          registeredEvents={activeEvents}
          segmentOverlays={recognitionMode === 'contour' ? segmentOverlays : []}
          active={isActive}
          chartPlotWidth={chartPlotWidth}
        />

        <SungNoteStrip
          notes={stripNotes}
          label={t('melodySequenceLabel')}
          active={isActive}
          numbered
          onClear={resetSungNotes}
          clearLabel={t('sungNotesClear')}
        />

        <MelodyAnalysisPanel events={activeEvents} compact />

        {activeEvents.length > 0 ? (
          <View style={[styles.sectionCard, styles.sectionCardCompact]}>
            <View style={styles.toggleRow}>
              <Text style={styles.sectionTitle}>{t('melodyQuantizedLabel')}</Text>
              <View style={styles.toggleWrap}>
                <Text style={styles.toggleLabel}>{t('melodyFitToKey')}</Text>
                <Switch
                  value={fitToKey}
                  onValueChange={setFitToKey}
                  trackColor={{ false: '#252532', true: '#7c4dff88' }}
                  thumbColor={fitToKey ? '#7c4dff' : '#555'}
                />
              </View>
            </View>
            {fitToKey && quantizedNotes.length > 0 ? (
              <>
                <Text style={styles.quantizedSeq}>{quantizeLabels(quantizedNotes)}</Text>
                {quantizeChanges(quantizedNotes).length > 0 ? (
                  <Text style={styles.changesHint}>
                    {t('melodyQuantizedChanges')}: {quantizeChanges(quantizedNotes).join(', ')}
                  </Text>
                ) : null}
                <Text style={styles.rawPreviewLabel}>{t('melodyRawPreviewLabel')}</Text>
                <Text style={styles.rawPreviewSeq}>{quantizeLabels(asStaffNotes(quantizeInputs))}</Text>
              </>
            ) : (
              <Text style={styles.quantizedSeq}>{quantizeLabels(asStaffNotes(quantizeInputs))}</Text>
            )}
          </View>
        ) : null}

        {activeEvents.length > 0 && keyEst ? (
          <View style={[styles.sectionCard, styles.sectionCardCompact]}>
            <View style={styles.chordsHeader}>
              <Text style={styles.sectionTitle}>{t('melodyChordsTitle')}</Text>
              <TouchableOpacity onPress={() => setShowRoman(v => !v)} activeOpacity={0.8}>
                <Text style={styles.romanToggle}>{t('melodyChordsRoman')}{showRoman ? ' ✓' : ''}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.chordStrip} numberOfLines={2}>
              {chordSuggestions.length
                ? chordStripText(chordSuggestions, showRoman)
                : '—'}
            </Text>
            <View style={styles.chordActions}>
              <TouchableOpacity style={styles.chordBtnSm} onPress={handleSuggestChords} activeOpacity={0.85}>
                <Text style={styles.chordBtnTextSm}>{t('melodyChordsSuggest')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chordBtnSm, styles.chordBtnPrimary, chordSuggestions.length === 0 && styles.btnDisabled]}
                onPress={handleApplyChords}
                disabled={chordSuggestions.length === 0}
                activeOpacity={0.85}
              >
                <Text style={[styles.chordBtnTextSm, styles.chordBtnTextPrimary]}>{t('melodyChordsApply')}</Text>
              </TouchableOpacity>
            </View>
            {appliedChords ? (
              <Text style={styles.appliedHint}>✓ {appliedChords.join(' · ')}</Text>
            ) : null}
          </View>
        ) : null}

        {showStaff && activeEvents.length > 0 ? (
          <DualStaffView
            notes={staffNotes}
            chords={staffChords}
            maxViewportHeight={220}
            isPlaying={isPlayingMelody}
            playbackPositionMs={playbackElapsedMs}
            totalDurationMs={playbackTotalMs}
            activeNoteIndex={playbackNoteIndex}
            activeStaffIndices={activeStaffIndices}
            noteTimings={staffPlaybackTimings}
          />
        ) : null}

        <View style={styles.bottomControlsWrap}>
          <Text style={styles.bottomControlsLabel}>{t('melodyQuickControls')}</Text>
          <View style={styles.bottomControlsRow}>
            <TouchableOpacity
              onPress={start}
              style={[styles.bottomQuickBtn, isActive && styles.btnDisabled]}
              disabled={isActive}
              activeOpacity={0.8}
            >
              <Ionicons name="mic-outline" size={16} color="#e0e0e0" />
              <Text style={styles.bottomQuickBtnText}>START</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={stop}
              style={[styles.bottomQuickBtn, !isActive && styles.btnDisabled, isActive && styles.bottomQuickBtnActive]}
              disabled={!isActive}
              activeOpacity={0.8}
            >
              <Ionicons name="stop" size={16} color={isActive ? '#0a0a0f' : '#e0e0e0'} />
              <Text style={[styles.bottomQuickBtnText, isActive && styles.bottomQuickBtnTextActive]}>STOP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePlayMelody}
              style={[
                styles.bottomQuickBtn,
                styles.bottomPlayBtn,
                (playbackPayload.notes.length === 0 && !isPlayingMelody) && styles.btnDisabled,
                isPlayingMelody && styles.bottomPlayBtnActive,
              ]}
              disabled={playbackPayload.notes.length === 0 && !isPlayingMelody}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isPlayingMelody ? 'stop' : 'play'}
                size={16}
                color={isPlayingMelody ? '#0a0a0f' : '#e0e0e0'}
              />
              <Text style={[styles.bottomQuickBtnText, isPlayingMelody && styles.bottomQuickBtnTextActive]}>
                {isPlayingMelody ? t('melodyStopPlayback') : t('melodyPlay')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomInstrumentRow}>
            {(['piano', 'sine'] as MelodyInstrument[]).map(inst => (
              <TouchableOpacity
                key={inst}
                style={[styles.bottomInstChip, instrument === inst && styles.instChipActive]}
                onPress={() => setInstrument(inst)}
                activeOpacity={0.85}
              >
                <Text style={[styles.bottomInstChipText, instrument === inst && styles.instChipTextActive]}>
                  {inst === 'piano' ? t('melodyInstrumentPiano') : t('melodyInstrumentSine')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.saveBtn, sungNotes.length === 0 && styles.btnDisabled]}
            onPress={handleSaveMelody}
            disabled={sungNotes.length === 0}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={18} color="#0a0a0f" />
            <Text style={styles.saveBtnText}>{t('melodySave')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.soonRow}>
          <TouchableOpacity
            style={[styles.soonBtn, showStaff && styles.soonBtnActive]}
            onPress={() => setShowStaff(v => !v)}
            activeOpacity={0.85}
          >
            <Text style={[styles.soonText, showStaff && styles.soonTextActive]}>{t('melodyShowStaff')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.soonBtn}
            onPress={handleSuggestChords}
            disabled={activeEvents.length === 0 || !keyEst}
            activeOpacity={0.85}
          >
            <Text style={styles.soonText}>{t('melodyShowChords')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.soonBtn} disabled>
            <Text style={styles.soonText}>{t('melodySoonExport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.soonBtn} disabled>
            <Text style={styles.soonText}>{t('melodySoonStudio')}</Text>
          </TouchableOpacity>
        </View>

        {savedMelodies.length > 0 ? (
          <View style={styles.savedSection}>
            <Text style={styles.savedTitle}>{t('melodySavedList')}</Text>
            <FlatList
              data={savedMelodies}
              keyExtractor={item => item.id}
              renderItem={renderSavedItem}
              scrollEnabled={false}
            />
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  title: { color: '#e0e0e0', fontSize: 22, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  hint: { color: '#555', fontSize: 12, marginBottom: 4 },
  hintSecondary: { color: '#484858', fontSize: 11, marginBottom: 10, fontStyle: 'italic' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
    backgroundColor: '#111118',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e1e28',
  },
  noteCol: { flex: 1, minWidth: 0 },
  controlsCol: { alignItems: 'stretch', gap: 6, minWidth: 118 },
  pitchLabel: { color: '#444', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  pitchNoteBig: { fontSize: 40, fontWeight: '800', lineHeight: 44, marginTop: 2 },
  pitchMeta: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  pitchHz: { color: '#555', fontSize: 12, marginTop: 2, minHeight: 16 },
  topBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1e1e28',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  topBtnActive: { backgroundColor: '#7c4dff', borderColor: '#7c4dff' },
  playBtn: { backgroundColor: '#15151e' },
  playBtnActive: { backgroundColor: '#00e676', borderColor: '#00e676' },
  topBtnText: { color: '#e0e0e0', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  topBtnTextActive: { color: '#0a0a0f' },
  instrumentRow: { marginTop: 2 },
  instrumentLabel: { color: '#444', fontSize: 8, fontWeight: '700', marginBottom: 4 },
  instrumentChips: { flexDirection: 'row', gap: 4 },
  instChip: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: '#15151e',
    borderWidth: 1,
    borderColor: '#252532',
  },
  instChipActive: { borderColor: '#7c4dff', backgroundColor: '#1a1528' },
  instChipText: { color: '#666', fontSize: 9, fontWeight: '700' },
  instChipTextActive: { color: '#7c4dff' },
  playSourceHint: { color: '#666', fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  playHint: { color: '#888', fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  playWarning: { color: '#ffb74d', fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  quantizeRhythmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  quantizeRhythmLabel: { color: '#666', fontSize: 9, fontWeight: '600' },
  actionRow: { flexDirection: 'row', marginBottom: 10 },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c4dff',
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: { color: '#0a0a0f', fontSize: 13, fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
  sectionCard: {
    backgroundColor: '#111118',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e1e28',
  },
  sectionCardCompact: { padding: 10, marginBottom: 8, borderRadius: 12 },
  sectionTitle: {
    color: '#7c4dff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { color: '#888', fontSize: 12, fontWeight: '600' },
  quantizedSeq: { color: '#ccc', fontSize: 13, fontWeight: '600', lineHeight: 20 },
  changesHint: { color: '#555', fontSize: 10, marginTop: 6, fontStyle: 'italic' },
  rawPreviewLabel: { color: '#444', fontSize: 9, fontWeight: '700', marginTop: 8, letterSpacing: 0.8 },
  rawPreviewSeq: { color: '#777', fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 2 },
  chordsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  romanToggle: { color: '#555', fontSize: 10, fontWeight: '700' },
  chordStrip: { color: '#ddd', fontSize: 12, fontWeight: '700', marginBottom: 8, lineHeight: 16 },
  chordActions: { flexDirection: 'row', gap: 6 },
  chordBtnSm: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#15151e',
    borderWidth: 1,
    borderColor: '#252532',
    alignItems: 'center',
  },
  chordBtnPrimary: { backgroundColor: '#7c4dff', borderColor: '#7c4dff' },
  chordBtnTextSm: { color: '#aaa', fontSize: 10, fontWeight: '800' },
  chordBtnTextPrimary: { color: '#0a0a0f' },
  appliedHint: { color: '#7c4dff', fontSize: 11, marginTop: 8, fontWeight: '600' },
  bottomControlsWrap: {
    marginBottom: 10,
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e1e28',
    gap: 6,
  },
  bottomControlsLabel: {
    color: '#444',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  bottomMicBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  bottomMicBtnText: { fontSize: 10 },
  bottomControlsRow: { flexDirection: 'row', gap: 6 },
  bottomQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#1e1e28',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  bottomQuickBtnActive: { backgroundColor: '#7c4dff', borderColor: '#7c4dff' },
  bottomQuickBtnText: { color: '#e0e0e0', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  bottomQuickBtnTextActive: { color: '#0a0a0f' },
  bottomPlayBtn: { backgroundColor: '#15151e' },
  bottomPlayBtnActive: { backgroundColor: '#00e676', borderColor: '#00e676' },
  bottomInstrumentRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  bottomInstChip: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: '#15151e',
    borderWidth: 1,
    borderColor: '#252532',
    alignItems: 'center',
  },
  bottomInstChipText: { color: '#666', fontSize: 9, fontWeight: '700' },
  soonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  soonBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#15151e',
    borderWidth: 1,
    borderColor: '#252532',
  },
  soonBtnActive: { borderColor: '#7c4dff88', backgroundColor: '#1a1528' },
  soonText: { color: '#888', fontSize: 10, fontWeight: '700' },
  soonTextActive: { color: '#7c4dff' },
  savedSection: { marginBottom: 12 },
  savedTitle: {
    color: '#444',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  savedRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#1e1e28',
    marginBottom: 6,
  },
  savedRowActive: { borderColor: '#7c4dff88' },
  savedName: { color: '#ddd', fontSize: 13, fontWeight: '700' },
  savedMeta: { color: '#555', fontSize: 11, marginTop: 2 },
  signalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  signalLabel: { color: '#444', fontSize: 9, letterSpacing: 1.5, fontWeight: '700', width: 24 },
  signalTrack: { flex: 1, height: 4, backgroundColor: '#1e1e28', borderRadius: 2, overflow: 'hidden' },
  signalBar: { height: 4, backgroundColor: '#7c4dff', borderRadius: 2 },
  detectorDebugChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a1528',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#7c4dff44',
  },
  detectorDebugText: { color: '#7c4dff', fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },
  recognitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  recognitionLabel: { color: '#888', fontSize: 11, fontWeight: '600' },
  recognitionStats: { color: '#555', fontSize: 10, fontWeight: '600', marginBottom: 8, paddingHorizontal: 4 },
  errorText: { color: '#ff5252', fontSize: 12, textAlign: 'center' },
});
