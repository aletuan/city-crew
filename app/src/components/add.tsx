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
//     fill; `quiet` in a screen's header, where it is the round buttons'
//     neighbour and not the screen's first thing.
//
//   AddCell — the space for one more in a list of your own, the shape of
//     the thing it adds: a tile among tiles, a row the cards' width above
//     the cards. Dashed like the slot, for the same reason, but a word and
//     a plus and nothing else, since the list around it already says what
//     goes there.
//
// There was a fourth, AddIconButton — the same action as a bare circle,
// one per row in a list. Search was its only caller, and Search now
// selects several rows and commits them from one bar (AddBatchBar), so
// the shape has no job left. Its story is worth keeping even though the
// code is not: it was filled with `colors.accent`, which is a *foreground*
// colour, leaving its `accentInk` glyph at 3.64:1 in the light theme and
// 6.79:1 in the dark — correct half the time and muddy the other half,
// for one substitution nobody could see in either theme alone. That is
// the mistake this file exists to stop repeating.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
export function AddSlot({ title, subtitle, onPress, testID }: {
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <View style={s.slotWrap}>
      <PressableScale onPress={onPress} accessibilityRole="button" contentStyle={s.slot} testID={testID}>
        <View style={s.slotIcon}>
          <Ionicons name="add" size={26} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.slotTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.slotSub} numberOfLines={2}>{subtitle}</Text>
        </View>
        {/* On both now. The row leads somewhere, and the one that had no
            chevron was reading as a card you could not press. 17, like
            every other row-end chevron in the app — it was 18 beside the
            18pt title, which is the one size on the row the chevron does
            not need to match. */}
        <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
      </PressableScale>
    </View>
  );
}

/**
 * The space for one more place in your own collection (owner, 22 Oct
 * 2026), from two mockups the owner drew: a dashed tile in the grid's
 * first cell, and a dashed row over the first card in the list. The
 * glyph is the bare plus of the second mockup, in both; the first had a
 * picture with a plus on it, which says "add a photo", and this adds a
 * place.
 *
 * Not `AddSlot`. That one ends a list, where the reader arrives with
 * nothing on screen to say what the row is for, so it takes a second line
 * and a circle to say it. This one leads a list of the very things it
 * adds, under a card that says whose list it is: the word is enough, and
 * a subtitle there would be the row explaining itself.
 *
 * The row is the cards' width and 48pt tall: the mockup's row measures
 * about 46, and 12 above and below a 24pt plus is the nearest figure that
 * stays over the 44 a control needs. The tile is the grid's tile, so the
 * cell it takes is a cell like the rest.
 */
export function AddCell({ label, onPress, size, testID }: {
  label: string;
  onPress: () => void;
  /** The grid's tile side; without it, a row across the list. */
  size?: number;
  testID?: string;
}) {
  const tile = size !== undefined;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={tile ? undefined : s.cellRowWrap}
      contentStyle={tile ? [s.cellTile, { width: size, height: size }] : s.cellRow}
      testID={testID}
    >
      <Ionicons name="add" size={24} color={colors.text} />
      <Text style={tile ? s.cellTileText : s.cellRowText} numberOfLines={2}>{label}</Text>
    </PressableScale>
  );
}

/**
 * The solid action.
 *
 * Height is the only dimension that varies, and it varies for a reason
 * rather than by accident: beside a section heading this sizes to its own
 * content in open space; `tall`, it stands at the 44pt control height,
 * beside a screen title or inside the floating dock on Explore. Everything
 * that carries the meaning — the gradient, the ink on it, the radius, the
 * weight, the word's size — is the same either way, which is the point of
 * it being one component.
 *
 * There was a third, `compact`, for the dock: 7pt of padding, a 14pt word
 * and a 16pt plus, about 31pt tall. It was the one control left under 44
 * once #848–#852 brought the rest up, and the same "Add" read as two
 * buttons — 31 in the dock, 44 in Gallery's header (owner, 10 Oct 2026).
 * It was also the worst place to be small: the dock around it is itself a
 * button that opens Search, so a tap a few points wide of the pill went
 * somewhere else entirely. The dock is 64 with 8 of padding, which leaves
 * 48: room for 44.
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
 * Not twice at the same weight. A tab with nothing in it has a card below
 * making the same offer with more words, and two filled invitations to do
 * one thing read as two different things — which is why Trips hides this
 * until the first trip exists. Collections keeps it in its header on an
 * empty Yours (owner, 26 Oct 2026, so the header is one height on both
 * tabs), and there it is `quiet`: the card's filled button is the one the
 * eye goes to.
 *
 * ── how loud ──
 *
 * Filled in the floating docks, where it is the bar's one action and
 * sits over photographs that a lighter pill would vanish into. `quiet`
 * in a screen's header (owner, 26 Oct 2026): filled there, it outweighed
 * the title beside it and every round button in the same row. Quiet is
 * the round buttons' own glass ground (`surfaceGlass`), the word in the
 * body's ink and the plus in the accent. Not the accent on `accentSoft`,
 * the tint the first proposal had: measured across every look that pair
 * reads 4.14:1 on standard's paper, 4.26 on blush and 4.35 on duck, under
 * the 4.5 a 16pt word needs. The body's ink on glass is 14.67 there and
 * nowhere under 6.7. Not an outline either: outlined pills here are the
 * reversals — Cancel, Unblock — and a way to make something is not one.
 */
