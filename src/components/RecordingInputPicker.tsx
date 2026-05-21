import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  INPUT_GROUPS,
  inputsOfKind,
  labelKind,
  type AudioRouteSnapshot,
  type RecordingInputInfo,
  type StudioAudioRouting,
} from '../utils/studioAudioRouting';

interface Props {
  routing: StudioAudioRouting;
  snap: AudioRouteSnapshot | null;
  loading: boolean;
  onRefresh: () => void;
  onPickInput: (inp: RecordingInputInfo) => void;
  compact?: boolean;
}

export default function RecordingInputPicker({
  routing, snap, loading, onRefresh, onPickInput, compact = false,
}: Props) {
  const activeUid = routing.inputUid;
  const current = snap?.currentInput;

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Микрофон записи</Text>
        <TouchableOpacity onPress={onRefresh} disabled={loading} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color={loading ? '#333' : '#7c4dff'} />
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        Для записи с гарнитуры выбери Bluetooth в списке. Если устройства нет — подключи наушники и нажми обновить.
      </Text>
      {current && (
        <Text style={styles.currentLine}>
          Сейчас у системы: {current.name} ({labelKind(current.kind)})
        </Text>
      )}
      {loading && (snap?.inputs.length ?? 0) === 0 ? (
        <Text style={styles.empty}>Загрузка…</Text>
      ) : (
        INPUT_GROUPS.map(grp => {
          const items = inputsOfKind(snap?.inputs ?? [], grp.kind);
          return (
            <View key={grp.kind} style={styles.group}>
              <Text style={styles.groupTitle}>{grp.title}</Text>
              {items.length === 0 ? (
                <Text style={styles.groupEmpty}>{grp.empty}</Text>
              ) : (
                items.map(inp => {
                  const active = activeUid === inp.uid;
                  return (
                    <TouchableOpacity
                      key={inp.uid}
                      onPress={() => onPickInput(inp)}
                      style={[styles.row, active && styles.rowActive]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={
                          inp.kind === 'bluetooth' ? 'bluetooth' :
                          inp.kind === 'wired' || inp.kind === 'usb' ? 'headset' : 'mic-outline'
                        }
                        size={16}
                        color={active ? '#00e676' : '#555'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowName, active && styles.rowNameActive]}>{inp.name}</Text>
                        <Text style={styles.rowSub}>{labelKind(inp.kind)}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={18} color="#00e676" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          );
        })
      )}
      {inputsOfKind(snap?.inputs ?? [], 'other').length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Другие</Text>
          {inputsOfKind(snap?.inputs ?? [], 'other').map(inp => {
            const active = activeUid === inp.uid;
            return (
              <TouchableOpacity
                key={inp.uid}
                onPress={() => onPickInput(inp)}
                style={[styles.row, active && styles.rowActive]}
              >
                <Ionicons name="mic-outline" size={16} color={active ? '#00e676' : '#555'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, active && styles.rowNameActive]}>{inp.name}</Text>
                  <Text style={styles.rowSub}>{labelKind(inp.kind)}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={18} color="#00e676" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {routing.mode === 'auto' && !activeUid && (
        <Text style={styles.autoNote}>Авто: система сама выбирает микрофон. Нажми устройство выше, чтобы зафиксировать.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, borderTopWidth: 1, borderColor: '#1e1e28', paddingTop: 14 },
  wrapCompact: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { color: '#ccc', fontSize: 14, fontWeight: '700' },
  refreshBtn: { padding: 6 },
  hint: { color: '#555', fontSize: 10, lineHeight: 14, marginBottom: 8 },
  currentLine: { color: '#666', fontSize: 10, marginBottom: 8 },
  empty: { color: '#555', fontSize: 11, marginBottom: 8 },
  group: { marginBottom: 8 },
  groupTitle: { color: '#666', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' },
  groupEmpty: { color: '#444', fontSize: 10, fontStyle: 'italic', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#14141c',
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#252532',
  },
  rowActive: { borderColor: '#00e67655', backgroundColor: '#00e67612' },
  rowName: { color: '#ccc', fontSize: 12, fontWeight: '700' },
  rowNameActive: { color: '#00e676' },
  rowSub: { color: '#555', fontSize: 10, marginTop: 1 },
  autoNote: { color: '#444', fontSize: 10, lineHeight: 14, marginTop: 4 },
});
