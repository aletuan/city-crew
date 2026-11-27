// TripInvitationScreen's stylesheet, as it was in one file.

import { StyleSheet } from 'react-native';
import { CONTROL_H } from '../../components/ui';
import { colors, font, radius, space, type } from '../../theme';

export const s = StyleSheet.create({
  // `Card` draws a surface and nothing else — padding is the caller's job,
  // and this screen shipped without doing it: every card had its content
  // against the border, and the summary line's first digit was clipped by
  // the rounded corner's overflow. The values are the family's own —
  // `space.cardPadding` across, InviteCard's 12–14 down.
  asker: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  askerName: { color: colors.text, fontSize: 16, fontWeight: font.bold },
  askerVerb: { color: colors.textSecondary, fontWeight: font.regular },
  askerMeta: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },

  section: {
    color: colors.textTertiary, fontSize: 11, fontWeight: font.bold,
    letterSpacing: 1.1, marginTop: space.cardGap, marginBottom: 8,
  },

  // Rows carry 8 of their own, so the card's vertical half meets them at
  // a 16 total — the same rhythm `cardPadding` gives the sides.
  plan: { paddingHorizontal: space.cardPadding, paddingVertical: 8 },
  stop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  at: {
    color: colors.textSecondary, fontSize: 14, fontWeight: font.medium,
    width: 44, paddingTop: 1,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 6,
    backgroundColor: colors.accentFill,
  },
  name: { ...type.cardTitle, fontSize: 16, color: colors.text },
  where: { color: colors.textTertiary, fontSize: 13, marginTop: 1 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 62, paddingBottom: 4 },
  legText: { color: colors.textTertiary, fontSize: 12 },

  sum: {
    marginTop: 8, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  sumText: { color: colors.textSecondary, fontSize: 13 },

  who: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: space.cardGap,
    paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  whoText: { flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  noteText: { flex: 1, color: colors.textTertiary, fontSize: 14, lineHeight: 20 },

  answers: { flexDirection: 'row', gap: 10, marginTop: space.cardGap },
  busy: { opacity: 0.6 },
  yes: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: CONTROL_H, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.accentFill,
  },
  yesText: { color: colors.accentInk, fontSize: 16, fontWeight: font.bold },
  no: {
    alignItems: 'center', justifyContent: 'center',
    minHeight: CONTROL_H, paddingVertical: 10, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
  },
  noText: { color: colors.textSecondary, fontSize: 16, fontWeight: font.medium },
  foot: {
    color: colors.textTertiary, fontSize: 13, lineHeight: 18,
    textAlign: 'center', marginTop: 12,
  },
  already: {
    color: colors.textSecondary, fontSize: 15,
    textAlign: 'center', marginTop: space.cardGap,
  },
});
