// Every way this app offers to add something, and there are three.
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
// Three shapes, because there are three jobs:
//
//   AddSlot — a space where a thing would go, at the end of a list. The
//     dashed outline is the whole argument: it says "not a thing, a place
//     for one", which no amount of label on a solid card manages.
//
//   AddPill — the solid action, beside a heading or inside a floating
//     bar. Filled, because it is a thing you do rather than a space you
//     fill.
//
// There was a third, AddIconButton — the same action as a bare circle,
// one per row in a list. Search was its only caller, and Search now
// selects several rows and commits them from one bar (AddBatchBar), so
// the shape has no job left. Its story is worth keeping even though the
// code is not: it was filled with `colors.accent`, which is a *foreground*
// colour, leaving its `accentInk` glyph at 3.64:1 in the light theme and
// 6.79:1 in the dark — correct half the time and muddy the other half,
// for one substitution nobody could see in either theme alone. That is
// the mistake this file exists to stop repeating.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HEADER_CONTROL_H, PressableScale } from './ui';
import { colors, font, gradAI, radius, space, type } from '../theme';

/**
 * The dashed slot at the end of a list.
 *
 * Two lines and no third. There used to be a `note` under the outline —
 * first announcing that suggestions get reviewed, then, softened, that
 * yours appears straight away. Both were answering a question nobody had
 * asked yet: the row is an invitation, and an invitation with a footnote
 * is asking to be read rather than taken. What it replaced it with is
 * nothing, which is the right size for it.
 */
export function AddSlot({ title, subtitle, onPress }: {
  title: string;
  subtitle: string;
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
/**
 * The gradient pill that offers to make one more of something.
 *
 * ── what it should say ──
 *
 * **The short word.** "New" to create one of this list's own things, "Add"
 * to offer the catalog a place it does not have. Not "New trip" or "Add
 * place": the pill sits under a title that has already named the thing, and
 * repeating it there is the button explaining itself to a reader who has
 * just read it.
 *
 * The whole phrase goes in `accessibilityLabel`, which is not a
 * consolation — a screen reader announces the button on its own, with no
 * title above it to lean on, so that is the one place the noun is load
 * bearing.
 *
 * An **empty state** is the exception and takes the full phrase in its
 * visible label: "Plan a trip", "Create your first collection". There is no
 * list above it to have named anything, and the sentence is doing the
 * explaining.
 *
 * ── and where it goes ──
 *
 * Never twice on one screen. A tab with nothing in it has a card below
 * making the same offer with more words, and two invitations to do one
 * thing read as two different things — see how Collections hangs this on a
 * section heading only when that section has rows, and how Trips hides it
 * until the first trip exists.
 */
export function AddPill({ label, onPress, compact, header, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  compact?: boolean;
  /** In a screen's header, where it sits beside a 34pt title and next to
   *  the 44pt round buttons the other tabs put in that slot. */
  header?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <LinearGradient {...gradAI} style={[s.pill, compact && s.pillCompact, header && s.pillHeader]}>
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

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingLeft: 14, paddingRight: 18, paddingVertical: 9,
    borderRadius: radius.pill,
  },
  pillCompact: { paddingLeft: 11, paddingRight: 14, paddingVertical: 7 },
  // `HEADER_CONTROL_H`, so a pill and a round button in the same header
  // slot are the same height. Everywhere else the pill sizes to its own
  // content, which is right beside a section heading and wrong beside a
  // screen title.
  pillHeader: { minHeight: HEADER_CONTROL_H, paddingHorizontal: 16, justifyContent: 'center' },
  pillText: { color: colors.accentInk, fontSize: 15.5, fontWeight: font.semibold },
  pillTextCompact: { fontSize: 14 },
});
