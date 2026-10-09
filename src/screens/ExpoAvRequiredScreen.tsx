import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DARK_BG = '#0a0a0f';
const TEXT = '#e0e0e0';
const MUTED = '#8888a0';
const ACCENT = '#00e676';

/** Honest blocker when the client lacks ExpoAudio (wrong Expo Go SDK). */
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
        В этом клиенте нет нативного модуля аудио{' '}
        <Text style={styles.mono}>ExpoAudio</Text>. Приложение не может
        запустить Tuner/Studio/Media — это не баг батника и не сеть.
      </Text>
      <Text style={styles.body}>
        Проект: SDK {sdk}. RecoTune собран под Expo SDK 57 (expo-audio / expo-video).
        Обновите Expo Go из магазина до SDK 57 или соберите APK.
      </Text>
      <View style={styles.steps}>
        <Text style={styles.stepTitle}>Как работать с live JS</Text>
        <Text style={styles.step}>1. Expo Go SDK 57: RecoTune.bat → QR</Text>
        <Text style={styles.step}>2. Или один раз: build-apk.bat → app-debug.apk</Text>
        <Text style={styles.step}>3. Metro: RecoTune.bat (порт 8081), та же Wi‑Fi</Text>
      </View>
      {Platform.OS === 'android' ? (
        <Text style={styles.hint}>
          Старый Expo Go (SDK 54/55/56) этот проект не откроет — только 57.
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
