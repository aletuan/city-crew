// What a place, or a list, is — as one pill per category, the same pill
// wherever a category is read rather than chosen.
//
// ── one pill, three screens (owner, 15 Oct 2026) ──
//
// The feed's card said "● Cà phê | +1"; the place page said the same two
// categories as two unlabelled glyphs on the cover, and a list's chips
// said them a third way, glyph and word. The owner's rule: what the card
// shows, the page shows the same way — only the page has the room to show
// all of it, so the card counts what it cannot fit and the page does not.
// One component, so the three cannot drift apart again.
//
// ── a dot, and why not just the word ──
//
// The word alone was the owner's first leaning, and it would have cut
// the one thread between the lists and the map: a pin has no word, only
// its category's colour and glyph, and the reader learns that colour
// from the places it is repeated. The dot is the least ink that keeps
// it — the word carries the meaning, so nobody needs the dot to read a
// card, and anybody walking from a card to its pin has it.
//
// Not the glyph. The glyph is for where there is no word (the pin) or
// where the chip is the map's legend (Explore's filter row). Three of
// the nine glyphs do not say their kind on sight — Views is a building,
// Culture a library, Focus a book — so beside a word they add width and
// no meaning. A dot is "information", a glyph is "the map".
//
// ── the list form, too (owner, 16 Oct 2026) ──
//
// The form's show/hide toggles were `Chip`s — glyph, border, 40pt tall —
// beside a list page that draws the same kinds as these pills. The owner
// asked for the form to read like the page, so the toggles are pills now
// (`KindToggles`) and a kind is no longer said two ways about one list.

import React from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';
import { PressableScale } from './ui';

/**
 * One category, and — where the caller had to stop — how many it left
 * out. A key the table has not learned keeps its word, tidied, and has
 * no dot: a colour is a category's, and an unknown one has none to give.
 */
export function KindPill({ kind, more = 0, chosen = false, off = false, testID }: {
  kind: string; more?: number;
  /** Lit as a chosen filter — see `KindPills`. */
  chosen?: boolean;
  /** Hidden by the list's owner — see `KindToggles`. */
  off?: boolean;
  testID?: string;
}) {
  const { t } = useI18n();
  const style = CATEGORIES[kind];
  return (
    <View style={[s.pill, chosen && s.pillOn, off && s.pillOff]} testID={testID}>
      {style ? <View style={[s.dot, { backgroundColor: off ? colors.textTertiary : style.color }]} /> : null}
      <Text style={[s.label, chosen && s.labelOn]} numberOfLines={1}>{categoryLabel(kind, t)}</Text>
      {more > 0 ? (
        <>
          <View style={s.sep} />
          <Text style={s.more}>{`+${more}`}</Text>
        </>
      ) : null}
    </View>
  );
}

/**
 * Every category, wrapped onto as many lines as it takes — the page's
 * reading of what the card had to count.
 *
 * Given `onPick`, the pills are also a filter (a collection's, 15 Oct
 * 2026): each a button that says whether it is chosen, and lit the way
 * Explore's filter chips are while it is — see `pillOn`. The pill keeps
 * its dot and its size, so the row does not reflow as chips light; the
 * border it lights is one every pill already carries, clear at rest.
 *
 * The pills are 25pt tall, under the 44 a target wants, and the owner
 * took that trade for one row instead of two (the filter row above the
 * places it replaced). The slop is 4 all round, half the 8 between rows
 * and pills, so two pills' slops meet and never overlap — a tap lands on
 * the pill it is nearest.
 */
export function KindPills({ kinds, chosen = [], onPick, style, testID }: {
  kinds: readonly string[];
  chosen?: readonly string[];
  onPick?: (kind: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { t } = useI18n();
  if (!kinds.length) return null;
  return (
    <View style={[s.row, style]} testID={testID}>
      {kinds.map((k) => {
        const id = testID ? `${testID}-${k}` : undefined;
        if (!onPick) return <KindPill key={k} kind={k} testID={id} />;
        const on = chosen.includes(k);
        return (
          <PressableScale
            key={k}
            onPress={() => onPick(k)}
            haptic="selection"
            scaleTo={0.94}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={categoryLabel(k, t)}
            aria-selected={on}
            testID={id}
          >
            <KindPill kind={k} chosen={on} />
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * The list form's show/hide row: the same pills, each a toggle. A shown
 * kind is drawn exactly as the list page draws it — the form previews
 * the page — and a hidden one stays in place, faded, its dot greyed: the
 * colour is what ties a kind to its pins, and a hidden kind has no pins
 * on the page. Nothing changes size, so the row never reflows on a tap.
 *
 * Not `KindPills`' `chosen`: there a lit pill is the exception (a
 * filter); here shown is the rule and hidden the exception, and the
 * accent would have lit every pill on a list nobody had touched.
 */
export function KindToggles({ kinds, shown, onToggle, testID }: {
  kinds: readonly string[];
  shown: readonly string[];
  onToggle: (kind: string, show: boolean) => void;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <View style={s.row} testID={testID}>
      {kinds.map((k) => {
        const on = shown.includes(k);
        return (
          <PressableScale
            key={k}
            onPress={() => onToggle(k, !on)}
            haptic="selection"
            scaleTo={0.94}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={categoryLabel(k, t)}
            accessibilityState={{ selected: on }}
            aria-selected={on}
            testID={testID ? `${testID}-${k}` : undefined}
          >
            <KindPill kind={k} off={!on} testID={testID ? `${testID}-${k}-pill` : undefined} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  // Moved here whole from PlaceCard, where it was the vibe pill. No
  // border: a bordered pill beside a line of grey text read as a control
  // you could press, and the fill alone is enough to say "one object".
  // `flexShrink: 0` is the card's contract with its line — the pill is
  // drawn whole or not at all — and costs a wrapping row nothing.
  // The border is always there, transparent at rest and taken out of
  // the padding (11 and 4 before it existed), so lighting a chosen pill
  // changes a colour and moves nothing.
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'transparent',
    paddingHorizontal: 10, paddingVertical: 3,
  },
  // Chosen, in the filter row's own words (`Chip`'s `chipOn`): the glass
  // a step heavier and its border drawn, the word in the accent — and not
  // an accent ring, which is what this wore for a build and the owner
  // found heavy beside Explore's quiet one (15 Oct 2026). The step is
  // from the pill's own resting glass, as `Chip`'s is from its clear one,
  // so the change is the same size on both.
  pillOn: { backgroundColor: colors.surfaceGlassStrong, borderColor: colors.borderGlass },
  // Hidden, in the form: faded whole rather than struck through — a
  // strike on a 13pt word in a 25pt pill reads as a rendering fault.
  // 0.4 was the figure agreed with the owner (16 Oct 2026).
  pillOff: { opacity: 0.4 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  // Full-strength text: one word on a card is the label, not an aside.
  label: { color: colors.text, fontSize: 13, fontWeight: font.semibold },
  labelOn: { color: colors.accent, fontWeight: font.semibold },
  // A rule, not a hairline: at 0.5pt it disappeared against the fill on a
  // light ground, and the count then read as part of the label.
  sep: { width: 1, height: 13, backgroundColor: colors.borderGlassSoft },
  more: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
