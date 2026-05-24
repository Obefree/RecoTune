import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useLocale } from '../context/LocaleContext';

const PADDING_LEFT = 44;
const DEFAULT_CHART_H = 220;
const DEFAULT_MAX_POINTS = 80;
/** Minimum px between history points / marker columns when timestamps cluster */
const MIN_CELL_W = 14;
/** Matches `CHART_MIN_INTERVAL_MS` in useSungNoteHistory — wall-clock X scale for Melody */
const CHART_SAMPLE_INTERVAL_MS = 100;
/** Avg gap below this → treat history as time-clustered and spread by index */
const CLUSTER_AVG_GAP_MS = 55;
const MARKER_STAGGER_PX = 16;
/** Playhead anchor — slightly right of center (visible “now” line). */
const PLAYHEAD_X_RATIO = 0.58;

/** Стабильная высота блока графика в тюнере (режим ¢/ноты + зум) */
export const TUNER_CHART_BLOCK_MIN_H =
  6 + 48 + 8 + 13 + DEFAULT_CHART_H + 10 + 8 + 44 + 12;

const A4_FREQ = 440;
const A4_MIDI = 69;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface HistoryPoint {
  /** Chromatic cents to nearest semitone (±50¢) */
  cents:  number;
  /** Optional — only when instrument/string mode is enabled */
  stringCents?: number;
  targetString?: number;
  targetNote?: string;
  freq:   number;
  midi:   number;
  note:   string;
  octave: number;
  ts:     number;
  /** When false, chart skips dot/segment (unvoiced glide). Default true for tuner history. */
  voiced?: boolean;
}

export interface TuningChartTarget {
  stringNumber: number;
  note: string;
  frequency: number;
}

/** Stable sung-note onset — vertical marker on pitch chart (Melody tab). */
export interface RegisteredMarker {
  ts: number;
  midi: number;
  note: string;
  octave: number;
}

export interface PitchSegmentOverlay {
  startMs: number;
  endMs: number;
  midi: number;
  note: string;
  octave: number;
  confidence?: number;
}

interface Props {
  history: HistoryPoint[];
  active: boolean;
  /** Цель настройки (строка строя) — линия на графике, центы относительно неё */
  tuningTarget?: TuningChartTarget | null;
  /** Committed notes from sungNoteDetector — dots + vertical ticks on pitch trace */
  registeredMarkers?: RegisteredMarker[];
  segmentOverlays?: PitchSegmentOverlay[];
  chartPlotWidth?: number;
  compact?: boolean;
  chartHeight?: number;
  /** Max points shown on the time axis (Melody uses 120+). */
  maxHistoryPoints?: number;
  /** Initial horizontal zoom (Melody chart uses 2× so history is not squashed). */
  defaultHZoom?: number;
  /** Wall-clock X axis (px/ms) — Melody live chart; avoids index-based speed-up. */
  timeAxis?: boolean;
}

