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
//
// ── one row of faces, not a row per person (owner, 20 Nov 2026) ──
//
// The named list under the faces took a line a head — three invitations
// were 150pt of a screen whose subject is the day, not the guest list —
// so the answers moved onto the faces themselves, after the way the
// profile's friends row marks a request: a disc on the corner. A yes is
// a green tick, an unanswered invitation a clock on a faded face, a no
// a cross on a fainter one. Order is `crewOf`'s: yes, waiting, no.
//
// What it costs: the names. They are one press away — the faces open the
// same sheet as the button (`InviteSheet`), where each friend's face is
// drawn with what they said, so there is one place to read answers and
// not two. A screen reader still gets them: each face says its name and
// each mark says its word, as separate things, which is also what the
// Maestro flows read (`crew-said-N`, text "Asked" / "Coming" / "Can’t
// make it" — the ids and the words the rows had).
//
// The faces are therefore not one accessible group. A group would hide
// the marks from VoiceOver and from the simulator's accessibility tree,
// and the button beside them already does what pressing the group does.
//
// Rejected: a dashed ring round a waiting face, as first drawn. React
// Native paints a dashed border only on some platforms at a round
// radius, and a state that depends on the platform is not a state.
// Rejected: tinting the "can't make it" half of the line below red. It
// is one string so it stays one string for a screen reader and a test;
// the cross on the face is what carries the colour.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Glyph, ICON } from './ui/glyph';
import type { FriendProfile } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { crewOf, headcount, type InviteRow } from '../lib/invites';
import { useScheme } from '../lib/theme';
import { bgHex, colors, font, radius, space } from '../theme';
import { Avatar, CHIP_H, CHIP_SLOP, PressableScale } from './ui';

/** How many faces before the row starts counting instead. Four fits at
 *  320pt beside the button; past that the overlap stops reading as people
 *  and starts reading as texture. The planner's is one of them, so an
 *  owner sees three guests and a count of the rest. */
