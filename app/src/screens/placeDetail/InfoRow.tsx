import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glyph } from '../../components/ui/glyph';
import { colors } from '../../theme';
import { s } from './styles';

// One row of the grouped info card: a small caps label over a value, the
// whole row the target.
//
// ── what came off it ──
//
// These were four stacked cards, each wearing a 44pt accent circle. Then
// one card, each row with a monochrome glyph on the left and an accent
// verb on the right — Route, Call, Open. Then this. The glyph and the
// label said the same thing twice, and the label is the one that
// translates; the verb named what a tap anywhere on the row already did,
// and the value is the thing you would tap. So the value carries the
// accent when the row goes somewhere — the address, the number, the site
// are the links, the way a phone number is in Contacts — and a row that
// goes nowhere stays grey. One mark per row, and it is the row's own
// content.
/**
 * A fact, with the glyph that names its kind in a gutter down the left.
 *
 * The glyph is not decoration and it is not a second copy of the label:
 * it is the thing that lets the eye find the phone number without
 * reading, and it gives the card a left edge the values line up against.
 * The hairline starts where the labels do rather than at the card's edge,
 * so the gutter reads as one column rather than as four interruptions.
 */
export function InfoRow({ icon, label, first, onPress, trailing, hug, children }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** The row that opens the card draws no hairline above itself. */
  first?: boolean;
  onPress?: () => void;
  /** A control at the row's end. A row carrying one is not itself
   *  pressable: two targets in one row, the outer one swallowing taps
   *  meant for the inner, is a worse row than one honest button. */
  trailing?: React.ReactNode;
  /** The words take only the width they need, so a control after them
   *  sits beside the value rather than at the row's far end. For a row
   *  whose control belongs to its value — Directions to the address —
   *  and not to the row. */
  hug?: boolean;
  children: React.ReactNode;
}) {
  const tappable = !!onPress && !trailing;
  return (
    <>
      {!first && <View style={s.rowDivider} />}
      <Pressable
        onPress={tappable ? onPress : undefined}
        disabled={!tappable}
        style={s.infoStack}
        accessibilityRole={tappable ? 'button' : undefined}
      >
        <View style={s.infoIconSlot}>
          <Glyph name={icon} size={19} color={colors.textTertiary} />
        </View>
        <View style={[s.infoWords, hug && s.infoWordsHug]}>
          <Text style={s.infoLabel}>{label}</Text>
          {children}
        </View>
        {trailing}
      </Pressable>
    </>
  );
}
