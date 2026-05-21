import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { HistoryPoint } from './FrequencyChart';

const STRIP_H = 68;
const RANGE   = 50;
const PAD_L   = 30;
const MAX_PTS = 80;

function centsToY(cents: number): number {
  const c = Math.max(-RANGE, Math.min(RANGE, cents));
  return STRIP_H / 2 - (c / RANGE) * (STRIP_H / 2 - 3);
}

function plotCents(p: HistoryPoint): number {
  return p.cents;
}

function colorForCents(c: number): string {
  const a = Math.abs(c);
  if (a <= 5)  return '#00e676';
  if (a <= 15) return '#ffeb3b';
  if (a <= 50) return '#ffa040';
  return '#ff5252';
}

interface Props {
  history: HistoryPoint[];
}

export default function MiniCentsStrip({ history }: Props) {
  const { width } = useWindowDimensions();
  const STRIP_W   = width - 32 - 16 - PAD_L - 6;
  const ANCHOR_X  = STRIP_W * 0.60;

  const pts  = history.slice(-MAX_PTS);
  const ptW  = STRIP_W / (MAX_PTS - 1);
  const xOf  = (i: number) => ANCHOR_X - (pts.length - 1 - i) * ptW;

  const segments = useMemo(() => {
    if (pts.length < 2) return [];
    return pts.slice(1).map((p, i) => {
      const x1 = xOf(i), x2 = xOf(i + 1);
      const y1 = centsToY(plotCents(pts[i])), y2 = centsToY(plotCents(p));
      const dx = x2 - x1, dy = y2 - y1;
      const len   = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      return { x: x1, y: y1, len, angle, color: colorForCents(plotCents(p)) };
    });
  }, [pts, xOf]);

  return (
    <View style={styles.wrapper}>
      {/* Y labels */}
      <View style={styles.yAxis}>
        {([-50, -25, 0, 25, 50] as const).map(c => (
          <Text key={c} style={[styles.yLabel, {
            top: centsToY(c) - 6,
            color: c === 0 ? '#00e676aa' : '#33333a',
          }]}>
            {c === 0 ? '0' : (c > 0 ? `+${c}` : c)}
          </Text>
        ))}
      </View>

      {/* Strip */}
      <View style={[styles.strip, { width: STRIP_W, height: STRIP_H }]}>

        {/* Zone bands */}
        <View style={[styles.band, styles.bandGreen]} />
        <View style={[styles.band, styles.bandYellow]} />

        {/* Grid lines ±50, ±100, ±200, ±300, 0 */}
        {([-50,-25,-10,0,10,25,50] as const).map(c => (
          <View key={c} style={[styles.gridLine, {
            top: centsToY(c) - 0.5,
            backgroundColor: c === 0 ? '#00e67640' : '#ffffff07',
            height: c === 0 ? 1.5 : 1,
          }]} />
        ))}

        {/* Segments */}
        {segments.map((s, i) => (
          <View key={i} style={{
            position: 'absolute', left: s.x, top: s.y - 1,
            width: s.len + 0.5, height: 2, borderRadius: 1,
            backgroundColor: s.color,
            transform: [{ rotate: `${s.angle}deg` }],
            transformOrigin: '0 50%',
          } as any} />
        ))}

        {/* Dots */}
        {pts.map((p, i) => (
          <View key={i} style={{
            position: 'absolute',
            left: xOf(i) - 2.5, top: centsToY(plotCents(p)) - 2.5,
            width: 5, height: 5, borderRadius: 2.5,
            backgroundColor: colorForCents(plotCents(p)),
            opacity: i === pts.length - 1 ? 1 : 0.45,
          }} />
        ))}

        {/* Latest cents label */}
        {pts.length > 0 && (() => {
          const last  = pts[pts.length - 1];
          const lc    = plotCents(last);
          const y     = centsToY(lc);
          const color = colorForCents(lc);
          return (
            <View style={[styles.latestBubble, {
              top:  Math.max(1, Math.min(STRIP_H - 16, y - 8)),
              left: Math.min(STRIP_W - 42, Math.max(4, ANCHOR_X + 6)),
            }]}>
              <Text style={[styles.latestText, { color }]}>
                {lc >= 0 ? `+${lc}¢` : `${lc}¢`}
              </Text>
            </View>
          );
        })()}

        <View style={styles.rangeBadge}>
          <Text style={styles.rangeText}>±50¢</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  yAxis:   { width: PAD_L, height: STRIP_H, position: 'relative' },
  yLabel:  { position: 'absolute', right: 4, fontSize: 8, fontWeight: '700',
             width: PAD_L - 6, textAlign: 'right' },
  strip: {
    position: 'relative', overflow: 'hidden',
    backgroundColor: '#080810', borderRadius: 8,
    borderWidth: 1, borderColor: '#161622',
  },
  band: { position: 'absolute', left: 0, right: 0 },
  bandGreen: {
    backgroundColor: '#00e6760d',
    top:    centsToY(5),
    height: Math.max(0, centsToY(-5) - centsToY(5)),
  },
  bandYellow: {
    backgroundColor: '#ffeb3b07',
    top:    centsToY(15),
    height: Math.max(0, centsToY(-15) - centsToY(15)),
  },
  gridLine: { position: 'absolute', left: 0, right: 0 },
  latestBubble: {
    position: 'absolute',
    backgroundColor: '#12121ecc',
    borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  latestText: { fontSize: 9, fontWeight: '800' },
  rangeBadge: {
    position: 'absolute', bottom: 3, right: 4,
    backgroundColor: '#12121ecc', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: '#1e1e2e',
  },
  rangeText: { color: '#333344', fontSize: 8, fontWeight: '700' },
});
