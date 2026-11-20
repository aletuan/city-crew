// A list's activity — who liked it and who saved a copy of it, all time,
// newest first (owner, 13 Nov 2026). Threads' "Post activity", for a
// collection: the list itself in a small card at the top, then the way
// to its statistics, then one row per act in a card of its own. Opened from "View
// activity ›" at the end of the card's activity row, which any signed-in
// reader is shown (15 Nov 2026).
//
// ── the two fetches, and what they promise ──
//
// The rows come from `likes_on_list` and `copies_of_list`
// (`lib/data/people`, `20261115090000_list_activity_for_readers.sql` and
// `20261115220000_own_like_counted.sql`), asked for the one list through
// `useListActivityOfQuery`, by its owner and by any reader of it. All
// time, and neither has a `limit`. What they leave out: a copy by the
// owner themselves, an act by somebody the owner has blocked, and one by
// somebody the reader and they have a block between. A like taken back
// or a copy deleted is a row gone, as on Activity: the page holds what
// still stands.
//
// The owner's own like is a row (owner, 15 Nov 2026). It was left out
// until then, as Activity leaves it out, and the card in front of this
// page counted it: ♥ 3 on the card, two names here. The number on the
// card is the number of hearts on the page now — but for the blocks
// above, which the card's count does not read.
//
// Until that day the owner's rows came from the RPCs Activity reads,
// `likes_on_mine` and `copies_of_mine` from the epoch: one kept answer
// for every list the owner has, narrowed here. A per-list RPC was the
// alternative written down as rejected, for costing a migration and one
// answer per list; the readers' page (15 Nov) paid for the migration,
// and the owner's own like is what the all-lists answer could not give
// without telling Activity about it too. `actsOn` still narrows by the
// list's id: a no-op on these rows, kept because a kept answer under the
// wrong key should draw nothing rather than another list's people.
//
// The one cap that can apply is not in the repo: PostgREST's "Max rows"
// on the live project (1,000 by default on Supabase), now on one list's
// rows rather than on all of an owner's. Not measured on the live
// project.
//
// ── the wait, and where it went (owner, 13 Nov 2026) ──
//
// The page opened on a spinner that stood visibly long. Read off the code
// as it was, the waterfall was:
//
//   tap → mount → the two RPCs, side by side → the faces (`profiles` by
//   handle, `useCuratorAvatarsQuery`), which could not be asked until the
//   rows said whose
//
// — two round trips one after the other, the first not starting until
// the screen had mounted, and both paid again on every open: nothing was
// kept. Not timed on a device; the shape is what the code did.
//
// Now:
//
//   - The faces ride the rows. Each row carries the actor's `avatar_url`
//     and id from the same join that gave its handle
//     (`20261113150000_activity_rows_carry_face`), so the second round
//     trip is gone: one round trip, the two RPCs side by side.
//   - That one round trip starts on the collection page, when the owner
//     opens their own list (`usePrefetchListActivityOf` there), not on
//     the tap. By the time "View activity" is pressed it has usually
//     landed. A reader's starts with the tap.
//   - The answer is kept (`useSharedFetch`): in memory for the app's
//     life, so this page's first render draws it; and on the phone, so
//     the first open after a launch draws the last launch's. Every open
//     still asks again behind what it shows, and a tap made while the
//     collection page's ask is in flight waits for that one rather than
//     sending another.
//
// So the spinner is drawn only when nothing at all is known — a first
// ever open, on a phone with no cache, faster than the prefetch. How long
// the one round trip takes was not measured either; what changed is how
// many there are and when they start.
//
// ── whoever can open the list ──
//
// The list is looked up where its own page finds it (`useReadableList`):
// the reader's own, one lent to them, or the public shelf. Until 15 Nov
// 2026 it was looked up among your own alone. A list found nowhere — one
// you have just deleted, opened from a stale screen — reads as a list
// with nothing on it: the empty state, no card, no fetch.
//
// ── the way to the statistics (owner, 13 Nov 2026) ──
//
// One row between the list's card and the people: "Statistics ›"
// ("Thống kê ›"), with the bar-chart glyph, opening the list's own page
// of figures (`CollectionStatsScreen`): opens, likes, copies and trips,
// all time and the last seven days. It is drawn for any list of yours
// with an id, whatever the people below say — a list nobody has liked
// can still have been opened and planned from, so "nothing here" on this
// page is not "nothing there". The figures are asked for as this page
// opens (`usePrefetchCollectionStats`), so the tap lands on them.
//
// It replaced, the same day, the two counts that stood here — "♡ Likes
// N ›" and "⧉ Copies N ›", Threads' pair — and the filter they worked:
// a tap narrowed the people to one kind, a second widened them again.
// The counts are on the Statistics page now, beside the two figures
// this page could never show (opens and trips have no people to list),
// and counted by the same rules (`collection_stats` leaves out what the
// feeds leave out), so the two pages agree. The filter went with them:
// without the counts it had nothing to stand on, and the badge on each
// face already says which kind a row is. The people are always all of
// them, newest first.
//
// ── the people, in a card ──
//
// The rows sit in one card, as the Crew screen's friends do: the card,
// the hairline between rows across the card's width, and Crew's row
// padding and gap. The row's content is as it was — the face with the
// kind on its corner, the name on top and "@handle · age" under it.
//
// A `ScrollView` and a `Card`, not the `FlatList` the page had: a card is
// one View around its rows, and a FlatList's rows are cells it mounts
// and unmounts on its own, which cannot sit inside one. Crew draws its
// friends the same way. The cost is that every row mounts at once —
// the RPCs' cap (above) bounds it, and an owner's one list is not
// measured anywhere near it. Rejected: each cell drawing its own piece
// of the card's edge (a top with its corners, sides, a bottom with its
// corners) — four styles imitating `Card` rather than using it, and a
// hairline that has to know which cell is last.
//
// ── what a row does ──
//
// The row itself, nothing. The app has no page for a person — the
// collection card's own curator head says so: "there is no public
// profile screen to open" — and the one sheet about a person
// (`PersonSheet`) is a menu of acts, each wired by the screen that opens
// it, not a profile. Opening it here would put Block on every liker,
// which is a decision about the feature and not this page's to make.
// VoiceOver reads who and what as one line, and the button beside it as
// a control of its own: an accessible row would swallow it.
//
// At its right end, the friend button (owner, 13 Nov 2026), from the
// crew the app already holds (`useCrew`) and the actor's id the row now
// carries — `rowButton` decides:
//
//   - Friends: the quiet outline, "Friends". A state, not a control.
//   - No relation: "Add friend", which sends the request at once, shows
//     "Requested" before the server has answered, reads the crew again,
//     and says so in an Alert if it failed (and goes back to "Add
//     friend"). No confirmation, as Crew's suggestions have none: the ask
//     is silent and withdrawable.
//   - You asked: the outline "Requested", inert. Cancelling is Crew's,
//     behind its sheet; a second way to do it here would be a second
//     place to explain it.
//   - They asked you: "Accept", which accepts as Crew's Accept does, with
//     the same optimism and the same Alert.
//   - Blocked, yourself, or nobody behind the row: no button.
//
// Crew's looks, value for value, for the states it has: its "Add"
// suggestion pill (the glass, the person glyph) for Add friend — quiet,
// because a page of likers is a page of these and the owner made Crew's
// quiet for exactly that (26 Oct 2026); its Cancel / Unblock outline for
// Friends and Requested — the outline, with its word a step quieter
// than Crew's (`textTertiary`, 13 Nov 2026): Crew's outline is a press
// (Cancel, Unblock), these two are states nobody can press, and on a
// page of friends four of five rows wore one, as loud as the names.
// Its Accept's gradient for Accept, the one that answers somebody
// waiting. Each at `CHIP_H`, 44 to the thumb with
// `CHIP_SLOP`. The styles are restated here, not imported: the button
// scale's check reads a button's face from the file's own `s`, and a
// style borrowed from another screen's sheet would be a button it
// cannot see.
//
// The words: "Kết bạn", "Đã gửi" (Crew's "Sent"), "Bạn bè", and
// "Đồng ý", Crew's own word for Accept (owner, 13 Nov 2026): one answer
// to a friend request, one word for it, wherever the request is met.
// Rejected: "Chấp nhận", which named the act on a row about a like that
// carries no "… muốn kết bạn với bạn" above it. Two words for one button
// read as two different things.
//
// ── states, as Activity has them ──
//
// Loading is the accent spinner under the card, and only while either
// half has nothing at all to show — neither a kept answer nor a fresh
// one. A refresh behind a kept answer draws no spinner: the rows are
// there, and they change in place if the answer did. Nothing to show is
// a state with a heading and one sentence, whatever the list is now —
// public, Friends or Private. A failure that leaves nothing to show says
// so, with Try again; one of the two failing while the other has rows
// still shows the rows, and a refresh that fails behind kept rows keeps
// them.
//
// ── a pull (owner, 13 Nov 2026) ──
//
// Pulling the page down asks both halves again and reads the crew again
// (`crew.ships`). The crew is the friend buttons' half of the page: a
// "Requested" the other person has accepted since went on saying
// "Requested" here until the provider next asked on its own — a return
// to the app after two minutes away (`lib/crew`), or a visit to Crew. The
// rows stay on the page through it, by the rule above (a refresh behind
// a kept answer draws no spinner), and change in place when the answers
// land; one that fails keeps them. The spinner is the pull's alone — see
// `pulling` — and stays lit until all three have settled.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Glyph, ICON } from '../components/ui/glyph';
import {
  Avatar, Card, EmptyState, GradientCta, PressableScale, Screen, useTabBarClearance,
} from '../components/ui';
import { useFriendButtons } from '../components/FriendButton';
import ListSummaryCard from '../components/ListSummaryCard';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useListActivityOfQuery, usePrefetchCollectionStats } from '../lib/data';
import { normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { actsOn, type ListAct } from '../lib/listActivity';
import { actAgeOf, ageWord } from '../lib/listAge';
import { useReadableList } from '../lib/readableList';
import { useScheme } from '../lib/theme';
import { bgHex, colors, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

export default function CollectionActivityScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'CollectionActivity'>;
}) {
  const { t, lang } = useI18n();
  // The list, wherever the reader holds it: their own, one lent to them,
  // or a public one — whoever can open the list opens this page (owner,
  // 15 Nov 2026).
  const { col, me, owned, loading: finding } = useReadableList(route.params.slug);
  // Any list of yours with an id has something to ask about, public or
  // not (see the header). A row from the launch cache may have none.
  const listId = col?.id ?? null;

  // The list's answer, kept and shared — see the header. One question for
  // the owner and for a reader (15 Nov 2026, `useListActivityOfQuery`):
  // the same rows but for a block between the reader and whoever acted.
  // Nobody to ask about without a list with an id: no fetch, and the
  // empty state.
  const activity = useListActivityOfQuery(me, listId);
  // The figures "Statistics ›" opens, asked for now — see the header.
  usePrefetchCollectionStats(me && listId ? me : null, listId);
  const { likes, copies } = activity;
  const acts = useMemo(
    () => (listId ? actsOn(listId, likes.data, copies.data) : []),
    [listId, likes.data, copies.data],
  );
  // Both halves or neither, as before: the copies that came first wait
  // for the likes, so a row never lands above one that arrives a beat
  // later. `loaded` is true from a kept answer as from a fresh one.
  //
  // And with nothing on the page, a half that has never had an answer
  // (`loadedAt` null: it failed, and nothing was kept) turns while it is
  // asked again. That is Try again: the failure clears as the retry goes
  // out, and without this the page would say "No likes or copies yet"
  // until the answer came — a claim, made while the question was still
  // open. A kept answer, even an empty one, is an answer: it is drawn,
  // and its refresh draws no spinner.
  const asking = (f: Pick<typeof likes, 'loaded' | 'loading' | 'loadedAt'>) =>
    !f.loaded || (f.loading && f.loadedAt === null);
  const loading = acts.length > 0
    ? !likes.loaded || !copies.loaded
    : asking(likes) || asking(copies);
  // Either half failing; said only when nothing is there to show.
  const failed = !!likes.error || !!copies.error;

  // The friend buttons — see the header, and `useFriendButtons`, where
  // they have lived since the person's page needed the same one (16 Nov
  // 2026).
  const { friendButton, crew } = useFriendButtons(me, 'activity');

  // The pull — see the header. The spinner belongs to the pull, as on the
  // collection page: armed by the gesture, disarmed when what it asked
  // for settles, and never lit by the ask every open makes behind a kept
  // answer, nor by the crew's own return-to-app refresh. A half already
  // in flight is joined, not asked twice (`useSharedFetch`); the crew's
  // fetch is not so careful — a reload starts over and drops the answer
  // on its way — so one already out is left to land, and the spinner
  // waits for it as for its own.
  const busy = likes.loading || copies.loading || crew.ships.loading;
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !busy) setPulling(false);
  }, [pulling, busy]);
  const pull = () => {
    setPulling(true);
    activity.reload();
    if (!crew.ships.loading) crew.ships.reload();
  };

  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
  // The badge's ring is the page's own ground, and a ring is a border:
  // a dynamic colour on a border flattens against the phone's appearance
  // rather than the app's, so it is resolved here (`bgHex`).
  const { scheme } = useScheme();
  const ring = { borderColor: bgHex[scheme] };

  /** A like's or a copy's age, by the card head's table (`ageWord`), with
   *  Activity's "just now" where a list says "New" — see `lib/listAge`. */
  const ageOf = (iso: string) =>
    ageWord(actAgeOf(iso, new Date()), lang, t, t('now', 'Vừa xong', 'たった今', '刚刚', '剛剛'));

  // The list, in a small card — `ListSummaryCard`.
  const card = col ? <ListSummaryCard col={col} owned={owned} onPerson={(handle) => navigation.navigate('Person', { handle })} testID="activity-list" /> : null;

  // The way to the statistics — see the header. Yours with an id only:
  // the figures are the owner's, and a launch-cache row has nothing to
  // ask about.
  //
  // A well of the accent's tint, not a card (owner, 16 Nov 2026): it was a
  // card like the two it stands between, and only its chevron said it
  // opens something. The tint is the place page's "add a photo" offer
  // (`LocalGuidePanel`) — a way to somewhere else on a fill, the facts
  // around it on paper — so the two pages say one thing with it. Glyph,
  // word and chevron in the accent, as that offer's are. Every colour is
  // the palette's, so it follows the look chosen in the profile.
  //
  // No disc behind the glyph (owner): the offer's holds a logo, and this
  // row is one line that a 44pt disc would make the tallest thing on the
  // page. Nor is one needed — computed over all 21 palettes, the accent
  // on the composited tint runs from 4.14:1 (paper) to 8.61:1 (honey),
  // where a graphical mark needs 3:1.
  //
  // Known and shared with the offer, not fixed here: the tint is nearly
  // the page's own ground on two palettes (1.05:1 on plum, 1.09:1 on
  // paper), where the well is told from the page by its shape alone.
  const statsLink = listId ? (
    <View style={s.well}>
      <PressableScale
        onPress={() => navigation.navigate('CollectionStats', { slug: route.params.slug })}
        haptic="selection"
        contentStyle={s.link}
        accessibilityRole="button"
        testID="activity-stats-link"
      >
        <Glyph name="stats-chart-outline" size={LINK_GLYPH} color={colors.accent} />
        <Text style={s.linkLabel}>{t('Statistics', 'Thống kê', '統計', '统计', '統計')}</Text>
        <Glyph name="chevron-forward" size={LINK_CHEVRON} color={colors.accent} />
      </PressableScale>
    </View>
  ) : null;

  const someone = t('Someone', 'Ai đó', '誰か', '有人', '有人');
  const row = (item: ListAct, index: number) => {
    /* Who, handle first (owner, 15 Nov 2026): the handle on top, bare and
       in the strong ink, with the age beside it; the real name under it,
       quieter. Threads' order, and the app's — Crew's rows turned the
       same day, so one person is not "hado / Ha Do" here and "Ha Do /
       @hado" a screen away. That mismatch is what had this order taken
       back on 13 Nov, the day it first shipped, with Crew's kept; the
       owner chose it again and for both. No `@`: at the head of a row
       the first line is the handle, and nothing needs telling apart.
       With no handle the name stands there; with neither, "someone". */
    const handle = item.handle ? normalizeHandle(item.handle) : '';
    const top = handle || item.name || someone;
    const under = handle && item.name ? item.name : '';
    const when = ageOf(item.at);
    const did = item.kind === 'like'
      ? t('Liked', 'Đã thích', 'いいね', '点赞', '按讚')
      : t('Saved a copy', 'Đã lưu bản sao', 'コピーを保存', '保存了副本', '儲存了副本');
    const face = (
      <View style={s.face}>
        {/* The face off the row itself — see the header. */}
        <Avatar url={item.avatar} size={ROW_FACE} />
        <View style={[s.badge, ring, item.kind === 'like' ? s.badgeLike : s.badgeCopy]} testID={`activity-badge-${item.kind}`}>
          <Glyph
            name={item.kind === 'like' ? 'heart' : 'copy'}
            size={BADGE_GLYPH}
            color={item.kind === 'like' ? LIKE_INK : colors.accentInk}
          />
        </View>
      </View>
    );
    return (
      <View
        key={`${item.kind}-${item.at}-${item.handle ?? ''}-${index}`}
        style={[s.row, index > 0 && s.rowDivider]}
        testID="activity-row"
      >
        <View
          style={s.who}
          accessible
          // What the badge says by its shape is said in words, since
          // VoiceOver cannot see the heart.
          accessibilityLabel={[top, under, did, when].filter(Boolean).join(', ')}
          testID="activity-who"
        >
          {/* Who, and what they did on the face's corner — Activity's
              arrangement, at Threads' sizes. */}
          {/* The face opens their page (16 Nov 2026) — `PersonScreen`.
              Not for somebody with no handle: there is no page to open.
              Known and not solved here: the group around it is one
              element to VoiceOver, so this press is not reachable by
              it; Crew's row, which is a button, is the way there. */}
          {handle ? (
            <PressableScale
              onPress={() => navigation.navigate('Person', { handle })}
              haptic="selection"
              testID="activity-open-person"
            >
              {face}
            </PressableScale>
          ) : face}
          <View style={s.lines}>
            {/* The age beside the handle, on its line, whether or not a
                name stands under it. */}
            <View style={s.lineOne}>
              <Text style={s.handle} numberOfLines={1}>{top}</Text>
              <Text style={s.when}>{when}</Text>
            </View>
            {under ? <Text style={s.name} numberOfLines={1}>{under}</Text> : null}
          </View>
        </View>
        {friendButton(item.id)}
      </View>
    );
  };

  /** The button at a row's right end, or none — see the header. */
  const emptyTitle = t('No likes or copies yet', 'Chưa có lượt thích hay bản sao nào', 'まだいいねやコピーはありません', '还没有点赞或复制', '還沒有按讚或複製');
  const state = finding ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} />
  ) : !listId ? (
    // Not yours, gone, or a row from the launch cache with no id to ask
    // about: nothing to show, said as nothing yet rather than as a fault.
    <EmptyState icon="heart" title={emptyTitle} body={waitBody(t)} testID="activity-empty" />
  ) : loading ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} testID="activity-loading" />
  ) : acts.length > 0 ? null : failed ? (
    // "Activity", not "your activity" as the Activity tab says of its own
    // page (15 Nov 2026): a reader who is not the owner opens this one, and
    // the English alone called the list's activity theirs.
    <EmptyState
      icon="cloud-offline"
      title={t("Couldn't load activity", 'Không tải được hoạt động', 'アクティビティを読み込めませんでした', '无法加载动态', '無法載入動態')}
      body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络连接后重试。', '請檢查網路連線後重試。')}
      testID="activity-failed"
    >
      <GradientCta
        icon="refresh"
        label={t('Try again', 'Thử lại', '再試行', '重试', '重試')}
        onPress={activity.reload}
        testID="activity-retry"
      />
    </EmptyState>
  ) : (
    <EmptyState icon="heart" title={emptyTitle} body={waitBody(t)} testID="activity-empty" />
  );

  const drawn = !loading && acts.length > 0;
  return (
    <Screen
      title={t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')}
      onBack={() => navigation.goBack()}
      backTestID="activity-back"
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
        {card}
        {statsLink}
        {state}
        {drawn ? <Card style={s.group} testID="activity-people">{acts.map(row)}</Card> : null}
      </ScrollView>
    </Screen>
  );
}

