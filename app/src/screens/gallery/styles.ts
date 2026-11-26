// GalleryScreen's stylesheet and the grid's two measures, as they were in
// one file.

import { StyleSheet } from 'react-native';
import { SECONDARY_CONTROL_H } from '../../components/ui';
import { colors, font, onPhoto, radius, space } from '../../theme';

export const COLS = 3;
export const GAP = 6;

export const s = StyleSheet.create({
  tools: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tool: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: SECONDARY_CONTROL_H, paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  // The hairline only holds the size; a `badSoft` border would resolve to
  // the phone's side of the pair, not the app's (`bgHex` in theme.ts).
  toolBad: { backgroundColor: colors.badSoft, borderColor: 'transparent' },
  toolText: { fontSize: 14, fontWeight: font.semibold },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    flex: 1, borderRadius: 12, overflow: 'hidden',
    backgroundColor: colors.surfaceGlassStrong,
  },
  // Not `flex: 1`: the waiting tile is given its cell outright, like the
  // pressables around it get theirs through their outer `style`.
  waiting: { flex: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
  waitingText: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium },
  hiddenVeil: {
    backgroundColor: 'rgba(6,5,8,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Top-left, on the scrim idiom the cards use over photography.
  badge: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill,
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  badgeText: { color: onPhoto.text, fontSize: 11, fontWeight: font.semibold },
  // The ring on the tile last opened: the accent, inside the tile so the
  // grid's gutters stay even.
  tileLast: { borderWidth: 2.5, borderColor: colors.accent },


  tick: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: onPhoto.text,
    backgroundColor: 'rgba(6,5,8,0.35)',
  },
  tickOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },

  tips: { padding: space.cardPadding, gap: 10 },
  tipsTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginTop: 7 },
  tipText: { flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 19 },

});
