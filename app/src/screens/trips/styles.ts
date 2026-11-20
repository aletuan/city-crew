// TripsScreen's stylesheet, and the measures it shares with the screen and
// its parts: as they were in one file.

import { StyleSheet } from 'react-native';
import { SECONDARY_CONTROL_H } from '../../components/ui';
import { colors, font, onPhoto, radius, space, type } from '../../theme';

/**
 * The pitch of the timeline: one row, and the air under it.
 *
 * Named because three styles depend on the pair and one of them is a rail
 * that has to reach from this dot to the next one. The gap was 2, which is
 * not a gap — three stops read as one paragraph with dots in the margin
 * rather than as three places you go to.
 *
 * The row stays one line. This card is deliberately a summary — see the
 * note at the top of the file — so the second line the plan screens give a
 * stop belongs on the detail screen, not here.
 */
const ROW_H = 30;

const ROW_GAP = 6;

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

export const s = StyleSheet.create({
  // The gutter every screen in this app keeps and this one did not: the
  // cards ran to both edges and the card's own corner radius clipped the
  // first glyph of every title.
  body: { gap: space.cardGap, paddingHorizontal: space.page },
  // The trip card's own ground and corner, at a row's height.
  none: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.cardPadding, paddingVertical: 16,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    marginBottom: space.titleToContent,
  },
  noneText: { ...type.body, color: colors.textSecondary, flexShrink: 1 },

  row: { marginBottom: space.cardGap },

  // The card is the tap now, so it carries its own surface rather than
  // sitting inside a `Card` — `PressableScale` needs the fill on the view
  // its children live in, and nesting one inside the other would put a
  // border around a border.
  // The padding lives on `cardBody`, not here, so the cover band can run
  // to the card's own edges. `overflow: hidden` was already on the card;
  // it now also does the clipping that keeps the picture inside the
  // corner radius, which is what makes the band possible without a
  // second rounded view around it.
  card: {
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    overflow: 'hidden',
  },
  cardBody: { padding: space.cardPadding },
  // 3:1, not `PlaceCard`'s 16:10 — see the note at the call site. Its own
  // ground shows for the instant before the image decodes, so the card
  // does not flash the page colour through a hole in itself.
  cover: { width: '100%', aspectRatio: 3, backgroundColor: colors.surfaceGlass },
  // The photographer's credit, required wherever the photo appears.
  // Identical to `PlaceCard`'s down to the shadow: it has to stay legible
  // over a bright sky and invisible the rest of the time.
  attr: {
    position: 'absolute', right: 10, bottom: 8, maxWidth: '50%',
    fontSize: 9, color: onPhoto.text, opacity: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  /** For the two places that do sit inside a real `Card` — the skeleton
   *  and the error — where `s.card` would paint a second surface inside
   *  the first. */
  pad: { padding: space.cardPadding },
  title: { color: colors.text, ...type.cardTitle },

  // The badge's glyph-to-word 5, kept; no box around them.
  company: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  companyText: { ...CAPTION, color: colors.textSecondary },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 6, marginTop: 8 },
  meta: { ...CAPTION, color: colors.textSecondary, flexShrink: 1, marginRight: 'auto' },

  stops: { marginTop: 14, gap: ROW_GAP },
  // `alignItems: center` and a fixed row height, so the dot lands on the
  // middle of its line and the rail between two dots has a known length.
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: ROW_H },
  stopTime: {
    ...CAPTION, color: colors.textSecondary, width: 46,
    fontVariant: ['tabular-nums'],
  },
  // The dot column and the rail beneath it, borrowed from the plan cards so
  // an itinerary looks like an itinerary wherever it is drawn.
  dotCol: { width: 9, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.accentFill },
  // Reaches exactly the next dot, which is why it is spelled as the sum
  // rather than as a number. It was `30` beside a `gap: 2`, and the two
  // were only in agreement by luck — the next hand to loosen the list
  // would have left the rail eight points short of the dot below it and
  // had no way to see why.
  rail: {
    position: 'absolute', top: 9, width: 2, height: ROW_H + ROW_GAP,
    backgroundColor: colors.borderGlassSoft,
  },
  stopName: { ...type.body, color: colors.text, flex: 1 },
  // Right-aligned and capped: it is the answer to "whereabouts", read after
  // the name, and letting it grow would push the name into an ellipsis to
  // print a district nobody was looking for yet.
  // A share of the row rather than the 108pt it was: 108 is a third of
  // the line on a 393pt phone, and on a 320pt one — an SE, or any iPhone
  // with Display Zoom on — the same 108 beside the 46pt time and the dot
  // column left the place name about 50pt, six characters. A third holds
  // the same proportion on both.
  stopArea: { ...CAPTION, color: colors.textTertiary, maxWidth: '33%', textAlign: 'right' },
  stopGone: { ...type.body, color: colors.textTertiary, fontStyle: 'italic', flex: 1 },
  more: { ...CAPTION, color: colors.textTertiary, marginLeft: 56, marginTop: 4 },

  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginTop: 14, marginBottom: 12,
  },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  open: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openText: { ...CAPTION, color: colors.accent, fontWeight: font.semibold },

  // Dimmed, not greyed out: still legible, just no longer the thing you
  // came here for.
  cardPast: { opacity: 0.72 },


  first: {
    alignItems: 'center', gap: 10, marginHorizontal: space.page,
    paddingHorizontal: space.cardPadding + 6, paddingTop: 26, paddingBottom: 22,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, marginBottom: space.titleToContent,
  },
  firstIcon: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
    marginBottom: 2,
  },
  firstTitle: { color: colors.text, ...type.headline, textAlign: 'center' },
  firstBody: {
    color: colors.textSecondary, fontSize: 15, lineHeight: 21,
    textAlign: 'center', marginBottom: 6,
  },
  guestHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  guestReturning: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginHorizontal: space.page, marginBottom: space.titleToContent },
  guestSignIn: { minHeight: SECONDARY_CONTROL_H, justifyContent: 'center', paddingHorizontal: 6 },
  guestSignInText: { color: colors.accent, fontSize: 15, fontWeight: font.semibold, textAlign: 'center' },

});
