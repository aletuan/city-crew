// Profile's stylesheet and the line metrics its rows share. One sheet for
// the screen and its parts, as it was in one file: the cards share a
// dozen of these, and a copy per part would drift.

import { StyleSheet } from 'react-native';
import { colors, font, quoteFace, radius, space, type } from '../../theme';

/**
 * Where the glyph sits on a two-line row: level with the first line, as
 * `PlaceDetailScreen` sets its own against a label. The owner caught the
 * difference the day the wells came off (6 Oct 2026): there the glyph
 * marks the label, here it had floated to the middle of label-plus-value,
 * so the same bare glyph read as two conventions one tab apart.
 *
 * The arithmetic is the detail screen's. The slot is `GLYPH_BOX` tall —
 * room for a 19pt glyph's whole line, where a box the height of the
 * label's line clipped it — and a margin of `(line − GLYPH_BOX) / 2`
 * puts the box's middle on the first line's middle, whatever the second
 * line does. The first lines are stated, not left to the platform: 15 for
 * the 12.5pt caption (the system face gives 14.9), 19 for the 16pt title
 * (19.1). A single-line row passes no line and lets the row centre it,
 * which lands in the same place.
 */
export const GLYPH_BOX = 26;

export const CAPTION_LINE = 15;

export const TITLE_LINE = 19;

