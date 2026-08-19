import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { QuantizedNote } from '../utils/melodyKeyQuantize';
import type { SuggestedChord } from '../utils/melodyChords';
import { useLocale } from '../context/LocaleContext';

const LINE_SPACING = 10;
const STAFF_LINES = 5;
const NOTE_RX = 6;
const NOTE_RY = 5;
const STEM_LEN = 26;
const NOTE_SLOT = 36;
const STAFF_LEFT = 56;
const TREBLE_TOP = 24;
const STAFF_GAP = 52;
const MIDDLE_C_MIDI = 60;
/** Treble bottom line E4; bass bottom line G2 */
const TREBLE_BOTTOM_MIDI = 64;
const BASS_BOTTOM_MIDI = 43;
const TREBLE_STEM_PIVOT = 71;
const BASS_STEM_PIVOT = 50;

export interface StaffNoteTiming {
  startMs: number;
  durationMs: number;
}

interface Props {
  notes: QuantizedNote[];
  chords?: SuggestedChord[];
  maxViewportHeight?: number;
  isPlaying?: boolean;
  playbackPositionMs?: number;
  totalDurationMs?: number;
  activeNoteIndex?: number;
  activeStaffIndices?: number[];
  noteTimings?: StaffNoteTiming[];
}

export function staffNoteCenterX(index: number): number {
  return STAFF_LEFT + index * NOTE_SLOT + NOTE_SLOT / 2;
}

/** X of each note from sung onsets (longer gaps = wider bars). Min gap so heads do not overlap. */
export function layoutStaffNoteXs(timings: StaffNoteTiming[]): number[] {
  if (timings.length === 0) return [];
  const t0 = timings[0].startMs;
  const xs: number[] = [];
  for (let i = 0; i < timings.length; i++) {
    const fromTime =
      STAFF_LEFT
      + NOTE_SLOT / 2
      + Math.max(0, timings[i].startMs - t0) * (NOTE_SLOT / 250);
    xs.push(i === 0 ? fromTime : Math.max(xs[i - 1] + 22, fromTime));
  }
  return xs;
}

export function playheadXFromTimings(
  elapsedMs: number,
  timings: StaffNoteTiming[],
  totalDurationMs: number,
  xs?: number[],
): number {
  if (timings.length === 0) return STAFF_LEFT;
  const centers = xs && xs.length === timings.length
    ? xs
    : timings.map((_, i) => staffNoteCenterX(i));
  const total = Math.max(totalDurationMs, 1);

  for (let i = 0; i < timings.length; i++) {
    const { startMs, durationMs } = timings[i];
    const endMs = startMs + durationMs;
    const x0 = centers[i];
    if (elapsedMs < endMs || i === timings.length - 1) {
      if (elapsedMs <= startMs) return x0;
      const x1 =
        i < timings.length - 1
          ? centers[i + 1]
          : x0 + NOTE_SLOT * 0.85;
      const span = Math.max(1, endMs - startMs);
      const t = Math.min(1, (elapsedMs - startMs) / span);
      return x0 + (x1 - x0) * t;
    }
  }

  const last = timings.length - 1;
  return centers[last] + NOTE_SLOT * Math.min(1, elapsedMs / total);
}

function midiToStaffY(midi: number, bottomLineMidi: number, staffTop: number): number {
  const semitonesFromBottom = midi - bottomLineMidi;
  const bottomY = staffTop + (STAFF_LINES - 1) * LINE_SPACING;
  return bottomY - semitonesFromBottom * (LINE_SPACING / 2);
}

function staffBounds(staffTop: number): { top: number; bottom: number } {
  return {
    top: staffTop,
    bottom: staffTop + (STAFF_LINES - 1) * LINE_SPACING,
  };
}

function chordForNoteIndex(chords: SuggestedChord[] | undefined, idx: number): string | null {
  if (!chords?.length) return null;
  for (const c of chords) {
    const [a, b] = c.noteRange;
    if (idx >= a && idx < b) return c.symbol;
  }
  return chords[chords.length - 1]?.symbol ?? null;
}

function LedgerLines({
  y,
  x,
  staffTop,
  bottomLineMidi,
  offsetY,
}: {
  y: number;
  x: number;
  staffTop: number;
  bottomLineMidi: number;
  offsetY: number;
}) {
  const bounds = staffBounds(staffTop);
  const lines: number[] = [];
  const topLineY = bounds.top + offsetY;
  const bottomLineY = bounds.bottom + offsetY;

  if (y < topLineY - LINE_SPACING / 4) {
    let ly = topLineY - LINE_SPACING;
    while (ly >= y - 1) {
      lines.push(ly);
      ly -= LINE_SPACING;
    }
  }
  if (y > bottomLineY + LINE_SPACING / 4) {
    let ly = bottomLineY + LINE_SPACING;
    while (ly <= y + 1) {
      lines.push(ly);
      ly += LINE_SPACING;
    }
  }

  return (
    <>
      {lines.map((ly, i) => (
        <View
          key={`ledger-${bottomLineMidi}-${i}`}
          style={[styles.ledgerLine, { left: x - 14, top: ly - 1, width: 28 }]}
        />
      ))}
    </>
  );
}

