// PlaceCard's stylesheet, shared by the card and the two pieces it draws
// (`PlaceCardPhoto`, `PlaceCardMeta`), as it was in one file.

import { StyleSheet } from 'react-native';
import { colors, font, onPhoto, quoteFace, radius, space, type } from '../theme';
import { photoDisc } from './ui';

export const s = StyleSheet.create({
  // ── the box, back (owner, 21 Nov 2026) ──
  //
  // A white box with a hairline round the photograph and the words, the
  // shared `Card`'s ground, edge and radius, the words padded inside it
  // as they were before 6 Nov. That day the owner's reference took the
  // box away — the photograph rounded on its own and the words sat on
  // the page under it, flush with the margin, 32pt more line for a name
  // — and the card in a collection's drag had to borrow a ground for
  // the length of the lift (`raised`, gone with this). The owner asked
  // for it back after seeing both side by side: each place reads as one
  // thing, as the collections on a person's page do, and where one ends
  // is no longer said by space alone.
  //
  // Weighed the same evening and passed over: a ground a step darker
  // than the page with no hairline (lighter, but neither the old card
  // nor the profile's), a white caption panel over the photograph's foot
  // (hides the rating and the hours ribbon), and the words over the
  // photograph as on the community shelf (unreadable on a light
  // photograph, and the kind's dot is lost on it).
  card: {
    marginHorizontal: space.page, marginBottom: space.cardGap,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft, overflow: 'hidden',
  },
  photo: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.surfaceGlass },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  // Google asks for the photo's author attribution wherever the photo is
  // shown, so this is not dropped — only made to recede. The camera
  // glyph is gone (it read as a control), the type is smaller, and it is
  // capped at half the card so a long name can't cross the frame.
  // Whether it is drawn at all is the `photo_attribution` switch, and
  // that is a decision taken in the database, not here — see
  // `lib/flags.ts` for why it has to be reversible without a release.
  attr: {
    position: 'absolute', right: 10, bottom: 8, maxWidth: '50%',
    fontSize: 9, color: onPhoto.text, opacity: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  // ~10% tighter than the standard card body: this is a feed, not a form.
  body: { paddingHorizontal: space.cardPadding, paddingVertical: 13 },
  // Top-right of the image, mirroring the attribution bottom-right.
  saveSlot: { position: 'absolute', top: 10, right: 10 },
  /**
   * The closed-sash, solved against the reference rather than eyeballed.
   *
   * Measured off the mock rather than eyeballed, and the way it had to
   * be measured is worth recording: reading a slanted band off a
   * photograph column by column gives numbers that are wrong in a
   * flattering way, because a brick wall passes for a dark red and the
   * card's own rounded corner clips the band just where a column meets
   * it. Rotating the crop flat first and measuring the band horizontally
   * is what produced these.
   *
   * On the mock's 1268 × 691 photograph, scaled by 349/1268 to the card
   * this app draws:
   *
   *   band thickness      70 px   →  19pt, taken as 20
   *   centre line meets the left edge   52pt down
   *   centre line meets the top edge   130pt across
   *   so the angle is atan(52/130) ≈ 22°, and the visible chord 140pt
   *   the line of text                 345 px  →  95pt for 20 characters
   *
   * ── why the angle is not the reference's 22° ──
   *
   * Shipped at 22° and looked at on a phone, the sash reads as a banner
   * laid along the top rather than a corner cut off, and the numbers say
   * why: it spends 130pt of a 349pt top edge and only 52 of a 218pt side,
   * which is 37% of the width against 24% of the height. Two and a half
   * times as much horizontal as vertical.
   *
   * The chord cannot shrink — it is holding a sentence — so the only
   * freedom is the angle, and the question is which angle is *balanced*
   * on a frame that is not square. 45° balances the two crossings in
   * points and therefore unbalances them against the edges: on a 16:10
   * photograph it spends 28% of the width and 45% of the height, tipped
   * as far the other way as 22° was this way, and it slants the type
   * enough to slow reading a twenty-character line.
   *
   * Equal *shares of each edge* is the balance a rectangle actually has,
   * and for 16:10 that is atan(10/16) ≈ 32°:
   *
   *              across   down    of the width / of the height
   *     22°       130pt    52pt        37%  /  24%
   *     32°       119pt    74pt        34%  /  34%      ← here
   *     45°        99pt    99pt        28%  /  45%
   *
   * So the sash sits on the diagonal of its own corner rather than along
   * one edge of it, and the angle stays whatever the words do.
   *
   * ── the chord, cut to the words ──
   *
   * The chord is set by the line it has to hold, and the line got short.
   * "Closed · opens 08:00" was twenty characters; 95pt across twenty is
   * 4.75 per character, which is Lora italic at **10pt**, not the 12 a
   * first pass guessed from the band's depth — and the difference is the
   * whole character of the thing. At 12 the sentence fills the chord end
   * to end and the sash reads as a banner; at 10 it keeps 22pt of red at
   * each end and reads as a stamp, which is what the reference drew.
   *
   * "Opens 08:00" is eleven, the longest of the three languages
   * (`sashLabel` pins that), so 52pt of type. The same 20pt of red at
   * each end gives a chord of 92, against 140 before:
   *
   *              across   down    of the width / of the height
   *     140pt     119pt    74pt        34%  /  34%
   *      92pt      78pt    49pt        22%  /  22%      ← here
   *
   * Still equal shares of each edge — the chord shrank along the same
   * 32° line — and the band covers 1.8% of the photograph where it
   * covered 2.8%. It also clears the rating pill by a wider margin than
   * before on a short card, which was the one place the old chord came
   * close to something.
   *
   * The rest is arithmetic. The centre line must pass through the chord's
   * midpoint (78/2, 49/2); a strip 180 wide leaves 44pt hanging past each
   * crossing for the card's radius to cut; rotation is about the centre,
   * so `left` and `top` place that centre and nothing else:
   *
   *   left = 78/2 − 180/2 = −51      top = 49/2 − 20/2 = 14.5
   *
   * `height` is fixed rather than grown from the text because `top` is
   * derived from it, and a font metric that moved would slide the sash
   * off its corner.
   *
   * Points, not percentages, like the bookmark at `top: 10, right: 10`:
   * a corner mark is the same size on every phone, and only the
   * photograph under it gets wider.
   */
  shutSash: {
    position: 'absolute', left: -51, top: 14.5, width: 180, height: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: onPhoto.shut,
    transform: [{ rotate: '-32deg' }],
  },
  // Lora italic, which the app already loads for the Ideas lede and the
  // Profile footer. Borrowed rather than added: a serif at a slant reads
  // as something stamped on the picture, where the card's own sans would
  // have read as one more piece of UI furniture — and the alternative was
  // shipping a face for one line of text.
  shutSashText: {
    color: onPhoto.text, fontSize: 10, lineHeight: 13,
    fontFamily: quoteFace, letterSpacing: 0.3,
  },
  // Top-left, the photograph's one free corner, in the rating pill's
  // exact material — the card's rule is that marks on one picture are
  // made of one thing.
  // The rating pill's exact ground, one hairline and all: two marks on
  // one photograph should be made of one material. The circle is not
  // decoration — it separates this tap from the card's own (press the
  // disc and you save, press anywhere else and the place opens) and it
  // holds the 40pt target that makes that separation reachable.
  //
  // ── 36, not 40 (owner, 4 Nov 2026) ──
  // A reference asked for the disc a step quieter: smaller, and its ground
  // down to 25–30% black. Smaller it is — 36 and a 17pt glyph (18 since
  // the scale, `ICON`), the same proportion as 40 and 19, and the 8pt slop keeps the target at 52. The
  // ground stays: over a white wall, which the second card in the
  // reference is all but, 58% black under a white glyph is 4.9:1, and
  // 25–30% is 1.8–2.0 — under the 3:1 a glyph needs, which 43% is the
  // least that reaches. The rating pill shares this ground and its words
  // need 56%. The disc is `photoDisc` now, shared with the list ⊕ and the
  // photo viewers' controls. The place screen's three stay 44: they tried
  // this size the same day and the owner found them too small to hit.
  saveFab: photoDisc,
  name: { color: colors.text, ...type.cardTitle },
  // District and hour on the left, the kind pill on the right, on one line.
  // The text cluster takes the slack and the pill keeps its size — see the
  // note beside the markup for which half is allowed to give way.
  //
  // 8pt above it, the same the status row takes, and it used to be 3. The
  // 3 was argued for: this line was the second half of the name's
  // sentence, so it sat tight under it while separate statements got 8.
  // That stopped being true when the vibe pill moved onto this line. A row
  // with a pill anchored to its right edge is not the tail of the sentence
  // above it — it is a row, and it reads as one whether or not the spacing
  // admits it.
  //
  // The number is not free-drawn. Neither text here sets `lineHeight`, so
  // each carries its own half-leading and 3pt of margin renders as about
  // 10.6pt of white between the letters; the reference card has about
  // 16.9. Two ways of measuring the difference — ink to ink, and baseline
  // to baseline — both land between 7 and 8, and 8 is the one this file
  // already owns.
  //
  // ── the kind beside the district, not at the far edge (owner, 6 Nov
  // 2026) ──
  //
  // With the frame gone the kind sat alone at the right margin, a word
  // floating a card's width from the line it belongs to. It follows the
  // district now, 14pt after it — wider than the 4 between the pin and
  // the district, so "Hồng Hà" and "● Cà phê" read as two facts and not
  // one name. The district still takes the ellipsis and the kind is
  // still drawn whole: the cluster only stopped stretching (`flexShrink`,
  // not `flex: 1`), so a long district gives way exactly as before.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  whereRow: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The same tertiary weight the plan and trip screens give a district, so
  // the fact wears one face across the app.
  // The district shrinks and takes the ellipsis; nothing else on the
  // line does — see "words give way, figures never" at the meta row.
  where: { flexShrink: 1, color: colors.textTertiary, ...type.meta },
  // The figures' Text: the same face as the district, in a box that
  // never gives up a point of width.
  figures: { flexShrink: 0, color: colors.textTertiary, ...type.meta },
  // The hour, for the forty-five minutes it is urgent — see CLOSING_SOON_MIN.
  // Weight as well as colour: amber alone is a hue difference, and the
  // readers most likely to be planning an evening around a closing time
  // are not all seeing the hue.
  soon: { color: colors.soon, fontWeight: font.semibold },
  // The distance, in the district's grey and the hour's weight — the meta
  // row's note says why it is weight and not a second colour.
  far: { fontWeight: font.semibold },
  // The rating supplies its own ground, like the bookmark: a photograph
  // can be any brightness, and a score has to be legible over all of them.
  ratingSlot: {
    position: 'absolute', left: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5,
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  // Three weights: the gold mark, the number, the count in parentheses.
  star: { color: onPhoto.star, fontSize: 13 },
  ratingValue: { color: onPhoto.text, fontSize: 15, fontWeight: font.semibold },
  ratingCount: { color: onPhoto.textSecondary, fontSize: 13, fontWeight: font.regular },
  status: { marginTop: 8 },

  // The pill itself is `KindPill`, shared with the place page and a
  // list's card, so the three say a category one way.
});
