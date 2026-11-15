// PlaceDetailScreen's stylesheet, and the measures it shares with the screen and
// its parts: as they were in one file.

import { StyleSheet } from 'react-native';
import { PAGE_COUNT_H } from '../../components/PageCount';
import { colors, display, font, radius, space, type } from '../../theme';

/** The check-in sheet's history: five rows in view, the rest scroll.
 *  Five is a week of ordinary visits at a glance; 48 is the row the
 *  Trips list uses for a one-line item, and five of them are 240 of a
 *  sheet that must still leave the pill's row visible behind it. */
export const HISTORY_ROWS = 5;

const HISTORY_ROW = 48;

/**
 * How far the bookmark's box hangs past the right margin, so its ink ends
 * on the margin as back's starts on the left one (`BACK_HANG`). From the icon
 * font rasterised at the glyph's 20pt (12 Nov 2026): `bookmark` and
 * `bookmark-outline` both leave 3.75pt of their 20pt advance clear on
 * each side, so centred in a 44pt box the ink stops 15.75 short of it.
 */
const SAVE_HANG = 16;

/** The left column the glyphs sit in, and the inset every hairline and
 *  every continuation under a row lines up against. Glyph 19, air 14. */
const GUTTER = 33;

/** Where a glyph sits down its row: level with the first line of the
 *  value, not with the label above it and not in the gap between them.
 *
 *  This is a decision about the address row, because that is the only row
 *  whose value wraps — Hours and the open-now line are short, and Website
 *  is held to one line. And it wraps almost always: of the 648 places
 *  carrying an address, 13 fit on one line. Thirteen. The rest run to two
 *  lines and thirty-five run to three, so the address row is a label over
 *  two lines of street, and the shape to design for is that one rather
 *  than the short address that happens to be on the screenshot.
 *
 *  Centred on the pair — label plus first line — the glyph lands on the
 *  top edge of the street and reads as pushed up. Centred on the whole
 *  row it drifts with the length of the address. Centred on the first
 *  line of the value it is level with the words it is a marker for, and
 *  it stays there whether the address runs to one line or four.
 *
 *  All three line heights are stated rather than left to the platform: a
 *  glyph's position derived from "what iOS thinks a 12pt line is" is a
 *  position nobody can check, and it moves the day that changes. 15 is a
 *  rounding of the 14.3 the system face gives at 12pt, so the rows keep
 *  the height they have. */
const LABEL_LINE = 15;

const LABEL_GAP = 5;

const VALUE_LINE = 24;

/** Everything above the first line of the value. */
const ABOVE_VALUE = LABEL_LINE + LABEL_GAP;

/**
 * Where a glyph sits, and how much room it is given to sit in.
 *
 * Two numbers, because the last version conflated them and clipped every
 * icon on the card. It gave the glyph a box of `LABEL_LINE` — fifteen
 * points — and a comment claiming that a 19pt glyph would simply overflow
 * it, top and bottom, because "the box is a position, not a frame".
 *
 * It is a frame. A `Text` constrained to a height shorter than its own
 * line lays out inside that height and the glyph is cut at the bottom
 * edge, which is exactly what shipped: the pin and the handset with their
 * feet sliced off. The claim was one I could not check from here and
 * should not have written as a fact.
 *
 * So the box is bigger than any 19pt line can be, and the *position* is
 * carried by a negative margin instead: centred, the box's middle lands
 * on `LABEL_LINE / 2`, which is the middle of the label's line. The glyph
 * is level with the word it names, and it has room to be drawn whole.
 *
 * Its footprint is 20.5pt against the words column's 44 or more, so
 * nothing here sets a row's height either way.
 */
const GLYPH_BOX = 26;

const GLYPH_LIFT = (LABEL_LINE - GLYPH_BOX) / 2;

/** How much of a long address the card shows before it asks. Two, because
 *  two is where the map still fits above the fold on the shortest phone
 *  this app supports; the rest is a tap away. */
export const ADDRESS_LINES = 2;

/** The facts row's height — the category chips and Check in beside them.
 *  44, the height the same chips have on Search and Places. */
const FACT_HEIGHT = 44;

/** How far in from the photograph card's edge the page count and the
 *  credit sit. The page margin it used was for a picture running to the
 *  screen's edge; inside a card, 12 is the inset the card's own corners
 *  (`radius.card`) leave room for. */
