// SketchingScreen's stylesheet, and the measures it shares with the screen and
// its parts: as they were in one file.

import { StyleSheet } from 'react-native';
import { colors, font, radius, space } from '../../theme';

export const s = StyleSheet.create({
  body: { alignItems: 'center', paddingHorizontal: space.page, paddingTop: 10, gap: 14 },

  title: { color: colors.text, fontSize: 27, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', marginTop: 6 },

  // ── the rhythm between the tiers ──
  //
  // 20pt between each of the three cards, as the eye measures it: the
  // body's 14 of `gap`, and each card taking its own difference on top.
  //
  // The deck is not a fourth card, and 28 under it says so. The cards
  // below are what the reader chose and what the planner is doing; the
  // deck is pictures that change on their own while that happens. At an
  // even 20 — the first answer, measured at 21 on the owner's phone — it
  // read as the top of the stack, and the owner asked for more.
  //
  // 17, not 14, because the deck's box is not where it ends. Three cards
  // lean ±3°, which drops a 108pt card's low corner 2.8pt below its box
  // (54 × sin 3°); two lean ±1.5°, 1.4pt. So 28 for three cards and 29.6
  // for two, and the shadow reaching further still. Before any of this
  // the gap was the body's 14 alone and read as 11: the tightest on the
  // screen, between the two things on it least alike.
  //
  // The cost is 8pt of height, and the step list and the findings box
  // below it move down by that much.
  deckRoom: { alignSelf: 'stretch', marginBottom: 17 },

  // ── the facts card ──
  //
  // The same white-on-paper card as the step list and the findings box
  // below it, so the screen reads as three tiers of one material rather
  // than a card, some loose grey type, and another card.
  facts: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  // `gap` on top of the 8pt `Chip` already carries, which is what every
  // other chip row in the app spends — matched here rather than tightened,
  // because a row that is denser inside this card than outside it reads as
  // a different kind of chip.
  //
  // ── and why the right padding is 6 rather than 14 ──
  //
  // `Chip` carries `marginRight: 8` of its own, which the last chip on a
  // line spends into empty space. Centring measures *that* line, trailing
  // margin and all, so the chips a reader can see land 4pt left of centre
  // — the amount the old loose row outside this card has always been off
  // by, unnoticed because nothing sat under it to be off against.
  //
  // Widening the box by exactly that 8 puts the visible run back on the
  // middle, and the last chip still ends 14 from the card's edge: 6 of
  // padding plus the 8 it brought.
  factChips: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, paddingRight: 6,
  },
  factRule: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginHorizontal: 14,
  },
  factRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  // `flexBasis: 0` with `minWidth: 0`, so the two cells split the row
  // evenly and a long name truncates inside its own half instead of
  // pushing the divider across.
  factCell: {
    flexGrow: 1, flexBasis: 0, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', gap: 11,
  },
  factDisc: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surfaceGlass, alignItems: 'center', justifyContent: 'center',
  },
  factText: { flexShrink: 1, minWidth: 0 },
  factPrimary: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  factSecondary: { color: colors.textTertiary, fontSize: 13, marginTop: 1 },
  factDivide: {
    width: StyleSheet.hairlineWidth, height: 36,
    backgroundColor: colors.borderGlassSoft, marginHorizontal: 12,
  },

  card: {
    alignSelf: 'stretch', marginTop: 6,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    // 16, where it was 6. The rows used to carry 11 of their own on top
    // of it; that had to go so the rail could reach between them, and
    // the card takes it back at the two ends where there is no next mark
    // to reach.
    paddingVertical: 16,
  },
  // No tint under the running row. `accentSoft` on a full-width row
  // already means "you chose this" — see `CandidateRow.rowOn`, where a
  // ticked search result wears exactly this colour and shape. Borrowing it
  // for "this one is working" is borrowing a word that is taken, and the
  // block was heavy enough to outweigh the orb it was meant to sit under.
  //
  // The signal lives in the mark instead. See `StepMark`.
  // No vertical padding, and the mark at the top rather than the middle:
  // both are what lets `markCol` stretch the full row so its rail can
  // span to the next mark. The rhythm the padding used to give is on
  // `stepTextGap` instead. Top-aligned is also the right answer for a
  // label that runs to two lines — the node marks where the step starts,
  // not the middle of its sentence.
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingHorizontal: 16 },
  markCol: { width: 24, alignSelf: 'stretch', alignItems: 'center' },
  // Reaches whatever is left of the row under the mark. The margins keep
  // it off both circles rather than growing out of them.
  rail: { flex: 1, width: 2, marginVertical: 3, backgroundColor: colors.accentLine },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  // The faint full circle the arc rides on.
  markTrack: { borderRadius: 12, borderWidth: 2, borderColor: colors.accentLine },
  // One quadrant of colour. Every other side transparent, so what shows is
  // an arc on the track rather than a ring with a bite out of it.
  markArc: {
    borderRadius: 12, borderWidth: 2,
    borderColor: 'transparent', borderTopColor: colors.accent,
  },
  markStill: { borderWidth: 2, borderColor: colors.accent },
  markPending: { borderWidth: 1.5, borderColor: colors.borderGlass, borderStyle: 'dashed' },
  // The label and its rule. The column carries the row's height, which
  // is what the stretched mark column — and therefore the rail — spans.
  stepBody: { flex: 1 },
  // 2 of lead, because the 24pt mark beside a 21pt line box sits a
  // pixel and a half proud of it.
  stepText: { color: colors.textSecondary, fontSize: 15, paddingTop: 2 },
  // 11 above and below, which is the rhythm the rows used to carry as
  // padding. The last step has no rule, so the card's own padding ends
  // the list.
  rule: {
    height: StyleSheet.hairlineWidth, marginVertical: 11,
    backgroundColor: colors.borderGlassSoft,
  },
  stepTextOn: { color: colors.text, fontWeight: font.semibold },
  stepTextOff: { color: colors.textTertiary },

  // A fixed height, because the box now holds sentences of different
  // lengths and a box that resizes under the step list makes the list
  // jump every time a fact lands. Two lines' worth, centred — the
  // skeleton's three bars fit the same room.
  // 6 of margin, the step card's own figure, for the 20 the other tiers
  // keep. It was 2, which left this box 4pt nearer the list than the list
  // is to the card above it — a difference too small to read as a
  // decision, so it read as a slip.
  preview: {
    alignSelf: 'stretch', gap: 10, padding: 16, marginTop: 6,
    minHeight: 96, justifyContent: 'center',
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  finding: { alignSelf: 'stretch', gap: 10 },
  // Left, not centred. Two sentences of different lengths centred put
  // their glyphs at two different x's, and a mark that moves between
  // rows is the thing that read as unbalanced: against an edge they
  // stack into a column and the eye reads down it.
  findingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // A disc, so a 15pt glyph lands on a surface of its own instead of
  // floating loose beside a sentence at the same weight.
  //
  // Not the accent, and not a coral tint under it. Coral on this screen
  // means progress — the ring's arc, a step done, the step running — and
  // a glyph that only says which *kind* of fact this is would be
  // spending that meaning on a label. The disc is the same quiet wash
  // every other well in the app uses.
  findingBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
  },
  // The settled line: the same size as the current one, in the footnote
  // colour, with the animated 0.6 opacity above doing the receding.
  //
  // It was 13 against the current line's 15. Two sizes two rows apart
  // read as two kinds of thing, and these are the same kind of thing at
  // two moments — so the size holds and only the ink moves.
  findingPrevText: {
    color: colors.textTertiary, fontSize: 15, lineHeight: 21,
    flexShrink: 1,
  },
  // A size up from `note` and in the reading colour, because this is
  // content rather than a footnote about the screen — it is the first
  // piece of the answer the reader gets.
  findingText: {
    color: colors.textSecondary, fontSize: 15, lineHeight: 21,
    flexShrink: 1,
  },
  note: { color: colors.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 2 },
});
