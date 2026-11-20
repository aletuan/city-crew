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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
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
  WordTabs,
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
import { useKeepCurrent } from '../lib/usePull';
import { answerInvite } from '../lib/data';
import { sortInvites, splitByStanding, type InviteRow } from '../lib/invites';
import type { Trip } from '../lib/data';
import InviteCard from '../components/InviteCard';
import { colors, space } from '../theme';
import { toProfileRoom, type Nav } from '../nav';
import { SettingRow } from './profile/rows';
import { TripCard, FirstTrip } from './trips/parts';
import { s } from './trips/styles';

type TripsTab = 'invites' | 'upcoming' | 'past';

type T = ReturnType<typeof useI18n>['t'];

/** What an empty tab says, and the glyph it says it with — the tab's own
 *  subject, in the accent every trip's calendar wears. */
const NONE: Record<TripsTab, { icon: React.ComponentProps<typeof Glyph>['name']; text: (t: T) => string }> = {
  invites: {
    icon: 'mail-outline',
    text: (t) => t(
      'When a friend invites you on a trip, it shows up here',
      'Khi bạn bè rủ bạn đi cùng, lời mời sẽ hiện ở đây',
      '友達に旅程に誘われると、ここに表示されます',
      '朋友邀请你加入行程时，会显示在这里', '朋友邀請你加入行程時，會顯示在這裡',
    ),
  },
  upcoming: {
    icon: 'calendar-outline',
    text: (t) => t(
      'No upcoming trips',
      'Chưa có chuyến đi sắp tới',
      'これからの旅はまだありません',
      '暂无即将到来的行程', '暫無即將到來的行程',
    ),
  },
  past: {
    icon: 'time-outline',
    text: (t) => t(
      'Trips move here once their day is over',
      'Chuyến đi sẽ chuyển vào đây khi đã qua ngày',
      '日付が過ぎた旅程はここに移ります',
      '行程日期过后会移到这里', '行程日期過後會移到這裡',
    ),
  },
};

/**
 * The half the tabs chose: its cards, or the one line an empty tab says.
 *
 * Its own component so the screen reads as what it decides — which tab,
 * when to greet, what the header offers — and this as what each tab draws.
 */
function TabBody({ tab, rail, upcoming, past, people, answering, navigation, onAnswer }: {
  tab: TripsTab;
  rail: { invite: InviteRow; trip: Trip }[];
  upcoming: Trip[];
  past: Trip[];
  people: ReturnType<typeof useCrew>['people'];
  answering: string | null;
  navigation: Nav;
  onAnswer: (tripId: string, said: 'accepted' | 'declined') => void;
}) {
  const { t } = useI18n();
  const list = tab === 'upcoming' ? upcoming : past;
  const shown = tab === 'invites' ? rail.length : list.length;

  // An empty tab is a state of the list, drawn where the list would
  // stand: the card "No upcoming trips" has been since 24 Oct 2026
  // (owner), one quiet line on the trip card's ground, now one per tab.
  // Reached only by choosing it — the greeting never opens on one while
  // another tab has something.
  //
  // No button in it. The way to a new trip is the header's plus, one
  // glance up, and two offers to do one thing read as two things (the
  // rule `FirstTrip` and the pill keep). An invitation is not something
  // the reader can make happen from here, so its line says where one
  // comes from instead; Past's says how a trip gets there.
  if (!shown) {
    return (
      <View style={s.none} testID={`trips-none-${tab}`}>
        <Glyph name={NONE[tab].icon} size={ICON.nav} color={colors.accent} />
        <Text style={s.noneText}>{NONE[tab].text(t)}</Text>
      </View>
    );
  }

  // Oldest first: an invitation is owed rather than news, so the one that
  // has waited longest is the one to answer next.
  if (tab === 'invites') {
    return (
      <>
        {rail.map(({ invite, trip }, i) => (
          <InviteCard
            key={trip.id}
            index={i}
            trip={trip}
            from={people[invite.inviter_id] ?? null}
            busy={answering === trip.id}
            onOpen={() => navigation.navigate('TripInvitation', { id: trip.id })}
            onAnswer={(said) => onAnswer(trip.id, said)}
          />
        ))}
      </>
    );
  }

  // Upcoming soonest first, past most recent first — `splitTrips` sorts.
  return (
    <>
      {list.map((trip, i) => (
        <View key={trip.id} style={s.row}>
          <TripCard
            trip={trip}
            testID={`trip-${tab}-${i}`}
            past={tab === 'past'}
            onPress={() => navigation.navigate('TripDetail', { id: trip.id })}
          />
        </View>
      ))}
    </>
  );
}

/**
 * What else the empty screen offers, under the card that offers a plan.
 *
 * The card alone left three quarters of the screen bare, and bare read
 * as unfinished rather than as calm (owner, 20 Nov 2026). Activity solved
 * the same emptiness with "You could try" and a card of rows, and this is
 * that card, so an empty tab looks like the other empty tabs.
 *
 * The three rows are what a trip is made of, not a tour of the app: the
 * places in it (Explore), the places you already like (your collections,
 * which the planner draws on), and the people you go with — friends are
 * who send the invitations this screen would otherwise be showing.
 * Weighed and left out: sample trips to tap into. Nothing in the catalog
 * holds a ready-made plan, and a hand-written one would date the first
 * time a place in it closed.
 */