const FACES = 4;
/** The disc on a face's corner, and the glyph inside it. */
const BADGE = 16;

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
  /** The count an invitee is allowed: accepted heads, batched by the
   *  invitations provider before this screen opened. Undefined while that
   *  answer has not landed — the row stays quiet rather than wearing the
   *  failure sentence as a loading state (the flicker the owner caught) —
   *  and null when the batch truly failed, which draws the numberless
   *  sentence: a missing headcount costs a clause, never the screen. */
  headCount: number | null | undefined;
  /** False for a solo evening, and for a trip the reader did not plan. */
  canInvite: boolean;
  onInvite: () => void;
}) {
  const { t } = useI18n();
  // The ring around each face is the page's own colour so an overlapped
  // stack reads as separate people — and it has to be resolved here, in
  // JS, from the app's scheme. Painted as the dynamic `colors.bg` it
  // followed the PHONE's appearance instead of the app's setting (border
  // colours flatten against system traits), and a reader with a light
  // phone under a dark app got a cream halo around every face.
  const { scheme } = useScheme();
  const ring = { borderColor: bgHex[scheme] };
  const crew = crewOf(invites);

  // The owner counts off the rows they can see; an invitee is given the
  // number. Both mean the same thing — the planner plus everyone who said
  // yes — and neither counts a maybe. For the invitee the two silences
  // stay distinct: undefined is an answer on its way, null one that died.
  const going = mine
    ? headcount(crew)
    : (typeof headCount === 'number' ? headCount + 1 : headCount);

  // The planner opens the row, and the reader is always in it — a grey
  // outline where a face belongs is the app forgetting who it is talking
  // to, a lesson the plan editor paid for once already. On your own trip
  // that is you, then everyone who said yes, overlapped into one small
  // crowd; on a trip you were asked onto it is the friend who planned it,
  // then you — the two ends of the invitation, touching. Who else was
  // asked stays a number: that is the owner's business.
  const nameOf = (id: string) => {
    const p = people[id];
    return p?.full_name || (p?.handle ? `@${p.handle}` : t('Someone', 'Ai đó', '誰か', '某人', '某人'));
  };
  const said = (st: InviteRow['status']) => (st === 'accepted'
    ? t('Coming', 'Sẽ đi', '参加', '参加', '參加')
    : st === 'declined'
      ? t('Can’t make it', 'Không đi được', '不参加', '无法参加', '無法參加')
      : t('Asked', 'Đã mời', '招待済み', '已邀请', '已邀請'));
  const waiting = crew.pending.length;
  const said_no = crew.declined.length;

  const asked = [...crew.accepted, ...crew.pending, ...crew.declined];
  const shown = asked.slice(0, FACES - 1);
  const hidden = asked.length - shown.length;
  const faces: { url: string | null; said?: InviteRow['status']; name?: string }[] = mine
    ? [
      { url: myAvatar },
      ...shown.map((i) => ({ url: people[i.invitee_id]?.avatar_url ?? null, said: i.status, name: nameOf(i.invitee_id) })),
    ]
    : [{ url: hostAvatar }, { url: myAvatar }];
  // No line at all while the count is still on its way: the faces already
  // say people are on this, and a sentence that gets replaced by a
  // different sentence half a second later reads as the app changing its
  // story. In practice the provider has answered before this screen opens.
  const line = going === undefined
    ? null
    : going === null
      ? t('You’re on this one.', 'Bạn có mặt trong chuyến này.', 'あなたはこの旅程に参加します。', '你参加了这个行程。', '你參加了這個行程。')
      : going === 1
        ? t('Just you, for now', 'Hiện chỉ có bạn', '今はあなただけ', '目前只有你', '目前只有你')
        : t(
          `${going} going`,
          `${going} người đi`,
          `${going}人が参加`,
          `${going} 人参加`, `${going} 人參加`,
        );

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <PressableScale
          onPress={onInvite}
          disabled={!canInvite}
          accessible={false}
          testID="trip-faces"
          contentStyle={s.faces}
        >
          {faces.map((f, i) => (
            <View key={i} style={[s.face, ring, i > 0 && { marginLeft: -10 }]}>
              <View
                accessible={f.name ? true : undefined}
                accessibilityLabel={f.name}
                style={f.said === 'pending' ? s.fadeWait : f.said === 'declined' ? s.fadeNo : null}
              >
                <Avatar url={f.url} size={28} />
              </View>
              {f.said ? (
                <View
                  accessible
                  accessibilityLabel={said(f.said)}
                  testID={`crew-said-${i - 1}`}
                  style={[
                    s.badge, ring,
                    { backgroundColor: f.said === 'accepted' ? colors.ok : f.said === 'declined' ? colors.bad : colors.textTertiary },
                  ]}
                >
                  <Glyph
                    name={f.said === 'accepted' ? 'checkmark' : f.said === 'declined' ? 'close' : 'time'}
                    size={ICON.tiny}
                    color="#FFFFFF"
                  />
                </View>
              ) : null}
            </View>
          ))}
          {hidden > 0 ? (
            <View style={[s.face, s.more, ring, { marginLeft: -10 }]}>
              <Text style={s.moreText}>{`+${hidden}`}</Text>
            </View>
          ) : null}
        </PressableScale>

        <View style={{ flex: 1, minWidth: 0 }}>
          {line ? <Text style={s.line} numberOfLines={1}>{line}</Text> : null}
          {/* Only the owner is told what is still owed, and only when
              something is. A count of zero waiting is not news. */}
          {mine && (waiting > 0 || said_no > 0) ? (
            <Text style={s.sub} numberOfLines={1}>
              {[
                waiting > 0 ? t(
                  `${waiting} yet to answer`,
                  `${waiting} chưa trả lời`,
                  `${waiting}人が未回答`,
                  `${waiting} 人未回复`, `${waiting} 人未回覆`,
                ) : null,
                said_no > 0 ? t(
                  `${said_no} can’t make it`,
                  `${said_no} không đi được`,
                  `${said_no}人が不参加`,
                  `${said_no} 人无法参加`, `${said_no} 人無法參加`,
                ) : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>

        {canInvite ? (
          <PressableScale onPress={onInvite} accessibilityRole="button" hitSlop={CHIP_SLOP} contentStyle={s.ghost} testID="trip-invite">
            <Glyph name="person-add-outline" size={ICON.text} color={colors.textSecondary} />
            <Text style={s.ghostText}>{t('Invite', 'Mời', '招待', '邀请', '邀請')}</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: space.cardGap },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faces: { flexDirection: 'row', alignItems: 'center' },
  // borderColor rides in from the component — see the `ring` note there.
  face: {
    borderRadius: 999, borderWidth: 2,
  },
  line: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium },
  sub: { color: colors.textTertiary, fontSize: 13, marginTop: 1 },

  ghost: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: CHIP_H, paddingHorizontal: 13, paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
    backgroundColor: colors.surfaceGlass,
  },
  ghostText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium },

  // Sized against the 28pt face: the smallest disc that holds the scale's
  // smallest glyph (`ICON.tiny`, 11) with the ring round it, which comes
  // to a little over half the face. It hangs 4 off the corner so it covers
  // the picture's edge and not its subject. The ring is the page's colour, as the faces' are.
  badge: {
    position: 'absolute', right: -4, bottom: -4,
    width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  // Faded, not recoloured: a waiting face is still the friend, a refused
  // one is still on the list. The disc says which, so the fade need only
  // say "not yet" (0.6) and "not coming" (0.4) apart at a glance.
  fadeWait: { opacity: 0.6 },
  fadeNo: { opacity: 0.4 },
  more: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlassStrong },
  moreText: { color: colors.textSecondary, fontSize: 11, fontWeight: font.medium },
});
