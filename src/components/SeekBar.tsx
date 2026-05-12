import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';

interface Props {
  position: number;   // seconds
  duration: number;   // seconds
  onSeek: (seconds: number) => void;
  color?: string;
}

export default function SeekBar({ position, duration, onSeek, color = '#7c4dff' }: Props) {
  const widthRef    = useRef(0);
  const seekingRef  = useRef(false);
  const [localPos, setLocalPos] = useState<number | null>(null);

  const calcSeconds = (x: number) => {
    if (widthRef.current <= 0 || duration <= 0) return 0;
    return Math.max(0, Math.min(duration, (x / widthRef.current) * duration));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        seekingRef.current = true;
        const secs = calcSeconds(e.nativeEvent.locationX);
        setLocalPos(secs);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const secs = calcSeconds(e.nativeEvent.locationX);
        setLocalPos(secs);
      },
      onPanResponderRelease: (e: GestureResponderEvent) => {
        const secs = calcSeconds(e.nativeEvent.locationX);
        setLocalPos(null);
        seekingRef.current = false;
        onSeek(secs);
      },
      onPanResponderTerminate: () => {
        setLocalPos(null);
        seekingRef.current = false;
      },
    })
  ).current;

  const displayed = localPos !== null ? localPos : position;
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
