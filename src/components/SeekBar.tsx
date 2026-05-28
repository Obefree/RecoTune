import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';

const DEFAULT_STEP_SEC = 0.1;

interface Props {
  position: number;   // seconds
  duration: number;   // seconds
  onSeek: (seconds: number) => void | Promise<void>;
  onScrubStart?: () => void;
  /** Called after onSeek completes (resume playback here) */
  onScrubEnd?: () => void;
  color?: string;
  /** Snap thumb to N ms steps (default 100 ms) */
  stepSec?: number;
}

function snapSeconds(seconds: number, duration: number, stepSec: number): number {
  if (duration <= 0) return 0;
  const step = stepSec > 0 ? stepSec : DEFAULT_STEP_SEC;
  const snapped = Math.round(seconds / step) * step;
  return Math.max(0, Math.min(duration, snapped));
}

export default function SeekBar({
  position,
  duration,
  onSeek,
  onScrubStart,
  onScrubEnd,
  color = '#7c4dff',
  stepSec = DEFAULT_STEP_SEC,
}: Props) {
  const widthRef = useRef(0);
  const grantXRef = useRef(0);
  const [localPos, setLocalPos] = useState<number | null>(null);

  const calcSeconds = (x: number) => {
    if (widthRef.current <= 0 || duration <= 0) return 0;
    return snapSeconds((x / widthRef.current) * duration, duration, stepSec);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        onScrubStart?.();
        grantXRef.current = e.nativeEvent.locationX;
        setLocalPos(calcSeconds(grantXRef.current));
      },
      onPanResponderMove: (_e, gestureState) => {
        const x = grantXRef.current + gestureState.dx;
        setLocalPos(calcSeconds(x));
      },
      onPanResponderRelease: (_e, gestureState) => {
        const x = grantXRef.current + gestureState.dx;
        const secs = calcSeconds(x);
        void (async () => {
          try {
            await Promise.resolve(onSeek(secs));
          } finally {
            setLocalPos(null);
            onScrubEnd?.();
          }
        })();
      },
      onPanResponderTerminate: () => {
        setLocalPos(null);
        onScrubEnd?.();
      },
    }),
  ).current;

  const displayed = localPos !== null ? localPos : snapSeconds(position, duration, stepSec);
  const pct = duration > 0 ? Math.min(1, displayed / duration) * 100 : 0;

  return (
    <View
      style={styles.hitArea}
      {...panResponder.panHandlers}
      onLayout={e => { widthRef.current = e.nativeEvent.layout.width; }}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <View style={[styles.thumb, { left: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 4,
    backgroundColor: '#2a2a38',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: '50%' as any,
    marginTop: -8,
    marginLeft: -8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
});
