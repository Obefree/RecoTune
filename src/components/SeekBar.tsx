import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';

const DEFAULT_STEP_SEC = 0.1;
/** Clear scrub lock once parent position is within this delta (seconds). */
const RELEASE_SYNC_TOLERANCE_SEC = 0.2;
/** Fallback if playback status never catches up after release. */
const RELEASE_CLEAR_MS = 350;

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
  const hitRef = useRef<View>(null);
  const widthRef = useRef(0);
  const leftRef = useRef(0);
  const grantPageXRef = useRef(0);
  const scrubbingRef = useRef(false);

  const durationRef = useRef(duration);
  const stepSecRef = useRef(stepSec);
  const onSeekRef = useRef(onSeek);
  const onScrubStartRef = useRef(onScrubStart);
  const onScrubEndRef = useRef(onScrubEnd);

  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { stepSecRef.current = stepSec; }, [stepSec]);
  useEffect(() => { onSeekRef.current = onSeek; }, [onSeek]);
  useEffect(() => { onScrubStartRef.current = onScrubStart; }, [onScrubStart]);
  useEffect(() => { onScrubEndRef.current = onScrubEnd; }, [onScrubEnd]);

  const [localPos, setLocalPos] = useState<number | null>(null);

  const calcSecondsFromLocalX = (localX: number): number | null => {
    const w = widthRef.current;
    const dur = durationRef.current;
    if (w <= 0 || dur <= 0) return null;
    const ratio = Math.max(0, Math.min(1, localX / w));
    return snapSeconds(ratio * dur, dur, stepSecRef.current);
  };

  const calcSecondsFromPageX = (pageX: number): number | null =>
    calcSecondsFromLocalX(pageX - leftRef.current);

  const syncTrackGeometry = (pageX: number, onReady?: (secs: number | null) => void) => {
    hitRef.current?.measureInWindow((x, _y, w) => {
      leftRef.current = x;
      if (w > 0) widthRef.current = w;
      onReady?.(calcSecondsFromLocalX(pageX - x));
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        scrubbingRef.current = true;
        onScrubStartRef.current?.();
        const pageX = e.nativeEvent.pageX;
        grantPageXRef.current = pageX;
        syncTrackGeometry(pageX, secs => {
          if (secs != null) setLocalPos(secs);
        });
      },
      onPanResponderMove: (_e, gestureState) => {
        const secs = calcSecondsFromPageX(grantPageXRef.current + gestureState.dx);
        if (secs != null) setLocalPos(secs);
      },
      onPanResponderRelease: (_e, gestureState) => {
        const secs = calcSecondsFromPageX(grantPageXRef.current + gestureState.dx);
        if (secs == null) {
          scrubbingRef.current = false;
          setLocalPos(null);
          onScrubEndRef.current?.();
          return;
        }
        setLocalPos(secs);
        void (async () => {
          try {
            await Promise.resolve(onSeekRef.current(secs));
          } finally {
            scrubbingRef.current = false;
            onScrubEndRef.current?.();
          }
        })();
      },
      onPanResponderTerminate: () => {
        scrubbingRef.current = false;
        setLocalPos(null);
        onScrubEndRef.current?.();
      },
    }),
  ).current;

  useEffect(() => {
    if (scrubbingRef.current || localPos == null || duration <= 0) return;
    if (Math.abs(position - localPos) <= RELEASE_SYNC_TOLERANCE_SEC) {
      setLocalPos(null);
    }
  }, [position, duration, localPos]);

  useEffect(() => {
    if (localPos == null || scrubbingRef.current) return;
    const t = setTimeout(() => setLocalPos(null), RELEASE_CLEAR_MS);
    return () => clearTimeout(t);
  }, [localPos]);

  const displayed = localPos !== null ? localPos : snapSeconds(position, duration, stepSec);
  const pct = duration > 0 ? Math.min(1, displayed / duration) * 100 : 0;

  return (
    <View
      ref={hitRef}
      style={styles.hitArea}
      {...panResponder.panHandlers}
      onLayout={e => {
        widthRef.current = e.nativeEvent.layout.width;
        hitRef.current?.measureInWindow((x, _y, w) => {
          leftRef.current = x;
          if (w > 0) widthRef.current = w;
        });
      }}
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
