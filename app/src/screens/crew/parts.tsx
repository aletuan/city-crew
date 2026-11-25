// The pieces every row on the crew page is made of, and its stylesheet.
//
// Out of `CrewScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import { Avatar, CHIP_H, PressableScale, SECONDARY_CONTROL_H } from '../../components/ui';
import type { FriendProfile } from '../../lib/data';
import { atHandle, normalizeHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { colors, font, radius, space, type } from '../../theme';
import type { Nav } from '../../nav';

/** How a sentence names them: the name, or the handle without one. */
export const nameOf = (p?: FriendProfile) => p?.full_name || (p ? atHandle(p.handle) : '…');

/** The visible door to a row's sheet — the ⋯ at its right end. Twice on
 *  this screen, word for word, until 16 Nov 2026; one piece now, and
 *  outside the screen's function, which is over its ceiling
 *  (`oversize.js`). */
export function Options({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.85}
      hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={t('Options', 'Tuỳ chọn', 'オプション', '选项', '選項')}
    >
      <Glyph name="ellipsis-horizontal" size={ICON.nav} color={colors.textTertiary} />
    </PressableScale>
  );
}

/**
 * Who a row is about, handle first (owner, 15 Nov 2026): the handle on
 * top, bare and in the strong ink, and the real name under it, quieter —
 * with whatever the row adds after the name (a friend's mutual saves).
 *
 * Until that day it was the name on top and "@handle" under it, and a
 * list's activity page was made to match (13 Nov). The owner turned both
 * together: a handle is what a person is added by here, what a list is
 * signed with, and the one thing every account has — 'full_name' is
 * optional, so a column of names was a column of names and handles
 * mixed. No `@`: the first line of a row of people is the handle.
 *
 * The three lists only — friends, sent, blocked. The request card says a
 * sentence ("Lan wants to join your crew"), the type-ahead puts both on
 * one line, and the sheets are headed by a name: none is a row of this
 * shape, and they are as they were.
 *
 * Outside the screen's function: it reads nothing of the screen's, and
 * the function is over its ceiling already (`oversize.js`).
 */
/** The face, or the space one would take — every row here draws it, so
 *  a missing avatar never changes a row's height. The circle itself is
 *  `Avatar`; what stays here is only the unwrapping of a profile that may
 *  not have arrived yet, which is this screen's own problem. Out of the
 *  screen's function since 20 Nov 2026, with `PersonDoor`, to keep that
 *  function under its ceiling. */
export function Face({ p, size = 44 }: { p?: FriendProfile; size?: number }) {
  return <Avatar url={p?.avatar_url} size={size} />;
}

/**
 * A face and the words beside it, as one way to that person's page —
 * on the Requests tab, where until 20 Nov 2026 nothing opened it.
 *
 * The Friends tab's rows had opened the page since 16 Nov; the rows on
 * Requests are where a reader most needs it, and could not (owner, 20
 * Nov 2026). A request asks you to decide about someone, and "who is
 * this?" is answered by their lists, not by a name and a handle. A
 * suggestion asks the same. A sent request matters less, and opens it
 * all the same: one rule for a face on this screen.
 *
 * The face and the words, not the whole card or row: those hold Accept,
 * Decline, Add, Hide, Cancel and ⋯, and a card that opened a page around
 * them would turn every near-miss of a button into a trip away. The
 * buttons sit outside this door, so a tap on one never reaches it.
 *
 * A stranger's page shows only what they made public, so nothing is
 * shown here that the page would not show anyone. A profile that has not
 * arrived opens nothing, as on the Friends tab.
 */
export function PersonDoor({ p, navigation, size, gap, testID, children }: {
  p?: FriendProfile;
  navigation: Nav;
  size?: number;
  /** The gap of the row it stands in, so the face sits where it did. */
  gap: number;
  testID: string;
  children: ReactNode;
}) {
  return (
    <PressableScale
      style={s.door}
      contentStyle={[s.doorRow, { gap }]}
      scaleTo={0.98}
      onPress={p ? () => navigation.navigate('Person', { handle: p.handle }) : undefined}
      accessibilityRole="button"
      testID={testID}
    >
      <Face p={p} size={size} />
      {children}
    </PressableScale>
  );
}

export function Who({ p, extra = '' }: { p?: FriendProfile; extra?: string }) {
  const handle = p ? normalizeHandle(p.handle) : '';
  const under = [handle && p?.full_name, extra].filter(Boolean).join(' · ');
  return (
    <View style={s.who}>
      <Text style={s.name} numberOfLines={1} testID="crew-who-handle">{handle || p?.full_name || '…'}</Text>
      {under ? <Text style={s.meta} numberOfLines={1} testID="crew-who-name">{under}</Text> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  who: { flex: 1, gap: 2 },
  addCard: { padding: space.cardPadding, gap: 12 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  typeName: { color: colors.text, fontSize: 15, fontWeight: font.medium, flexShrink: 1 },
  typeHandle: { color: colors.textTertiary, fontSize: 14 },

  head: {
    color: colors.textTertiary, fontSize: 13, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 6,
  },

  reqCard: { padding: space.cardPadding, gap: 14 },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // `PersonDoor`: the space the face and words had, and their row inside.
  door: { flex: 1 },
  doorRow: { flexDirection: 'row', alignItems: 'center' },
  reqTitle: { color: colors.text, fontSize: 16, lineHeight: 21 },
  answers: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  // A row whose write is in flight: dimmed, and refusing the tap, so a
  // second press has an answer ("it's working") rather than none.
  working: { opacity: 0.5 },
  accept: {
    flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
    minHeight: SECONDARY_CONTROL_H, borderRadius: radius.pill, paddingVertical: 10,
  },
  acceptText: { color: colors.accentInk, fontSize: 15, fontWeight: font.semibold },
  decline: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    minHeight: SECONDARY_CONTROL_H, paddingVertical: 10,
  },
  declineText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.semibold },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  name: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  meta: { color: colors.textTertiary, ...type.meta },
  // The reason a suggestion is there: the line that decides, so a step
  // brighter than the handle above it.
  reason: { color: colors.textSecondary, ...type.meta },
  // The ×, quiet beside Add: putting someone away is allowed, not urged.
  dismiss: { padding: 4, marginLeft: -6 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: CHIP_H, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: colors.surfaceGlass,
  },
  // Medium, as `AddPill`'s quiet word is (owner, 3 Nov 2026): the glass
  // pill wears one weight wherever it stands.
  addText: { color: colors.text, fontSize: 14, fontWeight: font.medium },

  // The two reversals — cancel a request, lift a block — wear the same
  // quiet outline: neither is a thing to encourage, both must be easy.
  quietBtn: {
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    minHeight: CHIP_H, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 6,
  },
  quietText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
});