export const s = StyleSheet.create({
  // The picker's chip, at rest: same glyph and hue, no press state and no
  // border — this card is a page of answers, not a set of controls. A
  // size up from when they sat in a table's value column: with the card's
  // width to themselves, 13.5pt chips read as leftovers.
  //
  // 44 tall, from the 37 its padding made: the same category chip is 44
  // on Search, Places and a place's own facts row, and a Cafés pill at
  // two heights across the app reads as two different things. Still no
  // border and no press state — the height is for the family, not a tap.
  tasteChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 14 },
  tasteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 9, minHeight: 44,
  },
  tasteChipText: { color: colors.text, fontSize: 15, fontWeight: font.medium },
  tasteEmpty: { paddingVertical: 14 },
  // The role badge and the Edit profile button, one row under the name.
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  // The ring with its two corners: the level's pill at bottom-right (the
  // ring's own), the role's disc at top-right (this screen's). Shrunk to
  // the ring, so "top-right" is the ring's corner and not the row's.
  avatarBox: { alignSelf: 'flex-start' },
  // The level pill's halo, mirrored to the top: the page's ground around
  // the disc, so the arc plainly runs underneath it (see EngagementRing).
  roleHalo: {
    position: 'absolute', right: -4, top: 0,
    backgroundColor: colors.bg, borderRadius: 999, padding: 2.5,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  // 24pt: the level pill's height, so the two corners read as a pair.
  roleDisc: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  roleGuide: { borderColor: colors.ok, backgroundColor: colors.okSoft },
  roleEditor: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 4 },
  avatarBig: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  heroTitle: { color: colors.text, fontSize: 19, fontWeight: font.bold, letterSpacing: 0.1 },
  heroBody: { color: colors.textSecondary, ...type.meta, lineHeight: 21 },

  guestLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: 4,
  },
  guestLinkText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },

  featureCard: { paddingHorizontal: space.cardPadding },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  // A row of two lines: the glyph is lifted to the first (see `GLYPH_BOX`),
  // and the chevron at the far end keeps the middle through `rowEnd`.
  twoLineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  rowEnd: { alignSelf: 'center' },
  featureRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft },
  // The old well's footprint without the well — see `RowGlyph`.
  rowGlyph: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold, lineHeight: TITLE_LINE },
  // Regular, not semibold: a settings label names a row, it does not head
  // a paragraph. The value takes the rest of the line and is pushed right
  // by its own flex rather than by a spacer view.
  // `flexShrink: 1` is what keeps the row's right-hand control on the
  // screen. Without it the label is rigid: on a 320pt window (an iPhone SE,
  // or an iPhone 15 with Display Zoom on) the switch row's label plus the
  // icon and the switch came to more than the card's 244pt, and the switch
  // was pushed past the card's edge and clipped. The value rows never
  // clipped, because their value has `flex: 1` and gives way first — the
  // label still takes the line ahead of it, and only shrinks once it is
  // the label alone that does not fit.
  settingLabel: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: font.regular },
  // No margin of its own: the row's 14pt gap already separates it from
  // the label, and the 10 this used to add was a quarter of the value's
  // room on a narrow screen — "Automatic" truncated to "Automa…" with the
  // gap it did not need.
  settingValue: {
    flex: 1, textAlign: 'right',
    color: colors.textTertiary, fontSize: 15, fontWeight: font.regular,
  },
  featureSub: { color: colors.textTertiary, fontSize: 14, fontWeight: font.regular, lineHeight: 19 },

  // On the glyph's shoulder. It sat on the well's corner (−2, −2) while
  // there was a well; on a bare 19pt glyph centred in a 44pt slot the
  // glyph spans 12.5–31.5, so a 10pt dot at 8 from the top and the right
  // (26–36) overlaps its top-right corner the way a badge sits on an
  // icon, rather than floating in the slot's empty corner 13pt away.
  reqDot: {
    position: 'absolute', top: 8, right: 8,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.accent,
    // The ring is the card's own colour, cut round the dot. Resolved in
    // JS at the call site (`bgElevatedHex[scheme]`): a `dyn` pair on a
    // border follows the phone's appearance, not the app's — `bgHex`.
    borderWidth: 2,
  },
  // The pill: 22pt tall so it sits inside the 44pt row without touching
  // its edges, the radius half the height for a true capsule. `minWidth`
  // 32 is two digits of 13pt semibold plus the padding — so "6", "30"
  // and "99" are one width, and the pills down a card line up.
  section: { color: colors.text, ...type.section, marginTop: 10 },

  // 2, not the 5 the column around it uses: a name and the handle under
  // it are one identity read top to bottom, and at the column's gap they
  // read as two separate facts that happen to be adjacent. Everything
  // below — the bio, the button — keeps the wider spacing.
  nameBlock: { gap: 2 },
  // No `flexShrink` on either any more: on their own lines neither is
  // competing for width with the other, and each wraps or truncates
  // against the column instead.
  accountName: {
    color: colors.text, fontSize: 23, fontWeight: font.bold, letterSpacing: 0.2,
    lineHeight: 28,
  },
  handle: { color: colors.textTertiary, ...type.meta },
  // The shared line's own box; the runs inside carry their colours.
  handleLine: { ...type.meta, lineHeight: 21 },
  // The card surface, not the glass tint: on paper the tint is a grey
  // smudge on a warm page, where the About-me card sitting inches below
  // it is white. Matching that card makes the button read as part of the
  // same set of objects rather than a hole in the background.
  // Under the hero, over a hairline: the width is split three ways and
  // the numbers centre in their thirds, with a short rule between.
  stats: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14,
    paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft,
  },
  stat: { alignItems: 'center', gap: 2, paddingVertical: 6 },
  statN: { color: colors.text, fontSize: 22, fontWeight: font.bold, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.borderGlassSoft },
  // The dash is a placeholder, so it takes the label's grey rather than
  // the ink a real count is drawn in.
  statPending: { color: colors.textTertiary },
  statsFailed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  statsFailedText: { color: colors.textSecondary, fontSize: 13 },
  statsRetry: { color: colors.accent, fontSize: 13, fontWeight: font.semibold },
  editBtn: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlassSoft,
    backgroundColor: colors.surfaceCard, paddingHorizontal: 16, paddingVertical: 8,
    // 44, not the 33 the padding alone made: it is a button.
    minHeight: 44, justifyContent: 'center',
  },
  editBtnText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },

  aboutLabel: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium, lineHeight: CAPTION_LINE },
  aboutValue: { color: colors.text, fontSize: 16, fontWeight: font.regular, lineHeight: 21 },

  signOutBtn: {
    borderRadius: radius.input, paddingVertical: 13, alignItems: 'center', marginTop: 6,
    borderWidth: 1, borderColor: colors.borderGlassSoft, backgroundColor: colors.surfaceGlass,
  },
  signOutText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },
  // TripDetailScreen's `delete`, measure for measure. The top margin is
  // this screen's own: the buffer below the tagline, see the note above.
  deleteBtn: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlassSoft,
    paddingVertical: 11, paddingHorizontal: 20, marginTop: 22,
  },
  deleteText: { color: colors.bad, fontSize: 13, fontWeight: font.semibold },

  tagline: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  // Lora's italic — see `quoteFace` in theme.ts. A face means no
  // fontWeight here, and a serif at this size wants a step more body
  // and air than the system meta type the two mottos used to wear.
  taglineText: { color: colors.textTertiary, fontFamily: quoteFace, fontSize: 16, textAlign: 'center', lineHeight: 25, letterSpacing: 0.2 },
  // Half a step under the quote, in the quote's own hand: the words
  // carry the weight, the name just signs them.
  taglineBy: { color: colors.textTertiary, fontFamily: quoteFace, fontSize: 13, letterSpacing: 0.4, marginTop: -2 },
});
