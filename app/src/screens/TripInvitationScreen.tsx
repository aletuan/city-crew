// An invitation, whole, before it is answered.
//
// The card on Trips carries enough for the easy yes. This is for the
// answer that needs looking at first: the times, the walk between the
// stops, what it will cost, and how many people are already coming.
//
// ── read from the list, not fetched again ──
//
// Same rule as `TripDetail`, and it works here for a reason worth naming:
// the invitee can read the trip from the moment they are asked, so it is
// already in `useMyTrips` alongside the ones they planned. No second
// query, and no second answer that could disagree with the screen behind
// this one.
//
// ── what it says before it asks ──
//
// Two sentences under the plan, and both are promises the rest of the
// system keeps rather than reassurance: the owner keeps the plan (there
// is no policy that would let this screen's reader move a stop), and
// declining does not delete anything (a refusal is a status, not a
// delete — see the trip_invites migration for why, unlike a declined
// friend request, it is recorded).

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AmbientWarmth, Avatar, Card, Empty, PressableScale, Screen, useTabBarClearance,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCrew } from '../lib/crew';
import { fromISO } from '../lib/day';
import { answerInvite } from '../lib/data';
import { useMyTrips } from '../lib/mytrips';
import { clockOf, dateline, fmtMinutes } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { useI18n } from '../lib/i18n';
import { useInvitations } from '../lib/invitations';
import { spendVnd } from '../lib/trips';
import { legsOf } from '../lib/travel';
import { colors, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

const money = (vnd: number) => (vnd >= 1_000_000
  ? `${Math.round(vnd / 100_000) / 10}M ₫`
  : `${Math.round(vnd / 1000)}k ₫`);

export default function TripInvitationScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'TripInvitation'>;
}) {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const { people } = useCrew();
  const { invites, crewCounts } = useInvitations();
  const clearance = useTabBarClearance();
  const trips = useMyTrips();

  const [busy, setBusy] = useState(false);

  const tripId = route.params.id;
  // Batched by the invitations provider alongside the rail this screen
  // was opened from, so the "you'd be N in all" clause is already in hand.
  const heads = crewCounts[tripId];
  const trip = trips.data.find((x) => x.id === tripId) ?? null;
  const invite = useMemo(
    () => invites.data.find((i) => i.trip_id === tripId && i.invitee_id === session?.user?.id) ?? null,
    [invites.data, tripId, session?.user?.id],
  );

  const answer = async (said: 'accepted' | 'declined') => {
    if (busy) return;
    setBusy(true);
    try {
      await answerInvite(tripId, said);
      invites.reload();
      trips.reload();
      // Both answers leave this screen: accepting puts the trip in Trips
      // where it now belongs, and declining ends the reader's access to it
      // on the same statement. Staying would be a screen with nothing left
      // to do on it either way.
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        t('Could not answer', 'Không trả lời được', '回答できません'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!trip) {
    return (
      <Screen title={t('Invitation', 'Lời mời', '招待')} onBack={() => navigation.goBack()}>
        <Empty text={trips.loaded
          ? t('That invitation is no longer here.', 'Lời mời đó không còn nữa.', 'その招待はもうありません。')
          : t('Loading…', 'Đang tải…', '読み込み中…')}
        />
      </Screen>
    );
  }

  const stops = trip.trip_stops ?? [];
  const day = fromISO(trip.day);
  const from = people[invite?.inviter_id ?? ''] ?? null;
  const legs = legsOf(stops.map((st) => st.places ?? { lat: null, lng: null }));
  const spend = spendVnd(stops.map((st) => st.places));
  const first = stops[0];
  const last = stops[stops.length - 1];
  const window = first?.arrive_min != null && last?.arrive_min != null
    ? `${clockOf(first.arrive_min)}–${clockOf(last.arrive_min + (last.dwell_min ?? 0))}`
    : null;
  const going = heads == null ? null : heads + 1;

  // Already answered — reached by a stale card, or by coming back. Said
  // plainly rather than by re-offering two buttons that would reach no
  // rows: the update policy pins the answer to the unanswered state.
  const answered = invite && invite.status !== 'pending';

  return (
    <Screen
      title={trip.title}
      eyebrow={t('INVITATION', 'LỜI MỜI', '招待')}
      onBack={() => navigation.goBack()}
    >
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={s.asker}>
          <Avatar url={from?.avatar_url} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.askerName} numberOfLines={1}>
              {from?.full_name || (from?.handle ? `@${from.handle}` : t('Someone', 'Ai đó', '誰か'))}
              {' '}
              <Text style={s.askerVerb}>{t('wants you along', 'muốn rủ bạn đi', 'があなたを誘っています')}</Text>
            </Text>
            <Text style={s.askerMeta} numberOfLines={2}>
              {[from?.handle ? `@${from.handle}` : null, day ? dateline(lang, day) : trip.day, window]
                .filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Card>

        <Text style={s.section}>{t('THEIR PLAN', 'KẾ HOẠCH CỦA HỌ', 'その予定')}</Text>
        <Card style={s.plan}>
          {stops.map((st, i) => {
            const p = st.places;
            const leg = legs[i];
            return (
              <View key={p?.slug ?? i}>
                <View style={s.stop}>
                  <Text style={s.at}>{st.arrive_min != null ? clockOf(st.arrive_min) : '—'}</Text>
                  <View style={s.dot} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>
                      {p ? t(p.name_en, p.name_vi, p.name_ja)
                        : t('A place that has since gone', 'Một nơi giờ không còn', 'いまはない場所')}
                    </Text>
                    <Text style={s.where} numberOfLines={1}>
                      {[p ? t(p.neighborhood_en, p.neighborhood_vi, p.neighborhood_ja) : null,
                        st.dwell_min ? fmtMinutes(st.dwell_min, lang) : null]
                        .filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
                {/* The walk between, which is the half of a plan a list of
                    times cannot show — two stops at 18:00 and 18:45 read
                    very differently at 300m and at 4km. */}
                {leg && i < stops.length - 1 ? (
                  <View style={s.leg}>
                    <Ionicons name="walk-outline" size={13} color={colors.textTertiary} />
                    <Text style={s.legText}>
                      {`${fmtDistance(leg.km)} · ≈ ${fmtMinutes(leg.minutes, lang)}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
          <View style={s.sum}>
            <Text style={s.sumText}>
              {[
                t(`${stops.length} stop${stops.length === 1 ? '' : 's'}`,
                  `${stops.length} điểm dừng`, `${stops.length}か所`),
                window,
                spend > 0 ? t(`~${money(spend)} / person`, `~${money(spend)} / người`, `~${money(spend)} / 人`) : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Card>

        {going != null ? (
          <Card style={s.who}>
            <Ionicons name="people-outline" size={17} color={colors.textSecondary} />
            <Text style={s.whoText}>
              {going === 1
                ? t(
                  `${from?.full_name || 'They'} — you’d be 2 in all.`,
                  `${from?.full_name || 'Họ'} — tính cả bạn là 2 người.`,
                  `${from?.full_name || 'この人'} — あなたを入れて2人。`,
                )
                : t(
                  `${from?.full_name || 'They'} and ${going - 1} other${going - 1 === 1 ? '' : 's'} — you’d be ${going + 1} in all.`,
                  `${from?.full_name || 'Họ'} và ${going - 1} người nữa — tính cả bạn là ${going + 1}.`,
                  `${from?.full_name || 'この人'} と他${going - 1}人 — あなたを入れて${going + 1}人。`,
                )}
            </Text>
          </Card>
        ) : null}

        <Card style={s.who}>
          <Ionicons name="lock-closed-outline" size={17} color={colors.textTertiary} />
          <Text style={s.noteText}>
            {t(
              `${from?.full_name || 'They'} keep the plan. Accepting puts it in your Trips and you get the reminder the evening before.`,
              `${from?.full_name || 'Họ'} giữ kế hoạch. Đồng ý thì chuyến vào mục Chuyến đi của bạn, và bạn được nhắc vào tối hôm trước.`,
              `予定は${from?.full_name || 'この人'}のものです。承諾すると旅程に入り、前の晩にリマインダーが届きます。`,
            )}
          </Text>
        </Card>

        {answered ? (
          <Text style={s.already}>
            {invite?.status === 'accepted'
              ? t('You said you’re in.', 'Bạn đã nhận lời.', '参加すると回答済みです。')
              : t('You said you can’t make it.', 'Bạn đã từ chối.', '不参加と回答済みです。')}
          </Text>
        ) : (
          <>
            <View style={s.answers}>
              <PressableScale
                onPress={() => answer('accepted')}
                accessibilityRole="button"
                containerStyle={{ flex: 1 }}
                style={[s.yes, busy && s.busy]}
              >
                <Ionicons name="checkmark" size={17} color={colors.accentInk} />
                <Text style={s.yesText}>{t('I’m in', 'Tôi tham gia', '参加する')}</Text>
              </PressableScale>
              <PressableScale
                onPress={() => answer('declined')}
                accessibilityRole="button"
                containerStyle={{ flex: 1 }}
                style={[s.no, busy && s.busy]}
              >
                <Text style={s.noText}>{t('Can’t make it', 'Không đi được', '行けません')}</Text>
              </PressableScale>
            </View>
            <Text style={s.foot}>
              {t(
                'Either answer tells them. Declining does not delete their plan.',
                'Dù trả lời thế nào họ cũng biết. Từ chối không xoá kế hoạch của họ.',
                'どちらの回答も相手に伝わります。断っても相手の予定は消えません。',
              )}
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
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
    color: colors.textSecondary, fontSize: 13.5, fontWeight: font.medium,
    width: 44, paddingTop: 1,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 6,
    backgroundColor: colors.accentFill,
  },
  name: { ...type.cardTitle, fontSize: 15.5, color: colors.text },
  where: { color: colors.textTertiary, fontSize: 12.5, marginTop: 1 },
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
  noteText: { flex: 1, color: colors.textTertiary, fontSize: 13.5, lineHeight: 20 },

  answers: { flexDirection: 'row', gap: 10, marginTop: space.cardGap },
  busy: { opacity: 0.6 },
  yes: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 14, borderRadius: radius.pill, backgroundColor: colors.accentFill,
  },
  yesText: { color: colors.accentInk, fontSize: 16, fontWeight: font.bold },
  no: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
  },
  noText: { color: colors.textSecondary, fontSize: 16, fontWeight: font.medium },
  foot: {
    color: colors.textTertiary, fontSize: 12.5, lineHeight: 18,
    textAlign: 'center', marginTop: 12,
  },
  already: {
    color: colors.textSecondary, fontSize: 14.5,
    textAlign: 'center', marginTop: space.cardGap,
  },
});
