// What a person has shared, on their page: what they did, newest first.
//
// ── activity, where the grid was (owner, 17 Nov 2026) ──
//
// The page ended in a grid of the person's public collections, two to a
// row. It is a feed now, one card a collection (`ActivityCard`), each
// headed by what the person did and when. The plan this is the first
// step of is `docs/collection-feed-plan.md`: the page,
// and after it the community's collections, turn into a feed in which a
// collection is the thing every interaction hangs on.
//
// One thing a person can have done, for now: created a collection. So
// today the feed is the grid's own collections in the grid's own order,
// each a card the width of the page with its description and a heart. It
// needs no new table — a collection's `created_at` and its likes were
// already here — and that is why it is the first step.
//
// A second thing since 24 Nov 2026: they checked in somewhere. A visit
// is a card of its own, about the place (`person/CheckinAct`), in the
// same column and ordered with the lists by day (`person.actsOn`) —
// handed in drawn (`visitCard`), so this file stays about the column.
//
// ── the grid, kept for two days and then gone (owner, 19 Nov 2026) ──
//
// It was kept beside the feed at first, on this argument: a feed is for
// reading and a grid is for finding. One curator has 24 public
// collections; at a card each that is some 8,000pt of scrolling to reach
// the oldest, where the grid showed six to a screen. So the heading
// carried a count on its right — "24 collections" — and pressing it
// turned the section into the grid, with "Activity" there to turn it
// back.
//
// It went in two steps the same morning. First on your own page, where
// the count gave its place to a way to Account (since 20 Nov 2026 the
// gear in the header, `person/Tools`): the grid
// of your own lists is the Collections tab's "Yours" over again. Then on
// everybody else's, so the two pages are one page: a section that turned
// into something else for a visitor and not for its owner was two
// designs, and the count with nothing to open would have been a figure
// the head had already given up (16 Nov 2026).
//
// What that costs is the argument above, and it still stands: somebody
// else's oldest list is at the end of the feed and nowhere nearer. The
// feed adds five as it is scrolled, so it is reachable; it is not quick.
// If that is felt, the answer to weigh first is a search of a person's
// lists, not the grid back.
//
// The tile went with it (`ListTile`, a cover 108pt tall over a title, a
// mark's glyph and "8 places · 2 likes"). It is in this file's history.
//
// ── five at a time, added before the reader reaches them ──
//
// The feed draws `PAGE` cards, and `PAGE` more each time the reader
// comes within a screen and a half of the end of them (`lib/feed`,
// `useReach`). Every card is a photograph the page's width, and the
// screen is a scroll view, not a list that recycles: all 24 at once is
// 24 decodes for a reader who came to see who this is.
//
// For a morning the next five came from a "Show more" under the fifth.
// The owner, the same afternoon: a feed loads as you go. The button is
// still drawn under the last card while there are more — a reader who
// reaches it before a scroll event has (a page barely longer than the
// screen, a switch control) has a way on — but a scroll gets there
// first.
//
// The collections are already in memory (the shelf is loaded whole), so
// "loading" here is drawing: there is nothing to wait for and no
// spinner. What does arrive late is a photograph, so the covers of the
// next `PAGE` are prefetched into memory as each batch is drawn, and
// the cards read them from there (`ActivityCard`'s cache policy).
//
// Not a recycling list, and not pages from the server: both are step 2
// of the plan, where the feed is the community's and has no end. Here
// the longest page is 24 cards.
//
// ── not only public ones (owner, 17 Nov 2026, the same evening) ──
//
// The page holds what this reader may open (`person.listsOn`): every
// list of your own on your own page, and on a friend's the lists they
// shared with you beside their public ones. A card says who sees it (`marks`): the globe, a padlock, two heads and how
// many, or two heads and "Shared with you" — every card, a public one
// too since the next morning (`person.seenOn`). A list shared with friends has its heart, for them and
// for its owner (`shares.likeable`); a private one shows the likes it
// kept as a figure, as on its own page.
//
// ── the heart ──
//
// The collection's own like, wired as the shelf wires it: signed out,
// the tap is the invitation to sign in; signed in, the provider owns the
// write and the optimistic count, so a like made here shows everywhere.
// A row from a launch cache with no id cannot be liked and draws none.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, type NativeScrollEvent, type NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import ActivityCard, { type ActivityMark, type CardCopy } from '../../components/ActivityCard';
import { Card, fireHaptic, GradientCta, PressableScale, SECONDARY_CONTROL_H } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { agoLabel } from '../../lib/ago';
import { useLikes } from '../../lib/catalog';
import type { PersonCheckin } from '../../lib/checkin';
import { nearEnd } from '../../lib/feed';
import type { Collection, FriendProfile } from '../../lib/data';
import { atHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import { actsOn, type ListSeen } from '../../lib/person';
import { useSaveActions } from '../../lib/save';
import { SEEN_GLYPH, seenName } from '../../lib/shares';
import { colors, font, space, type } from '../../theme';
import { useCardComments } from './useCardComments';

/** No visits, the same array every render: `actsOn` is memoised on it. */
const NO_VISITS: PersonCheckin[] = [];

/** How many cards the feed draws at first, and adds at each "Show more". */
export const PAGE = 5;

/**
 * The page's scroll, as a count of the times the reader has come near
 * the end of what is drawn — the number `Shared` adds cards on.
 *
 * Once for each height the page has had: scroll events arrive sixty a
 * second and every one of them near the end would be "near the end", so
 * a reach is counted when the content's height is one it has not been
 * counted at. Five more cards make the page taller; if the reader is
 * still near the end of that, it counts again.
 */
export function useReach() {
  const [reach, setReach] = useState(0);
  const countedAt = useRef(-1);
  return {
    reach,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const at = e.nativeEvent;
      if (!nearEnd(at) || countedAt.current === at.contentSize.height) return;
      countedAt.current = at.contentSize.height;
      setReach((n) => n + 1);
    },
  };
}