function TryNext({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const tabs = navigation.getParent();
  return (
    <>
      <Text style={s.tryHead}>{t('You could try', 'Bạn có thể thử', 'こちらもどうぞ', '你可以试试', '你可以試試')}</Text>
      <Card testID="trips-try">
        <SettingRow
          icon="compass-outline"
          label={t('Explore places', 'Khám phá địa điểm', 'スポットを見る', '探索地点', '探索地點')}
          onPress={() => tabs?.navigate('Explore')}
          testID="trips-try-explore"
        />
        <SettingRow
          icon="bookmark-outline"
          label={t('Save places you love', 'Lưu địa điểm yêu thích', 'お気に入りのスポットを保存', '收藏喜欢的地点', '收藏喜歡的地點')}
          onPress={() => tabs?.navigate('Collections', { screen: 'CollectionsHome', params: { tab: 'yours', at: Date.now() } })}
          testID="trips-try-save"
        />
        <SettingRow
          icon="people-outline"
          label={t('Add friends to plan together', 'Thêm bạn để rủ nhau đi chung', '友達を追加して一緒に計画', '添加好友一起规划', '新增好友一起規劃')}
          onPress={() => toProfileRoom(navigation, 'Crew')}
          last
          testID="trips-try-crew"
        />
      </Card>
    </>
  );
}

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
  // Saving happens in the Ideas stack and an answer arrives from another
  // phone, so both lists are re-read on every focus and on a pull —
  // `lib/usePull` says why, and why the first focus is not skipped.
  const refresh = useKeepCurrent([trips, invites], [trips, invites]);
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
      // The last invitation accepted: the trip it was now lives on
      // Upcoming, so the screen goes there with it rather than leaving
      // the reader in front of an emptied tab. With more still waiting
      // the tab stays — they are the next thing to answer. A decline
      // has nowhere to go.
      if (said === 'accepted' && rail.length === 1) setTab('upcoming');
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

  // ── three tabs, not three headings (owner, 20 Nov 2026) ──
  //
  // The screen was one scroll with "Invitations · 1", "Upcoming · 2" and
  // "Past · 55" as caption headings, and on an account with a long past
  // the invitations and the next trip were the top of a list nobody
  // finished. As tabs, the figures ride on the switch the way they do on
  // Crew, Activity and Collections (`WordTabs`): what waits on an answer
  // is a `count` — news, the accent pill — and how many trips each half
  // holds is a `tally`, a fact in the quiet one. Zero draws no pill.
  //
  // Opened once per visit on the tab that has something in it, and never
  // re-decided under the reader's thumb — the Crew screen's rule:
  // invitations if one is waiting, else what is coming, else what has
  // been. Opening on an empty Upcoming above a full Past would hide the
  // only list there is behind a tap; the missing pill on Upcoming already
  // says why the screen opened where it did.
  const [tab, setTab] = useState<TripsTab>('upcoming');
  const greeted = useRef(false);
  const settled = trips.loaded && invites.loaded;
  useEffect(() => {
    if (greeted.current || !settled || !session) return;
    greeted.current = true;
    if (rail.length) setTab('invites');
    else if (!upcoming.length && past.length) setTab('past');
  // Once, when both reads first land; see above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, session]);

  // Anything to switch between: a trip of their own or one waiting on an
  // answer. A declined invitation's trip is neither.
  const anything = mine.length > 0 || rail.length > 0;

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
      // Only once there is something to switch between. With nothing,
      // `FirstTrip` below is already making the same offer and saying
      // what a trip is for — two
      // invitations to do one thing read as two different things, which is
      // the rule Collections keeps on its own section heading and this
      // screen shipped without.
      //
      // The header's plus (`HeaderAdd`), the one every header that makes
      // something wears.
      right={anything ? (
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

      {/* Above the list rather than in it, as on Crew: the switch stays
          put while the half it chose scrolls. Not drawn while there is
          nothing at all — three empty rooms are the same absence said
          three times, and `FirstTrip` says it once, with the way out. */}
      {trips.loaded && anything && (
        <WordTabs
          tabs={[
            { key: 'invites', label: t('Invites', 'Lời mời', '招待', '邀请', '邀請'), count: rail.length, testID: 'trips-tab-invites' },
            { key: 'upcoming', label: t('Upcoming', 'Sắp tới', 'これから', '即将到来', '即將到來'), tally: upcoming.length, testID: 'trips-tab-upcoming' },
            // "Past", not "Been there": a trip moves here when its day is
            // over, and nothing records that anyone went (UX-10).
            { key: 'past', label: t('Past', 'Đã qua', 'これまで', '已结束', '已結束'), tally: past.length, testID: 'trips-tab-past' },
          ]}
          active={tab}
          onChange={setTab}
        />
      )}

      {trips.loaded && !(tripsFail && trips.data.length === 0) && (
        <ScrollView
          testID={!trips.loading && !trips.fromCache && !trips.error && invites.loaded && !invites.loading && !invites.error ? 'trips-ready' : undefined}
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: space.page, paddingTop: 4, paddingBottom: clearance }}
          showsVerticalScrollIndicator={false}
          refreshControl={refresh}
          onScroll={duckScroll}
          scrollEventThrottle={16}
        >
          {/* "No trips yet" is false while somebody is waiting on an
              answer, and offering to plan a first one would be the app
              talking over an invitation it is already showing. */}
          {!anything && (
            <>
              <FirstTrip onPress={() => navigation.getParent()?.navigate('Ideas')} />
              <TryNext navigation={navigation} />
            </>
          )}

          {anything && (
            <TabBody
              tab={tab}
              rail={rail}
              upcoming={upcoming}
              past={past}
              people={people}
              answering={answering}
              navigation={navigation}
              onAnswer={answer}
            />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
