import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text, Dimensions, TouchableOpacity } from 'react-native';

const { width } = Dimensions.get('window');
const PADDING_LEFT = 44;
// scroll(16*2) + mainCard(8*2) + yAxis + extra gap
const CHART_W  = width - 32 - 16 - PADDING_LEFT - 6;
const CHART_H  = 220;
const MAX_POINTS = 80;
// Latest point anchored at 60% — older points trail to the left
const ANCHOR_X = CHART_W * 0.60;

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
}

/* ─── CENTS MODE ─── */
const CENT_ZOOMS  = [500, 250, 100, 50] as const;
type  CentZoom    = typeof CENT_ZOOMS[number];
const CENT_LABELS: Record<CentZoom, string> = { 500: '±500¢', 250: '±250¢', 100: '±100¢', 50: '±50¢' };

function centsToY(cents: number, range: number) {
  const c = Math.max(-range, Math.min(range, cents));
  return CHART_H / 2 - (c / range) * (CHART_H / 2 - 4);
}
function colorForCents(c: number) {
  const a = Math.abs(c);
  if (a <= 5)  return '#00e676';
  if (a <= 15) return '#ffeb3b';
  return '#ff5252';
}

/* ─── PITCH MODE ─── */
const PITCH_ZOOMS  = [18, 12, 7, 4] as const;   // semitones each side
type  PitchZoom    = typeof PITCH_ZOOMS[number];
const PITCH_LABELS: Record<PitchZoom, string> = { 18: '3oct', 12: '2oct', 7: '1oct', 4: '½oct' };

// Subtle background tint per octave
const OCT_BG: Record<number, string> = {
  0: '#6a0dad18', 1: '#1a237e18', 2: '#006064 18',
  3: '#1b5e2018', 4: '#e6510018', 5: '#b71c1c18', 6: '#880e4f18',
};
function octBg(oct: number) { return OCT_BG[Math.max(0, Math.min(oct, 6))] ?? '#ffffff08'; }

// Visible line color per octave
const OCT_LINE: string[] = [
  '#b39ddb', '#90caf9', '#80deea', '#a5d6a7',
  '#ffcc80', '#ef9a9a', '#f48fb1',
];
function octLine(oct: number) { return OCT_LINE[Math.max(0, Math.min(oct, OCT_LINE.length - 1))]; }

function midiToY(midi: number, center: number, semiRange: number) {
  const norm = (midi - center) / semiRange;
  return CHART_H / 2 - norm * (CHART_H / 2 - 4);
}

