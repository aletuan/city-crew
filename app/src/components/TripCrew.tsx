// Who is coming, and — on your own trip — what each of them said.
//
// The plan editor has drawn a crew row since the day it shipped, and it
// has always been a lie with a face on it: one avatar, the reader's own
// initial, beside the words "Just you, for now" and a button that opened
// nothing. The row survives because the shape was right; what changed is
// that there is now something true to put in it.
//
// ── the statuses are the point, not decoration ──
//
// The invite sheet promises "Either answer tells them". This row is where
// that promise is kept: a refusal is a fact the person who planned the
// evening has to act on — a table booked for four is wrong when one of
// them cannot come — and it is not the same news as an unanswered
// invitation. So a declined row stays, greyed and labelled, rather than
// disappearing and leaving the owner to notice a missing face.
//
// An invitee sees none of that. Who else was asked is the owner's
// business, and one of them may have said no; the count comes from
// `trip_crew_counts`, which returns a number without the rows behind it.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { FriendProfile } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { crewOf, headcount, type InviteRow } from '../lib/invites';
import { colors, font, radius, space } from '../theme';
import { Avatar, PressableScale } from './ui';

/** How many faces before the row starts counting instead. Four fits at
 *  320pt beside the button; past that the overlap stops reading as people
 *  and starts reading as texture. */
const FACES = 4;

export default function TripCrew({
  mine, invites, people, myAvatar, hostAvatar, headCount, canInvite, onInvite,
}: {
  /** Whether the reader planned this trip. The two sides of this row are
   *  different screens' worth of truth, not one with a button hidden. */
  mine: boolean;
  /** Every invitation on the trip — the owner's view. Empty for an
   *  invitee, who is not shown other people's rows. */
  invites: readonly InviteRow[];
  people: Record<string, FriendProfile>;
  /** The reader's own picture. They are on this trip in either role —
   *  planner or invited — so their face is always in the row; a null
   *  draws the fallback Avatar itself carries. */
  myAvatar: string | null;
  /** The planner's picture, when the planner is somebody else. Null on
   *  the reader's own trip — there the planner is `myAvatar`. */
  hostAvatar: string | null;
  /** The count an invitee is allowed: accepted, from the function. Null
   *  when it could not be fetched — a missing headcount costs a clause in
   *  a sentence and must not fail the screen. */
  headCount: number | null;
  /** False for a solo evening, and for a trip the reader did not plan. */
  canInvite: boolean;
  onInvite: () => void;
}) {
  const { t } = useI18n();
  const crew = crewOf(invites);

  // The owner counts off the rows they can see; an invitee is given the
  // number. Both mean the same thing — the planner plus everyone who said
  // yes — and neither counts a maybe.
  const going = mine ? headcount(crew) : (headCount == null ? null : headCount + 1);

  // The planner opens the row, and the reader is always in it — a grey
  // outline where a face belongs is the app forgetting who it is talking
  // to, a lesson the plan editor paid for once already. On your own trip
  // that is you, then everyone who said yes, overlapped into one small
  // crowd; on a trip you were asked onto it is the friend who planned it,
  // then you — the two ends of the invitation, touching. Who else was
  // asked stays a number: that is the owner's business.
  const faces: (string | null)[] = mine
    ? [
      myAvatar,
      ...crew.accepted.slice(0, FACES - 1).map((i) => people[i.invitee_id]?.avatar_url ?? null),
    ]
    : [hostAvatar, myAvatar];
  const waiting = crew.pending.length;
  const said_no = crew.declined.length;

  const line = going == null
    ? t('You’re on this one.', 'Bạn có mặt trong chuyến này.', 'あなたはこの旅程に参加します。')
    : going === 1
      ? t('Just you, for now', 'Hiện chỉ có bạn', '今はあなただけ')
      : t(
        `${going} going`,
        `${going} người đi`,
        `${going}人が参加`,
      );

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <View style={s.faces}>
          {faces.map((url, i) => (
            <View key={i} style={[s.face, i > 0 && { marginLeft: -10 }]}>
              <Avatar url={url} size={28} />
            </View>
          ))}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.line} numberOfLines={1}>{line}</Text>
          {/* Only the owner is told what is still owed, and only when
              something is. A count of zero waiting is not news. */}
          {mine && (waiting > 0 || said_no > 0) ? (
            <Text style={s.sub} numberOfLines={1}>
              {[
                waiting > 0 ? t(
                  `${waiting} yet to answer`,
                  `${waiting} chưa trả lời`,
                  `${waiting}人が未回答`,
                ) : null,
                said_no > 0 ? t(
                  `${said_no} can’t make it`,
                  `${said_no} không đi được`,
                  `${said_no}人が不参加`,
                ) : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>

        {canInvite ? (
          <PressableScale onPress={onInvite} accessibilityRole="button" style={s.ghost}>
            <Ionicons name="person-add-outline" size={14} color={colors.textSecondary} />
            <Text style={s.ghostText}>{t('Invite', 'Mời', '招待')}</Text>
          </PressableScale>
        ) : null}
      </View>

      {/* The named list, owner only, and only once somebody has been asked.
          A row per person rather than a summary, because the two things
          the owner does here — chase an unanswered invitation, re-plan
          around a refusal — both need the name. */}
      {mine && invites.length > 0 ? (
        <View style={s.list}>
          {[...crew.accepted, ...crew.pending, ...crew.declined].map((i) => {
            const p = people[i.invitee_id];
            const said = i.status;
            return (
              <View key={i.invitee_id} style={s.person}>
                <Avatar url={p?.avatar_url} size={26} />
                <Text style={s.personName} numberOfLines={1}>
                  {p?.full_name || (p?.handle ? `@${p.handle}` : t('Someone', 'Ai đó', '誰か'))}
                </Text>
                <Text
                  style={[
                    s.said,
                    said === 'accepted' && { color: colors.ok },
                    said === 'declined' && { color: colors.bad },
                  ]}
                >
                  {said === 'accepted'
                    ? t('Coming', 'Sẽ đi', '参加')
                    : said === 'declined'
                      ? t('Can’t make it', 'Không đi được', '不参加')
                      : t('Asked', 'Đã mời', '招待済み')}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: space.cardGap },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faces: { flexDirection: 'row', alignItems: 'center' },
  face: {
    borderRadius: 999, borderWidth: 2, borderColor: colors.bg,
  },
  line: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium },
  sub: { color: colors.textTertiary, fontSize: 12.5, marginTop: 1 },

  ghost: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
    backgroundColor: colors.surfaceGlass,
  },
  ghostText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.medium },

  list: {
    marginTop: 12, gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
    paddingTop: 10,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  personName: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: font.medium },
  said: { color: colors.textTertiary, fontSize: 12.5, fontWeight: font.medium },
});
