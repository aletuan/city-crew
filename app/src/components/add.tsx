// The two ways this app offers to add something, and only two.
//
// They had drifted. The dashed slot existed twice — once under your own
// collections, once under Explore's places — written separately and
// measured differently every time: a 52pt circle against a 44pt rounded
// square, an 18pt title against 16, `space.cardPadding` against a 14
// somebody typed, a chevron on one and none on the other. Seven
// differences between two rows that mean the same thing and sit two taps
// apart. Nobody decided any of that; it is what happens when one idea is
// written down twice.
//
// So it is written down once. The measurements kept are the ones tied to
// the design tokens rather than to numbers chosen in the moment, which
// happen to be the collections screen's — the older of the two, and the
// one that had to line up with real cards directly above it.
//
// Two shapes, because there are two jobs:
//
//   AddSlot — a space where a thing would go, at the end of a list. The
//     dashed outline is the whole argument: it says "not a thing, a place
//     for one", which no amount of label on a solid card manages.
//
//   AddPill — the solid action, beside a heading or inside a floating
//     bar. Filled, because it is a thing you do rather than a space you
//     fill.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './ui';
import { colors, font, gradAI, radius, space, type } from '../theme';

/**
 * The dashed slot at the end of a list.
 *
 * `note` is the quiet line under it, for the one fact the offer cannot
 * make without: what happens after you take it.
 */
export function AddSlot({ title, subtitle, note, onPress }: {
  title: string;
  subtitle: string;
  note?: string;
  onPress: () => void;
}) {
  return (
    <View style={s.slotWrap}>
      <PressableScale onPress={onPress} accessibilityRole="button" style={s.slot}>
        <View style={s.slotIcon}>
          <Ionicons name="add" size={26} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.slotTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.slotSub} numberOfLines={2}>{subtitle}</Text>
        </View>
        {/* On both now. The row leads somewhere, and the one that had no
            chevron was reading as a card you could not press. */}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </PressableScale>
      {note ? <Text style={s.slotNote}>{note}</Text> : null}
    </View>
  );
}

/**
 * The solid action.
 *
 * `compact` is the only dimension that varies, and it varies for a reason
 * rather than by accident: beside a section heading this sits in open
 * space, and inside the floating bar on Explore it shares a line with two
 * lines of text. Everything that carries the meaning — the gradient, the
 * ink on it, the radius, the weight — is the same either way, which is
 * the point of it being one component.
 */
export function AddPill({ label, onPress, compact, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <LinearGradient {...gradAI} style={[s.pill, compact && s.pillCompact]}>
        <Ionicons name="add" size={compact ? 16 : 18} color={colors.accentInk} />
        <Text style={[s.pillText, compact && s.pillTextCompact]}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  slotWrap: { marginHorizontal: space.page, marginTop: 4, marginBottom: 8 },
  slot: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: space.cardPadding, borderRadius: radius.card,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderGlass,
  },
  slotIcon: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  // Line box stated rather than left to the font. This is carried over
  // from the copy of this row that lived on a collection: at this weight
  // the metrics leave nothing under the baseline, and the descender on
  // "Thêm địa điểm" was the first thing to go. It was fixed once, in one
  // of four places, which is exactly the failure this file exists to end.
  slotTitle: { color: colors.text, ...type.cardTitle, lineHeight: 24 },
  slotSub: { color: colors.textTertiary, fontSize: 14, lineHeight: 19 },
  slotNote: {
    color: colors.textTertiary, fontSize: 12.5,
    textAlign: 'center', paddingTop: 10,
  },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingLeft: 14, paddingRight: 18, paddingVertical: 9,
    borderRadius: radius.pill,
  },
  pillCompact: { paddingLeft: 11, paddingRight: 14, paddingVertical: 7 },
  pillText: { color: colors.accentInk, fontSize: 15.5, fontWeight: font.semibold },
  pillTextCompact: { fontSize: 14 },
});
