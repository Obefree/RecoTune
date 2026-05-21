import React, { useState } from 'react';

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';



import RecorderScreen from './RecorderScreen';

import PlayerScreen from './PlayerScreen';

import VideoScreen from './VideoScreen';

import { useLocale } from '../context/LocaleContext';



type Segment = 'record' | 'play' | 'video';



export default function MediaScreen() {

  const insets = useSafeAreaInsets();

  const { t } = useLocale();

  const [segment, setSegment] = useState<Segment>('record');



  const segments: { id: Segment; label: string }[] = [

    { id: 'record', label: t('mediaRecord') },

    { id: 'play', label: t('mediaPlay') },

    { id: 'video', label: t('mediaVideo') },

  ];



  return (

    <View style={styles.wrapper}>

      <View style={[styles.segBar, { paddingTop: insets.top + 6 }]}>

        {segments.map(s => {

          const active = segment === s.id;

          return (

            <TouchableOpacity

              key={s.id}

              onPress={() => setSegment(s.id)}

              style={[styles.segBtn, active && styles.segBtnActive]}

              activeOpacity={0.85}

            >

              <Text style={[styles.segText, active && styles.segTextActive]}>{s.label}</Text>

            </TouchableOpacity>

          );

        })}

      </View>

      <View style={styles.body}>

        {segment === 'record' ? <RecorderScreen embedded /> : null}

        {segment === 'play' ? <PlayerScreen /> : null}

        {segment === 'video' ? <VideoScreen embedded /> : null}

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  wrapper: { flex: 1, backgroundColor: '#0a0a0f' },

  segBar: {

    flexDirection: 'row',

    paddingHorizontal: 12,

    paddingBottom: 8,

    gap: 6,

    backgroundColor: '#0a0a0f',

    borderBottomWidth: 1,

    borderBottomColor: '#1e1e2a',

  },

  segBtn: {

    flex: 1,

    alignItems: 'center',

    paddingVertical: 10,

    borderRadius: 12,

    backgroundColor: '#111118',

    borderWidth: 1,

    borderColor: '#222',

  },

  segBtnActive: {

    backgroundColor: '#1e1e2a',

    borderColor: '#7c4dff55',

  },

  segText: { color: '#555', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  segTextActive: { color: '#7c4dff' },

  body: { flex: 1 },

});


