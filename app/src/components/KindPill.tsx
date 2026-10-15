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

/**
 * One category, and — where the caller had to stop — how many it left
 * out. A key the table has not learned keeps its word, tidied, and has
 * no dot: a colour is a category's, and an unknown one has none to give.
 */
export function KindPill({ kind, more = 0, testID }: { kind: string; more?: number; testID?: string }) {
  const { t } = useI18n();
  const style = CATEGORIES[kind];
  return (
    <View style={s.pill} testID={testID}>
      {style ? <View style={[s.dot, { backgroundColor: style.color }]} /> : null}
      <Text style={s.label} numberOfLines={1}>{categoryLabel(kind, t)}</Text>
      {more > 0 ? (
        <>
          <View style={s.sep} />
          <Text style={s.more}>{`+${more}`}</Text>
        </>
      ) : null}
    </View>
  );
}

/** Every category, wrapped onto as many lines as it takes — the page's
 *  reading of what the card had to count. */
export function KindPills({ kinds, style, testID }: {
  kinds: readonly string[]; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  if (!kinds.length) return null;
  return (
    <View style={[s.row, style]} testID={testID}>
      {kinds.map((k) => <KindPill key={k} kind={k} testID={testID ? `${testID}-${k}` : undefined} />)}
    </View>
  );
}

const s = StyleSheet.create({
  // Moved here whole from PlaceCard, where it was the vibe pill. No
  // border: a bordered pill beside a line of grey text read as a control
  // you could press, and the fill alone is enough to say "one object".
  // `flexShrink: 0` is the card's contract with its line — the pill is
  // drawn whole or not at all — and costs a wrapping row nothing.
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  // Full-strength text: one word on a card is the label, not an aside.
  label: { color: colors.text, fontSize: 13, fontWeight: font.semibold },
  // A rule, not a hairline: at 0.5pt it disappeared against the fill on a
  // light ground, and the count then read as part of the label.
  sep: { width: 1, height: 13, backgroundColor: colors.borderGlassSoft },
  more: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