type T = ReturnType<typeof useI18n>['t'];

/**
 * A list's mark, in the card's terms: the glyph, the word beside it when
 * there is one, and what VoiceOver says.
 *
 * On your own page the glyph stands alone, as it does under your handle
 * on the list's own page — with the number of friends after the two
 * heads, the figure its Share button carries. On somebody else's page
 * the two heads would say "shared" and not with whom, so the words are
 * there: "Shared with you".
 */
export function marks(seen: ListSeen, t: T): ActivityMark {
  // The globe alone, on anybody's page: what it is on the list's own.
  if (seen.kind === 'public') return { icon: SEEN_GLYPH.public, label: seenName('public', t) };
  if (seen.kind === 'private') return { icon: SEEN_GLYPH.private, label: seenName('private', t) };
  if (seen.kind === 'friends') {
    return { icon: SEEN_GLYPH.friends, text: String(seen.n), label: `${seenName('friends', t)}, ${seen.n}` };
  }
  const lent = t('Shared with you', 'Được chia sẻ với bạn', 'あなたと共有', '与你共享', '與你共享');
  return { icon: SEEN_GLYPH.friends, text: lent, label: lent };
}

/**
 * Your own page with nothing on it: no collection, made or copied, and
 * no visit. The first thing a new reader's own page says to them.
 *
 * ── what it says (owner, 28 Nov 2026) ──
 *
 * "Start your page", the two things that put something on it, and a
 * button for each. It said "No collections yet — Your collections will
 * show here" with one outlined pill, "Create your first collection",
 * from 21 Nov: written when this page was a page of lists. It is a feed
 * of visits and lists now, a visit is the easier first thing to do, and
 * the card said nothing of it; and the sentence described the empty
 * place rather than asking for anything.
 *
 * The first button is `GradientCta`, the app's one filled button. On 21
 * Nov that was turned down for an outlined pill — "a second gradient
 * there would outweigh the face and the cover above it". On the owner's
 * screenshot of a new account the pill read as a secondary control on
 * the one screen where it is the only thing to do, and there is no
 * first gradient on this page for it to be second to. The second is
 * words in the accent, the secondary control's 44 tall: it leaves the
 * page (Explore, where a place to check in at is found), and two filled
 * buttons side by side are a choice with no answer.
 *
 * Still "none yet" and not "none public": your own page draws every
 * list of yours, the private ones with their padlock. Rejected on 21
 * Nov and still: a second state, "See your collections ›", for a reader
 * whose lists are all private — that reader's page shows them.
 */
function FirstOfYours({ onCreate, onExplore }: { onCreate: () => void; onExplore: () => void }) {
  const { t } = useI18n();
  return (
    <Card style={s.none} testID="person-no-lists">
      <Text style={s.noneTitle}>{t('Start your page', 'Bắt đầu trang của bạn', 'あなたのページを始めましょう', '开始你的主页', '開始你的主頁')}</Text>
      <Text style={s.noneBody}>
        {t(
          'Check in at a place or save a few into a collection. They show up here.',
          'Check-in một địa điểm hoặc lưu vài nơi vào bộ sưu tập. Chúng sẽ hiện ở đây.',
          'スポットにチェックインするか、いくつかをコレクションに保存しましょう。ここに表示されます。',
          '在一个地点打卡，或把几个地点存进合集。它们会显示在这里。', '在一個地點打卡，或把幾個地點存進合集。它們會顯示在這裡。',
        )}
      </Text>
      <View style={s.firstRow}>
        <GradientCta icon="add" label={t('Create a collection', 'Tạo bộ sưu tập', 'コレクションを作る', '创建合集', '建立合集')} onPress={onCreate} testID="person-first-list" />
        <PressableScale
          onPress={onExplore}
          scaleTo={0.96}
          haptic="selection"
          accessibilityRole="button"
          contentStyle={s.second}
          testID="person-first-visit"
        >
          <Glyph name="location-outline" size={ICON.text} color={colors.accent} />
          <Text style={s.secondText}>{t('Find a place to check in', 'Tìm chỗ để check-in', 'チェックインする場所を探す', '找个地方打卡', '找個地方打卡')}</Text>
        </PressableScale>
      </View>
    </Card>
  );
}

