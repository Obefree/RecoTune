import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const PADDING_LEFT = 44;
const DEFAULT_CHART_H = 220;
const MAX_POINTS   = 80;

const A4_FREQ = 440;
const A4_MIDI = 69;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface HistoryPoint {
  cents:  number;   // cents deviation from nearest note (for tuner mode)
  freq:   number;   // smoothed Hz (for pitch mode)
  midi:   number;   // exact MIDI (with fractional cents)
  note:   string;
  octave: number;
  ts:     number;
}

interface Props {
  history: HistoryPoint[];
  active: boolean;
  /** When set, chart plot uses this width (embedded column). Otherwise derived from window. */
  chartPlotWidth?: number;
  /** Tight layout: narrower axis, pitch mode, less chrome (pinch & pan still work). */
  compact?: boolean;
  /** Vertical plot height (default 220). Use ~100–140 in tight layouts. */
  chartHeight?: number;
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
function maxHScroll(nPts: number, cellW: number, chartW: number) {
  if (nPts <= 1) return 0;
  const tw = Math.max(chartW, (nPts - 1) * cellW + 8);
  return Math.max(0, tw - chartW);
}

/* ─── Component ─── */
export default function FrequencyChart({
  history, active, chartPlotWidth, compact = false, chartHeight,
}: Props) {
  const plotH = Math.max(72, Math.min(300, chartHeight ?? DEFAULT_CHART_H));
  const { width }  = useWindowDimensions();
  const padLeft    = compact ? 30 : PADDING_LEFT;
  const CHART_W    = chartPlotWidth ?? (width - 32 - 16 - PADDING_LEFT - 6);
  const ANCHOR_X   = CHART_W * 0.60;
  const BASE_CELL  = useMemo(() => CHART_W / Math.max(1, MAX_POINTS - 1), [CHART_W]);

  const [mode,       setMode]      = useState<'cents' | 'pitch'>(compact ? 'pitch' : 'cents');
  const [centZoomI,  setCentZoomI] = useState(0);
  /** Default: widest pitch range (index 0 → ±24 semitones) */
  const [pitchZoomI, setPitchZoomI]= useState(0);

  useEffect(() => {
    if (compact) setMode('pitch');
  }, [compact]);

  /** Horizontal time zoom (pinch) — vertical range still via chips */
  const [hZoom, setHZoom] = useState(1);
  const [hScroll, setHScroll] = useState(0);

  const hsRef = useRef(0);
  const hzRef = useRef(1);
  const panOriginScroll = useRef(0);
  const pinchOriginZoom = useRef(1);

  useEffect(() => { hsRef.current = hScroll; }, [hScroll]);
  useEffect(() => { hzRef.current = hZoom; }, [hZoom]);

  const pts  = history.slice(-MAX_POINTS);
  const cellW = BASE_CELL * hZoom;
  const totalW = Math.max(CHART_W, Math.max(0, pts.length - 1) * cellW + 8);
  const xOf = (i: number) => i * cellW;

  useEffect(() => {
    if (history.length === 0) {
      setHScroll(0);
      setHZoom(1);
    }
  }, [history.length]);

  useEffect(() => {
    const max = maxHScroll(pts.length, cellW, CHART_W);
    setHScroll(s => clamp3(s, 0, max));
  }, [hZoom, pts.length, cellW, CHART_W]);

  const lastTs = pts[pts.length - 1]?.ts ?? 0;

  useEffect(() => {
    if (pts.length === 0) return;
    const max = maxHScroll(pts.length, cellW, CHART_W);
    setHScroll(prev => {
      const nearEnd = prev >= max - 24;
      if (nearEnd) {
        return clamp3((pts.length - 1) * cellW - ANCHOR_X, 0, max);
      }
      return clamp3(prev, 0, max);
    });
  }, [lastTs, pts.length]);

  const beginPan = useCallback(() => {
    panOriginScroll.current = hsRef.current;
  }, []);

  const onPanUpdate = useCallback((translationX: number) => {
    const cw = BASE_CELL * hzRef.current;
    const max = maxHScroll(pts.length, cw, CHART_W);
    const next = clamp3(panOriginScroll.current - translationX, 0, max);
    setHScroll(next);
  }, [pts.length, BASE_CELL, CHART_W]);

  const beginPinch = useCallback(() => {
    pinchOriginZoom.current = hzRef.current;
  }, []);

  const onPinchUpdate = useCallback((scale: number) => {
    const z = clamp3(pinchOriginZoom.current * scale, 0.35, 4);
    hzRef.current = z;
    setHZoom(z);
    const cw = BASE_CELL * z;
    const max = maxHScroll(pts.length, cw, CHART_W);
    setHScroll(s => clamp3(s, 0, max));
  }, [pts.length, BASE_CELL, CHART_W]);

  const composedGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Pan()
          .activeOffsetX([-10, 10])
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

  const centSegs = useMemo(() => {
    if (mode !== 'cents' || pts.length < 2) return [];
    return pts.slice(1).map((p, i) => {
      const x1 = xOf(i), x2 = xOf(i + 1);
      const y1 = centsToY(pts[i].cents, centRange, plotH);
      const y2 = centsToY(p.cents,      centRange, plotH);
      const dx = x2-x1, dy = y2-y1;
      return { x: x1, y: y1, len: Math.sqrt(dx*dx+dy*dy),
               angle: Math.atan2(dy,dx)*(180/Math.PI), color: colorForCents(p.cents) };
    });
  }, [mode, pts, cellW, centRange, plotH]);

  /* ── PITCH mode geometry ── */
  const pitchRange  = PITCH_ZOOMS[pitchZoomI];

  const centerMidi = useMemo(() => {
    if (pts.length === 0) return 60;
    const tail = pts.slice(-12);
    return tail.reduce((s, p) => s + p.midi, 0) / tail.length;
  }, [pts]);

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
      const x1 = xOf(i), x2 = xOf(i + 1);
      const y1 = midiToY(pts[i].midi, centerMidi, pitchRange, plotH);
      const y2 = midiToY(p.midi,      centerMidi, pitchRange, plotH);
      const dx = x2-x1, dy = y2-y1;
      return { x: x1, y: y1, len: Math.sqrt(dx*dx+dy*dy),
               angle: Math.atan2(dy,dx)*(180/Math.PI),
               color: octLine(p.octave) };
    });
  }, [mode, pts, cellW, centerMidi, pitchRange, plotH]);

  const latest = pts.length > 0 ? pts[pts.length - 1] : null;
  const blockW = padLeft + CHART_W;

  return (
    <View style={[styles.outer, compact && styles.outerCompact, { width: blockW }]}>
      {!compact && (
        <>
      <View style={styles.modeRow}>
        <TouchableOpacity
          onPress={() => setMode('cents')}
          style={[styles.modeChoice, mode === 'cents' && styles.modeChoiceActive]}
          activeOpacity={0.85}>
          <Text style={[styles.modeChoiceIcon, mode === 'cents' && styles.modeChoiceTextActive]}>¢</Text>
          <Text style={[styles.modeChoiceLabel, mode === 'cents' && styles.modeChoiceTextActive]}>ЦЕНТЫ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode('pitch')}
          style={[styles.modeChoice, mode === 'pitch' && styles.modeChoiceActivePitch]}
          activeOpacity={0.85}>
          <Text style={[styles.modeChoiceIcon, mode === 'pitch' && styles.modeChoiceTextActivePitch]}>♩</Text>
          <Text style={[styles.modeChoiceLabel, mode === 'pitch' && styles.modeChoiceTextActivePitch]}>НОТЫ</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.gestureHint}>
        Свайп влево/вправо — листать · Щипок двумя пальцами — масштаб по времени
      </Text>
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
          {pts.map((p, i) => {
            const x = xOf(i);
            const y = mode === 'cents'
              ? centsToY(p.cents, centRange, plotH)
              : midiToY(p.midi,  centerMidi, pitchRange, plotH);
            const color = mode === 'cents' ? colorForCents(p.cents) : octLine(p.octave);
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
            const y = mode === 'cents'
              ? centsToY(latest.cents, centRange, plotH)
              : midiToY(latest.midi, centerMidi, pitchRange, plotH);
            const color = mode === 'cents' ? colorForCents(latest.cents) : octLine(latest.octave);
            const lx = (pts.length - 1) * cellW;
            const bubbleX = Math.min(totalW - 58, Math.max(4, lx + 6));
            return (
              <View style={[styles.noteBubble, {
                left: bubbleX,
                top:  Math.max(2, y - 26),
              }]}>
                <Text style={[styles.noteBubbleText, { color }]}>
                  {latest.note}{latest.octave}
                  {mode === 'cents' && (
                    <Text style={styles.centsHint}>
                      {latest.cents >= 0 ? ` +${latest.cents}¢` : ` ${latest.cents}¢`}
                    </Text>
                  )}
                </Text>
              </View>
            );
          })()}

            </View>

            {history.length === 0 && (
              <Text style={styles.emptyText}>{active ? 'play a note…' : 'start tuner'}</Text>
            )}
          </View>
        </GestureDetector>
      </View>

      {/* Zoom presets — one tap each, large rows */}
      {!compact && (
      <View style={[styles.zoomPanel, { width: blockW }]}>
        <Text style={styles.zoomPanelTitle}>{mode === 'cents' ? 'Диапазон (центы)' : 'Диапазон (октавы)'}</Text>
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
});