export const MARK_INSET = 12;

/**
 * How far a long name may shrink before it is cut: to 0.8 of the bar's
 * 20, which is 16 — the size of the text in the cards below. Smaller and
 * the place's own name would read as the smallest words on its page. At
 * 20 the bar holds about 30 characters on a 440pt phone, and at 16 about
 * 37; 90% of the catalog's names are 35 or shorter, before `splitName`
 * takes the branch off.
 */
export const BAR_NAME_MIN_SCALE = 0.8;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // The bar: back, the name, the bookmark, on the page's own paper. 6 over
  // the row, as `Screen`'s inline header has it; 12 under, the gap the
  // mock-up leaves between the bar and the photograph.
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.page, paddingBottom: 12,
  },
  // `type.titleCompact`, the one size of a page reached from another
  // (owner, 12 Nov 2026). It shipped at 19,
  // the size at which the mock-up's own name set at its width there; at
  // 20 "Lazyly Coffee & Quiet Eatery" is 272pt of the bar's 326.
  barName: { flex: 1, textAlign: 'center', color: colors.text, ...type.titleCompact },
  barControl: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveHang: { marginRight: -SAVE_HANG },

  // A card under the bar, inside the page's margins, rounded all round at
  // `radius.card` — the photograph as the mock-up drew it.
  heroWrap: {
    marginHorizontal: space.page, borderRadius: radius.card,
    overflow: 'hidden', backgroundColor: colors.surfaceGlass,
  },
  // Height comes from the call site — it is the safe-area inset plus the
  // frame, and only the screen knows the inset.
  hero: { backgroundColor: colors.surfaceGlass },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroScrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 116 },
  // Required attribution, kept quiet — see the note in PlaceCard.
  //
  // Above the page count, right-aligned to it: the line its old seat's note
  // named as "free and twice as wide". It sat centred on the bottom edge,
  // the seat the page marks left, until the kinds took the left corner — three
  // glyphs there are about 125pt, and a centred credit at 30% of a 320pt
  // window starts 112pt in, so the two would have touched on the smallest
  // phone and on a 390pt one too. The count is `PAGE_COUNT_H` tall at
  // bottom 15; this sits 6pt over it. The flag that draws it is off
  // today, by the owner's decision; the seat is kept so switching it on
  // moves nothing.
  attr: {
    position: 'absolute', right: MARK_INSET, bottom: 15 + PAGE_COUNT_H + 6, maxWidth: '50%', textAlign: 'right',
    fontSize: 9, color: '#fff', opacity: 0.55,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },

  // 4, so the score's line (8 down) starts 12 under the photograph, the
  // gap the mock-up leaves there.
  body: { paddingHorizontal: space.page, paddingTop: 4 },
  // Body face, not display: the qualifier is a fact about the title, not
  // a second title, and the change of face is what says so. 8 down, 12
  // under the photograph, as the score's line would be without it.
  // Centred, each line of it, under the centred name in the bar.
  subtitle: { color: colors.textSecondary, ...type.body, marginTop: 8, textAlign: 'center' },
  // Under the pick mark the two are one head, not two lines: 4 between
  // them, where the mark's 6 below and this line's 8 above would leave
  // 14 — wider than either keeps from the photograph (8), which reads as
  // two separate things. The 4 is reasoned, not measured on a phone.
  subtitleUnderPick: { marginTop: -2 },

  // ── the rating, as a line rather than a badge ──
  //
  // `center`, not a baseline: the star is the tallest thing here and the
  // eye reads it against the number, not against the number's feet.
  //
  // 8 above, against the subtitle's 4. The subtitle is part of the name
  // and sits close enough to be read with it; the score is a different
  // fact and takes the wider gap that says so.
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The rating's line, with check-in pinned to its right. Centred on the
  // pill: the line is one 24pt row of text beside a 44pt control, and a
  // top-aligned score sat 10pt high of the pill's word.
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, minHeight: 24 },
  kindRow: { marginTop: 14 },
  metaFacts: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The score keeps the size and weight it wore inside the badge. It was
  // never the type that made the badge expensive.
  ratingValue: { color: colors.text, fontSize: 18, fontWeight: font.bold },
  // The count was 12 in the badge, where it had a box to belong to and
  // two lines of its own. On an open line that reads as fine print, so it
  // comes up to `type.meta` — the size every other secondary fact on this
  // screen already uses.
  ratingDot: { color: colors.textTertiary, fontSize: 15, fontWeight: font.regular },
  ratingCount: { color: colors.textSecondary, ...type.meta },

  // Its own column, so a score and a price that wrap do not push it.
  checkinSlot: { flexShrink: 0, marginLeft: 12 },
  // The category chip's box — padding, radius, gap — with the fill taken
  // out and the hairline recoloured, from the days it sat at the end of
  // that row; the chips are gone and the box is still this app's pill.
  checkin: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6, minHeight: FACT_HEIGHT,
  },
  // Worn: the one fill this row is allowed, because it is a state. The
  // hairline stays, transparent, so the pill keeps its exact size. It
  // took the fill's colour first, `okSoft`, and on a phone in Dark under
  // the app's Light that border resolved to the charcoal side and drew a
  // near-black ring round a pale green pill — see `bgHex` in theme.ts.
  //
  // Green, not the coral it wore first. Solid coral said "done" loudly,
  // but it is also the colour of every button on this screen that asks
  // for something, and the owner's reference drew a visit as the quiet
  // green the app already uses for good news (`okSoft`, the public-list
  // banner's ground). Coral now means "do this", green "you did".
  // `okInk` on it: 5.1:1 on paper, 7.2:1 on charcoal.
  checkinOn: { backgroundColor: colors.okSoft, borderColor: 'transparent' },
  checkinOnText: { color: colors.okInk },
  // The two words stacked; see "one width in both states" at the pill.
  checkinWords: { alignItems: 'center' },
  // The word not being shown: it keeps its width and gives up its height,
  // so it sizes the column and draws nothing.
  checkinGhost: { height: 0, opacity: 0, overflow: 'hidden' },
  checkinHead: { gap: 12 },
  checkinHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  checkinHeadTitle: { flex: 1, color: colors.text, fontSize: 18, fontFamily: display.semibold },
  checkinCount: { marginRight: space.cardPadding },
  // The sheet's own card surface, as its rows below wear it. Capped at
  // HISTORY_ROWS rows of HISTORY_ROW each; more scrolls inside.
  history: {
    maxHeight: HISTORY_ROWS * HISTORY_ROW,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.cardPadding, height: HISTORY_ROW,
  },
  historyDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  historyText: { flex: 1, color: colors.text, fontSize: 15 },
  // The filter row's chip, at rest: same hairline, same radius, same
  // type, so a category looks like the same thing here as there. Glass
  // fill rather than the filter's bare outline, because these are facts
  // to read, not controls to press, and the fill is what says so.

  desc: { color: colors.textSecondary, ...type.body, lineHeight: 24 },
  // The mark sits in its own disc so the label and the text share one
  // left edge: a glyph inline with the heading would put the paragraph
  // under the heading and the heading beside the glyph, which is two
  // columns pretending to be one.
  // A column since the heading took a line of its own (see the block):
  // the head row, then the paragraph at the screen's full width.
  // The card's inner spacing is the info card's (`space.cardPadding`),
  // so the paragraph's left edge is the address's. 10 between the
  // paragraph block and the chips, the gap the chips used to carry as a
  // margin, now the card's so it holds whichever of the two is first.
  whyCard: { marginTop: 14, padding: space.cardPadding, gap: 10 },
  why: { gap: 6 },
  // Baseline-aligned, not centred: the mark is a glyph beside a word and
  // sits on the word's line, its ink at cap height the way an opening
  // quote does. Centred in a 28pt box (the disc's, kept a day after the
  // disc went) it floated like a superscript, and the box's slack plus a
  // 10pt gap put ~15pt between mark and word on the owner's phone. 6pt
  // now, mark to word, with no box.
  whyHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  whyQuote: {
    color: colors.accent, fontSize: 22, lineHeight: 22, fontFamily: display.bold,
    includeFontPadding: false,
  },
  whyBody: { gap: 2 },
  // 16, the Local Guide panel's title, now that this is a heading row of
  // its own rather than a label tucked over the paragraph.
  whyLabel: { flex: 1, color: colors.accent, fontSize: 16, fontWeight: font.semibold },
  // An eyebrow: 6 above the name, which is the gap a kicker keeps from
  // its headline at this size. Spaced caps at 12 — the label's own size
  // from the heading row — so it reads as a mark, not a second title.
  pick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8, marginBottom: 6 },
  pickText: { color: colors.accent, fontSize: 12, fontWeight: font.semibold, letterSpacing: 0.8, textTransform: 'uppercase' },

  // The credit's line: 4 more than the body's 2-pt gap, so 6 between the
  // paragraph's last line and it — close enough to read as the quote's
  // signature, apart enough not to read as a seventh line of it.
  // `flex-start` keeps the press to the credit's own width: a tap on the
  // empty card beside a handle should not leave the app.
  creditRow: { alignSelf: 'flex-start', marginTop: 4 },
  // One step under the paragraph's size, quieter than the sentence it
  // attributes. The link colour is the only thing that marks the source
  // as reachable — an underline in this face is a scar.
  credit: { color: colors.textTertiary, fontSize: 15 },
  // Two steps down from the paragraph, where the credit is one: the
  // credit is part of the quote and this is a note about it.
  descFallback: { color: colors.textTertiary, fontSize: 12 },
  creditLink: { color: colors.accent },

  // The Card supplies ground, border and radius; the horizontal inset
  // lives here so each row's hairline can run to the card's edge.
  infoGroup: { marginTop: 18, paddingHorizontal: space.cardPadding },
  // The map is the third thing in the address's column, under the label
  // and the street:
  //
  //     [icon] ADDRESS
  //            27/16 Ng. 18 Huỳnh Thúc Kháng
  //            [map]
  //
  // So it starts at `GUTTER`, where the words start and where every
  // hairline starts, and ends at the card's own padding. Full-bleed was
  // tried — it is what the reference does — and it broke that column:
  // the picture reached left past every other thing in the card and the
  // grid stopped being a grid. `overflow: hidden` because MiniMap draws
  // to its own corners.
  mapSlot: {
    marginLeft: GUTTER, marginBottom: 16,
    borderRadius: radius.card - 8, overflow: 'hidden',
  },
  // On the Pressable itself — PressableScale's `style`, not its
  // `contentStyle`, which is the animated view inside.
  //
  // The in-row position, which is now the fallback — a card with no map to
  // stand the button on. `marginLeft` is the gap the row never had: the
  // address is `flex: 1` and this is `flexShrink: 0`, so with nothing
  // between them the words ran to the pill's edge.
  goSlot: { flexShrink: 0, marginLeft: 12, marginTop: ABOVE_VALUE - 6 },
  // On the map, clear of Google's attribution in the opposite corner.
  goOnMap: { position: 'absolute', right: 10, bottom: 10 },
  // The square beside the address: 36, and 4pt of slop on each side to
  // make the 44 this app gives every control — the pill it replaces was
  // 44 tall with no slop, and 44 of tint beside a one-line address is
  // taller than the words it serves. `radius.input`, the one corner
  // between a pill's and a card's, for a square that is neither.
  go: {
    width: 36, height: 36, borderRadius: radius.input,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  // A disc over the tiles, 40 rather than `MiniMap`'s locate button's 36
  // because this is the only control on the map and the one the card
  // exists for; `hitSlop` takes the target past 44 without taking more of
  // the picture.
  //
  // Not quite opaque. The note this replaces said a glass disc could not
  // work because a Google tile is not a surface this app chooses — pale
  // beige, white roads and green parks in a different mix at every
  // address — and that is true of `surfaceGlass`, which is a wash with no
  // ground of its own. It is not true of `bgElevatedVeil`, which keeps its
  // own colour and only thins it, so the disc stops reading as a sticker
  // on a photograph without giving up the ground the glyph stands on.
  //
  // See that token for where 0.88 comes from, and for the mistake on the
  // way: this preview is always a *light* tile, `MiniMap` passing no night
  // style, so the case that decides the number is the dark theme's disc
  // over pale roads rather than anything the light theme does.
  goDisc: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevatedVeil,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  goText: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  // 17pt over a label and a 24pt line keeps every row a ≥58pt target.
  // A row is a column — label, then value. Only Hours lays itself across,
  // for the chevron at its end.
  //
  // Still `flex-start`, and the glyphs are placed by their own boxes
  // rather than by this. `center` here would centre them on the whole
  // row, and the address row's height is the length of the address: the
  // pin would sit level with the street on a short one and slide down
  // between the lines on a long one, which is a glyph whose position is
  // a property of the data.
  infoStack: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 17 },
  // The whole gutter, not the glyph: 19 of it is the glyph and the
  // remaining 14 is the air before the words. Written `GUTTER - 14` it was
  // 19 — exactly the glyph — so there was no air at all and every label
  // sat against its icon at whatever the glyph's own side bearing happened
  // to be. Measured on the phone: 4.0pt after the pin, 2.7 after the
  // clock, 2.4 after the handset. Three different gaps because three
  // different glyphs, which is what made the column look ragged.
  //
  // At `GUTTER` the words begin exactly where the hairline and the hours
  // table already began, and the three are one column.
  //
  // A box of a stated height rather than a glyph with a nudge on it, and
  // the box is the label and the first line of the value together.
  //
  // The glyph belongs to the pair, not to either line of it. Level with
  // the label it marks a word and leaves the street unmarked; level with
  // the street it leaves ADDRESS alone above an empty gutter. Centred
  // across both it holds the two as one row, which is what a row is.
  //
  // It took four tries to land here, and the first three are worth
  // keeping because each was wrong in its own way. `marginTop: 1` under
  // `alignItems: 'flex-start'` was no position at all — it pinned the
  // glyph to the top and let the icon font's line box decide the rest,
  // and had no answer for a second line of address. Then the first line
  // of the value. Then the label's line.
  //
  infoIconSlot: {
    width: GUTTER, height: GLYPH_BOX, marginTop: GLYPH_LIFT,
    justifyContent: 'center', overflow: 'visible',
  },
  infoWords: { flex: 1, minWidth: 0 },
  // See `hug` on InfoRow: content width, shrinking before the control.
  infoWordsHug: { flex: 0, flexShrink: 1 },
  // The same box at the other end of the row, so both ends stay level.
  infoChevronSlot: {
    height: GLYPH_BOX, marginTop: GLYPH_LIFT,
    justifyContent: 'center', overflow: 'visible',
  },
  // Starts where the labels start. Run to the card's edge it cut the
  // gutter into four pieces; inset, the glyphs read as one column.
  //
  // Its own element rather than a border on the box that holds the row,
  // and that is the whole of a bug this card carried: `marginLeft` on a
  // wrapper moves everything inside it, so every row after the first was
  // pushed 33pt right — icon, label and value together — while the first
  // row sat at the card's padding. Measured on the phone: the address pin
  // at 18pt from the card edge, the clock and the handset at 46. A line
  // has nothing inside it to drag along.
  rowDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginLeft: GUTTER,
  },
  infoLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 1.2,
    lineHeight: LABEL_LINE, marginBottom: LABEL_GAP,
  },
  infoValue: { color: colors.ink, ...type.meta, lineHeight: VALUE_LINE },
  /** The value of a row that goes somewhere. Ink like the rest — the
   *  accent came off after a day on the phone, where a two-line address
   *  in red outweighed the title — and a touch of weight is what is
   *  left to say the row is a link. */
  infoLink: { fontWeight: font.medium },
  // Semibold and a size up on the table under it: this is the answer, and
  // it is the working it was derived from.
  // The same 24 the other values keep: it is the second line of its pair,
  // and the glyph beside it is centred on a box that assumes so.
  openNow: {
    color: colors.open, fontSize: 16, fontWeight: font.semibold,
    lineHeight: VALUE_LINE,
  },
  // The sash's own brick, not the grey it was. See `colors.shutInk`: the
  // grey was the label's colour and 3.41:1 on the dark card, so the one
  // fact a reader opens this screen at night to find was both quiet and
  // under AA.
  openNowShut: { color: colors.shutInk },
  hoursTable: { paddingBottom: 16, paddingLeft: GUTTER },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  hourDay: { color: colors.ink, fontSize: 15, fontWeight: font.medium },
  hourTime: { color: colors.ink, fontSize: 15, fontWeight: font.regular },
});