export default function Shared({ me, person, lists, visits = NO_VISITS, visitCard, holding, seenOf, coverFor, onOpen, onComments, copyOf, reasonOf, missed, reach = 0, onCreate, onExplore, finding = false }: {
  me: string | null;
  person: FriendProfile;
  /** The collections this reader may see here, newest first
   *  (`person.listsOn`). */
  lists: Collection[];
  /** The visits this reader may see here, newest first, and the card
   *  for one — `person/CheckinAct`. In the same column as the lists, by
   *  day (`person.actsOn`). */
  visits?: PersonCheckin[];
  visitCard?: (v: PersonCheckin) => React.ReactNode;
  /** The visits have not answered yet: nothing of the column is drawn,
   *  so that they do not land among lists already on the page
   *  (`useVisitCards`, which also says for how long at most). */
  holding?: boolean;
  /** Who can see each (`person.seenOn`). */
  seenOf: (c: Collection) => ListSeen;
  coverFor: (c: Collection) => string | undefined;
  onOpen: (c: Collection) => void;
  /** Opens a collection's thread of comments — `useCardComments`. */
  onComments?: (c: Collection) => void;
  /** A card's copy button (`useCardCopy`), or none. */
  copyOf?: (c: Collection) => CardCopy | undefined;
  /** While the page is searched (`person/Find`): why a card is there,
   *  in its line's place — "Là Việt Coffee · 1 of 4 places" — or null
   *  for the count it always says. */
  reasonOf?: (c: Collection) => string | null;
  /** Words were typed and nothing answers them: the empty card says
   *  that, not that there are no lists. */
  missed?: boolean;
  /** How many times the reader has come near the page's end (`useReach`). */
  reach?: number;
  /** Opens the form on a new collection: your own page, with none. */
  onCreate: () => void;
  /** Your own empty page's second way to begin: to Explore. */
  onExplore: () => void;
  /** The page is being searched (`person/Find`). A page with nothing on
   *  it then draws nothing under the box: on the owner's screenshot of
   *  28 Nov 2026 "Start your page" and its two buttons stood under
   *  "Search your collections", an invitation in answer to a question. */
  finding?: boolean;
}) {
  const { t, lang } = useI18n();
  const { likes, myLikes, toggleLike } = useLikes();
  const { askToSignIn } = useSaveActions();
  const [shown, setShown] = useState(PAGE);

  // What they did, lists and visits in one column — `person.actsOn`.
  const acts = useMemo(() => actsOn(lists, visits), [lists, visits]);
  const drawn = acts.slice(0, shown);

  // A new reach: five more, while there are more.
  const counted = useRef(reach);
  useEffect(() => {
    if (reach === counted.current) return;
    counted.current = reach;
    setShown((n) => (n < acts.length ? n + PAGE : n));
  }, [reach, acts.length]);

  // The covers of the cards that would be added next, on their way into
  // memory before they are asked for. A string, so the effect runs when
  // the set changes and not on every render that builds a new array.
  const ahead = acts.slice(shown, shown + PAGE)
    .map((a) => (a.kind === 'list' ? coverFor(a.list) : a.visit.place.cover)).filter(Boolean).join(' ');
  useEffect(() => {
    if (ahead) Image.prefetch(ahead.split(' '), 'memory-disk').catch(() => {});
  }, [ahead]);

  const placesWord = (n: number) => (n === 1
    ? t('1 place', '1 địa điểm', '1か所', '1 个地点', '1 個地點')
    : t(`${n} places`, `${n} địa điểm`, `${n}か所`, `${n} 个地点`, `${n} 個地點`));

  const heart = (c: Collection) => {
    if (!me) { askToSignIn('like'); return; }
    fireHaptic('light');
    void toggleLike({ id: c.id as string, slug: c.slug });
  };

  // What each card shows of its thread, for the cards drawn — nothing,
  // with the switch off.
  const talkOf = useCardComments(
    drawn.flatMap((a) => (a.kind === 'list' ? [a.list] : [])), (c) => seenOf(c).kind === 'public', (c) => localized(c, 'title', lang), onComments,
  );

  const listCard = (c: Collection) => (
    <ActivityCard
      key={c.slug}
      testID="person-act"
      face={person.avatar_url}
      who={person.full_name || atHandle(person.handle)}
      did={t(' created a collection', ' đã tạo bộ sưu tập', 'さんがコレクションを作成', ' 创建了合集', ' 建立了合集')}
      when={c.created_at ? agoLabel(c.created_at, Date.now(), lang, t) : undefined}
      mark={marks(seenOf(c), t)}
      title={localized(c, 'title', lang)}
      uri={coverFor(c)}
      meta={reasonOf?.(c) ?? placesWord(c.collection_places.length)}
      desc={localized(c, 'desc', lang)}
      liked={!!c.id && myLikes.includes(c.id)}
      likes={likes[c.slug] ?? 0}
      onOpen={() => onOpen(c)}
      onHeart={c.id && seenOf(c).kind !== 'private' ? () => heart(c) : undefined}
      {...talkOf(c)}
      copy={copyOf?.(c)}
    />
  );

  const none = acts.length === 0;
  return (
    <>
      {holding ? (
        <ActivityIndicator color={colors.accent} style={s.wait} testID="person-activity-wait" />
      ) : missed ? (
        <Card style={s.none} testID="person-find-none">
          <Text style={s.noneTitle}>
            {t('Nothing found', 'Không tìm thấy', '見つかりませんでした', '没有找到', '沒有找到')}
          </Text>
          <Text style={s.noneBody}>
            {t(
              'Try the name of a place, or of a collection.',
              'Thử tên một địa điểm, hoặc tên bộ sưu tập.',
              'スポット名かコレクション名で試してください。',
              '试试地点名或合集名。', '試試地點名或合集名。',
            )}
          </Text>
        </Card>
      ) : none && finding ? null : none && me && person.id === me ? (
        <FirstOfYours onCreate={onCreate} onExplore={onExplore} />
      ) : none ? (
        <Card style={s.none} testID="person-no-lists">
          <Text style={s.noneTitle}>
            {t('No public collections yet', 'Chưa có bộ sưu tập công khai', '公開コレクションはまだありません', '还没有公开的合集', '還沒有公開的合集')}
          </Text>
          <Text style={s.noneBody}>
            {t(
              'When they share a collection, it will show here.',
              'Khi họ chia sẻ một bộ sưu tập, nó sẽ hiện ở đây.',
              'コレクションが公開されると、ここに表示されます。',
              '对方分享合集后，会显示在这里。', '對方分享合集後，會顯示在這裡。',
            )}
          </Text>
        </Card>
      ) : (
        <View style={s.feed} testID="person-activity">
          {drawn.map((a) => (a.kind === 'visit' ? visitCard?.(a.visit) : listCard(a.list)))}
          {acts.length > shown ? (
            <PressableScale
              onPress={() => setShown((n) => n + PAGE)}
              haptic="selection"
              contentStyle={s.more}
              accessibilityRole="button"
              testID="person-show-more"
            >
              <Text style={s.moreText}>{t('Show more', 'Xem thêm', 'もっと見る', '查看更多', '檢視更多')}</Text>
            </PressableScale>
          ) : null}
        </View>
      )}
    </>
  );
}

