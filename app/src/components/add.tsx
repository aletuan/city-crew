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
// Three shapes, because there are three jobs (and a fourth, the
// header's plus, which is a round button more than any of them):
//
//   AddSlot — a space where a thing would go, at the end of a list. The
//     dashed outline is the whole argument: it says "not a thing, a place
//     for one", which no amount of label on a solid card manages.
//
//   AddPill — the solid action, beside a heading or inside a floating
//     bar. Filled, because it is a thing you do rather than a space you
//     fill. In a screen's header it is a plus alone, `HeaderAdd`.
//
//   AddCell — the space for one more in a list of your own, the shape of
//     the thing it adds: a tile among tiles, a row the cards' width above
//     the cards. Dashed like the slot, for the same reason, but a plus
//     and at most a word — the row's; the tile is the plus alone — since
//     the list around it already says what goes there.
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
import { Glyph, ICON } from './ui/glyph';
import { INK_GAP_END, PressableScale, RoundIconButton, SECONDARY_CONTROL_H } from './ui';
import { useScheme } from '../lib/theme';
import { colors, font, gradAI, radius, space, textTertiaryHex, type } from '../theme';

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
          <Glyph name="add" size={ICON.feature} color={colors.accent} />
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
        <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} />
      </PressableScale>
    </View>
  );
}

/**
 * The space for one more place in your own collection (owner, 22 Oct
 * 2026), from two mockups the owner drew: a dashed tile in the grid's
 * first cell, and a dashed row over the first card in the list. The
 * glyph was the bare plus of the second mockup, in both; the first had a
 * picture with a plus on it, which says "add a photo", and this adds a
 * place.
 *
 * ── the tile, laid out as a photo tile is (owner, 2 Nov 2026) ──
 *
 * The tile carried a little map for a day — a route, a pin, two hills —
 * and came back without it: hills and trees said nothing about a city's
 * places, and every drawing tried after (a street grid, a row of
 * shopfronts, the kinds' glyphs) was a picture to read before the plus.
 * What stayed is the colour, the accent's tint, which is what makes the
 * tile the one cell in the grid that is not a place, and with it no
 * dashed edge: the tint says "not a place" already.
 *
 * It was laid out as the photo tiles beside it are: the plus in the
 * middle, the word along the bottom where a tile's name is. It carried
 * the list's count in its top corner from 2 Nov, where a tile's status
 * sits; on 13 Nov the count moved to the card, at the end of the kinds'
 * row, for the owner and a visitor alike (owner's call), and the tile
 * went back to saying one thing.
 *
 * ── the ring alone, in the middle (owner, 14 Nov 2026) ──
 *
 * The photo tile's anatomy put the two halves of one control on two
 * axes. On the 111pt tile of a 393pt phone the ring stood on the tile's
 * centre, 55.5, and the word began 8 in from the left as a name does:
 * "Thêm địa điểm" is about 85 wide (measured in Inter, which sets within
 * a point or two of the system face at 12), so its middle fell near
 * 50.5, five to the left of the ring's. Too little to read as a word set
 * left, too much to read as one set centre. And the ring ended 14.5
 * above the word's line, so the two read as a mark and a caption, not as
 * one button.
 *
 * The owner's answer, once the ways of aligning the two were drawn side
 * by side, was to take the word off: the tile is the ring, in the middle
 * of the tint, and nothing else. The word was the third naming of one
 * act. The tile is never drawn on an empty list (`OwnEmpty` makes the
 * offer there, in a sentence), so wherever it stands there is a place in
 * the cell beside it to say what a plus in this grid adds; the dock's
 * pill says "+ Địa điểm" and the ⋯ menu's row says it in full. It also
 * ends the question of the word fitting: 85 of the 95 a 393pt phone's
 * tile leaves inside its 8s, and of the 89 a 375pt phone's does.
 *
 * What it costs: in a grid of photographs a bare plus can be read as
 * "add a photo", and someone handed a copy of a list meets the tile
 * before adding anything themselves. A tap that guessed wrong opens the
 * search for a place and loses nothing. The word is still the tile's
 * name to a screen reader, which hears the tile with no grid around it
 * (`accessibilityLabel`), and the list's row keeps it in sight: a row of
 * one plus says nothing at all.
 *
 * Weighed in the same round, and not taken:
 *   - the word centred but left at the foot. One axis, and the row's
 *     shared line of names kept, but the 14.5 stays, and with it the
 *     mark-and-caption reading.
 *   - the ring and the word as one column in the middle, 8 apart, the
 *     word in medium and the secondary ink. Chosen first, then passed
 *     over for no word: it fixed the alignment of a word the tile did
 *     not need.
 *   - a grey typed in for the word, #6F706A. On the tint it is 4.00:1 on
 *     Duck and 1.60 on Chocolate, a look whose page is dark.
 *
 * The plus stands in a dashed 44pt ring, the button scale's middle step,
 * and is the accent's colour (owner, 2 Nov 2026). It was a solid disc in
 * the raised ground for a day, and a white disc on a tint is a button, a
 * second one inside the tile; the dashes say "an empty place, to fill",
 * the language the list's row and the new-collection tile already speak.
 * The ring is `textTertiary`, the quietest ink there is: on the tint over
 * the page it measures 3.68:1 at its lowest (Chocolate) and 6.0 at its
 * highest, over the 3:1 a control's outline needs; the plus in the accent
 * is 4.14 at its lowest (Paper) — both worked out in add.ui.test.tsx,
 * against every look. The dash is the row's own 1pt. The whole tile is
 * still one control, named by its word to whoever hears it, not sees it.
 *
 * From the same round (a mock with a "COLLECTION" kicker, a zero-padded
 * "04" and "Add a new place"), the ring and the accent plus were taken
 * and the rest was not: the kicker names what the screen's title already
 * names, the leading zero is a figure no other count in the app wears,
 * and "new" says nothing a place you add is not.
 *
 * Not `AddSlot`. That one ends a list, where the reader arrives with
 * nothing on screen to say what the row is for, so it takes a second line
 * and a circle to say it. This one leads a list of the very things it
 * adds, under a card that says whose list it is: the word is enough on
 * the row, the plus on the tile, and a subtitle there would be either one
 * explaining itself.
 *
 * The row is the cards' width and 48pt tall: the mockup's row measures
 * about 46, and 12 above and below a 24pt plus is the nearest figure that
 * stays over the 44 a control needs. The tile is the grid's tile, so the
 * cell it takes is a cell like the rest.
 */