/* ─── Component ─── */
export default function FrequencyChart({ history, active }: Props) {
  const [mode,       setMode]      = useState<'cents' | 'pitch'>('cents');
  const [centZoomI,  setCentZoomI] = useState(0);
  const [pitchZoomI, setPitchZoomI]= useState(1);  // default 2 oct

  const pts  = history.slice(-MAX_POINTS);
  // Fixed spacing; latest point always at ANCHOR_X, older ones trail left
  const ptW  = CHART_W / (MAX_POINTS - 1);
  const xOf  = (i: number) => ANCHOR_X - (pts.length - 1 - i) * ptW;

  const cycleZoom = () => {
    if (mode === 'cents')  setCentZoomI( i => (i + 1) % CENT_ZOOMS.length);
    else                   setPitchZoomI(i => (i + 1) % PITCH_ZOOMS.length);
  };

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
      const y1 = centsToY(pts[i].cents, centRange);
      const y2 = centsToY(p.cents,      centRange);
      const dx = x2-x1, dy = y2-y1;
      return { x: x1, y: y1, len: Math.sqrt(dx*dx+dy*dy),
               angle: Math.atan2(dy,dx)*(180/Math.PI), color: colorForCents(p.cents) };
    });
  }, [mode, pts, xOf, centRange]);

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
      const y1 = midiToY(cMidi + 12, centerMidi, pitchRange); // top (higher pitch)
      const y2 = midiToY(cMidi,      centerMidi, pitchRange); // bottom
      if (y1 > CHART_H || y2 < 0) continue;
      bands.push({ oct, y: Math.max(0, y1), h: Math.min(CHART_H, y2) - Math.max(0, y1) });
    }
    return bands;
  }, [minMidi, maxMidi, centerMidi, pitchRange]);

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
      const y1 = midiToY(pts[i].midi, centerMidi, pitchRange);
      const y2 = midiToY(p.midi,      centerMidi, pitchRange);
      const dx = x2-x1, dy = y2-y1;
      return { x: x1, y: y1, len: Math.sqrt(dx*dx+dy*dy),
               angle: Math.atan2(dy,dx)*(180/Math.PI),
               color: octLine(p.octave) };
    });
  }, [mode, pts, xOf, centerMidi, pitchRange]);

  const latest = pts.length > 0 ? pts[pts.length - 1] : null;
  const zoomLabel = mode === 'cents' ? CENT_LABELS[centRange] : PITCH_LABELS[pitchRange];

  return (
    <View style={styles.wrapper}>

      {/* Y-axis */}
      <View style={styles.yAxis}>
        {mode === 'cents'
          ? centLabels.map(c => (
              <Text key={c} style={[styles.yLabel, {
                top:   centsToY(c, centRange) - 7,
                color: c === 0 ? '#00e676' : Math.abs(c) === centRange ? '#ff525288' : '#444',
              }]}>
                {c > 0 ? `+${c}` : c}
              </Text>
            ))
          : pitchAxisLabels.map(m => {
              const ni  = ((m % 12) + 12) % 12;
              const oct = Math.floor(m / 12) - 1;
              const y   = midiToY(m, centerMidi, pitchRange);
              if (y < -8 || y > CHART_H + 8) return null;
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
      <TouchableOpacity onPress={cycleZoom} activeOpacity={0.95}>
        <View style={[styles.chart, { width: CHART_W, height: CHART_H }]}>

          {/* ── Cents mode backgrounds ── */}
          {mode === 'cents' && <>
            <View style={[styles.zoneBand, { backgroundColor: '#00e67610',
              top: centsToY(centRange*0.1, centRange),
              height: Math.max(0, centsToY(-centRange*0.1, centRange) - centsToY(centRange*0.1, centRange)) }]} />
            <View style={[styles.zoneBand, { backgroundColor: '#ffeb3b08',
              top: centsToY(centRange*0.3, centRange),
              height: Math.max(0, centsToY(-centRange*0.3, centRange) - centsToY(centRange*0.3, centRange)) }]} />
            {centGrids.map(c => (
              <View key={c} style={[styles.gridLine, {
                top: centsToY(c, centRange) - 0.5,
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
              const y  = midiToY(m, centerMidi, pitchRange);
              if (y < 0 || y > CHART_H) return null;
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
              ? centsToY(p.cents, centRange)
              : midiToY(p.midi,  centerMidi, pitchRange);
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
              ? centsToY(latest.cents, centRange)
              : midiToY(latest.midi, centerMidi, pitchRange);
            const color = mode === 'cents' ? colorForCents(latest.cents) : octLine(latest.octave);
            // bubble sits just right of the anchor point, clamped inside chart
            const bubbleX = Math.min(CHART_W - 58, Math.max(4, ANCHOR_X + 6));
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

          {/* ── Bottom badges ── */}
          <View style={styles.badges}>
            {/* Mode toggle */}
            <TouchableOpacity onPress={() => setMode(m => m === 'cents' ? 'pitch' : 'cents')}
              style={styles.modeBadge} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Text style={styles.modeText}>{mode === 'cents' ? '¢' : '♩'}</Text>
            </TouchableOpacity>
            {/* Zoom badge */}
            <TouchableOpacity onPress={cycleZoom}
              style={styles.zoomBadge} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Text style={styles.zoomText}>{zoomLabel}</Text>
            </TouchableOpacity>
          </View>

          {history.length === 0 && (
            <Text style={styles.emptyText}>{active ? 'play a note…' : 'start tuner'}</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  yAxis:   { width: PADDING_LEFT, height: CHART_H, position: 'relative' },
  yLabel:  { position: 'absolute', right: 6, fontSize: 10, fontWeight: '700',
             width: 34, textAlign: 'right' },
  chart: {
    position: 'relative', overflow: 'hidden',
    backgroundColor: '#0a0a12', borderRadius: 10,
    borderWidth: 1, borderColor: '#1e1e2a',
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
  badges: {
    position: 'absolute', bottom: 5, right: 5,
    flexDirection: 'row', gap: 5, alignItems: 'center',
  },
  modeBadge: {
    backgroundColor: '#1a1a2ecc', borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: '#7c4dff88',
  },
  modeText: { color: '#7c4dff', fontSize: 12, fontWeight: '900' },
  zoomBadge: {
    backgroundColor: '#1a1a2ecc', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: '#2a2a40',
  },
  zoomText: { color: '#7c4dff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  emptyText: {
    color: '#2a2a3a', fontSize: 12, position: 'absolute',
    top: '42%', left: 0, right: 0, textAlign: 'center',
  },
});
