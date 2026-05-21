import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RegisteredNoteEvent } from '../hooks/useSungNoteHistory';
import {
  estimateKey,
  estimateRhythm,
  pitchClassesPresent,
} from '../utils/melodyAnalysis';
import { useLocale } from '../context/LocaleContext';

interface Props {
  events: RegisteredNoteEvent[];
  compact?: boolean;
}

export default function MelodyAnalysisPanel({ events, compact = false }: Props) {
  const { t } = useLocale();
  const keyEst = useMemo(() => estimateKey(events), [events]);
  const classes = useMemo(() => pitchClassesPresent(events), [events]);
  const rhythm = useMemo(() => estimateRhythm(events), [events]);

  if (events.length === 0) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        <Text style={styles.title}>{t('melodyAnalysisTitle')}</Text>
        <Text style={styles.empty}>{t('melodyNoNotes')}</Text>
      </View>
    );
  }

  const tempoKey =
    rhythm?.tempoLabel === 'slow'
      ? 'melodyTempoSlow'
      : rhythm?.tempoLabel === 'fast'
        ? 'melodyTempoFast'
        : 'melodyTempoMedium';

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.title}>{t('melodyAnalysisTitle')}</Text>
      {!compact ? <Text style={styles.disclaimer}>{t('melodyAnalysisDisclaimer')}</Text> : null}

      <View style={styles.row}>
        <Text style={styles.label}>{t('melodyKeyLabel')}</Text>
        <Text style={styles.value}>{keyEst?.label ?? '—'}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('melodyNotesDetectedLabel')}</Text>
        <Text style={styles.value}>{classes.length ? classes.join(', ') : '—'}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('melodyRhythmLabel')}</Text>
        <Text style={styles.value}>
          {rhythm
            ? [
                t(tempoKey),
                rhythm.bpmApprox != null ? `~${rhythm.bpmApprox} BPM` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : '—'}
        </Text>
      </View>

      {rhythm && rhythm.gapsMs.length > 0 ? (
        <Text style={styles.gaps}>
          {t('melodyGapsLabel')}: {rhythm.gapsMs.map(g => `${g}ms`).join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#111118',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e1e28',
  },
  wrapCompact: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 12,
  },
  title: {
    color: '#7c4dff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  disclaimer: {
    color: '#444',
    fontSize: 10,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  empty: { color: '#2a2a3a', fontSize: 13 },
  row: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  label: { color: '#555', fontSize: 12, fontWeight: '700', width: 110 },
  value: { flex: 1, color: '#ccc', fontSize: 12, fontWeight: '600' },
  gaps: { color: '#555', fontSize: 10, marginTop: 4, lineHeight: 14 },
});
