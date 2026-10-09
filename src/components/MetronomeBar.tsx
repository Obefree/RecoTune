import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  bpm: number;
  running: boolean;
  onToggle: () => void;
  onBump: (delta: number) => void;
  hint?: string;
  label: string;
};

export default function MetronomeBar({ bpm, running, onToggle, onBump, hint, label }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onToggle}
          style={[styles.playBtn, running && styles.playBtnOn]}
          accessibilityRole="button"
          accessibilityLabel={running ? `${label} stop` : `${label} start`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name={running ? 'pause' : 'pulse'} size={14} color={running ? '#00e676' : '#777'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onBump(-10)} style={styles.bpmBtn} accessibilityLabel={`${label} −10`} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.bpmBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.bpmVal}>{bpm}</Text>
        <TouchableOpacity onPress={() => onBump(10)} style={styles.bpmBtn} accessibilityLabel={`${label} +10`} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.bpmBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {hint ? <Text style={styles.hint} numberOfLines={2}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a28',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  playBtnOn: { backgroundColor: '#00e67622', borderColor: '#00e676' },
  bpmBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16161e',
    borderRadius: 7,
  },
  bpmBtnText: { color: '#888', fontSize: 14, fontWeight: '700' },
  bpmVal: { color: '#bbb', fontSize: 12, fontWeight: '800', minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'] },
  hint: { color: '#444', fontSize: 9, lineHeight: 12, marginTop: 3 },
});