function NoteGlyph({
  note,
  x,
  y,
  stemDown,
  showLabel,
  highlight,
  dimmed,
}: {
  note: QuantizedNote;
  x: number;
  y: number;
  stemDown: boolean;
  showLabel: boolean;
  highlight?: boolean;
  dimmed?: boolean;
}) {
  const fill = highlight
    ? '#00e676'
    : dimmed
      ? '#4a4a58'
      : note.adjusted
        ? '#7c4dff'
        : '#e8e8f0';
  const stemColor = highlight ? '#00e676' : dimmed ? '#4a4a58' : '#e8e8f0';
  const stemX = stemDown ? x + NOTE_RX - 1 : x - NOTE_RX + 1;
  const stemTop = stemDown ? y - NOTE_RY : y + NOTE_RY - 1;

  return (
    <>
      <View
        style={[
          styles.noteHead,
          highlight && styles.noteHeadActive,
          {
            left: x - NOTE_RX,
            top: y - NOTE_RY,
            backgroundColor: fill,
          },
        ]}
      />
      <View
        style={[
          styles.stem,
          {
            left: stemX,
            top: stemDown ? stemTop - STEM_LEN : stemTop,
            height: STEM_LEN,
            backgroundColor: stemColor,
          },
        ]}
      />
      {showLabel ? (
        <Text style={[styles.noteLabel, { left: x - 12, top: y + NOTE_RY + 4 }]}>
          {note.name}
          {note.octave}
        </Text>
      ) : null}
    </>
  );
}

