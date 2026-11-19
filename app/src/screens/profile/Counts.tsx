// Your four counts — Collections, Check-ins, Friends, Trips — each a door
// into the place that holds it.
//
// ── where they stand (owner, 19 Nov 2026) ──
//
// Under the hero of the Account page until P2 of
// docs/profile-home-plan.md; on your own person page now, wherever it
// opens, under the head and over the requests waiting. Yours to see: a
// visitor to your page sees it as before. The doors to Check-ins and
// Friends, rooms only the last tab's stack has, go through
// `toProfileRoom`, which changes tab when it has to. Not on Account any
// more: a figure said on two pages is two copies to keep agreeing.

import { Text, View } from 'react-native';
import { fireHaptic, PressableScale } from '../../components/ui';
import { useSession } from '../../lib/auth';
import { visitSummary } from '../../lib/checkin';
import { useMyCheckins } from '../../lib/checkins';
import { useCrew } from '../../lib/crew';
import { splitFriendships } from '../../lib/friends';
import { useI18n } from '../../lib/i18n';
import { useMyTrips } from '../../lib/mytrips';
import { useMyLists } from '../../lib/save';
import { goTo, toProfileRoom, type Nav } from '../../nav';
import { s } from './styles';

/**
 * One number and its word, a door into the tab that holds them.
 *
 * `null` is "not known yet", and it is drawn as a dash, never as 0. The
 * tiles used to read `data.length` straight off fetches still in flight,
 * so a reader with 11 lists, 48 places and 55 trips signed in to three
 * zeros — the same figures an empty account shows, and read as one
 * (UX-14, 17 Oct 2026). A zero here is now only ever an answer.
 */
export function StatTile({ n, label, onPress }: { n: number | null; label: string; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <PressableScale
      scaleTo={0.96}
      style={{ flex: 1 }}
      contentStyle={s.stat}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={n === null
        ? `${label}, ${t('loading', 'đang tải', '読み込み中', '加载中', '載入中')}`
        : `${n} ${label}`}
    >
      <Text style={[s.statN, n === null && s.statPending]}>{n ?? '—'}</Text>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

export function Counts({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useSession();
  const mine = useMyLists();
  // The visits — the app's one copy, so a check-in made a moment ago on
  // a place's screen is already in this count.
  const visits = useMyCheckins();
  // Sorted by the pure half in lib/friends; the fetch itself is scoped by
  // RLS to edges this account is on.
  const { ships } = useCrew();
  const friends = splitFriendships(ships.data, session?.user?.id ?? '').friends.length;
  const trips = useMyTrips();

  // The four doors. Each is a count the reader made and a
  // tap into the place that holds it — a number on a profile earns its place
  // only as a door (the ring already says "how far"; these say "how many"
  // and "where"). A tab navigator is the parent when the screen is in the
  // app; the root ref is the way out when it is not, naming each tab's
  // first screen (see the guest link's note on `getParent()?.`).
  //
  // To the tab's list, at its top, every time — not to wherever the tab
  // was last left. A bare `navigate(tab)` restored that tab's stack, so
  // "48 Saved places" opened whichever collection the reader had been in
  // (UX-09, 17 Oct 2026): a door whose room depended on history. `pop`
  // closes what was open above the list — React Navigation 7's
  // `navigate` no longer goes back to a screen already in the stack on
  // its own — `at` is a fresh param the list reads as "scroll to the
  // top", and Collections is aimed at Yours, the half these counts are of.
  //
  // Collections and Trips are tabs, and hop. Check-ins and Friends are
  // pages pushed over your page (`Visited`, `Crew`), the pages Account's
  // rows open too.
  // The four fetches behind them, for the one line that says a count
  // could not be loaded and the one press that asks again.
  const counts = [mine, visits, ships, trips];
  const hop = (tab: 'Collections' | 'Trips', first: 'CollectionsHome' | 'TripsHome') => {
    fireHaptic('selection');
    const at = Date.now();
    const params = {
      screen: first,
      params: tab === 'Collections' ? { tab: 'yours', at } : { at },
      pop: true,
    };
    const parent = navigation.getParent();
    if (parent) parent.navigate(tab, params);
    else goTo(tab, params);
  };

  return (
    <>
      {/* Bare numbers over a hairline, not boxed tiles: four filled boxes
          beside a title read as a second toolbar (the desk learned this in
          #634), where the number alone is the thing being read. No review
          count: there is no review feature, and a count with no data
          behind it is the one number that must not appear.

          Collections, Check-ins, Friends, Trips (owner, 16 Nov 2026). It
          was Collections, Saved places, Trips. "Saved places" went: the
          places are the ones in the collections beside it — a detail of
          that number, not a fourth thing — and it had no door of its
          own, opening the same list Collections does. The one other
          place for it, Places filtered to saved, shows one city where
          the number counts every city. The figure still sets the level
          (`saved`, below the ring); it is only not drawn.

          Check-ins and Friends took the room: each is a thing the reader
          did and each has a page that lists exactly what is counted —
          `Visited` spans every city, as its number does. They were
          numbers at the ends of their rows further down, and a figure
          said twice on one page is one of them wasted, so those rows
          keep their words and lose their pills. Four short words fit
          where three with a long one did. */}
      <View style={s.stats}>
        <StatTile n={mine.loaded ? mine.data.length : null} label={t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')} onPress={() => hop('Collections', 'CollectionsHome')} />
        <View style={s.statDivider} />
        {/* Distinct places, not visits: three evenings at one bar is one
            place been to — the figure the row below carried. */}
        <StatTile n={visits.loaded ? visitSummary(visits.data).places : null} label={t('Check-ins', 'Check-in', 'チェックイン', '打卡', '打卡')} onPress={() => toProfileRoom(navigation, 'Visited')} />
        <View style={s.statDivider} />
        <StatTile n={ships.loaded ? friends : null} label={t('Friends', 'Bạn bè', '友達', '好友', '好友')} onPress={() => toProfileRoom(navigation, 'Crew')} />
        <View style={s.statDivider} />
        <StatTile n={trips.loaded ? trips.data.length : null} label={t('Trips', 'Chuyến đi', 'トリップ', '行程', '行程')} onPress={() => hop('Trips', 'TripsHome')} />
      </View>
      {/* A dash that stays a dash is a question the screen cannot answer,
          and it says so — only for a count still unknown: a fetch that
          fails over figures already on screen (a cached copy) leaves
          those standing, and they are not wrong enough to interrupt. */}
      {counts.some((c) => !c.loaded && c.error) ? (
        <View style={s.statsFailed} testID="stats-failed">
          <Text style={s.statsFailedText}>
            {t("Couldn't load your counts.", 'Không tải được số liệu.', '件数を読み込めませんでした。', '无法加载统计数据。', '無法載入統計資料。')}
          </Text>
          <PressableScale
            onPress={() => counts.forEach((c) => { if (!c.loaded) c.reload(); })}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text style={s.statsRetry}>{t('Try again', 'Thử lại', '再試行', '重试', '重試')}</Text>
          </PressableScale>
        </View>
      ) : null}
    </>
  );
}
