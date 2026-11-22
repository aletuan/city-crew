// The collection screen's stylesheet, and the measures it shares with the
// screen and its parts: one file's worth, as they were in one file.

import { StyleSheet } from 'react-native';
import { ICON, CHIP_H, INK_GAP_END, SECONDARY_CONTROL_H } from '../../components/ui';
import { colors, display, font, radius, space, type } from '../../theme';

/** Between tiles, both ways. The reference's, measured off it: about a
 *  fourteenth of a tile. */
export const GRID_GAP = 8;

/** The face at the head of the card, yours or the curator's — see
 *  `curatorRow`. The ⋯ beside it is centred on it (`s.moreHang`).
 *
 *  40, up from 28 (owner, 13 Nov 2026), when the head became a post's:
 *  a face with two lines beside it, the handle and how old the list is.
 *  The size the apps this reads beside give that head — Facebook and X
 *  draw 40, Threads 36, Instagram 32 — and the height of the two lines
 *  (`BYLINE_LINE` twice), so the face and the words beside it are one
 *  block, neither overhanging the other. */
export const FACE = 40;

/** Each of the two lines beside the face: half of it, so the handle and
 *  the line under it stand exactly the face's height. A 15pt line in the
 *  system face is 17.9 by its own metrics (SF Pro's ascender and
 *  descender come to 1.19 em), so 20 adds about a point above and below
 *  each, and nothing is clipped. */
const BYLINE_LINE = FACE / 2;

/** Air between the handle and the line under it (owner, 16 Nov 2026).
 *
 *  The two 20pt lines stood flush, and on the phone "18h · 🌐 Public"
 *  sat against the handle: both lines are 15pt, the lower one carries a
 *  15pt globe, and the point of leading each line keeps is all there was
 *  between two inks of one size. 3 is the step that reads as two lines
 *  rather than one block of text.
 *
 *  The column is 43 with it, 3 over the face. It gives them back as a
 *  negative margin, half above and half below, so the row is still the
 *  face's 40 and nothing under it in the card moves: the words overhang
 *  the face by a point and a half each way, inside the leading the
 *  lines already hold, which no eye finds.
 *
 *  Rejected: a 44 face with 22pt lines. It keeps "two lines are the
 *  face" exactly and buys 2, not 3 — and makes every head in the app
 *  larger to move two lines apart. */
export const BYLINE_GAP = 3;

/** What the line under the handle adds above and below the who-can-see
 *  control to make Apple's 44 for the thumb. The control cannot be drawn
 *  `CHIP_H` tall there: 32 in a 20pt line would make the two lines 52,
 *  taller than the face, and push the words down 12. So it is drawn the
 *  line's 20 and reaches the button scale's 44 (`SECONDARY_CONTROL_H`)
 *  with 12 each way, as `CHIP_SLOP` reaches it from 32 with 6. Upward that
 *  reaches into the handle's line, which on your own list is never a
 *  button; downward, into the 14 between the head and the words. */
export const BYLINE_SLOP = {
  top: (SECONDARY_CONTROL_H - BYLINE_LINE) / 2,
  bottom: (SECONDARY_CONTROL_H - BYLINE_LINE) / 2,
};

/** The heart's tally, which set the foot's height before the activity
 *  row had one: 15pt in the system face, 17.9 by its metrics, so 18. */
const TALLY_LINE = 18;
/** How much lower the heart stands in the `CHIP_H` activity row than it
 *  did in the foot, and how much higher off the card's bottom: 7. */
const ROW_AIR = (CHIP_H - TALLY_LINE) / 2;
/** "View activity ›"'s chevron, at the words' 15. */
export const ACTIVITY_CHEVRON = ICON.text;
/**
 * The heart and Share at the card's foot: 18, in the secondary grey
 * (owner, 18 Nov 2026).
 *
 * They were 15 in the tertiary grey, the byline's — "one of the row's
 * quiet marks" — and on the owner's phone a liked heart, filled, stood
 * beside a Share that had all but gone: an outline's stroke is 32/512 of
 * its size, 0.94pt at 15, in the app's faintest ink. At 18 it is 1.1pt,
 * and a step darker. Not 20, the size a feed's card gave its heart: this
 * row also holds the words "Share" and "Activity". The feed's card came
 * down to this the same day, so one heart is one size on a card.
 *
 * Not the hearts on a photograph (Explore's shelf, the Collections
 * tab's tiles): white on a picture has no contrast to find, and a tile
 * has no room.
 */
