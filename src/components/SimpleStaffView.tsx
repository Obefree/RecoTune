import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { QuantizedNote } from '../utils/melodyKeyQuantize';
import type { SuggestedChord } from '../utils/melodyChords';
import { useLocale } from '../context/LocaleContext';

const LINE_SPACING = 10;
const STAFF_LINES = 5;
const NOTE_RADIUS = 6;
const NOTE_SLOT = 36;
const STAFF_LEFT = 48;
const STAFF_TOP = 28;
/** Treble: bottom line E4 */
const BOTTOM_LINE_MIDI = 64;

interface Props {
  notes: QuantizedNote[];
  chords?: SuggestedChord[];
  height?: number;
  /** Max viewport height — staff scrolls inside when content is taller. */
  maxViewportHeight?: number;
}

function midiToStaffY(midi: number): number {
  /** Each semitone = half a line spacing; higher pitch = smaller Y */
  const semitonesFromBottom = midi - BOTTOM_LINE_MIDI;
  const bottomY = STAFF_TOP + (STAFF_LINES - 1) * LINE_SPACING;
  return bottomY - semitonesFromBottom * (LINE_SPACING / 2);
}

function chordForNoteIndex(chords: SuggestedChord[] | undefined, idx: number): string | null {
  if (!chords?.length) return null;
  for (const c of chords) {
    const [a, b] = c.noteRange;
    if (idx >= a && idx < b) return c.symbol;
  }
  return chords[chords.length - 1]?.symbol ?? null;
}

export default function SimpleStaffView({
  notes,
  chords,
  height = 160,
  maxViewportHeight = 180,
}: Props) {
  const { t } = useLocale();

  const staffWidth = useMemo(
    () => STAFF_LEFT + Math.max(notes.length, 1) * NOTE_SLOT + 24,
    [notes.length],
  );

  const yBounds = useMemo(() => {
    if (notes.length === 0) return { min: STAFF_TOP, max: STAFF_TOP + 4 * LINE_SPACING };
    const ys = notes.map(n => midiToStaffY(n.midi));
    return {
      min: Math.min(...ys, STAFF_TOP) - 16,
      max: Math.max(...ys, STAFF_TOP + 4 * LINE_SPACING) + 16,
    };
  }, [notes]);

  const viewHeight = Math.max(height, yBounds.max - yBounds.min + 48);

  if (notes.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{t('melodyStaffTitle')}</Text>
        <Text style={styles.empty}>{t('melodyNoNotes')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('melodyStaffTitle')}</Text>
      <Text style={styles.clefLabel}>{t('melodyStaffTreble')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        style={{ maxHeight: maxViewportHeight }}
      >
        <View style={[styles.staffCanvas, { width: staffWidth, height: viewHeight }]}>
          {Array.from({ length: STAFF_LINES }).map((_, i) => (
            <View
              key={`line-${i}`}
              style={[
                styles.staffLine,
                {
                  top: STAFF_TOP + i * LINE_SPACING - yBounds.min + 8,
                  left: STAFF_LEFT,
                  width: staffWidth - STAFF_LEFT - 8,
                },
              ]}
            />
          ))}

          {notes.map((n, idx) => {
            const x = STAFF_LEFT + idx * NOTE_SLOT + NOTE_SLOT / 2;
            const y = midiToStaffY(n.midi) - yBounds.min + 8;
            const chordLabel = chordForNoteIndex(chords, idx);
            return (
              <React.Fragment key={`${n.midi}-${idx}`}>
                {chordLabel && idx > 0 && chordForNoteIndex(chords, idx - 1) !== chordLabel ? (
                  <Text style={[styles.chordSymbol, { left: x - 14, top: STAFF_TOP - yBounds.min - 8 }]}>
                    {chordLabel}
                  </Text>
                ) : null}
                {idx === 0 && chordLabel ? (
                  <Text style={[styles.chordSymbol, { left: x - 14, top: STAFF_TOP - yBounds.min - 8 }]}>
                    {chordLabel}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.noteHead,
                    {
                      left: x - NOTE_RADIUS,
                      top: y - NOTE_RADIUS,
                      backgroundColor: n.adjusted ? '#7c4dff' : '#e0e0e0',
                    },
                  ]}
                />
                <Text style={[styles.noteLabel, { left: x - 12, top: y + NOTE_RADIUS + 2 }]}>
                  {n.name}{n.octave}
                </Text>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#111118',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e1e28',
  },
  title: {
    color: '#7c4dff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  clefLabel: {
    color: '#555',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 6,
  },
  empty: { color: '#2a2a3a', fontSize: 13 },
  staffCanvas: { position: 'relative' },
  staffLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#3a3a55',
  },
  noteHead: {
    position: 'absolute',
    width: NOTE_RADIUS * 2,
    height: NOTE_RADIUS * 2,
    borderRadius: NOTE_RADIUS,
  },
  noteLabel: {
    position: 'absolute',
    color: '#555',
    fontSize: 8,
    fontWeight: '600',
  },
  chordSymbol: {
    position: 'absolute',
    color: '#aaa',
    fontSize: 11,
    fontWeight: '800',
  },
});