type T = (en: string, vi: string, ja: string, zh?: string, hant?: string) => string;

/** A list nobody has acted on yet: Activity's sentence, for one list. */
const waitBody = (t: T) => t(
  'When someone likes or copies this collection, you will see it here.',
  'Khi có người thích hay sao chép bộ sưu tập này, bạn sẽ thấy ở đây.',
  'このコレクションにいいねやコピーがあると、ここに表示されます。',
  '有人点赞或复制这个合集时，会显示在这里。', '有人按讚或複製這個合集時，會顯示在這裡。',
);

/** A row's face: 40 (owner, 13 Nov 2026), the size the collection
 *  card's head gives a face with two lines beside it, for the reason
 *  written there — Facebook and X draw 40 — and the two lines here stand
 *  about its height. */
const ROW_FACE = 40;
/** The statistics row's glyph: a control's step, leading a 15pt label
 *  on a row of its own. It was 17 until the scale (`ICON`, 18 Nov 2026);
 *  the two counts this row replaced led with it too. */
const LINK_GLYPH = ICON.action;
/** Its chevron: 15, as "View activity ›" draws it beside its words. */
const LINK_CHEVRON = ICON.text;
/** The badge's glyph: Activity's 11, a mark rather than an icon to tap. */
const BADGE_GLYPH = ICON.tiny;
/** The badge's ring of page: 2, enough to cut the disc off the face it
 *  overlaps, where Activity's hairline sat on a card and needed none. */