export const ACT_GLYPH = ICON.action;
/** How far the chevron's ink stops short of its box's right edge, read
 *  off the icon font itself (13 Nov 2026): Ionicons' `chevron-forward`
 *  is drawn from 159 to 352 of a 512 advance, so 160/512 = 0.312 of the
 *  size is empty after the ink — 4.7 at 15. The same measure gives the
 *  back chevron's 6.75 at 22 (`BACK_HANG`), its mirror image. */
const CHEVRON_GAP_END = ACTIVITY_CHEVRON * (160 / 512);

export const s = StyleSheet.create({
  // No `screen`, no `header`, no `title`. This screen drew its own header
  // and it drifted: a 20pt title where every other pushed screen has 26,
  // centred against a two-line stack where the shared one aligns to the
  // first line, and its own paddings. `Screen` draws it now — the same
  // component Crew, Trips, Ideas and six others already use, and the same
  // shape `authUi` arrived at independently.
  //
  // The 20pt was a workaround for long collection names truncating, which
  // `Screen` answers better: two lines at 26pt hold far more of a name
  // than one line at 20 ever did.
  // The glyph, the word and the chevron, as one press, on nothing: see
  // `visibility` above. The 5 the header line it came from used, so the
  // three still read as one phrase. The byline's height, not `CHIP_H`
  // (13 Nov 2026): it stands in that line now, and `BYLINE_SLOP` makes
  // the 44pt target. "Shared with you" wears the same box, unpressed.
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 5, height: BYLINE_LINE },
  // A question, so it is the sheet's whole header: the rows under it are
  // the answers, and the title VoiceOver hears first. The size and face
  // Visited's sheet titles use.
  sheetTitle: { color: colors.text, fontSize: 18, fontFamily: display.semibold, paddingHorizontal: 4 },
  meta: { color: colors.textTertiary, ...type.meta },
  // The heart's tally and Share's word: the acts' ink, a step darker
  // than the byline's — see `ACT_GLYPH`.
  act: { color: colors.textSecondary, ...type.meta },
  // The heart and its tally, one fact, first in the activity row (see
  // `activity`). In the header it had to sit beside the count, or it read
  // as a second header control slipped a line under ⋯ — inside the card
  // there is no control above it to be mistaken for.
  // The Share sheet's head: its title, and under it the question its
  // first card answers, in the quiet grey a card's own lines wear.
  sheetHead: { gap: 4 },
  sheetAsk: { color: colors.textTertiary, ...type.meta, paddingHorizontal: 4 },
  like: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // Public or Private, in one grey — see `visibility`.
  visibilityWord: { color: colors.textTertiary, ...type.meta, lineHeight: BYLINE_LINE },
  // The list's age, then who sees it, under the handle. 6 round the
  // "·", the gap the card's other "a · b" line keeps (`filterCount`).
  byline: { flexDirection: 'row', alignItems: 'center', gap: 6, height: BYLINE_LINE },
  // The meta size and grey, as the word after it: one line, one ink.
  bylineText: { color: colors.textTertiary, ...type.meta, lineHeight: BYLINE_LINE },

  // Full width at the foot of the list, in the page's margins, with the
  // room the dashed slot it replaced kept above it.
  // The chips and, while something is chosen, the count line under them.
  kindsBlock: { gap: 10 },
  // The kinds in a column that wraps, the count fixed to its right. 12
  // from the last kind to the rule and 12 from the rule to the pin (its
  // 9 and the count's own 3): the rule midway, and each side under the
  // 18 between two kinds, so the rule and the count read as the row's
  // end rather than one more kind. It was 16 with no rule.
  kindsLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kindsLeft: { flex: 1 },
  // A bare kind's box — 13pt medium in the tertiary grey, the pin at the
  // word's size — so the figure is a kind's equal in weight and quieter
  // in ink: it counts, it does not name. 3 between pin and figure, not a
  // kind's 6 between dot and word: the pin's own bearings make up the
  // rest (measured in ink, see `activityRow`).
  placeCount: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  placeCountText: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium },
  // The rule before the count: the thinnest line the screen draws, in the
  // card's hairline ink but the firmer of the two (`borderGlass`, not the
  // `borderGlassSoft` the hairline across the card uses) — a third of a
  // point upright and 14 tall reads as nothing in the softer one. 14:
  // the 13pt figure's line, no taller than the words it stands between.
  countRule: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: colors.borderGlass, marginRight: 9 },
  // `KindPill`'s rule, clear: 4 above and below and a 2pt border, so a
  // filter row's first line and the count are one height.
  placeCountRule: { paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterCountText: { color: colors.textTertiary, fontSize: 13 },
  filterClear: { color: colors.accent, fontSize: 13, fontWeight: font.semibold },
  // The page's margins outside, the card's padding inside; the text keeps
  // the body size and line height it had bare, so nothing reflows but
  // the inset. The ⋯ hangs at the top right, on the face's row.
  // Above the places, so the cover growing out of its tile is not drawn over
  // by the cells it crosses (`CollectionHero`).
  headerAbove: { zIndex: 2 },
  descWrap: { paddingHorizontal: space.page, paddingBottom: 14 },
  // ── the card's rhythm, measured in ink (owner, 13 Nov 2026) ──
  // Read off a 2x render of a visitor's card, ink to ink, before and
  // after the morning's change. The last column is the afternoon's — the
  // 40pt face with two lines, the foot become the activity row — and is
  // that render's figures carried through the change, worked out rather
  // than read off a new render: re-read it on a device.
  //
  // |                        | before  | morning | afternoon |
  // |------------------------|---------|---------|-----------|
  // | card's top → face      | 16      | 20      | 20        |
  // | face → words           | 15–18   | 17–20 (accents, letters) | 17–20 |
  // | words → kinds          | 20.5    | 20.5    | 20.5      |
  // | kinds → hairline       | 21      | 21      | 21        |
  // | hairline → heart       | 16.5    | 20.5    | 20.5      |
  // | heart → card's bottom  | 20      | 20      | 20        |
  // | words' left / right    | 16 / 48 | 16 / 16 | 16 / 16   |
  //
  // So one rhythm of about 20 from the card's top to its bottom: the words
  // came out of the face's row (the 12 of `descBody` became this 14),
  // the foot's top went from 12 to 16, and the top from 16 to 20, since
  // the face is a solid disc whose ink fills its box while the heart, at
  // the bottom, carries a few points of its glyph's own air. The sides
  // stay 16: the words now run to the card's own edges.
  //
  // The afternoon keeps every figure. The face is still a solid disc, and
  // the head row is still the face's height — the two lines beside it
  // are `BYLINE_LINE` twice and the ⋯ is centred inside it — so the top
  // and the 14 under the head stand. The activity row is `CHIP_H` where
  // the foot was the tally's line (`TALLY_LINE`), so the heart sits
  // `ROW_AIR` lower in it and `ROW_AIR` higher off the bottom: both
  // paddings round it give that back, 16 − 7 = 9, and the heart's ink
  // keeps its 20.5 and its 20.
  // The card itself holds only the cover and the words' block under it;
  // the padding the card had is the block's (`descIn`), so the cover can
  // run to the card's edges.
  descCard: {},
  descIn: {
    gap: 14, padding: space.cardPadding, paddingTop: space.cardPadding + 4,
    paddingBottom: space.cardPadding - ROW_AIR,
  },
  // The face and its two lines, with the ⋯ at the end of the row; the
  // words go under it, across the card (owner, 13 Nov 2026). Centred, so
  // a head with no face — an editorial handle, or your own list's note
  // glyph — stands its one line on the ⋯'s middle rather than the top.
  descTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  descBody: { flex: 1 },
  // The face and the handle. `alignSelf` keeps the press to the row's own
  // width rather than the card's: a tap on empty space beside a handle
  // should not open a sheet about a person.
  curator: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', maxWidth: '100%' },
  // The handle over the line under it (`byline`), the column the face's
  // height, and the handle the part that gives when it is long.
  // `BYLINE_GAP` apart, and no taller in the row for it — see there.
  curatorLines: { flexShrink: 1, gap: BYLINE_GAP, marginVertical: -BYLINE_GAP / 2 },
  curatorTag: { color: colors.text, fontSize: 15, fontWeight: font.semibold, lineHeight: BYLINE_LINE, flexShrink: 1 },
  // A hairline, then the activity row (`activity`).
  activity: {
    // 9, not the foot's 16 (owner, 13 Nov 2026): the row is `CHIP_H` now,
    // the heart centred in it, so 16 − `ROW_AIR` keeps its ink 20.5 under
    // the hairline — see `descCard`.
    paddingTop: space.cardPadding - ROW_AIR,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  // The heart from the start of the row, "View activity ›" at its end.
  // One height whatever it holds, so the card does not grow when it does.
  //
  // ── the spacing, measured in ink (owner, 12 Nov 2026) ──
  // Measured while the count was still in the foot; it moved to the kinds'
  // row the next day, taking its 3 with it (`placeCount`), and so did who
  // can see the list, to the line under the handle. The 20 between pairs
  // stays for whatever the row holds next to the heart.
  // Read off a 2x render of a visitor's foot, glyph ink to glyph ink, not
  // off these numbers: each glyph's box has side bearings of its own.
  //
  // |                     | ♡ → 2 | 2 → 📍 | 📍 → 17 |
  // |---------------------|-------|--------|---------|
  // | was (gap 16, pin 6) | 6.5   | 20     | 9.5     |
  // | now (gap 20, pin 3) | 6.5   | 24     | 6.5     |
  //
  // The pin's box is wider round its ink than the heart's, so at the
  // same gap its count stood 3pt further off. "2 · 📍 · 17" read as four
  // things evenly spaced, not two pairs: 20 between the pairs was only
  // twice the 9.5 inside one. Now each glyph sits 6.5 from its count and
  // the pairs 24 apart, nearly four times that.
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 20, height: CHIP_H },
  // To the row's end whether a heart is before it or not, and hung past
  // the card's padding by the chevron's empty edge (`CHEVRON_GAP_END`),
  // so the ink ends where the words above it do, as the ⋯'s does.
  activityLinkHang: { marginLeft: 'auto', marginRight: -CHEVRON_GAP_END },
  // 2 between the word and the chevron's box: with the glyph's own 4.7 of
  // bearing (`CHEVRON_GAP_END`, the same each side) that is 6.7 of air
  // from the word to the ink, the 6.5 the heart keeps to its tally.
  activityLink: { flexDirection: 'row', alignItems: 'center', gap: 2, height: CHIP_H },
  activityLinkText: { color: colors.textTertiary, ...type.meta },
  // Justified (owner, 3 Nov 2026), the owner's call over the case put
  // against it: a 318pt column holds some 44 characters, iOS does not
  // hyphenate Vietnamese, and the up-to-25pt each ragged line stopped
  // short now goes into its nine or so spaces — some open to near twice
  // a space. The last line stays ragged, as justified text always ends,
  // so "… Đọc thêm" and "Thu gọn" keep their own spacing. Here only: the
  // place blurbs and every other paragraph stay set ragged-right.
  descText: { color: colors.textSecondary, ...type.body, lineHeight: 24, textAlign: 'justify' },
  // `alignSelf` keeps the press to the words, as the curator row's does.
  descAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 24 },
  descAddText: { color: colors.textTertiary, fontSize: 15, fontStyle: 'italic', flexShrink: 1 },
  // The ⋯'s box: the header's 44pt width, so the header's measure of the
  // glyph's ink (`INK_GAP_END`, a 21pt ⋯ centred in 44) still holds, and
  // `CHIP_H` tall, an action inside a row; `CHIP_SLOP` makes 44 of that
  // for the thumb. A 32pt-wide box would have been the same 44 tall but
  // 32 across, and its ink a fresh number nobody had measured.
  more: { width: SECONDARY_CONTROL_H, height: CHIP_H, alignItems: 'center', justifyContent: 'center' },
  // Hung past the card's padding by the glyph's empty edge, so the ink
  // ends where the words under it do, as the pencil's did. And 4 of air
  // above and below: 32 drawn on the face's 40pt row, centred on the
  // face, and the row the face's height even where there is no face —
  // an editorial handle's, or a lent list's with no handle — so every
  // card's head is one height and the words start at one place. On the
  // 28pt face this was 2 into the air instead, for the same reason.
  moreHang: { marginRight: -INK_GAP_END['ellipsis-horizontal'], marginVertical: (FACE - CHIP_H) / 2 },

  // The responder that carries a lifted card: the list's whole height.
  dragArea: { flex: 1 },
  // Lifted: above its neighbours, with the shadow of something held off
  // the page. `zIndex` for iOS and the web, `elevation` for Android.
  arrangeCellLifted: { zIndex: 10, elevation: 6 },
  gridRow: { paddingHorizontal: space.page, gap: GRID_GAP, marginBottom: GRID_GAP },

  // The views' name over their card in the ⋯'s sheet: quieter than a
  // row's title, so it reads as a heading and not as one more thing to
  // press; inset as the sheet's title is, and spaced by the sheet's own
  // gap like everything else in it.
  menuSection: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium, paddingHorizontal: 4 },
  emptyWrap: { marginHorizontal: space.page, marginTop: 24 },
  empty: {
    alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding + 6, paddingTop: 26, paddingBottom: 24,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card,
  },
  emptyIcon: {
    width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  // 16, not 15: it is one short line now rather than a paragraph, and at
  // the smaller size it read as a caption under the glyph.
  emptyBody: {
    color: colors.textSecondary, fontSize: 16, lineHeight: 22, textAlign: 'center',
  },
});
