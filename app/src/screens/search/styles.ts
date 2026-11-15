// SearchScreen's stylesheet, and the measures it shares with the screen and
// its parts: as they were in one file.

import { StyleSheet } from 'react-native';
import { CHIP_H } from '../../components/ui';
import { colors, font, onPhoto, radius, space, type } from '../../theme';

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.page, paddingTop: 8, paddingBottom: 14,
  },
  // The cities' row, under the box. `UnderlineChoice` brings the page's
  // margins; this is the air between it and the list. It used to be a
  // horizontal ScrollView of its own, the list's sibling in the screen's
  // column, and grew by default (React Native's `baseHorizontal` is
  // flexGrow 1): with a short list the two split the empty height, and
  // "boat" set its one card a third of the screen below the chips. The
  // row's ScrollView now sits inside this View, which does not grow.
  citiesRow: { flexGrow: 0, paddingBottom: 12 },
  // Under the box, on the page's margin, before the chips. The pill is
  // `Chip`'s glass and padding (its chipOn), sized to its words
  // and stopped at the margin, where a long name ends in "…".
  addingToRow: { paddingHorizontal: space.page, paddingBottom: 12, flexDirection: 'row' },
  addingTo: {
    flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addingToText: { flexShrink: 1, color: colors.textSecondary, fontSize: 15 },
  addingToTitle: { color: colors.text, fontWeight: font.semibold },
  addingToCount: { flexShrink: 0, color: colors.textSecondary, fontSize: 15, marginLeft: -3 },

  section: {
    color: colors.text, ...type.section,
    paddingHorizontal: space.page, marginTop: 10, marginBottom: space.headingToContent,
  },

  // ── the zero-state ──
  // Small caps rather than the 22pt section face: these are shelf labels
  // over a resting screen, not headings over results the reader asked
  // for, and three of them at full section weight would shout over a
  // page that is meant to feel idle.
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.page, marginTop: 18, marginBottom: 10,
  },
  eyebrow: {
    color: colors.textTertiary, fontSize: 13, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  clear: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.page,
  },
  // The words' button takes the row's height, so the tap target is the
  // same band it was when the whole row was one button.
  recentHit: { flex: 1 },
  recentMain: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  recentTerm: { flex: 1, color: colors.text, fontSize: 16 },
  // 8 at the sides, not the page's 20: the cells have no ground, so what
  // lines up with the page is the first word, centred in its cell — and
  // the 24pt it gives back is what keeps "Thiên nhiên" on one line.
  browseGrid: { paddingHorizontal: 8, marginBottom: 4 },
  row: { marginHorizontal: space.page, marginBottom: space.cardGap },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.cardPadding,
    padding: space.cardPadding,
  },
  thumbBadge: { top: 4, left: 4 },
  thumb: {
    width: 64, height: 64, borderRadius: radius.image,
    backgroundColor: colors.surfaceGlass,
  },
  cardTitle: { color: colors.text, ...type.cardTitle },
  noneBox: { alignItems: 'center', paddingTop: 34, paddingHorizontal: space.page },
  noneMark: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
  },
  // Sat on the rim rather than inside, so the magnifier stays a magnifier
  // and the badge reads as a note about it.
  noneBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  noneBadgeText: { color: colors.accent, fontSize: 15, fontWeight: font.semibold, lineHeight: 18 },
  noneTitle: {
    color: colors.text, fontSize: 19, fontWeight: font.semibold,
    textAlign: 'center', marginTop: 18,
  },
  noneHint: {
    color: colors.textTertiary, fontSize: 15, lineHeight: 21,
    textAlign: 'center', marginTop: 8, marginBottom: 4,
  },

  nothing: {
    color: colors.textSecondary, ...type.meta, lineHeight: 22,
    paddingHorizontal: space.page, paddingTop: 18, paddingBottom: 6, textAlign: 'center',
  },
  cardMeta: { color: colors.textTertiary, ...type.meta },
  // The same 4pt the pin keeps from the district on PlaceCard.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The right edge: a gold mark, the number, and its count a size down
  // in the secondary colour, as PlaceCard sets them. Same gold the photo
  // overlay uses, so a star means one thing everywhere.
  rowRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowStar: { color: onPhoto.star, fontSize: 13 },
  rowRatingValue: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  rowRatingCount: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },

  // The fork wears the app's glass pills — the same face the vibe chips
  // and the save button have — because it is an offer, not a result. The
  // eyebrow label is the reference mockup's "OR TRY": small caps, quiet,
  // clearly a heading over choices rather than a sentence.
  forkBox: { paddingHorizontal: space.page, marginTop: 26 },
  forkLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    letterSpacing: 1.2, marginBottom: 10,
  },
  forkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  forkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.surfaceGlass, borderWidth: 1,
    borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 14, minHeight: CHIP_H, paddingVertical: 6,
  },
  forkChipText: { color: colors.text, fontSize: 14, fontWeight: font.medium },
});