const RING = 2;
/** The disc a like wears. Not a palette token: none of the twenty is a
 *  like's red — `accent` is the coral the copy disc wears (and the liked
 *  heart on the card), `bad` means destructive. The value was picked by
 *  eye beside the owner's Threads reference, not read off it; what was
 *  measured is its glyph's contrast (`LIKE_INK`), which holds on every
 *  look because the disc is one value on all of them. */
const LIKE_RED = '#FF3040';
/** White on `LIKE_RED`: 3.65:1, over the 3:1 a graphic needs. The near-
 *  black `accentInk` would reach 5.07, but a heart on a red disc is white
 *  everywhere a reader has met one. */
const LIKE_INK = '#FFFFFF';

const s = StyleSheet.create({
  content: { paddingHorizontal: space.page },
  spinner: { marginTop: 20 },
  // The people's card: the page's gap under it.
  group: { marginBottom: space.cardGap },
  // The statistics row's well — see `statsLink`. The card's corner and the
  // page's gap, the accent's tint for a ground, and no rim.
  well: { backgroundColor: colors.accentSoft, borderRadius: radius.card, marginBottom: space.cardGap },
  // The statistics row: Crew's row padding, glyph and word at the left,
  // the chevron pushed to the right by the word's `flex` — the counts'
  // row it replaced, value for value.
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  linkLabel: { color: colors.accent, fontSize: 15, fontWeight: font.semibold, flex: 1 },
  // Crew's row inside its card, value for value: 14 between the face,
  // the words and the button, the card's padding at either end, 13 above
  // and below. Centred: a face beside two lines wants its middle on
  // theirs.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  // Crew's hairline, across the card's width.
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  // The face and the words, which VoiceOver reads as one line; it gives
  // the button its width and takes the rest.
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  face: { width: ROW_FACE, height: ROW_FACE },
  // Activity's 20pt badge on its face's corner, hung a hair past it so it
  // reads as pinned on, with a ring of the page instead of a hairline.
  badge: {
    position: 'absolute', right: -3, bottom: -3,
    width: 20, height: 20, borderRadius: 10, borderWidth: RING,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeLike: { backgroundColor: LIKE_RED },
  // The accent as a surface, and what sits on it: `accentFill` and
  // `accentInk`, 6.79:1.
  badgeCopy: { backgroundColor: colors.accentFill },
  lines: { flex: 1, gap: 2 },
  lineOne: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  // The handle gives when it is long; the age never does.
  handle: { color: colors.text, fontSize: 15, fontWeight: font.semibold, flexShrink: 1 },
  when: { color: colors.textTertiary, ...type.meta, flexShrink: 0 },
  // The name under a handle: the third step, as the age beside the
  // handle, and as Crew's name under a handle (15 Nov 2026).
  name: { color: colors.textTertiary, ...type.meta },

});
