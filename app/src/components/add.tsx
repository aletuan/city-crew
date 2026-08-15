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
//   AddIconButton — the same action with no room for a word, one per row
//     in a list. Same fill, same ink, no label.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './ui';
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

/**
 * The same action with no room for a word — one per row in a list.
 *
 * The fifth copy of "add" in this app, and the one that got away when the
 * other four were gathered here: it is a circle rather than a row, so it
 * did not look like the same thing. It was filled with `colors.accent`,
 * which is `dyn('#C4402C', '#FF6F5B')` — a value that changes what it *is*
 * between themes. On paper it is a foreground colour, dark enough to read
 * as text on a light page, and filling a button with it left the
 * `accentInk` glyph at 3.64:1. In the dark theme the same line resolves to
 * the bright coral and measures 6.79:1, so the button was correct half the
 * time and muddy the other half, for one substitution nobody could see in
 * either theme alone.
 *
 * `gradAI` is a literal, not a `dyn()` — the theme file says so at the
 * constant itself, "a gradient is a fill" — so this reads at 6.79:1 in
 * both. The label lives in `accessibilityLabel` because a bare glyph
 * announces nothing.
 */
export function AddIconButton({ onPress, accessibilityLabel }: {
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <LinearGradient {...gradAI} style={s.iconBtn}>
        <Ionicons name="add" size={22} color={colors.accentInk} />
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
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  pillText: { color: colors.accentInk, fontSize: 15.5, fontWeight: font.semibold },
  pillTextCompact: { fontSize: 14 },
});
