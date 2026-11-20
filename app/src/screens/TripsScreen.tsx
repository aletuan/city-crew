// The trips you saved — the only screen in the app that reads a table it
// cannot rebuild.
//
// Everything else the app shows is catalog: rows the desk wrote, where a
// stale copy is one refresh away from being right. A trip is a decision
// somebody made on a particular evening, so this screen renders it as it
// was saved rather than re-planning it. A place that has since left the
// catalog comes back null and is drawn as a gap, not quietly dropped —
// the reader picked five stops and a list of four with no explanation is
// the app losing something in front of them.
//
// ── two halves, not one list ──
//
// Upcoming runs soonest first, because the next trip is the one you opened
// the tab for. Past runs most recent first, because that is the order
// memory works in. The split and both sorts live in `lib/trips` where a
// test can see them; `today` counts as upcoming, so an evening you are
// currently on does not become a memory at midnight.
//
// ── the card summarises, the detail carries ──
//
// This file used to argue there should be no detail screen, because the
// card held the whole itinerary and a tap leading to the same content one
// screen deeper buys nothing. That was true while the card printed every
// stop. It stopped being true at `CARD_STOPS`: a day out is five stops, a
// card showing three of them and saying so is a summary, and a summary
// needs somewhere to lead. Delete moved with it — a destructive glyph
// competing for taps with a card that is now itself a tap is the worse of
// the two places to keep it.
//
// ── the crew row is not drawn ──
//
// The reference design shows overlapping avatars and "5 going" on every
// card. Nothing in this app knows who else is on a trip: there is no
// membership table, no invitation, and no policy letting anybody read a
// row they do not own. Drawing initials there would be inventing people,
// which is the same mistake the plan editor's Invite button is labelled a
// mock to avoid. The footer keeps the shape and fills it with what is
// true — how many stops, what it costs.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { Glyph, ICON } from '../components/ui/glyph';
import { HeaderAdd } from '../components/add';
import {
  AmbientWarmth,
  Card,
  GradientCta,
  PressableScale,
  Screen,
  Skeleton,
  useTabBarClearance,
} from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { holdResume } from '../lib/resume';
import { useSession } from '../lib/auth';
import { minutesOf, toISO } from '../lib/day';
import { useMyTrips } from '../lib/mytrips';
import { useI18n } from '../lib/i18n';
import { classifyLoadFail } from '../lib/loadfail';
import { LoadFailBanner, LoadFailEmpty } from '../components/loadFail';
import { splitTrips } from '../lib/trips';
import { useCrew } from '../lib/crew';
import { useInvitations } from '../lib/invitations';
import { answerInvite } from '../lib/data';
import { sortInvites, splitByStanding } from '../lib/invites';
import InviteCard from '../components/InviteCard';
import { colors, space } from '../theme';
import type { Nav } from '../nav';
import { TripCard, FirstTrip } from './trips/parts';
import { s } from './trips/styles';