export function AddPill({ label, onPress, tall, quiet, busy, icon = 'add', accessibilityLabel, testID }: {
  label: string;
  onPress: () => void;
  /** The header's weight: glass, not the gradient. See "how loud". */
  quiet?: boolean;
  /** The glyph before the word. A plus everywhere it adds; the collection
   *  dock's visitor pill copies, and wears the ⋯ menu's copy glyph so one
   *  act has one mark (owner, 17 Oct 2026). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** At the 44pt control height: in a screen's header, beside a large title
   *  and the 44pt round buttons the other tabs put in that slot, and in
   *  Explore's floating dock. */
  tall?: boolean;
  /** The thing it adds is on its way. The pill keeps its word and its
   *  width, the plus makes way for a spinner, and a tap does nothing.
   *
   *  Gallery used to pass `'…'` as the label instead, and the pill shrank
   *  to the width of three dots: a narrower, wordless pill in the same
   *  slot read as a different button, not the same one working (owner,
   *  7 Oct 2026). The word is what says which button this still is; the
   *  spinner is what says it is busy; and the two are kept apart so
   *  neither has to mean both. */
  busy?: boolean;
  accessibilityLabel?: string;
  /** For the smoke flows, which tap by id. */
  testID?: string;
}) {
  const glyph = 18;
  const mark = quiet ? colors.accent : colors.accentInk;
  const face = [s.pill, tall && s.pillTall, quiet && s.pillQuiet, busy && s.pillBusy];
  const inside = (
    <>
      {/* The spinner takes the plus's own box, so the word does not move
          when one replaces the other. */}
      {busy
        ? <View style={{ width: glyph, height: glyph, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="small" color={mark} /></View>
        : <Ionicons name={icon} size={glyph} color={mark} />}
      <Text style={[s.pillText, quiet && s.pillTextQuiet]}>{label}</Text>
    </>
  );
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      aria-disabled={busy}
      aria-busy={busy}
      testID={testID}
    >
      {quiet
        ? <View style={face}>{inside}</View>
        : <LinearGradient {...gradAI} style={face}>{inside}</LinearGradient>}
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

  // The cards' own margins, so the row's dashed edge is the cards' edge.
  cellRowWrap: { marginHorizontal: space.page, marginBottom: space.cardGap },
  cellRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 12, borderRadius: radius.card,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderGlass,
  },
  cellRowText: { color: colors.textSecondary, fontSize: 16, lineHeight: 22 },
  // The tile's own radius (`PlaceTile`), so the cell reads as one of them.
  cellTile: {
    alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8,
    borderRadius: radius.input, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderGlass,
  },
  cellTileText: { color: colors.textSecondary, fontSize: 14, lineHeight: 18, textAlign: 'center' },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingLeft: 14, paddingRight: 18, paddingVertical: 9,
    borderRadius: radius.pill,
  },
  // `HEADER_CONTROL_H`, so a pill and a round button in the same header
  // slot are the same height, and the dock's pill is the header's. Beside
  // a section heading the pill sizes to its own content, which is right
  // in open space and wrong beside a title or inside another button.
  pillTall: { minHeight: HEADER_CONTROL_H, paddingHorizontal: 16, justifyContent: 'center' },
  // Dimmed, not greyed: the gradient stays so the pill is still plainly
  // the same object, and 0.7 is the figure `working` rows use elsewhere
  // for "taken, not yet answered" — a little less, since this one also
  // carries a spinner saying so.
  pillBusy: { opacity: 0.7 },
  pillText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
  pillQuiet: { backgroundColor: colors.surfaceGlass },
  pillTextQuiet: { color: colors.text },
});
