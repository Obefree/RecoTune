import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import FrequencyChart, { HistoryPoint } from './FrequencyChart';
import type { RegisteredNoteEvent } from '../hooks/useSungNoteHistory';
import { useLocale } from '../context/LocaleContext';

interface Props {
  history: HistoryPoint[];
  registeredEvents: RegisteredNoteEvent[];
  active: boolean;
  chartPlotWidth?: number;
}

export default function MelodyPitchChart({
  history,
  registeredEvents,
  active,
  chartPlotWidth,
}: Props) {
  const { t } = useLocale();
  const markers = useMemo(
    () =>
      registeredEvents.map(e => ({
        ts: e.ts,
        midi: e.midi,
        note: e.name,
        octave: e.octave,
      })),
    [registeredEvents],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('melodyChartTitle')}</Text>
      <FrequencyChart
        history={history}
        active={active}
        compact
        chartHeight={176}
        chartPlotWidth={chartPlotWidth}
        maxHistoryPoints={120}
        defaultHZoom={2}
        timeAxis
        registeredMarkers={markers}
      />
      <Text style={styles.legend}>{t('chartScrollHistoryHint')}</Text>
      {registeredEvents.length > 0 ? (
        <Text style={styles.legend}>{t('melodyChartMarkersHint')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  title: {
    color: '#444',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  legend: {
    color: '#3a3a55',
    fontSize: 9,
    marginTop: 4,
    fontWeight: '600',
  },
});
