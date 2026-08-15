// The way out of a list that did not have what you came for.
//
// A slot, not a place: the same dashed outline the collections list and a
// collection's own last row wear, saying the same thing — "not a thing, a
// space where one would go".
//
// Shared by Explore and Search because it is one offer, not two. What
// differs between them is only the words: Explore has nothing to name yet
// and asks a question, Search knows exactly what you typed and can say it
// back. Duplicating the row to say that would have meant two dashed
// outlines drifting apart over time.
//
// `note` is required wherever this leads to a suggestion, and it is not
// decoration. Without it a submitter who cannot find their place
// afterwards concludes the app is broken, when it is working exactly as
// designed.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './ui';
import { colors, font, radius, space } from '../theme';

export default function SuggestRow({ title, subtitle, note, onPress }: {
  title: string;
  subtitle: string;
  note?: string;
  onPress: () => void;
}) {
  return (
    <View style={s.wrap}>
      <PressableScale onPress={onPress} accessibilityRole="button" style={s.row}>
        <View style={s.icon}>
          <Ionicons name="add" size={24} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <Text style={s.sub} numberOfLines={2}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
      </PressableScale>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: space.page, marginTop: 4, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: radius.card,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderGlass,
  },
  icon: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  sub: { color: colors.textTertiary, fontSize: 13.5, lineHeight: 19 },
  note: {
    color: colors.textTertiary, fontSize: 12.5,
    textAlign: 'center', paddingTop: 10,
  },
});