export default function TripsScreen({ navigation, route }: { navigation: Nav; route?: { params?: { at?: number } } }) {
  const { t } = useI18n();
  const { session } = useSession();
  const clearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useScrollToTop(scrollRef);
  // And from Profile's Trips count, which lands here with a fresh `at`:
  // the list from its top, not where the reader last left it (UX-09).
  const at = route?.params?.at;
  useEffect(() => {
    if (at) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [at]);
  const trips = useMyTrips();
  const tripsFail = classifyLoadFail(trips.error);

  // Saving happens in the Ideas stack, in another tab, so this list is
  // always out of date by the time anyone looks at it. Every focus reloads
  // — including the first. Skipping the first used to assume "just
  // mounted" meant "fresh", but the provider's own fetch runs once, on
  // app launch, on the Explore tab; the first time this tab is ever
  // focused in a session is exactly the moment after saving the session's
  // first trip, and skipping that focus left the new trip missing until a
  // second visit. The redundant request the skip was for costs one round
  // trip on an ordinary visit and is invisible — `reload` keeps showing
  // the data already on screen while it runs.
  useFocusEffect(useCallback(() => {
    trips.reload();
  // `trips.reload` is stable; `trips` is a new object on every load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips.reload]));

  // One `Date` for both halves of the question, because `todayISO()` and
  // `minutesOf()` read separately can straddle midnight and produce "the
  // 17th, at 00:00" for a clock that is already on the 18th.
  //
  // Read at render rather than on a timer. The list is re-read on every
  // focus anyway, so a trip that ends while the reader is looking at this
  // exact screen moves down the next time they come back to it — which is
  // late by minutes, not by the hours the day-granular split was late by,
  // and costs no interval nobody would remember to clear.
  // What the reader can open is now three things, not one: what they
  // planned, what they were asked to and accepted, and what is still
  // waiting on an answer. RLS returns all three in one list — an invitee
  // reads the trip from the moment they are asked — so the split happens
  // here, off their own id. See `lib/invites`.
  const me = session?.user?.id ?? null;
  const { people } = useCrew();
  const { invites } = useInvitations();
  const [answering, setAnswering] = useState<string | null>(null);

  const myInvites = useMemo(
    () => (me ? invites.data.filter((i) => i.invitee_id === me) : []),
    [invites.data, me],
  );
  const { mine, asked } = useMemo(
    () => splitByStanding(trips.data, me ?? '', myInvites),
    [trips.data, me, myInvites],
  );
  // Oldest first: an invitation is owed rather than news, so the one that
  // has waited longest is the one to answer next.
  const rail = useMemo(() => {
    const byTrip = new Map(asked.map((tr) => [tr.id, tr]));
    return sortInvites(myInvites)
      .filter((i) => i.status === 'pending' && byTrip.has(i.trip_id))
      .map((i) => ({ invite: i, trip: byTrip.get(i.trip_id)! }));
  }, [asked, myInvites]);

  const answer = async (tripId: string, said: 'accepted' | 'declined') => {
    if (answering) return;
    setAnswering(tripId);
    try {
      await answerInvite(tripId, said);
      invites.reload();
      trips.reload();
    } catch (e) {
      Alert.alert(
        t('Could not answer', 'Không trả lời được', '回答できません', '无法回复', '無法回覆'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setAnswering(null);
    }
  };

  const now = new Date();
  // Split what they are actually going on — a trip nobody has agreed to
  // must not appear among the plans they have.
  const { upcoming, past } = splitTrips(mine, toISO(now), minutesOf(now));

  // Signed out is not an empty list, it is a different question, so it gets
  // the whole screen rather than a banner above nothing.
  if (!session) {
    return (
      <Screen title={t('Trips', 'Chuyến đi', '旅程', '行程', '行程')}>
        <AmbientWarmth />
        <View style={s.first}>
          <View style={s.firstIcon}>
            <Glyph name="map" size={ICON.feature} color={colors.accent} />
          </View>
          <Text style={s.firstTitle}>
            {t('Where to next?', 'Đi đâu tiếp theo?', '次はどこへ？', '下一站去哪儿？', '下一站去哪裡？')}
          </Text>
          <Text style={s.firstBody}>
            {t(
              'Plan a trip your way.',
              'Lên chuyến đi theo cách bạn thích.',
              '自分らしい旅を計画しましょう。',
              '按你的方式规划行程。', '按你的方式規劃行程。',
            )}
          </Text>
          <GradientCta
            wide
            icon="sparkles-outline"
            label={t('Try planning a trip', 'Thử lên kế hoạch', '旅の計画を試す', '试着规划一次行程', '試著規劃一次行程')}
            onPress={() => navigation.getParent()?.navigate('Ideas', { screen: 'IdeasHome' })}
          />
          <Text style={s.guestHint}>
            {t(
              'No account needed',
              'Không cần tài khoản',
              'アカウント不要',
              '无需账号', '無需帳號',
            )}
          </Text>
        </View>
        <View style={s.guestReturning}>
          <Text style={s.guestHint}>
            {t('Already have an account?', 'Đã có tài khoản?', 'アカウントをお持ちですか？', '已有账号？', '已有帳號？')}
          </Text>
          <PressableScale
            accessibilityRole="button"
            contentStyle={s.guestSignIn}
            onPress={() => {
              holdResume({ tab: 'Trips', at: Date.now() });
              navigation.getParent()?.navigate('Profile', { screen: 'SignIn', initial: false });
            }}
          >
            <Text style={s.guestSignInText}>
              {t('Sign in', 'Đăng nhập', 'サインイン', '登录', '登入')}
            </Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('Trips', 'Chuyến đi', '旅程', '行程', '行程')}
      // A header action acts on the screen it sits above, and the one thing
      // this screen cannot do for itself is make another trip. It jumps to
      // Ideas, which is where a trip comes from.
      //
      // Only once there is a list. With none, `FirstTrip` below is already
      // making the same offer and saying what a trip is for — two
      // invitations to do one thing read as two different things, which is
      // the rule Collections keeps on its own section heading and this
      // screen shipped without.
      //
      // The header's plus (`HeaderAdd`), the one every header that makes
      // something wears.
      right={trips.data.length > 0 ? (
        <HeaderAdd
          label={t('New trip', 'Chuyến đi mới', '新しい旅程', '新建行程', '新增行程')}
          onTitle
          onPress={() => navigation.getParent()?.navigate('Ideas')}
          testID="trips-new"
        />
      ) : undefined}
    >
      <AmbientWarmth />
      {!trips.loaded && (
        <View style={s.body}>
          {[0, 1].map((i) => (
            <Card key={i} style={s.pad}>
              <Skeleton style={{ height: 19, width: '60%', borderRadius: 8 }} />
              <Skeleton style={{ height: 13, width: '40%', borderRadius: 7, marginTop: 8 }} />
              <Skeleton style={{ height: 44, width: '100%', borderRadius: 10, marginTop: 14 }} />
            </Card>
          ))}
        </View>
      )}

      {/* Named, never the server's words; the body when there is nothing
          to show and a banner when there is — see `components/loadFail`. */}
      {trips.loaded && tripsFail && (
        trips.data.length === 0
          ? <LoadFailEmpty kind={tripsFail} onRetry={trips.reload} testID="trips-load-fail" />
          : <LoadFailBanner kind={tripsFail} onRetry={trips.reload} testID="trips-load-banner" />
      )}

      {trips.loaded && !(tripsFail && trips.data.length === 0) && (
        <ScrollView
          testID={!trips.loading && !trips.fromCache && !trips.error && invites.loaded && !invites.loading && !invites.error ? 'trips-ready' : undefined}
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
          showsVerticalScrollIndicator={false}
          onScroll={duckScroll}
          scrollEventThrottle={16}
        >
          {/* "No trips yet" is false while somebody is waiting on an
              answer, and offering to plan a first one would be the app
              talking over an invitation it is already showing. */}
          {!mine.length && !rail.length && (
            <FirstTrip onPress={() => navigation.getParent()?.navigate('Ideas')} />
          )}

          {/* The rail, above the plans that are already agreed. A count on
              the heading for the same reason the sections below carry one:
              it says how much is owed before the scan starts. */}
          {!!rail.length && (
            <Text style={[s.section, s.sectionInvite]}>
              {t('Invitations', 'Lời mời', '招待', '邀请', '邀請')} · {rail.length}
            </Text>
          )}
          {rail.map(({ invite, trip }, i) => (
            <InviteCard
              key={trip.id}
              index={i}
              trip={trip}
              from={people[invite.inviter_id] ?? null}
              busy={answering === trip.id}
              onOpen={() => navigation.navigate('TripInvitation', { id: trip.id })}
              onAnswer={(said) => answer(trip.id, said)}
            />
          ))}

          {/* The lede speaks to the half that exists. It said "your next
              plans" over every list, and on an account whose 55 trips were
              all behind it, it sat directly above "Been there · 55"
              (UX-10, 17 Oct 2026). With nothing ahead it says so, which
              is also the line that makes "New trip" above it the obvious
              next move.

              "Your journeys", owner's words (14 Nov 2026), after "Your
              next plans, in order." lost its last clause the same day: the
              order is visible, and "next plans" said again what the
              "Upcoming" heading under it says. No full stop, as given. */}
          {!!mine.length && !!upcoming.length && (
            <Text style={s.lede}>
              {t(
                'Your journeys',
                'Những hành trình của bạn',
                'あなたの旅',
                '你的旅程', '你的旅程',
              )}
            </Text>
          )}
          {/* Nothing ahead is a state of the list, so it is drawn as one: a
              quiet card where the upcoming trips would stand, not a
              sentence under the title (owner, 24 Oct 2026). As a lede it
              read as the screen's subtitle and was passed over; as a card
              it takes the place of the section it stands in for, and the
              first thing above "Past" says why there is no "Upcoming".
              The calendar is coral, as every trip's calendar is — see
              `IconSubtitle` on the one glyph wearing two colours. Not a
              button: "New trip" is in the header, one glance up. */}
          {!!mine.length && !upcoming.length && (
            <View style={s.none} testID="trips-none-ahead">
              <Glyph name="calendar-outline" size={ICON.nav} color={colors.accent} />
              <Text style={s.noneText}>
                {t(
                  'No upcoming trips',
                  'Chưa có chuyến đi sắp tới',
                  'これからの旅はまだありません',
                  '暂无即将到来的行程', '暫無即將到來的行程',
                )}
              </Text>
            </View>
          )}

          {/* The count belongs on the heading rather than under it: this is
              a list somebody scans to find one trip, and how many there are
              is the first thing that tells them how long the scan is. */}
          {!!upcoming.length && (
            <Text style={s.section}>
              {t('Upcoming', 'Sắp tới', 'これから', '即将到来', '即將到來')} · {upcoming.length}
            </Text>
          )}
          {upcoming.map((trip, i) => (
            <View key={trip.id} style={s.row}>
              <TripCard
                trip={trip}
                testID={`trip-upcoming-${i}`}
                past={false}
                onPress={() => navigation.navigate('TripDetail', { id: trip.id })}
              />
            </View>
          ))}

          {!!past.length && (
            // "Past", not "Been there": a trip moves here when its day is
            // over, and nothing records that anyone went. The heading
            // states the date, the one thing the split knows — the pair
            // to "Upcoming" (UX-10).
            <Text style={[s.section, !!upcoming.length && s.sectionAfter]}>
              {t('Past', 'Đã qua', 'これまで', '已结束', '已結束')} · {past.length}
            </Text>
          )}
          {past.map((trip) => (
            <View key={trip.id} style={s.row}>
              <TripCard
                trip={trip}
                past
                onPress={() => navigation.navigate('TripDetail', { id: trip.id })}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
