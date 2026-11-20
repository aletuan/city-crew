// IdeasScreen's stylesheet, and the measures it shares with the screen and
// its parts: as they were in one file.

import { StyleSheet } from 'react-native';
import { SECONDARY_CONTROL_H } from '../../components/ui';
import { colors, font, quoteFace, radius, space, type } from '../../theme';

/** The Day / Evening track's padding and border, which its halves sit inside. */
const SEG_PAD = 3;

const SEG_BORDER = 1;

export const SEG_SLOP = { top: SEG_PAD + SEG_BORDER, bottom: SEG_PAD + SEG_BORDER };

export const s = StyleSheet.create({
  // The quote face the Profile footer wears, sized for a lede, in the
  // title's own column — so no page padding of its own. The 24pt line,
  // the 6pt above and the 12pt below are what `IdeasHeaderArt.BAND`
  // counts on; change one, change both. The 12 is the room before the
  // first section heading, which sat 13pt under the lede without it.
  // A face means no fontWeight (theme's rule).
  lede: {
    color: colors.textTertiary, fontFamily: quoteFace, fontSize: 16, lineHeight: 24,
    marginTop: 6, marginBottom: 12,
  },
  heading: {
    color: colors.text, ...type.headline,
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },

  // No heading above it, unlike every question below. A heading would make
  // it a fifth question; without one it reads as an alternative to the four,
  // which is what it is.

  grid: { paddingHorizontal: space.page },

  whenCard: { marginHorizontal: space.page, paddingVertical: 4 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 14 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 10 },
  whereText: { color: colors.text, fontSize: 16, fontWeight: font.medium, flex: 1 },
  // One track, two halves — the pill the app gives a chosen control, on a
  // recessed ground so the pair reads as a single switch rather than as
  // two buttons that happen to be adjacent.
  segment: {
    flexDirection: 'row', padding: SEG_PAD,
    borderRadius: radius.pill, backgroundColor: colors.bg,
    borderWidth: SEG_BORDER, borderColor: colors.borderGlassSoft,
  },
  // The track stands at `SECONDARY_CONTROL_H`, the button scale's 44
  // (owner, 28 Oct 2026; it was 46 with a 38 inside), and each half is the
  // 36 left inside its padding and hairline. The slop reaches back out to
  // the track's edge, so each half is still a 44pt target. It measured 29
  // from padding alone.
  segItem: {
    minHeight: SECONDARY_CONTROL_H - 2 * (SEG_PAD + SEG_BORDER), paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
  },
  segItemOn: { backgroundColor: colors.accentSoft },
  segText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium },
  segTextOn: { color: colors.accent, fontWeight: font.semibold },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginHorizontal: 14 },

  fromRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceGlass },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  fromTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  fromMeta: { color: colors.textTertiary, fontSize: 13 },
  // The pin's gap to its figure on the shelf's cards.
  fromCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // On the page's margin, as the when-card above them is. The seed cards
  // had only their vertical padding and ran to the screen's edges, so
  // the two cards on this screen stood at two widths and the ticks sat
  // under the phone's rounded corner (owner's screenshot, 21 Nov 2026).
  seedCard: { marginHorizontal: space.page, paddingVertical: 4 },
  // Under the heading, in the rows' own meta voice: it is about the rows.
  // On the heading's own margin, since it is the heading's second line;
  // pulled up into the heading's gap so the two read as one block.
  fromHint: {
    color: colors.textTertiary, fontSize: 13, paddingHorizontal: space.page,
    marginTop: -(space.headingToContent - 2), marginBottom: 10,
  },
  // The start sheet's well, on the heading's margin: `okSoft` on `okInk`,
  // the pair the theme keeps for state the reader made.
  movedWell: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: space.page,
    marginBottom: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.card,
    backgroundColor: colors.okSoft,
  },
  movedText: { flex: 1, color: colors.okInk, fontSize: 13, lineHeight: 19 },
  askTitle: { color: colors.text, ...type.cardTitle },
  askMeta: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  groupLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    letterSpacing: 0.7, textTransform: 'uppercase', paddingHorizontal: space.page,
    marginTop: 12, marginBottom: 8,
  },
  more: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    paddingVertical: 10, paddingHorizontal: space.page,
  },
  moreText: { color: colors.accent, fontSize: 14, fontWeight: font.medium },

  cta: { paddingHorizontal: space.page, marginTop: 4, gap: 10 },
  ctaOff: { opacity: 0.4 },
  ctaHint: { color: colors.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center' },

  // Under the card, not inside it: the card is the control and this is a
  // consequence of it, the same relation `ctaHint` has to the button.
  //
  // `space.page`, like every other top-level element here. This screen has
  // no container padding — the scroll view runs edge to edge and the lede,
  // the headings, the card and the CTA each declare their own inset. A `4`
  // slipped in here instead, borrowed from a card's interior, and left the
  // line starting 18pt to the left of everything it belongs under.
  whenNote: {
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: space.page,
  },

  // The whole left of the row is the target, not the words alone: a date
  // you have to hit exactly is a worse row than one you can tap across.
  // The box takes the room; the row inside it lays the icon and date out.
  dayBox: { flex: 1 },
  dayHit: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 2 },

  pickScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.32)' },
  // Centred rather than a bottom sheet: the calendar is a square of dense
  // targets, and the middle of the screen is where a thumb reaches all of
  // it. The start sheet is bottom-anchored because it is a form.
  pickCard: {
    position: 'absolute', left: space.page, right: space.page,
    top: '18%',
    backgroundColor: colors.bgElevated,
    borderRadius: 22,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
});
