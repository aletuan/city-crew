// The journey between two stops: how it is made, how far, about how long.
//
// Three screens print this line — the options card, the editor, the
// saved trip — and until 3 Oct 2026 each built it by hand from the same
// glyph ternary and the same "distance · ≈ time" string. They were made
// to agree in #783, by hand, which is how they would have drifted again;
// this row is where they agree now. The words are `legLine`'s and the
// glyph `modeIcon`'s (`lib/travel`), so a test can hold the line without
// a renderer; what this file adds is the 12pt glyph in tertiary ink, 5pt
// from the figure, which is how all three screens had it.
//
// No spacing of its own. Where the row sits — under a card, under a
// stop's sentence, between two options rows — is the screen's to say,
// through `style`, since each has a different neighbour above it.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../lib/i18n';
import { legLine, modeIcon, type Leg } from '../lib/travel';
import { colors, font } from '../theme';

export default function LegRow({ leg, style, testID }: {
  leg: Leg;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { lang } = useI18n();
  return (
    <View style={[s.row, style]} testID={testID}>
      <Ionicons name={modeIcon(leg.mode)} size={12} color={colors.textTertiary} />
      <Text style={s.text}>{legLine(leg, lang)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { fontSize: 13, fontWeight: font.regular, color: colors.textTertiary },
});
