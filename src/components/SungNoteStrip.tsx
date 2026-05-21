import React from 'react';

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import type { SungNote } from '../utils/sungNoteDetector';



interface Props {

  notes: SungNote[];

  label: string;

  active?: boolean;

  numbered?: boolean;

  onClear?: () => void;

  clearLabel?: string;

}



export default function SungNoteStrip({

  notes,

  label,

  active = true,

  numbered = false,

  onClear,

  clearLabel,

}: Props) {

  const showClear = onClear != null && notes.length > 0;



  return (

    <View style={styles.wrap}>

      <Text style={styles.label}>{label}</Text>

      <ScrollView

        horizontal

        showsHorizontalScrollIndicator={false}

        contentContainerStyle={styles.row}

        style={styles.scroll}

      >

        {notes.length === 0 ? (

          <Text style={styles.placeholder}>—</Text>

        ) : (

          notes.map((n, i) => (

            <React.Fragment key={`${n.ts}-${i}`}>

              {i > 0 ? <Text style={styles.sep}>·</Text> : null}

              <View style={styles.chip}>

                {numbered ? (

                  <Text style={styles.index}>{i + 1}</Text>

                ) : null}

                <Text style={[styles.chipText, !active && styles.chipTextIdle]}>

                  {`${n.name}${n.octave}`}

                </Text>

              </View>

            </React.Fragment>

          ))

        )}

      </ScrollView>

      {showClear ? (

        <TouchableOpacity

          onPress={onClear}

          style={styles.clearBtn}

          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}

          accessibilityLabel={clearLabel ?? 'Clear sung notes'}

        >

          <Ionicons name="trash-outline" size={18} color="#666" />

        </TouchableOpacity>

      ) : null}

    </View>

  );

}



const styles = StyleSheet.create({

  wrap: {

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#111118',

    borderRadius: 14,

    paddingVertical: 10,

    paddingHorizontal: 12,

    marginBottom: 12,

    borderWidth: 1,

    borderColor: '#1e1e28',

    gap: 10,

  },

  label: {

    color: '#444',

    fontSize: 9,

    fontWeight: '800',

    letterSpacing: 1.2,

    minWidth: 36,

  },

  scroll: {

    flex: 1,

  },

  row: {

    flexDirection: 'row',

    alignItems: 'center',

    flexGrow: 1,

    paddingRight: 8,

  },

  chip: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 4,

    paddingHorizontal: 2,

  },

  index: {

    color: '#444',

    fontSize: 11,

    fontWeight: '800',

    minWidth: 14,

  },

  chipText: {

    color: '#7c4dff',

    fontSize: 16,

    fontWeight: '800',

    letterSpacing: 0.3,

  },

  chipTextIdle: {

    color: '#5a4abf',

  },

  sep: {

    color: '#333',

    fontSize: 14,

    fontWeight: '700',

    marginHorizontal: 6,

  },

  placeholder: {

    color: '#2a2a3a',

    fontSize: 16,

    fontWeight: '600',

  },

  clearBtn: {

    padding: 4,

    marginLeft: 2,

  },

});


