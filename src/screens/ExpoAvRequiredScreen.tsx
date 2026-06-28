import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DARK_BG = '#0a0a0f';
const TEXT = '#e0e0e0';
const MUTED = '#8888a0';
const ACCENT = '#00e676';

/** Honest blocker when Expo Go lacks ExponentAV (SDK 55+). Not a fake tab. */
export default function ExpoAvRequiredScreen() {
  const insets = useSafeAreaInsets();
  const sdk = Constants.expoConfig?.sdkVersion ?? 'unknown';

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>RecoTune</Text>
      <Text style={styles.lead}>
        В этом Expo Go нет нативного модуля аудио{' '}
        <Text style={styles.mono}>ExponentAV</Text> (expo-av). Приложение не может
        запустить Tuner/Studio/Media — это не баг батника и не сеть.
      </Text>
      <Text style={styles.body}>
        Проект: SDK {sdk}. В Expo Go SDK 54 expo-av ещё есть; в SDK 55+ его убрали —
        нужна dev-сборка или миграция на expo-audio (отдельная задача).
      </Text>
      <View style={styles.steps}>
        <Text style={styles.stepTitle}>Как работать с live JS (рекомендуется)</Text>
        <Text style={styles.step}>1. Один раз: build-apk.bat → app-debug.apk</Text>
        <Text style={styles.step}>2. Установить APK на телефон</Text>
        <Text style={styles.step}>3. Запустить RecoTune.bat (Metro на порту 8081)</Text>
        <Text style={styles.step}>4. Открыть RecoTune на телефоне (та же Wi‑Fi)</Text>
      </View>
      {Platform.OS === 'android' ? (
        <Text style={styles.hint}>
          Если Expo Go на SDK 54 — обновите зависимости (npm install) и перезапустите Metro
          без --offline; expo-font уже закреплён на ~14.0.12.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK_BG },
  content: { paddingHorizontal: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '800', color: ACCENT, letterSpacing: 1 },
  lead: { fontSize: 16, lineHeight: 24, color: TEXT },
  body: { fontSize: 14, lineHeight: 22, color: MUTED },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: TEXT },
  steps: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e1e2a',
    backgroundColor: '#12121a',
    gap: 8,
  },
  stepTitle: { fontSize: 13, fontWeight: '700', color: ACCENT, textTransform: 'uppercase' },
  step: { fontSize: 14, lineHeight: 22, color: TEXT },
  hint: { fontSize: 13, lineHeight: 20, color: MUTED, marginTop: 8 },
});