/** The section's distance from what stands above it: the heading's. */
const TOP = 22;

const s = StyleSheet.create({
  // Where the first card's reason line will be: the page's own spinner
  // stands 20 under the head (`PersonScreen`'s `spinner`), and so does this.
  wait: { marginTop: 20 },
  // No heading over the feed since 20 Nov 2026 (owner). "Activity" stood
  // here in the small capitals the place page heads a fact with, with a
  // count and then "Account ›" on its right; once the gear took the
  // latter (`person/Tools`) it was a word alone over cards that each say
  // what was done ("… created a collection"). Should the feed ever hold
  // two kinds to choose between — lists and check-ins — the answer to
  // weigh is tabs, not the word back. The feed keeps the heading's 22
  // from what stands above it.
  feed: { gap: space.cardGap, marginTop: TOP },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  moreText: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  none: { padding: space.cardPadding, gap: 6, marginTop: TOP },
  noneTitle: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  noneBody: { color: colors.textSecondary, ...type.meta },
  // Your own empty card's two ways to begin (`FirstOfYours`): 10 under
  // the sentence (with the card's 6, 16 in all), side by side, and the
  // second under the first on a phone too narrow for both.
  firstRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4, marginTop: 10 },
  // Words and a mark in the accent, the secondary control's 44 tall.
  second: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: SECONDARY_CONTROL_H },
  secondText: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },
});