export default function DualStaffView({
  notes,
  chords,
  maxViewportHeight = 220,
  isPlaying = false,
  playbackPositionMs = 0,
  totalDurationMs = 0,
  activeNoteIndex = -1,
  activeStaffIndices,
  noteTimings,
}: Props) {
  const { t } = useLocale();

  const bassTop = TREBLE_TOP + (STAFF_LINES - 1) * LINE_SPACING + STAFF_GAP;

  const timings = useMemo(
    () =>
      noteTimings ??
      notes.map((_, i) => ({
        startMs: i * 400,
        durationMs: 400,
      })),
    [noteTimings, notes],
  );

  const noteXs = useMemo(
    () => (noteTimings && noteTimings.length === notes.length
      ? layoutStaffNoteXs(noteTimings)
      : notes.map((_, i) => staffNoteCenterX(i))),
    [noteTimings, notes.length],
  );

  const staffWidth = useMemo(() => {
    const last = noteXs[noteXs.length - 1] ?? STAFF_LEFT;
    return last + NOTE_SLOT + 24;
  }, [noteXs]);

  const canvasHeight = useMemo(() => {
    const trebleYs = notes
      .filter(n => n.midi >= MIDDLE_C_MIDI)
      .map(n => midiToStaffY(n.midi, TREBLE_BOTTOM_MIDI, TREBLE_TOP));
    const bassYs = notes
      .filter(n => n.midi < MIDDLE_C_MIDI)
      .map(n => midiToStaffY(n.midi, BASS_BOTTOM_MIDI, bassTop));
    const allY = [...trebleYs, ...bassYs, TREBLE_TOP, bassTop + 4 * LINE_SPACING];
    const minY = Math.min(...allY, TREBLE_TOP) - 28;
    const maxY = Math.max(...allY, bassTop + 4 * LINE_SPACING) + 36;
    return maxY - minY + 16;
  }, [notes, bassTop]);

  const activeStaffSet = useMemo(() => {
    if (!isPlaying) return new Set<number>();
    if (activeStaffIndices?.length) return new Set(activeStaffIndices);
    if (activeNoteIndex >= 0) return new Set([activeNoteIndex]);
    return new Set<number>();
  }, [isPlaying, activeStaffIndices, activeNoteIndex]);

  const playheadX = useMemo(() => {
    if (!isPlaying) return null;
    const total = totalDurationMs > 0
      ? totalDurationMs
      : timings.reduce((m, t) => Math.max(m, t.startMs + t.durationMs), 400);
    return playheadXFromTimings(playbackPositionMs, timings, total, noteXs);
  }, [isPlaying, playbackPositionMs, timings, totalDurationMs, noteXs]);

  const yOffset = useMemo(() => {
    const trebleYs = notes.map(n =>
      n.midi >= MIDDLE_C_MIDI
        ? midiToStaffY(n.midi, TREBLE_BOTTOM_MIDI, TREBLE_TOP)
        : TREBLE_TOP,
    );
    const bassYs = notes.map(n =>
      n.midi < MIDDLE_C_MIDI
        ? midiToStaffY(n.midi, BASS_BOTTOM_MIDI, bassTop)
        : bassTop,
    );
    const minY = Math.min(...trebleYs, ...bassYs, TREBLE_TOP) - 20;
    return 12 - minY;
  }, [notes, bassTop]);

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        style={{ maxHeight: maxViewportHeight }}
      >
        <View style={[styles.staffCanvas, { width: staffWidth, height: canvasHeight }]}>
          <Text style={[styles.clefLabel, { top: TREBLE_TOP + yOffset - 2 }]}>
            𝄞 {t('melodyStaffTreble')}
          </Text>
          <Text style={[styles.clefLabel, { top: bassTop + yOffset - 2 }]}>
            𝄢 {t('melodyStaffBass')}
          </Text>

          {Array.from({ length: STAFF_LINES }).map((_, i) => (
            <View
              key={`treble-line-${i}`}
              style={[
                styles.staffLine,
                {
                  top: TREBLE_TOP + i * LINE_SPACING + yOffset,
                  left: STAFF_LEFT,
                  width: staffWidth - STAFF_LEFT - 8,
                },
              ]}
            />
          ))}
          {Array.from({ length: STAFF_LINES }).map((_, i) => (
            <View
              key={`bass-line-${i}`}
              style={[
                styles.staffLine,
                {
                  top: bassTop + i * LINE_SPACING + yOffset,
                  left: STAFF_LEFT,
                  width: staffWidth - STAFF_LEFT - 8,
                },
              ]}
            />
          ))}

          {isPlaying && playheadX != null ? (
            <View
              style={[
                styles.playhead,
                {
                  left: playheadX - 1,
                  top: TREBLE_TOP + yOffset - 8,
                  height: bassTop - TREBLE_TOP + (STAFF_LINES - 1) * LINE_SPACING + 16,
                },
              ]}
            />
          ) : null}

          {notes.map((n, idx) => {
            const x = noteXs[idx] ?? staffNoteCenterX(idx);
            const isTreble = n.midi >= MIDDLE_C_MIDI;
            const staffTop = isTreble ? TREBLE_TOP : bassTop;
            const bottomMidi = isTreble ? TREBLE_BOTTOM_MIDI : BASS_BOTTOM_MIDI;
            const y = midiToStaffY(n.midi, bottomMidi, staffTop) + yOffset;
            const stemDown = isTreble ? n.midi >= TREBLE_STEM_PIVOT : n.midi >= BASS_STEM_PIVOT;
            const chordLabel = chordForNoteIndex(chords, idx);
            const prevChord = idx > 0 ? chordForNoteIndex(chords, idx - 1) : null;
            const showChord = chordLabel && (idx === 0 || chordLabel !== prevChord);
            const isActive = activeStaffSet.has(idx);
            const isPast =
              isPlaying &&
              activeStaffSet.size > 0 &&
              idx < Math.min(...activeStaffSet);

            return (
              <React.Fragment key={`${n.midi}-${idx}`}>
                {showChord ? (
                  <Text
                    style={[
                      styles.chordSymbol,
                      { left: x - 16, top: TREBLE_TOP + yOffset - 18 },
                    ]}
                  >
                    {chordLabel}
                  </Text>
                ) : null}
                <LedgerLines
                  y={y}
                  x={x}
                  staffTop={staffTop}
                  bottomLineMidi={bottomMidi}
                  offsetY={yOffset}
                />
                <NoteGlyph
                  note={n}
                  x={x}
                  y={y}
                  stemDown={stemDown}
                  showLabel={idx === 0 || idx === notes.length - 1}
                  highlight={isActive}
                  dimmed={isPast}
                />
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
    position: 'absolute',
    left: 4,
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    width: 48,
  },
  empty: { color: '#2a2a3a', fontSize: 13 },
  staffCanvas: { position: 'relative' },
  staffLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#3a3a55',
  },
  ledgerLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#3a3a55',
  },
  noteHead: {
    position: 'absolute',
    width: NOTE_RX * 2,
    height: NOTE_RY * 2,
    borderRadius: NOTE_RX,
  },
  noteHeadActive: {
    shadowColor: '#00e676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  playhead: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#00e676',
    opacity: 0.85,
    borderRadius: 1,
    zIndex: 10,
  },
  stem: {
    position: 'absolute',
    width: 1.5,
    backgroundColor: '#e8e8f0',
  },
  noteLabel: {
    position: 'absolute',
    color: '#555',
    fontSize: 8,
    fontWeight: '600',
  },
  chordSymbol: {
    position: 'absolute',
    color: '#bbb',
    fontSize: 11,
    fontWeight: '800',
  },
});
