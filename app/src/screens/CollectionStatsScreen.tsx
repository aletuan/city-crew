// A list's statistics, for its owner (owner, 13 Nov 2026): four figures —
// Views, Likes, Copies, Trips — each its all-time total large and the
// last seven days small under it. Opened from "Statistics ›" on the
// list's Activity page, which only the owner reaches.
//
// ── what each figure counts ──
//
// The function's rules (`collection_stats`, in
// `20261113160000_collection_stats.sql`), not this page's:
//
//   - Views: every open of the list's page, anybody's — the owner's own,
//     a guest's, a second the same day (`useCountView`). Kept as a number
//     per list per day, never who.
//   - Likes and Copies: what the Activity page lists, counted — the
//     owner's own and anybody the owner blocked left out — so this page
//     and that one cannot disagree.
//   - Trips: trips saved from "Start from what you love" with this list
//     ticked, the owner's own included, while they still exist. Counting
//     began with that migration; an older trip has no source to count.
//
// "Last 7 days" is the instant a week ago for likes, copies and trips,
// and for views — which keep only a day — today and the six days before
// it on Vietnam's calendar. The line under each figure says "7 days" and
// nothing finer: the difference is the hours of today already past.
//
// No line under the grid (owner, 13 Nov 2026). There was one, saying
// views and trips include the owner's own and likes and copies do not,
// on the reasoning that a new list's first opens are its owner's and
// "Views 3" should not leave anyone guessing whose. The owner took it
// off: four figures and a footnote about how two of them are counted is
// the footnote read every visit to explain a rule learned once.
//
// ── the asking ──
//
// Kept and shared (`useCollectionStatsQuery`, `useSharedFetch`), and
// asked for as the Activity page opens (`usePrefetchCollectionStats`), so
// the tap usually lands on figures already drawn; every open still asks
// again behind them. The states are the Activity page's: the spinner only
// while nothing at all is known, a failure with nothing to show said with
// Try again, kept figures kept through a failed refresh.
//
// ── a pull (owner, 13 Nov 2026) ──
//
// Pulling the page down asks for the four figures again, as the list's
// Activity page and the collection page reload on a pull: a figure that
// moved while the page stood open — somebody's like, somebody's open —
// waited for Back and a second visit. The figures stay drawn through it: a refresh of a kept answer
// is not "nothing known", so the rule above draws no spinner of its own,
// and the tiles change in place when the answer lands. One that fails
// keeps them, as any failed refresh does. The pull asks nothing that the
// collection page's open would count: only that page records a view.
//
// ── only the owner ──
//
// The list is looked up among your own (`useMyLists`), as on the Activity
// page, and asked about only then. The function answers nobody else
// anyway: no row, which `statsOf` reads as null — a list deleted or no
// longer yours since the page opened — and the page says nothing is
// counted rather than inventing four zeros.
//
// ── nothing yet ──
//
// A list with nothing counted at all says so in a sentence, as the
// Activity page's empty state does, instead of four tiles reading 0. One
// figure above zero and all four tiles are drawn, the zeros with them:
// a 0 beside a 3 is information.
//
// ── the tiles ──
//
// Two by two, each a `Card`: its glyph and label on top, the total in the
// display face, and the week under it. A stat tile's contract — a label,
// a value, a qualifier — with no colour carrying meaning: the figures
// wear text ink, and the glyph is identity, never a reading. Not
// pressable: there is nowhere further to go from a number, and the
// people behind the likes and copies are one Back away.
//
// The total is set at 30, `type.title`'s size, the app's largest type
// (picked off the scale, not measured on a device). A narrow phone fits
// six digits in a tile's width at that size by arithmetic — 375pt less
// the page's two 22s, the 14 between the tiles and each tile's two 16s,
// 133pt, over Space Grotesk's digit at about 0.6em, 18pt — so a figure
// longer than that shrinks to its line (`adjustsFontSizeToFit`) rather
// than wrapping or being cut. Grouped by the reader's language
// (`groupDigits`), never compacted: it is the curator's own number.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Glyph, type GlyphName } from '../components/ui/glyph';
import { Card, EmptyState, GradientCta, Screen, useTabBarClearance } from '../components/ui';
import ListSummaryCard from '../components/ListSummaryCard';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useSession } from '../lib/auth';
import { useCollectionStatsQuery } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { type Figure, groupDigits, nothingCounted, type StatKind, statsOf } from '../lib/listStats';
import { useMyLists } from '../lib/save';
import { colors, display, font, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

export default function CollectionStatsScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'CollectionStats'>;
}) {
  const { t, lang } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const mine = useMyLists();
  const col = mine.data.find((c) => c.slug === route.params.slug) ?? null;
  const listId = col?.id ?? null;

  // Nobody or no list asks nothing (`useCollectionStatsQuery`).
  const q = useCollectionStatsQuery(me, listId);
  const stats = statsOf(q.data);
  // Asking, and nothing known: no kept answer and no fresh one, or Try
  // again out after a failure that left nothing — the Activity page's rule.
  const loading = !q.loaded || (q.loading && q.loadedAt === null);
  // The pull's spinner is the pull's, as on the collection page: armed by
  // the gesture, disarmed when the fetch settles, and never lit by the
  // ask every open makes behind kept figures. A pull while that ask is
  // still out joins it (`useSharedFetch` sends one request per key), so
  // the spinner waits for the answer already coming.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !q.loading) setPulling(false);
  }, [pulling, q.loading]);
  const pull = () => { setPulling(true); q.reload(); };

  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();

  const nothingTitle = t('Nothing counted yet', 'Chưa có gì để đếm', 'まだ数字はありません', '还没有数据', '還沒有資料');
  const nothingBody = t(
    'When someone opens this collection, likes it, copies it or starts a trip from it, you will see it here.',
    'Khi có người mở, thích, sao chép bộ sưu tập này hay bắt đầu một chuyến đi từ nó, bạn sẽ thấy ở đây.',
    'このコレクションが開かれたり、いいねやコピー、旅程の出発点にされたりすると、ここに表示されます。',
    '有人打开、点赞、复制这个合集，或从它开始行程时，会显示在这里。', '有人開啟、按讚、複製這個合集，或從它開始行程時，會顯示在這裡。',
  );
  const nothing = <EmptyState icon="stats-chart-outline" title={nothingTitle} body={nothingBody} testID="stats-empty" />;

  const LABEL: Record<StatKind, string> = {
    views: t('Views', 'Lượt xem', '閲覧', '浏览', '瀏覽'),
    likes: t('Likes', 'Lượt thích', 'いいね', '点赞', '按讚'),
    copies: t('Copies', 'Bản sao', 'コピー', '副本', '副本'),
    trips: t('Trips', 'Chuyến đi', '旅程', '行程', '行程'),
  };
  const week = (n: string) => t(`Last 7 days: ${n}`, `7 ngày qua: ${n}`, `過去7日間: ${n}`, `过去 7 天：${n}`, `過去 7 天：${n}`);

  const tile = (k: StatKind, f: Figure) => {
    const total = groupDigits(f.total, lang);
    const recent = groupDigits(f.week, lang);
    return (
      <Card key={k} style={s.tile} testID={`stats-${k}`}>
        <View
          style={s.tileInner}
          // One line to VoiceOver, as it reads on the tile.
          accessible
          accessibilityLabel={`${LABEL[k]}, ${total}, ${week(recent)}`}
          testID={`stats-${k}-figure`}
        >
          <View style={s.tileHead}>
            <Glyph name={GLYPH[k]} size={TILE_GLYPH} color={colors.accent} />
            <Text style={s.label} numberOfLines={1}>{LABEL[k]}</Text>
          </View>
          <Text style={s.total} numberOfLines={1} adjustsFontSizeToFit testID={`stats-${k}-total`}>{total}</Text>
          <Text style={s.week} numberOfLines={1} testID={`stats-${k}-week`}>{week(recent)}</Text>
        </View>
      </Card>
    );
  };

  const body = !col && mine.loading ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} />
  ) : !listId ? (
    // Not yours, gone, or a launch-cache row with no id: nothing to ask.
    nothing
  ) : loading ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} testID="stats-loading" />
  ) : stats === null && q.error ? (
    <EmptyState
      icon="cloud-offline"
      title={t("Couldn't load the statistics", 'Không tải được thống kê', '統計を読み込めませんでした', '无法加载统计', '無法載入統計')}
      body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络连接后重试。', '請檢查網路連線後重試。')}
      testID="stats-failed"
    >
      <GradientCta
        icon="refresh"
        label={t('Try again', 'Thử lại', '再試行', '重试', '重試')}
        onPress={q.reload}
        testID="stats-retry"
      />
    </EmptyState>
  ) : stats === null || nothingCounted(stats) ? (
    nothing
  ) : (
    <View style={s.grid} testID="stats-grid">
      <View style={s.gridRow}>{tile('views', stats.views)}{tile('likes', stats.likes)}</View>
      <View style={s.gridRow}>{tile('copies', stats.copies)}{tile('trips', stats.trips)}</View>
    </View>
  );

  return (
    <Screen
      title={t('Statistics', 'Thống kê', '統計', '统计', '統計')}
      onBack={() => navigation.goBack()}
      backTestID="stats-back"
      backBare
      compactTitle
    >
      <ScrollView
        onScroll={duckScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[s.content, { paddingBottom: tabClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} />}
      >
        {col ? <ListSummaryCard col={col} testID="stats-list" /> : null}
        {body}
      </ScrollView>
    </Screen>
  );
}