function nearestHistoryIndex(pts: HistoryPoint[], ts: number): number | null {
  if (pts.length === 0) return null;
  let best = 0;
  let bestD = Math.abs(pts[0].ts - ts);
  for (let i = 1; i < pts.length; i++) {
    const d = Math.abs(pts[i].ts - ts);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function medianMidi(pts: HistoryPoint[]): number {
  if (pts.length === 0) return 60;
  const sorted = pts.map(p => p.midi).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function historyClustered(pts: HistoryPoint[]): boolean {
  if (pts.length < 2) return true;
  const span = pts[pts.length - 1].ts - pts[0].ts;
  const avgGap = span / (pts.length - 1);
  return avgGap < CLUSTER_AVG_GAP_MS || span < 400;
}

interface ChartTimeLayout {
  clustered: boolean;
  effectiveCell: number;
  totalW: number;
  maxScroll: number;
  xOfIndex: (i: number) => number;
  xOfTime: (ts: number) => number;
  markerX: (markerIndex: number, ts: number) => number;
}

function buildTimeLayout(
  pts: HistoryPoint[],
  markers: RegisteredMarker[],
  chartW: number,
  cellW: number,
  timeAxis: boolean,
  scrollRightPad: number,
): ChartTimeLayout {
  const effectiveCell = Math.max(cellW, MIN_CELL_W);
  const n = pts.length;
  const mCount = markers.length;

  if (n === 0) {
    const emptyW = Math.max(chartW, mCount > 0 ? (mCount - 1) * effectiveCell + 8 : chartW);
    return {
      clustered: true,
      effectiveCell,
      totalW: emptyW,
      maxScroll: Math.max(0, emptyW - chartW),
      xOfIndex: () => 0,
      xOfTime: () => 0,
      markerX: mi => mi * effectiveCell,
    };
  }

  if (timeAxis) {
    const pxPerMs = effectiveCell / CHART_SAMPLE_INTERVAL_MS;
    const t0 = pts[0].ts;
    const xOfIndex = (i: number) => Math.max(0, (pts[i].ts - t0) * pxPerMs);
    const xOfTime = (ts: number) => Math.max(0, (ts - t0) * pxPerMs);

    const idxGroups = new Map<number, number[]>();
    markers.forEach((mk, mi) => {
      const idx = nearestHistoryIndex(pts, mk.ts) ?? 0;
      if (!idxGroups.has(idx)) idxGroups.set(idx, []);
      idxGroups.get(idx)!.push(mi);
    });
    const maxStagger = Math.max(
      0,
      ...Array.from(idxGroups.values()).map(g => (g.length - 1) * MARKER_STAGGER_PX),
    );

    const lastX = n > 0 ? xOfIndex(n - 1) : 0;
    const totalW = Math.max(chartW, lastX + scrollRightPad + maxStagger + 8);

    const markerX = (mi: number, ts: number) => {
      const idx = nearestHistoryIndex(pts, ts) ?? 0;
      const base = xOfIndex(idx);
      const group = idxGroups.get(idx) ?? [mi];
      const rank = group.indexOf(mi);
      return base + rank * MARKER_STAGGER_PX;
    };

    return {
      clustered: false,
      effectiveCell,
      totalW,
      maxScroll: Math.max(0, totalW - chartW),
      xOfIndex,
      xOfTime,
      markerX,
    };
  }

  const clustered = historyClustered(pts);

  if (clustered) {
    const idxGroups = new Map<number, number[]>();
    markers.forEach((mk, mi) => {
      const idx = nearestHistoryIndex(pts, mk.ts) ?? 0;
      if (!idxGroups.has(idx)) idxGroups.set(idx, []);
      idxGroups.get(idx)!.push(mi);
    });
    const maxStagger = Math.max(
      0,
      ...Array.from(idxGroups.values()).map(g => (g.length - 1) * MARKER_STAGGER_PX),
    );
    const slotCount = Math.max(n, mCount, 2);
    const totalW = Math.max(
      chartW,
      (slotCount - 1) * effectiveCell + maxStagger + 8,
    );
    const xOfIndex = (i: number) => i * effectiveCell;
    const xOfTime = (ts: number) => xOfIndex(nearestHistoryIndex(pts, ts) ?? 0);

    const markerX = (mi: number, ts: number) => {
      const idx = nearestHistoryIndex(pts, ts) ?? 0;
      const group = idxGroups.get(idx) ?? [mi];
      const rank = group.indexOf(mi);
      return xOfIndex(idx) + rank * MARKER_STAGGER_PX;
    };

    return {
      clustered: true,
      effectiveCell,
      totalW,
      maxScroll: Math.max(0, totalW - chartW),
      xOfIndex,
      xOfTime,
      markerX,
    };
  }

  const t0 = pts[0].ts;
  const span = Math.max(1, pts[n - 1].ts - t0);
  const idxGroups = new Map<number, number[]>();
  markers.forEach((mk, mi) => {
    const idx = nearestHistoryIndex(pts, mk.ts) ?? 0;
    if (!idxGroups.has(idx)) idxGroups.set(idx, []);
    idxGroups.get(idx)!.push(mi);
  });
  const maxStagger = Math.max(
    0,
    ...Array.from(idxGroups.values()).map(g => (g.length - 1) * MARKER_STAGGER_PX),
  );
  const totalW = Math.max(chartW, (n - 1) * effectiveCell + maxStagger + 8);
  const contentW = totalW - 8 - maxStagger;
  const xOfIndex = (i: number) => (n <= 1 ? 0 : ((pts[i].ts - t0) / span) * contentW);
  const xOfTime = (ts: number) => Math.max(0, Math.min(contentW, ((ts - t0) / span) * contentW));

  const markerX = (mi: number, ts: number) => {
    const idx = nearestHistoryIndex(pts, ts) ?? 0;
    const base = xOfIndex(idx);
    const group = idxGroups.get(idx) ?? [mi];
    const rank = group.indexOf(mi);
    return base + rank * MARKER_STAGGER_PX;
  };

  return {
    clustered: false,
    effectiveCell,
    totalW,
    maxScroll: Math.max(0, totalW - chartW),
    xOfIndex,
    xOfTime,
    markerX,
  };
}

/* ─── CENTS MODE ─── */
const CENT_ZOOMS  = [500, 250, 100, 50] as const;
type  CentZoom    = typeof CENT_ZOOMS[number];
const CENT_LABELS: Record<CentZoom, string> = { 500: '±500¢', 250: '±250¢', 100: '±100¢', 50: '±50¢' };

function centsToY(cents: number, range: number, h: number) {
  const c = Math.max(-range, Math.min(range, cents));
  return h / 2 - (c / range) * (h / 2 - 4);
}
function colorForCents(c: number) {
  const a = Math.abs(c);
  if (a <= 5)  return '#00e676';
  if (a <= 15) return '#ffeb3b';
  return '#ff5252';
}

/* ─── PITCH MODE ─── */
/** Semitones each side of center → total span = 2× (e.g. 24 → 4 octaves across chart) */
const PITCH_ZOOMS  = [24, 18, 12, 7, 4] as const;
type  PitchZoom    = typeof PITCH_ZOOMS[number];
const PITCH_LABELS: Record<PitchZoom, string> = {
  24: '4 oct', 18: '3 oct', 12: '2 oct', 7: '1 oct', 4: '½ oct',
};

// Subtle background tint per octave
const OCT_BG: Record<number, string> = {
  0: '#6a0dad18', 1: '#1a237e18', 2: '#00606418',
  3: '#1b5e2018', 4: '#e6510018', 5: '#b71c1c18', 6: '#880e4f18',
};
function octBg(oct: number) { return OCT_BG[Math.max(0, Math.min(oct, 6))] ?? '#ffffff08'; }

// Visible line color per octave
const OCT_LINE: string[] = [
  '#b39ddb', '#90caf9', '#80deea', '#a5d6a7',
  '#ffcc80', '#ef9a9a', '#f48fb1',
];
function octLine(oct: number) { return OCT_LINE[Math.max(0, Math.min(oct, OCT_LINE.length - 1))]; }

function midiToY(midi: number, center: number, semiRange: number, h: number) {
  const norm = (midi - center) / semiRange;
  return h / 2 - norm * (h / 2 - 4);
}

function clamp3(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

/** Max horizontal scroll (time axis) in px */
function maxHScrollFromTotal(totalW: number, chartW: number) {
  return Math.max(0, totalW - chartW);
}

/* ─── Component ─── */
function plotCents(p: HistoryPoint, useStringCents: boolean): number {
  return useStringCents && p.stringCents != null ? p.stringCents : p.cents;
}

export default function FrequencyChart({
  history,
  active,
  tuningTarget = null,
  registeredMarkers = [],
  segmentOverlays = [],
  chartPlotWidth,
  compact = false,
  chartHeight,
  maxHistoryPoints,
  defaultHZoom = 1,
  timeAxis = false,
}: Props) {
  const { t } = useLocale();
  const plotH = Math.max(72, Math.min(300, chartHeight ?? DEFAULT_CHART_H));
  const { width }  = useWindowDimensions();
  const padLeft    = compact ? 30 : PADDING_LEFT;
  const CHART_W    = chartPlotWidth ?? (width - 32 - 16 - PADDING_LEFT - 6);
  const ANCHOR_X   = CHART_W * PLAYHEAD_X_RATIO;
  const scrollRightPad = CHART_W - ANCHOR_X + 8;
  const maxPts = Math.max(20, maxHistoryPoints ?? DEFAULT_MAX_POINTS);
  const BASE_CELL  = useMemo(() => CHART_W / Math.max(1, maxPts - 1), [CHART_W, maxPts]);

  const [mode,       setMode]      = useState<'cents' | 'pitch'>(compact ? 'pitch' : 'cents');
  const [centZoomI,  setCentZoomI] = useState(0);
  /** Default: widest pitch range (index 0 → ±24 semitones) */
  const [pitchZoomI, setPitchZoomI]= useState(0);

  useEffect(() => {
    if (compact) setMode('pitch');
  }, [compact]);

  /** Horizontal time zoom (pinch) — vertical range still via chips */
  const [hZoom, setHZoom] = useState(defaultHZoom);
  const [hScroll, setHScroll] = useState(0);

  const hsRef = useRef(0);
  const hzRef = useRef(defaultHZoom);
  const panOriginScroll = useRef(0);
  const pinchOriginZoom = useRef(defaultHZoom);
  const followEndRef = useRef(true);

  useEffect(() => { hsRef.current = hScroll; }, [hScroll]);
  useEffect(() => { hzRef.current = hZoom; }, [hZoom]);

  const pts  = history.slice(-maxPts);
  const cellW = BASE_CELL * hZoom;

  const timeLayout = useMemo(
    () => buildTimeLayout(pts, registeredMarkers, CHART_W, cellW, timeAxis, scrollRightPad),
    [pts, registeredMarkers, CHART_W, cellW, timeAxis, scrollRightPad],
  );
  const { totalW, maxScroll, xOfIndex, xOfTime, markerX } = timeLayout;
  const xOf = xOfIndex;
  const useStringCents = tuningTarget != null;

  useEffect(() => {
    if (history.length === 0) {
      setHScroll(0);
      setHZoom(defaultHZoom);
      followEndRef.current = true;
    }
  }, [history.length, defaultHZoom]);

  const lastTs = pts[pts.length - 1]?.ts ?? 0;
  const lastEndX = pts.length > 0 ? xOfIndex(pts.length - 1) : 0;

  useEffect(() => {
    if (pts.length === 0) return;
    setHScroll(prev => {
      const clamped = clamp3(prev, 0, maxScroll);
      if (!followEndRef.current) return clamped;
      return clamp3(lastEndX - ANCHOR_X, 0, maxScroll);
    });
  }, [lastTs, pts.length, lastEndX, maxScroll, ANCHOR_X]);

  const beginPan = useCallback(() => {
    panOriginScroll.current = hsRef.current;
  }, []);

  const onPanUpdate = useCallback((translationX: number) => {
    const next = clamp3(panOriginScroll.current - translationX, 0, maxScroll);
    followEndRef.current = next >= maxScroll - 24;
    setHScroll(next);
  }, [maxScroll]);

  const beginPinch = useCallback(() => {
    pinchOriginZoom.current = hzRef.current;
  }, []);

  const onPinchUpdate = useCallback((scale: number) => {
    const z = clamp3(pinchOriginZoom.current * scale, 0.35, 4);
    hzRef.current = z;
    setHZoom(z);
    setHScroll(s => clamp3(s, 0, maxHScrollFromTotal(
      buildTimeLayout(pts, registeredMarkers, CHART_W, BASE_CELL * z, timeAxis, scrollRightPad).totalW,
      CHART_W,
    )));
  }, [pts, registeredMarkers, BASE_CELL, CHART_W, timeAxis, scrollRightPad]);

  const scrollToStart = useCallback(() => {
    followEndRef.current = false;
    setHScroll(0);
  }, []);

  const composedGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Pan()
          .activeOffsetX([-12, 12])
          .failOffsetY([-14, 14])
          .onBegin(() => {
            runOnJS(beginPan)();
          })
          .onUpdate(e => {
            runOnJS(onPanUpdate)(e.translationX);
          }),
        Gesture.Pinch()
          .onBegin(() => {
            runOnJS(beginPinch)();
          })
          .onUpdate(e => {
            runOnJS(onPinchUpdate)(e.scale);
          }),
      ),
    [beginPan, onPanUpdate, beginPinch, onPinchUpdate],
  );

  /* ── CENTS mode geometry ── */
  const centRange  = CENT_ZOOMS[centZoomI];
  const centStep   = centRange >= 500 ? 100 : centRange >= 250 ? 50 : centRange >= 100 ? 25 : 10;
  const centGrids  = [] as number[];
  for (let c = -centRange; c <= centRange; c += centStep) centGrids.push(c);
  const centLabels = centRange >= 500 ? [-500,-250,0,250,500]
    : centRange >= 250 ? [-250,-100,0,100,250]
    : centRange >= 100 ? [-100,-50,0,50,100]
    : [-50,-25,0,25,50];

  const isPlotted = (p: HistoryPoint) => p.voiced !== false;

  const centSegs = useMemo(() => {
    if (mode !== 'cents' || pts.length < 2) return [];
    return pts.slice(1).map((p, i) => {
      if (!isPlotted(pts[i]) || !isPlotted(p)) return null;
      const x1 = xOf(i), x2 = xOf(i + 1);
      const c1 = plotCents(pts[i], useStringCents);
      const c2 = plotCents(p, useStringCents);
      const y1 = centsToY(c1, centRange, plotH);
      const y2 = centsToY(c2, centRange, plotH);
      const dx = x2-x1, dy = y2-y1;
      return { x: x1, y: y1, len: Math.sqrt(dx*dx+dy*dy),
               angle: Math.atan2(dy,dx)*(180/Math.PI), color: colorForCents(c2) };
    }).filter((s): s is NonNullable<typeof s> => s != null);
  }, [mode, pts, cellW, centRange, plotH, useStringCents]);

  /* ── PITCH mode geometry ── */
  const pitchRange  = PITCH_ZOOMS[pitchZoomI];

  const targetMidi = useMemo(() => {
    if (!tuningTarget) return null;
    return 12 * Math.log2(tuningTarget.frequency / A4_FREQ) + A4_MIDI;
  }, [tuningTarget]);

  const centerMidiRaw = useMemo(() => {
    if (targetMidi != null) return targetMidi;
    if (pts.length === 0) return 60;
    const sample = pts.length >= 20 ? pts.slice(-20) : pts;
    return medianMidi(sample);
  }, [pts, targetMidi]);

  const [centerMidiSmooth, setCenterMidiSmooth] = useState(60);
  useEffect(() => {
    if (targetMidi != null) {
      setCenterMidiSmooth(targetMidi);
      return;
    }
    setCenterMidiSmooth(centerMidiRaw);
  }, [centerMidiRaw, targetMidi]);

  const centerMidi = targetMidi != null ? targetMidi : centerMidiSmooth;
  /** Stable Y for markers — median of recent history, no drift between frames */
  const markerCenterMidi = centerMidiRaw;

  const minMidi = centerMidi - pitchRange;
  const maxMidi = centerMidi + pitchRange;

  const octBands = useMemo(() => {
    const bands: { oct: number; y: number; h: number }[] = [];
    const lo = Math.floor(minMidi / 12) - 2;
    const hi = Math.ceil(maxMidi  / 12) + 2;
    for (let oct = lo; oct <= hi; oct++) {
      const cMidi = (oct + 1) * 12;   // C of this octave
      const y1 = midiToY(cMidi + 12, centerMidi, pitchRange, plotH);
      const y2 = midiToY(cMidi,      centerMidi, pitchRange, plotH);
      if (y1 > plotH || y2 < 0) continue;
      bands.push({ oct, y: Math.max(0, y1), h: Math.min(plotH, y2) - Math.max(0, y1) });
    }
    return bands;
  }, [minMidi, maxMidi, centerMidi, pitchRange, plotH]);

  const pitchGrids = useMemo(() => {
    const lines: number[] = [];
    for (let m = Math.floor(minMidi); m <= Math.ceil(maxMidi); m++) lines.push(m);
    return lines;
  }, [minMidi, maxMidi]);

  const pitchAxisLabels = useMemo(() => {
    const labels: number[] = [];
    for (let m = Math.floor(minMidi) - 1; m <= Math.ceil(maxMidi) + 1; m++) {
      const ni = ((m % 12) + 12) % 12;
      const isC = ni === 0;
      const isEGA = [4, 7, 9].includes(ni);
      if (isC) labels.push(m);
      else if (pitchRange <= 7  && isEGA)  labels.push(m);
      else if (pitchRange <= 4)            labels.push(m);
    }
    return labels;
  }, [minMidi, maxMidi, pitchRange]);

  const pitchSegs = useMemo(() => {
    if (mode !== 'pitch' || pts.length < 2) return [];
    return pts.slice(1).map((p, i) => {
      if (!isPlotted(pts[i]) || !isPlotted(p)) return null;
      const x1 = xOf(i), x2 = xOf(i + 1);
      const y1 = midiToY(pts[i].midi, centerMidi, pitchRange, plotH);
      const y2 = midiToY(p.midi,      centerMidi, pitchRange, plotH);
      const dx = x2-x1, dy = y2-y1;
      return { x: x1, y: y1, len: Math.sqrt(dx*dx+dy*dy),
               angle: Math.atan2(dy,dx)*(180/Math.PI),
               color: octLine(p.octave) };
    }).filter((s): s is NonNullable<typeof s> => s != null);
  }, [mode, pts, cellW, centerMidi, pitchRange, plotH]);

  const segmentBlocks = useMemo(() => {
    if (mode !== 'pitch' || segmentOverlays.length === 0 || pts.length === 0) return [];
    return segmentOverlays.map((seg, i) => {
      const x1 = xOfTime(seg.startMs);
      const x2 = Math.max(x1 + 8, xOfTime(seg.endMs));
      const y = midiToY(seg.midi, centerMidi, pitchRange, plotH);
      if (y < -24 || y > plotH + 24) return null;
      return {
        key: `${seg.startMs}-${seg.midi}-${i}`,
        left: x1,
        top: Math.max(1, Math.min(plotH - 20, y - 10)),
        width: Math.max(8, x2 - x1),
        label: `${seg.note}${seg.octave}`,
        confidence: seg.confidence ?? 0,
      };
    }).filter((s): s is NonNullable<typeof s> => s != null);
  }, [mode, segmentOverlays, pts.length, xOfTime, centerMidi, pitchRange, plotH]);

  const latest = pts.length > 0 ? pts[pts.length - 1] : null;
  const blockW = padLeft + CHART_W;

  return (
    <View style={[
      styles.outer,
      compact && styles.outerCompact,
      { width: blockW, minHeight: compact ? undefined : TUNER_CHART_BLOCK_MIN_H },
    ]}>
      {!compact && (
        <>
      <View style={styles.modeRow}>
        <TouchableOpacity
          onPress={() => setMode('cents')}
          style={[styles.modeChoice, mode === 'cents' && styles.modeChoiceActive]}
          activeOpacity={0.85}>
          <Text style={[styles.modeChoiceIcon, mode === 'cents' && styles.modeChoiceTextActive]}>¢</Text>
          <Text style={[styles.modeChoiceLabel, mode === 'cents' && styles.modeChoiceTextActive]}>{t('chartCents')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode('pitch')}
          style={[styles.modeChoice, mode === 'pitch' && styles.modeChoiceActivePitch]}
          activeOpacity={0.85}>
          <Text style={[styles.modeChoiceIcon, mode === 'pitch' && styles.modeChoiceTextActivePitch]}>♩</Text>
          <Text style={[styles.modeChoiceLabel, mode === 'pitch' && styles.modeChoiceTextActivePitch]}>{t('chartNotes')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.gestureHint}>{t('chartGestureHint')}</Text>
      {registeredMarkers.length > 0 ? (
        <Text style={styles.gestureHintSub}>{t('chartStableMarkersHint')}</Text>
      ) : null}
        </>
      )}

      <View style={styles.chartRow}>
      {/* Y-axis */}
      <View style={[styles.yAxis, { width: padLeft, height: plotH }]}>
        {mode === 'cents'
          ? centLabels.map(c => (
              <Text key={c} style={[styles.yLabel, {
                top:   centsToY(c, centRange, plotH) - 7,
                color: c === 0 ? '#00e676' : Math.abs(c) === centRange ? '#ff525288' : '#444',
              }]}>
                {c > 0 ? `+${c}` : c}
              </Text>
            ))
          : pitchAxisLabels.map(m => {
              const ni  = ((m % 12) + 12) % 12;
              const oct = Math.floor(m / 12) - 1;
              const y   = midiToY(m, centerMidi, pitchRange, plotH);
              if (y < -8 || y > plotH + 8) return null;
              return (
                <Text key={m} style={[styles.yLabel, {
                  top: y - 7,
                  color: ni === 0 ? '#ffffff99' : '#555',
                  fontSize: ni === 0 ? 10 : 9,
                }]}>
                  {NOTE_NAMES[ni]}{ni === 0 ? oct : ''}
                </Text>
              );
            })
        }
      </View>

      {/* Chart */}
        <GestureDetector gesture={composedGesture}>
          <View style={[styles.chart, { width: CHART_W, height: plotH }]}>
            <View
              style={[styles.chartInner, { width: totalW, height: plotH, transform: [{ translateX: -hScroll }] }]}
              collapsable={false}>

          {/* ── Cents mode backgrounds ── */}
          {mode === 'cents' && <>
            <View style={[styles.zoneBand, { backgroundColor: '#00e67610',
              top: centsToY(centRange*0.1, centRange, plotH),
              height: Math.max(0, centsToY(-centRange*0.1, centRange, plotH) - centsToY(centRange*0.1, centRange, plotH)) }]} />
            <View style={[styles.zoneBand, { backgroundColor: '#ffeb3b08',
              top: centsToY(centRange*0.3, centRange, plotH),
              height: Math.max(0, centsToY(-centRange*0.3, centRange, plotH) - centsToY(centRange*0.3, centRange, plotH)) }]} />
            {centGrids.map(c => (
              <View key={c} style={[styles.gridLine, {
                top: centsToY(c, centRange, plotH) - 0.5,
                backgroundColor: c === 0 ? '#00e67650' : '#ffffff0a',
                height: c === 0 ? 1.5 : 1,
              }]} />
            ))}
          </>}

          {/* ── Pitch mode backgrounds ── */}
          {mode === 'pitch' && <>
            {octBands.map(b => (
              <View key={b.oct} style={[styles.zoneBand, { backgroundColor: octBg(b.oct),
                top: b.y, height: Math.max(0, b.h) }]} />
            ))}
            {pitchGrids.map(m => {
              const ni = ((m % 12) + 12) % 12;
              const y  = midiToY(m, centerMidi, pitchRange, plotH);
              if (y < 0 || y > plotH) return null;
              return (
                <View key={m} style={[styles.gridLine, {
                  top: y - 0.5,
                  backgroundColor: ni === 0 ? '#ffffff35' : '#ffffff09',
                  height: ni === 0 ? 1.5 : 1,
                }]} />
              );
            })}
          </>}

          {/* ── Line segments ── */}
          {mode === 'pitch' && segmentBlocks.map(seg => (
            <View
              key={seg.key}
              pointerEvents="none"
              style={[
                styles.segmentBlock,
                {
                  left: seg.left,
                  top: seg.top,
                  width: seg.width,
                  opacity: Math.max(0.28, Math.min(0.6, 0.24 + seg.confidence * 0.5)),
                },
              ]}
            >
              {seg.width >= 34 ? (
                <Text style={styles.segmentBlockText} numberOfLines={1}>{seg.label}</Text>
              ) : null}
            </View>
          ))}

          {(mode === 'cents' ? centSegs : pitchSegs).map((s, i) => (
            <View key={i} style={{
              position: 'absolute', left: s.x, top: s.y - 1.5,
              width: s.len + 0.5, height: 3, borderRadius: 1.5,
              backgroundColor: s.color,
              transform: [{ rotate: `${s.angle}deg` }],
              transformOrigin: '0 50%',
            } as any} />
          ))}

          {/* ── Dots ── */}
          {tuningTarget && mode === 'pitch' && targetMidi != null && (() => {
            const y = midiToY(targetMidi, centerMidi, pitchRange, plotH);
            if (y < 0 || y > plotH) return null;
            return (
              <>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute', left: 0, right: 0, top: y - 1,
                    height: 2, backgroundColor: '#00e67688',
                  }}
                />
                <View pointerEvents="none" style={[styles.targetBadge, { top: Math.max(2, y - 20), left: 6 }]}>
                  <Text style={styles.targetBadgeText}>⌖ {tuningTarget.note}</Text>
                </View>
              </>
            );
          })()}

          {tuningTarget && mode === 'cents' && (
            <View
              pointerEvents="none"
              style={[styles.targetBadge, { top: plotH - 22, left: 6 }]}
            >
              <Text style={styles.targetBadgeText}>
                ⌖ {t('chartTargetString')} {tuningTarget.stringNumber} · {tuningTarget.note}
              </Text>
            </View>
          )}

          {mode === 'pitch' && registeredMarkers.map((m, mi) => {
            const x = markerX(mi, m.ts);
            const y = midiToY(m.midi, markerCenterMidi, pitchRange, plotH);
            if (y < -20 || y > plotH + 20) return null;
            const label = `${m.note}${m.octave}`;
            const chipTop = mi % 2 === 0
              ? Math.max(2, y - 28)
              : Math.min(plotH - 22, y + 10);
            const chipLeft = Math.min(totalW - 40, Math.max(2, x - 14));
            return (
              <React.Fragment key={`reg-${m.ts}-${mi}`}>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: x - 0.5,
                    top: 0,
                    width: 1.5,
                    height: plotH,
                    backgroundColor: '#7c4dff55',
                  }}
                />
                <View
                  pointerEvents="none"
                  style={[styles.markerChip, { left: chipLeft, top: chipTop }]}
                >
                  <Text style={styles.markerChipText}>{label}</Text>
                </View>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: x - 5,
                    top: y - 5,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#7c4dff',
                    borderWidth: 1.5,
                    borderColor: '#e8e0ff',
                  }}
                />
              </React.Fragment>
            );
          })}

          {pts.map((p, i) => {
            if (!isPlotted(p)) return null;
            const x = xOf(i);
            const c = plotCents(p, useStringCents);
            const y = mode === 'cents'
              ? centsToY(c, centRange, plotH)
              : midiToY(p.midi,  centerMidi, pitchRange, plotH);
            const color = mode === 'cents' ? colorForCents(c) : octLine(p.octave);
            return (
              <View key={i} style={{
                position: 'absolute',
                left: x - 3, top: y - 3,
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: color,
                opacity: i === pts.length - 1 ? 1 : 0.55,
              }} />
            );
          })}

          {/* ── Latest note bubble ── */}
          {latest && (() => {
            const lc = plotCents(latest, useStringCents);
            const y = mode === 'cents'
              ? centsToY(lc, centRange, plotH)
              : midiToY(latest.midi, centerMidi, pitchRange, plotH);
            const color = mode === 'cents' ? colorForCents(lc) : octLine(latest.octave);
            const lx = xOfIndex(pts.length - 1);
            const bubbleX = Math.min(totalW - 58, Math.max(4, lx + 6));
            const label = tuningTarget && mode === 'cents'
              ? `${t('chartTargetString')}${latest.targetString ?? tuningTarget.stringNumber} ${lc >= 0 ? '+' : ''}${lc}¢`
              : `${latest.note}${latest.octave}`;
            return (
              <View style={[styles.noteBubble, {
                left: bubbleX,
                top:  Math.max(2, y - 26),
              }]}>
                <Text style={[styles.noteBubbleText, { color }]}>
                  {label}
                  {mode === 'cents' && !tuningTarget && (
                    <Text style={styles.centsHint}>
                      {lc >= 0 ? ` +${lc}¢` : ` ${lc}¢`}
                    </Text>
                  )}
                </Text>
              </View>
            );
          })()}

            </View>

            {history.length === 0 && (
              <Text style={styles.emptyText}>{active ? t('chartPlayNote') : t('chartStartTuner')}</Text>
            )}

            {history.length > 0 && hScroll > 20 && maxScroll > 0 ? (
              <TouchableOpacity
                style={styles.scrollStartChip}
                onPress={scrollToStart}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.scrollStartChipText}>{t('chartScrollToStart')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </GestureDetector>
      </View>

      {/* Zoom presets — one tap each, large rows */}
      {!compact && (
      <View style={[styles.zoomPanel, { width: blockW }]}>
        <Text style={styles.zoomPanelTitle}>{mode === 'cents' ? t('chartRangeCents') : t('chartRangeOctaves')}</Text>
        <View style={styles.zoomChipsRow}>
          {mode === 'cents'
            ? CENT_ZOOMS.map((z, i) => (
                <TouchableOpacity
                  key={z}
                  onPress={() => setCentZoomI(i)}
                  style={[styles.zoomChip, centZoomI === i && styles.zoomChipActive]}
                  activeOpacity={0.85}>
                  <Text style={[styles.zoomChipText, centZoomI === i && styles.zoomChipTextActive]}>
                    {CENT_LABELS[z]}
                  </Text>
                </TouchableOpacity>
              ))
            : PITCH_ZOOMS.map((z, i) => (
                <TouchableOpacity
                  key={z}
                  onPress={() => setPitchZoomI(i)}
                  style={[styles.zoomChip, pitchZoomI === i && styles.zoomChipActivePitch]}
                  activeOpacity={0.85}>
                  <Text style={[styles.zoomChipText, pitchZoomI === i && styles.zoomChipTextActivePitch]}>
                    {PITCH_LABELS[z]}
                  </Text>
                </TouchableOpacity>
              ))}
        </View>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer:   { paddingVertical: 4 },
  outerCompact: { paddingVertical: 0 },
  chartRow:{ flexDirection: 'row', alignItems: 'flex-start' },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  gestureHint: {
    color: '#3a3a55',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 13,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  gestureHintSub: {
    color: '#4a3a6a',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 13,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  modeChoice: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#111118',
    borderWidth: 2,
    borderColor: '#2a2a38',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modeChoiceActive: {
    borderColor: '#00e676',
    backgroundColor: '#00e67618',
  },
  modeChoiceActivePitch: {
    borderColor: '#7c4dff',
    backgroundColor: '#7c4dff18',
  },
  modeChoiceIcon: { fontSize: 22, fontWeight: '900', color: '#555' },
  modeChoiceLabel: { fontSize: 13, fontWeight: '800', color: '#666', letterSpacing: 0.5 },
  modeChoiceTextActive: { color: '#00e676' },
  modeChoiceTextActivePitch: { color: '#7c4dff' },
  zoomPanel: {
    marginTop: 10,
  },
  zoomPanelTitle: {
    color: '#444',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  zoomChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoomChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#15151e',
    borderWidth: 2,
    borderColor: '#252532',
  },
  zoomChipActive: {
    borderColor: '#00e676',
    backgroundColor: '#00e67614',
  },
  zoomChipActivePitch: {
    borderColor: '#7c4dff',
    backgroundColor: '#7c4dff14',
  },
  zoomChipText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '800',
  },
  zoomChipTextActive: { color: '#00e676' },
  zoomChipTextActivePitch: { color: '#bb99ff' },
  yAxis:   { position: 'relative' },
  yLabel:  { position: 'absolute', right: 6, fontSize: 10, fontWeight: '700',
             width: 34, textAlign: 'right' },
  chart: {
    position: 'relative', overflow: 'hidden',
    backgroundColor: '#0a0a12', borderRadius: 10,
    borderWidth: 1, borderColor: '#1e1e2a',
  },
  chartInner: {
    position: 'relative',
    overflow: 'hidden',
  },
  zoneBand: { position: 'absolute', left: 0, right: 0 },
  gridLine: { position: 'absolute', left: 0, right: 0 },
  segmentBlock: {
    position: 'absolute',
    height: 20,
    borderRadius: 5,
    backgroundColor: '#7c4dff',
    borderWidth: 1,
    borderColor: '#d4c4ff66',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentBlockText: {
    color: '#f2ecff',
    fontSize: 8,
    fontWeight: '900',
  },
  noteBubble: {
    position: 'absolute', backgroundColor: '#1a1a2e',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#2a2a40',
  },
  noteBubbleText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  centsHint: { fontSize: 9, fontWeight: '600', color: '#888' },
  emptyText: {
    color: '#2a2a3a', fontSize: 12, position: 'absolute',
    top: '42%', left: 0, right: 0, textAlign: 'center',
  },
  targetBadge: {
    position: 'absolute',
    backgroundColor: '#00e67622',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#00e67655',
  },
  targetBadgeText: { color: '#00e676', fontSize: 10, fontWeight: '800' },
  markerChip: {
    position: 'absolute',
    backgroundColor: '#1a1528ee',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#7c4dff88',
    zIndex: 4,
  },
  markerChipText: { color: '#d4c4ff', fontSize: 9, fontWeight: '800' },
  scrollStartChip: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 6,
    backgroundColor: '#1a1528ee',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#7c4dff66',
  },
  scrollStartChipText: { color: '#bb99ff', fontSize: 9, fontWeight: '800' },
});
