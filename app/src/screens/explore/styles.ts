// Explore's stylesheet, and the one measure it shares with the screen:
// the screen and its parts, as they were in one file.

import { StyleSheet } from 'react-native';
import { colors, display, font, onPhoto, radius, space, type } from '../../theme';

/**
 * The pinned filter row's own breathing room, above and below its chips.
 *
 * Named because it has to be subtracted somewhere else. Pinned, the row is
 * its own top edge and needs this; at rest it sits under the Places
 * heading, whose `marginBottom` is already the gap the app uses between
 * any heading and its content — and the two were adding up, so that one
 * heading stood 26pt off its content where every other stands 16.
 *
 * Since the screen went full-bleed the row's real top padding is this
 * *plus the safe-area inset*: with no fixed header left above it, pinning
 * means pinning to the raw top of the glass, and without the inset the
 * chips would sit under the clock. The subtraction at the heading grows
 * by the same amount, so the at-rest geometry is unchanged — see the
 * heading's own comment.
 */
export const FILTER_PAD = 10;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // Full-bleed photography wears no hairline: a translucent border over
  // an image lights up wherever the photo is bright and vanishes where
  // it's dark, reading as a broken frame. Edges end in shadow instead.
  //
  // Only the bottom corners round now that the photo owns the top edge.
  // The gradient's last stop is near-opaque dark, so in the dark theme
  // the edge dissolves into the page and reads as the mockup's fade; on
  // paper the same corners read as a dark sheet ending — a deliberate
  // edge, not a failed blend into white.
  hero: {
    borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card,
    overflow: 'hidden', justifyContent: 'flex-end',
    marginBottom: space.titleToContent,
  },
  // The old fixed header's row, laid on the photograph: dateline left,
  // search right. `top` is inline — it owes the safe area its offset.
  heroTop: {
    position: 'absolute', left: space.page, right: space.page,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  // The eyebrow's voice on the header's glass: photography can be any
  // sky, so unlike the page eyebrow this one brings its own ground.
  heroDate: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8,
    backgroundColor: 'rgba(10,11,10,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  heroDateText: {
    color: onPhoto.text, fontSize: 12, fontFamily: display.semibold,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  // The same disc the detail screen floats on its photos, in the pill's
  // material, so the pair reads as one set.
  heroSearch: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,11,10,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  heroContent: { paddingHorizontal: space.page, paddingBottom: space.cardPadding + 6, gap: 10 },
  // The dateline's material at the headline's shoulder, in the same
  // eyebrow voice (`heroDateText`) — the pills read as one set. The
  // chevron is what makes it read as a control rather than a caption.
  heroCity: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(10,11,10,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  // The screen title's scale, because this is the screen's title now —
  // the display face carrying a whole line, per theme.ts.
  heroTitle: { color: onPhoto.text, ...type.title, lineHeight: 40 },
  heroSub: { color: onPhoto.textSecondary, ...type.meta, lineHeight: 21 },
  // The screen's one loud control: the accent at full strength — the same
  // primary-button material the auth screens use.
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 12,
  },
  heroCtaText: { color: colors.accentInk, fontSize: 16, fontFamily: display.semibold },

  section: {
    color: colors.text, ...type.section,
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },
  // The control sits beside the heading, not out at the margin.
  //
  // `space-between` put it there, and the width of the gap then had
  // nothing to do with the two things it separated — it was whatever the
  // phone was wide. A disc alone on the right edge reads as a second
  // section's worth of distance from the word it belongs to, and on a
  // 430pt screen the thumb has to cross the whole row to reach the sort
  // for the list directly beneath it. Left-aligned, the pair reads as one
  // phrase: the heading, and what you do to it.
  // The gap to the chips is the app's own: `headingToContent`, the same
  // 16 that sits under every other heading in it.
  //
  // It briefly had none, and that was a leftover rather than a choice.
  // While the block still pinned itself, this row was given a fixed
  // height that doubled as the clearance the chips needed under the
  // clock, and the spacing came out of that height. The block stopped
  // pinning itself when the floating copy took the job, the fixed height
  // went with it, and the margin it had been standing in for was never
  // put back — so the heading sat straight on the chips.
  placesHead: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.page,
    marginBottom: space.headingToContent,
  },
  placesTitle: { color: colors.text, ...type.section },
  // The glyph alone, with no disc (owner, 24 Oct 2026). The box keeps
  // its 36pt: with the 4pt slop that is the 44pt target, and it is the
  // box the guide's ring is drawn around.
  filterButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  // Map tiles are light in both schemes, so a disc that reads fine over
  // the hero's dark scrim goes nearly invisible over them — it needs a
  // ground of its own rather than the glass surface the rest of the row wears.
  // The map's own quick filters. Opaque elevated ground, never the glass
  // the rest of the row wears: the tiles under it are busy with lines and
  // labels, and glass over them is noise. Lift is the place card's
  // (`MapPlaceCard`), not the nudge's: the pill is a small control, and
  // the nudge's 18-point blur under a 42-point object reads as a smear.
  mapPill: {
    flexDirection: 'row', alignItems: 'center',
    padding: 3, borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
    shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  // 40 wide, not 36: the pill has no gap between cells, so the extra
  // four points are what keeps two neighbouring glyphs from reading as
  // one. The radius is the pill's minus its padding, so an on-cell's
  // wash follows the pill's curve at the ends instead of cutting across it.
  mapCell: {
    width: 40, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  mapCellOn: { backgroundColor: colors.accentSoft },
  // Between cells, a rule the height of the glyph rather than the cell:
  // full height would carve the pill into boxes.
  mapRule: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.borderGlass },
  // The slot pushes it to the end of the heading row; the pill itself is
  // the thing that gets pressed, which is why the two are separate — see
  // `PressableScale` on where a width has to live.
  viewBtnSlot: { marginLeft: 'auto' },
  // Words and a glyph, with no pill behind them (owner, 24 Oct 2026):
  // the words already say it is a button. The padding stays, because it
  // and the 6pt slop are what make the target 44pt tall.
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  // Neutral in both states. Coral in this app means a filter is on, and
  // spending it here would say the list has been narrowed when all that
  // happened is the reader opened a map.
  viewBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: font.semibold },
  // On the glyph's shoulder rather than the box's corner: with no disc
  // the box is invisible, and a badge at its corner floated 8pt off the
  // mark it counts. The glyph is 19pt in the 36pt box, so its top-right
  // sits 8.5pt in from each edge, and the badge is centred near it.
  filterBadge: {
    position: 'absolute', top: 1, right: 1,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill,
  },
  filterBadgeText: { color: colors.accentInk, fontSize: 9, fontWeight: font.bold },

  shelfHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: space.page },

  // The pinned filter row. Its top padding is inline — FILTER_PAD plus
  // the safe-area inset — because pinned it is the top edge of the whole
  // screen and the chips must clear the clock; the at-rest arithmetic
  // that keeps this invisible lives on the Places heading.
  //
  // No background of its own: that belongs to `filterBarBg`, faded in as
  // the row approaches the top. The page's own colour there, not the tab
  // bar's glass — glass says content is passing beneath me, which is true
  // of the floating bar, but this row pinned is the page's own top edge,
  // the place the list begins under, and it should read as the page.
  // The block in the list: no clearance of its own, because it does not
  // pin. It scrolls off like anything else, and the copy that takes over
  // is the one that has to clear the clock.
  filterBar: {
    paddingBottom: FILTER_PAD,
  },
  // And that copy: over the screen rather than in the list, so nothing
  // it does can move a row or eat a tap meant for one. Opaque, because
  // the list runs underneath it.
  filterBarFloating: {
    position: 'absolute', left: 0, right: 0, top: 0,
    zIndex: 20,
    backgroundColor: colors.bg,
  },
  // Drawn only at the bottom, and only a hairline: it is where the header
  // block ends and the list begins, which is the one edge that has
  // anything to say. A full border would box the row in like a control.
  filterHair: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
  },
  seeAll: { color: colors.accent, fontSize: 14, fontWeight: font.medium },
  // Same rule as the hero: photo cards end in shadow, not in a hairline.
  shelfCard: {
    // Width and height are the screen's business — see `cardW` in the
    // shelf itself.
    borderRadius: radius.image, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  shelfCardText: { padding: 13, gap: 3 },
  shelfCardTitle: { color: onPhoto.text, fontSize: 16, fontWeight: font.semibold, lineHeight: 20 },
  shelfCardMeta: { color: onPhoto.textSecondary, fontSize: 13, fontWeight: font.regular },
  shelfCardFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Right edge of the foot row, so the gesture is a corner rather than
  // a word in the middle of a sentence.
  shelfLikeHit: { marginLeft: 'auto' },
  shelfLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  mapBody: { flex: 1 },
  mapStrip: { position: 'absolute', left: 0, right: 0 },
  // Top-left of the map, in the same discs as the sort control: the
  // reader has already learned what that disc means.
  // `pointerEvents` as a style, not a prop: the prop form is deprecated in
  // this React Native, and a style travels with the element it is on.
  // Both edges, so the toast in it has a width to shrink inside; the
  // row between and around its children stays the map's to pan.
  mapQuick: {
    position: 'absolute', left: space.page, right: space.page, top: 12, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 10, pointerEvents: 'box-none',
  },
});