/** Each figure's mark: the open eye, the Activity page's heart and copy
 *  mark, and the trips tab's calendar (drawn from the line set). */
const GLYPH: Record<StatKind, GlyphName> = {
  views: 'eye-outline',
  likes: 'heart-outline',
  copies: 'duplicate-outline',
  trips: 'calendar-outline',
};
/** The label's glyph: 15, the size "View activity ›" sets beside 15pt words. */
const TILE_GLYPH = 15;

const s = StyleSheet.create({
  content: { paddingHorizontal: space.page },
  spinner: { marginTop: 20 },
  // Two rows of two, the page's card gap between them both ways.
  grid: { gap: space.cardGap },
  gridRow: { flexDirection: 'row', gap: space.cardGap },
  // Half the row each, at the card's own padding. 6 between the label,
  // the figure and the week: chosen, not measured on a device — between
  // `space.nameToMeta`'s 4, which is for a name and the line under it,
  // and the 10 a row of controls takes.
  tile: { flex: 1 },
  tileInner: { padding: space.cardPadding, gap: 6 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.textSecondary, ...type.meta, fontWeight: font.semibold, flexShrink: 1 },
  total: { color: colors.text, fontSize: type.title.fontSize, fontFamily: display.bold, fontVariant: ['tabular-nums'] },
  // The caption size the trip screens set their small lines at (13).
  week: { color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
});
