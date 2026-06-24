import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated, useWindowDimensions } from 'react-native';

function centsToAngle(cents: number) {
  return (cents / 50) * 50;
}

function Tick({ angle, length, thick, color, W, H }: {
  angle: number; length: number; thick: number; color: string; W: number; H: number;
}) {
  // Rotate around the bottom-center of the needle (pivot = bottom of the tick)
  // New Architecture requires transform matrices; avoid transformOrigin string.
  const rad = (angle * Math.PI) / 180;
  const pivotX = 0;          // offset from tick center-x to pivot
  const pivotY = length / 2; // offset from tick center-y to pivot (bottom of tick)
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  // translate pivot to origin, rotate, translate back
  const tx = pivotX - cosA * pivotX + sinA * pivotY;
  const ty = pivotY - sinA * pivotX - cosA * pivotY;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', bottom: 0,
        left: W / 2 - thick / 2, width: thick, height: length,
        backgroundColor: color, borderRadius: thick / 2,
        transform: [
          { translateX: tx },
          { translateY: ty },
          { rotate: `${angle}deg` },
        ],
      }}
    />
  );
}

function ArcLabel({ angle, text, color, W, H, R }: {
  angle: number; text: string; color: string; W: number; H: number; R: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const r2  = R - 22;
  const cx  = W / 2 + r2 * Math.sin(rad);
  const cy  = H     - r2 * Math.cos(rad);
  return (
    <Text
      pointerEvents="none"
      style={{
        position: 'absolute', left: cx - 12, top: cy - 8,
        width: 24, textAlign: 'center', color, fontSize: 9, fontWeight: '700',
      }}
    >
      {text}
    </Text>
  );
}

interface Props {
  cents: number | null;
  color: string;
}

export default function TunerNeedle({ cents, color }: Props) {
  const { width } = useWindowDimensions();
  const W = width - 32;
  const H = W * 0.58;
  const R = H * 0.92;

  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = cents !== null ? centsToAngle(cents) : 0;
    // Input is already smoothed by the 1€ filter, so the spring can be snappy
    // (low lag) without re-introducing jitter; clamp prevents overshoot.
    Animated.spring(rotation, {
      toValue: angle,
      damping: 17,
      stiffness: 120,
      mass: 0.7,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [cents]);

  const rotate = rotation.interpolate({
    inputRange: [-50, 50],
    outputRange: ['-50deg', '50deg'],
  });

  // Tick definitions: [angle, length, thickness, color]
  const ticks: [number, number, number, string][] = [
    [-50, 18, 2, '#ff5252'],  // -50 ¢
    [-40, 10, 1.5, '#555'],
    [-30, 13, 1.5, '#666'],
    [-20, 10, 1.5, '#555'],
    [-10, 10, 1.5, '#555'],
    [  0, 22, 2.5, '#00e676'], // 0 ¢ center
    [ 10, 10, 1.5, '#555'],
    [ 20, 10, 1.5, '#555'],
    [ 30, 13, 1.5, '#666'],
    [ 40, 10, 1.5, '#555'],
    [ 50, 18, 2, '#ff5252'],  // +50 ¢
    // Half-way minors
    [-45, 7, 1, '#3a3a4a'],
    [-35, 7, 1, '#3a3a4a'],
    [-25, 7, 1, '#3a3a4a'],
    [-15, 7, 1, '#3a3a4a'],
    [ -5, 7, 1, '#3a3a4a'],
    [  5, 7, 1, '#3a3a4a'],
    [ 15, 7, 1, '#3a3a4a'],
    [ 25, 7, 1, '#3a3a4a'],
    [ 35, 7, 1, '#3a3a4a'],
    [ 45, 7, 1, '#3a3a4a'],
  ];

  const labels: [number, string, string][] = [
    [-50, '-50', '#ff525299'],
    [-25, '-25', '#555'],
    [  0,  '0', '#00e67699'],
    [ 25, '+25', '#555'],
    [ 50, '+50', '#ff525299'],
  ];

  return (
    <View style={[styles.container, { width: W, height: H }]}>
      {/* Arc line */}
      {/* Color zones background — drawn with thin ticks along the arc */}
      {ticks.map(([a, len, thick, col], i) => (
        <Tick key={i} angle={a} length={len} thick={thick} color={col} W={W} H={H} />
      ))}

      {labels.map(([a, txt, col]) => (
        <ArcLabel key={txt} angle={a} text={txt} color={col} W={W} H={H} R={R} />
      ))}

      {/* FLAT / SHARP text */}
      <Text style={[styles.sideLabel, { left: 8 }]}>♭ FLAT</Text>
      <Text style={[styles.sideLabel, { right: 8 }]}>SHARP ♯</Text>

      {/* Needle */}
      <Animated.View
        style={[
          styles.needle,
          {
            bottom: 0,
            left: W / 2 - 1.5,
            height: R - 28,
            transform: [
              { translateY: (R - 28) / 2 },   // shift so rotation axis = bottom of needle
              { rotate },
              { translateY: -(R - 28) / 2 },
            ],
          },
        ]}
      >
        <View style={[styles.needleBar, { backgroundColor: color }]} />
        <View style={[styles.needleTip, { backgroundColor: color }]} />
      </Animated.View>

      {/* Pivot */}
      <View style={[styles.pivot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', alignSelf: 'center', overflow: 'hidden' },
  sideLabel: { position: 'absolute', top: 8, color: '#383848', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  needle: { position: 'absolute', width: 3, alignItems: 'center' },
  needleBar: { width: 2, flex: 1, borderRadius: 1, opacity: 0.9 },
  needleTip: { width: 4, height: 12, borderRadius: 2, position: 'absolute', top: 0, marginLeft: -1 },
  pivot: { position: 'absolute', bottom: -7, alignSelf: 'center', width: 16, height: 16, borderRadius: 8 },
});