export function AddCell({ label, onPress, size, testID }: {
  label: string;
  onPress: () => void;
  /** The grid's tile side; without it, a row across the list. The tile
   *  draws no word: `label` is its name to a screen reader only. */
  size?: number;
  testID?: string;
}) {
  const { scheme } = useScheme();
  if (size !== undefined) {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        contentStyle={[s.cellTile, { width: size, height: size }]}
        testID={testID}
      >
        <View style={[s.cellDisc, { borderColor: textTertiaryHex[scheme] }]}>
          <Glyph name="add" size={ICON.nav} color={colors.accent} />
        </View>
      </PressableScale>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.cellRowWrap}
      contentStyle={s.cellRow}
      testID={testID}
    >
      <Glyph name="add" size={ICON.nav} color={colors.text} />
      <Text style={s.cellRowText} numberOfLines={2}>{label}</Text>
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
 * Filled, in the floating docks, where it is the bar's one action and
 * sits over photographs that a lighter pill would vanish into. A
 * screen's header had a quiet one, the word and the plus in the accent
 * on nothing, from 26 Oct 2026 until 20 Nov 2026, when it gave way to the
 * plus alone (`HeaderAdd`, which says why).
 */
export function AddPill({ label, onPress, busy, icon = 'add', accessibilityLabel, testID }: {
  label: string;
  onPress: () => void;
  /** The glyph before the word. A plus everywhere it adds; the collection
   *  dock's visitor pill copies, and wears the ⋯ menu's copy glyph so one
   *  act has one mark (owner, 17 Oct 2026). */
  icon?: keyof typeof Ionicons.glyphMap;
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
  const glyph = ICON.action;
  const mark = colors.accentInk;
  const face = [s.pill, busy && s.pillBusy];
  const inside = (
    <>
      {/* The spinner takes the plus's own box, so the word does not move
          when one replaces the other. */}
      {busy
        ? <View style={{ width: glyph, height: glyph, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="small" color={mark} /></View>
        : <Glyph name={icon} size={glyph} color={mark} />}
      <Text style={s.pillText}>{label}</Text>
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
      <LinearGradient {...gradAI} style={face}>{inside}</LinearGradient>
    </PressableScale>
  );
}

/**
 * The way to make one more, at the right end of a screen's header: a
 * plus, alone (owner, 20 Nov 2026). Trips, Collections and a place's
 * gallery wear it.
 *
 * It was the quiet `AddPill`, "+ New" in the accent. The owner brought a
 * reference with a filled round button and the question of the word;
 * weighed with him:
 *
 *   - the word goes. On a screen titled "Trips" a plus says "a trip";
 *     VoiceOver still hears the whole phrase (`label`). The header's
 *     controls elsewhere are glyphs — the back chevron, the ⋯, the
 *     friends screen's add-a-friend — and the word was the one thing in
 *     the row to read.
 *   - not the reference's filled disc. Filled, this header's button
 *     outweighed the title once already (26 Oct 2026); the round
 *     buttons' discs came off on 14 Nov; and a filled round button is a
 *     floating one's shape, on screens whose whole job is making — which
 *     this tab is not: a trip is made from Ideas. A disc of `accentSoft`
 *     under an accent plus was the middle way, and went with the next
 *     point.
 *   - the body's ink, not the accent: a round button wears colour only
 *     when its colour is information (`RoundIconButton`), and with no
 *     word beside it the plus cannot be read as a second title — which
 *     is what the accent was for. Ink is the look's own, chosen in
 *     Profile, and the strongest contrast on the page.
 *   - not heavier. Ionicons draws one plus, at the stroke every glyph in
 *     the app has; a bolder one would be from another set beside the
 *     chevron. Heavier is bigger: 27, the next step, if the 22 reads
 *     faint on a phone. Not seen on one yet.
 *
 * `busy`: a spinner in the plus's place, the same box, and no press — a
 * gallery's photo on its way.
 */
export function HeaderAdd({ label, onPress, busy, testID }: {
  /** The whole phrase, for VoiceOver: "New trip", "Add a photo". */
  label: string;
  onPress: () => void;
  busy?: boolean;
  testID?: string;
}) {
  const hang = { marginRight: -INK_GAP_END.add };
  if (busy) {
    return (
      <View
        style={[s.headerBusy, hang]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: true, disabled: true }}
        aria-busy
        testID={testID}
      >
        <ActivityIndicator size="small" color={colors.text} />
      </View>
    );
  }
  return <RoundIconButton bare icon="add" label={label} onPress={onPress} style={hang} testID={testID} />;
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
  // The tile's own radius (`PlaceTile`), so the cell reads as one of them,
  // on the accent's tint: the one cell in the grid that is not a place.
  // The ring alone, in the middle of the tile — see "the ring alone, in
  // the middle" on `AddCell`.
  cellTile: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.input, overflow: 'hidden', backgroundColor: colors.accentSoft,
  },
  cellDisc: {
    width: SECONDARY_CONTROL_H, height: SECONDARY_CONTROL_H, borderRadius: SECONDARY_CONTROL_H / 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderStyle: 'dashed',
  },

  // `SECONDARY_CONTROL_H`, so a pill and a round button in the same header
  // slot are the same height, and the dock's pill is the header's. There
  // was a second, padding-sized height for a pill beside a section heading
  // (`tall` was the 44); every caller had come to pass `tall`, and the
  // button scale (owner, 28 Oct 2026) has no place for a 37, so it went.
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    minHeight: SECONDARY_CONTROL_H, paddingLeft: 14, paddingRight: 18, paddingVertical: 9,
    borderRadius: radius.pill,
  },
  // Dimmed, not greyed: the gradient stays so the pill is still plainly
  // the same object, and 0.7 is the figure `working` rows use elsewhere
  // for "taken, not yet answered" — a little less, since this one also
  // carries a spinner saying so.
  pillBusy: { opacity: 0.7 },
  pillText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
  // The round button's own 44 box, so the spinner stands where the plus
  // did and the header does not move.
  headerBusy: { width: SECONDARY_CONTROL_H, height: SECONDARY_CONTROL_H, alignItems: 'center', justifyContent: 'center' },
});
