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
// where the chip is a control (Explore's filter row, which is the map's
// legend, and the list form's toggles). Three of the nine glyphs do not
// say their kind on sight — Views is a building, Culture a library,
// Focus a book — so beside a word they add width and no meaning. A dot
// is "information", a glyph is "something you can press, or the map".

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
export function KindPill({ kind, more = 0, chosen = false, testID }: {
  kind: string; more?: number;
  /** Lit as a chosen filter — see `KindPills`. */
  chosen?: boolean;
  testID?: string;
}) {
  const { t } = useI18n();
  const style = CATEGORIES[kind];
  return (
    <View style={[s.pill, chosen && s.pillOn]} testID={testID}>
      {style ? <View style={[s.dot, { backgroundColor: style.color }]} /> : null}
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
 * 2026): each a button that says whether it is chosen, lit in the
 * accent while it is — the accent is for state the reader made, and a
 * chosen filter is that. The pill keeps its dot and its size, so the row
 * does not reflow as chips light; the ring is drawn in a border every
 * pill already carries, transparent at rest.
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
  pillOn: { borderColor: colors.accent },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  // Full-strength text: one word on a card is the label, not an aside.
  label: { color: colors.text, fontSize: 13, fontWeight: font.semibold },
  labelOn: { color: colors.accent },
  // A rule, not a hairline: at 0.5pt it disappeared against the fill on a
  // light ground, and the count then read as part of the label.
  sep: { width: 1, height: 13, backgroundColor: colors.borderGlassSoft },
  more: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
