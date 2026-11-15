// CollectionsScreen's stylesheet, and the measures it shares with the screen and
// its parts: as they were in one file.

import { StyleSheet } from 'react-native';
import { CHIP_H, TABS_ROW_GAP } from '../../components/ui';
import { colors, font, mosaicScrim, onPhoto, radius, space, type } from '../../theme';

/** Under the open box and its kinds: the gap the tabs leave, so the
 *  shelf starts the same distance under whichever row is last. */
const SEARCH_ROW_GAP = TABS_ROW_GAP;

export const s = StyleSheet.create({
  // Margins stay on the Pressable; the card itself is what scales.
  noticeWrap: { marginHorizontal: space.page, marginBottom: space.titleToContent },
  // One row: the words, then the chip at the end. 14 above and below the
  // two lines, so the banner is about 72pt where the card was 150.
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  noticeCopy: { flex: 1, gap: 2 },
  // 16, a step under the card title's 18: the banner introduces the shelf
  // rather than being an item on it, and at 18 it outranked the tiles.
  noticeTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold, lineHeight: 21 },
  // A step down again: the supporting line, read after the title.
  noticeBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 19 },
  noticeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: CHIP_H, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
  },
  noticeChipText: { color: colors.accentInk, fontSize: 15, fontWeight: font.semibold },

  // The community grid. Sized in the component — the width is the
  // screen's business — and dressed in the Explore shelf card's clothes:
  // photo, three-stop scrim, light ink.
  // A city's name over its block, and the count at the row's far edge.
  //
  // One size with the bar pinned under the tabs (owner, 15 Nov 2026). The
  // name here was the section size, 22, with the count beside it at 15,
  // and the pinned copy a step smaller, 18 and 13, with its count at the
  // far edge: scrolling, the same city's name was two sizes a moment
  // apart and its count in two places, and the owner read it on the phone
  // as an inconsistency, not as a hierarchy. The pinned row's is the one
  // kept — it is the one that has to stay under the tabs.
  // Above it, the row gap already left by the block before plus the
  // page's title gap; below, the theme's heading-to-content step, so the
  // name sits closer to the cards it heads than to the ones it follows.
  cityHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.page, paddingTop: space.titleToContent, paddingBottom: space.headingToContent,
  },
  // The first block has no heading at rest (owner, 7 Nov 2026): the city
  // is named once the list moves, by the bar under the pinned tabs. What
  // stands in its slot is the gap — the 14 the row above leaves (the
  // tabs, or the box once it is open) and this make `titleToContent`, the
  // gap under a screen's head everywhere else (6 Nov: with the heading,
  // "Hà Nội" had floated 43pt under the box). Later blocks keep their
  // headings: those are where one city ends.
  firstGap: { height: space.titleToContent - SEARCH_ROW_GAP },
  cityHeadName: { ...type.cardTitle, color: colors.text, flexShrink: 1 },
  // The ▾ says the name opens something: the list of cities to jump to.
  cityHeadChevron: { alignSelf: 'center', marginLeft: -4 },
  // "16 collections", not "16": a bare number beside a city's name read
  // as anything — a rank, a district (owner, 6 Nov 2026).
  cityHeadCount: { marginLeft: 'auto', fontSize: 13, fontWeight: font.medium, color: colors.textTertiary },
  // The same heading, pinned under the tabs: the same name and the same
  // count, in a row of its own measure.
  //
  // Close under the tabs (owner, 7 Nov 2026): it sat ~29pt below their
  // underline — the tabs' own 14, a hairline, then the name centred in a
  // 44pt row. Now the tabs' 14 is the whole gap, the same the tabs leave
  // above the search box at rest; the hairline went, the underline and
  // the bar's ground part them already. The target stays past 44 through
  // `hitSlop` (see `cityHead`).
  cityBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.page, paddingBottom: 12,
  },
  // A guest's pinned row is the bar alone, at the top of the screen.
  cityBarAlone: { paddingTop: 12 },
  jumpTitle: { color: colors.text, ...type.cardTitle },
  gridRow: {
    flexDirection: 'row', gap: space.cardGap,
    marginHorizontal: space.page, marginBottom: space.cardGap,
  },
  gcard: { borderRadius: radius.image, overflow: 'hidden', justifyContent: 'flex-end' },
  gcardText: { padding: 12, gap: 2 },
  mosaicCard: { gap: 0 },
  mosaicPhoto: { flex: 1, borderRadius: radius.image, overflow: 'hidden' },
  mosaicWords: { gap: 6, padding: 14 },
  mosaicOverlay: { position: 'absolute', left: 0, right: 0 },
  mosaicTail: { position: 'absolute', left: 0, right: 0, height: mosaicScrim.tailHeight },
  mosaicTailBelow: { top: '100%' },
  mosaicTailAbove: { bottom: '100%' },
  mosaicWordsBottom: { position: 'absolute', bottom: 0 },
  mosaicWordsTop: { position: 'absolute', top: 0 },
  // In the caption's flow rather than pinned: the caption's own 14pt
  // padding puts it in the corner, where the pinned badge would sit.
  mosaicBadgeInline: { position: 'relative', top: 0, left: 0, alignSelf: 'flex-start' },
  mosaicWordsBelow: { paddingHorizontal: 2, paddingTop: 11, paddingBottom: 0 },
  mosaicWordsFeatured: { padding: 20 },
  mosaicTitleFeatured: { ...type.titleDetail, color: onPhoto.text, lineHeight: 32 },
  mosaicInkShadow: { textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  mosaicTitleBelow: { color: colors.text },
  // Full white on a photograph, not the 82% secondary ink: at 82% a 12–13pt
  // line over a white picture needs 0.65 of dark, at full white 0.58, and
  // `mosaicScrim` holds 0.60 behind every line. Size carries the order.
  mosaicAuthor: { color: onPhoto.text, fontSize: 12, lineHeight: 16, flexShrink: 1 },
  // The face and the name, as the tile's foot sets them, 6 apart.
  mosaicBy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mosaicAuthorBelow: { color: colors.textSecondary },
  mosaicBlurb: { color: onPhoto.text, fontSize: 13, lineHeight: 18 },
  gcardTitle: { color: onPhoto.text, fontSize: 16, fontWeight: font.semibold, lineHeight: 19 },
  gcardBy: { color: onPhoto.textSecondary, fontSize: 13, fontWeight: font.medium, flexShrink: 1 },
  // As tall as the avatar on every tile (owner, 17 Oct 2026). A
  // community tile leads with an 18pt face, your own with a 14pt glyph,
  // and the shorter row sat the title 2–3pt lower on one tab than the
  // other — the same list moved as you switched tabs.
  gcardFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, minHeight: 18 },
  gcardMeta: { color: onPhoto.textSecondary, fontSize: 13 },
  gcardLock: {
    position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceCard,
  },
  gcardCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gcardLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // The tile/list switch — two glyphs in a quiet glass capsule, the
  // chosen one seated on a solid thumb. Small on purpose: it is a
  // preference, not a destination.
  viewToggle: {
    flexDirection: 'row', gap: 2, padding: 3,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.pill,
  },
  viewBtn: {
    width: 26, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  viewBtnOn: { backgroundColor: colors.surfaceCard },

  // The visits screen's box and panel, to the point: the same row, the
  // same Cancel inside the box, the same card of groups, so the two screens
  // that let a reader narrow a list of their own do it with one grammar.
  // The header's own subtitle type (`s.subtitle` in ui/surfaces.tsx), in the page's
  // margins. The header ends 14 under the title; -6 brings this line to
  // the 8 a subtitle sits under its title in that header.
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: space.page, marginBottom: SEARCH_ROW_GAP },
  // The panel on the page's own ground, not in a card: its rows run to
  // the screen's edge and fade into the page, which a card's ground —
  // translucent in every dark look — would not match. The suggestions,
  // words in a list rather than a row, keep the card.
  panel: { marginBottom: 14, gap: space.headingToContent },
  recents: { marginHorizontal: space.page, padding: space.cardPadding, gap: 10 },
  group: { gap: 10 },
  onPage: { marginHorizontal: space.page },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legend: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  clear: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  suggestionText: { flex: 1, color: colors.text, fontSize: 16 },
  // Under the box, where the panel was, with the box's own margins: the
  // review board's folded filter (owner, 25 Oct 2026) — no chips, the
  // glyph and the words, a hairline between them, a ✕ after each word.
  // 36pt tall, Explore's filter button's box; the slop makes it 44.
  // The kinds under the open box, its own gap below them.
  kinds: { marginBottom: SEARCH_ROW_GAP },
  // The pinned copy: over the shelf, opaque because the shelf runs under
  // it, and a hairline at its foot — the edge between the switch and the
  // lists, the one Explore's pinned row draws too.
  pinned: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft,
  },
  hiddenHeader: { opacity: 0 },
  // The header's own subtitle type, drawn up under the title by the 6 the
  // header's 14 below it has to spare, and 12 clear of the tabs.
  scope: { color: colors.textSecondary, fontSize: 14, lineHeight: 18, marginHorizontal: space.page, marginTop: -6, marginBottom: 12 },
  // The empty Mosaic cover's well, filling the photograph's box.
  thumbFill: { width: '100%', flex: 1 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },

  firstWrap: { marginHorizontal: space.page, marginBottom: space.titleToContent },
  first: {
    alignItems: 'center', gap: 10,
    paddingHorizontal: space.cardPadding + 6, paddingTop: 26, paddingBottom: 22,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card,
  },
  firstIcon: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
    marginBottom: 2,
  },
  firstTitle: { color: colors.text, ...type.headline },
  firstBody: {
    color: colors.textSecondary, fontSize: 15, lineHeight: 21,
    textAlign: 'center', marginBottom: 6,
  },
  firstFoot: { color: colors.textTertiary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },

});
