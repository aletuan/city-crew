// Activity — a log of what happened between you and other people on City
// Crew over the last two weeks, in one timeline: who liked or copied your
// collections, whose collections you liked or copied, and who became your
// friend, whichever of you asked. A row about a list opens it and wears
// the chevron that says so; one on a list that is gone opens nothing and
// wears none, and a friendship row opens the other person's page
// (`activity/ActivityRows` says why).
//
// ── a log, not only news (owner, 28 Oct 2026) ──
//
// Until then this was news only: what others did with your lists. The
// owner widened it to your own acts too, and kept the two weeks. It holds
// what still stands: a like taken back, a copy deleted, a friendship
// ended or a request declined left no row to read, and so leave no line.
// Profile's count on the way in still counts only what others did — news
// is the part worth a number.
//
// Friend requests waiting are here as a row, not as an inbox. They
// lived here once, as a REQUESTS section above the timeline with the
// same Accept and Decline as the Requests tab on Your crew — the same
// list in two places — and the owner took them out on 20 Oct 2026; Crew
// has been the inbox since #309. They came back on 20 Nov 2026 (owner:
// one bell — every piece of news for you is in the bell, and a request
// is in its figure): first a few hours as your own page's card, then
// the same day as one row at the head of "For you" (`requestRow` in
// `activity/ActivityRows`) — who is asking, and the way to Crew, where
// each is answered.
//
// Your own plans are not here. An UPCOMING section carried the nearest
// trip for a day (6–7 Oct 2026) and went: by then the same fact was on
// the Trips tab's dot, in the morning notification and on the Trips
// screen, and this copy — the deepest, one line, and showing one trip
// when there were two on the day — was the only one telling it wrong.
//
// The applause comes through `likes_on_mine`, which names every liker
// to the one person allowed to ask — the owner of the list. "Someone
// liked…" survives only as the fallback for a liker whose profile is
// gone. See the named_applause migration for why the owner is not
// "the public" that the likes table's privacy promise protects against.
//
// ── empty (owner, 25 Oct 2026) ──
//
// Nothing to show was one grey sentence, and a failed load was the same
// sentence: both fetches answered a failure with an empty list, so a
// reader offline was told nobody had liked anything. Now the three are
// apart. Empty is a state with a heading and the one step that would
// end it, which depends on what the reader has: no collections — make
// one; only private ones — only a public list can be liked or copied, so
// say so and open the shelf where the switch is; a public one already —
// nothing to do but wait, so no button. Under it, three ways into the
// rest of the app ("You could try"), in the Profile stack's own rows.
// A failure that leaves nothing to show says so, with Try again; one
// half failing while the other has news still shows the news.
//
// ── a pull (owner, 13 Nov 2026) ──
//
// The timeline used to move only on Try again, and Try again starts from
// nothing: it empties the three halves, so the whole page turns into the
// spinner while they are asked. That is right for a page that failed,
// which has nothing to keep; for a page showing rows it would trade them
// for a spinner, so a pull is a different ask:
//
//   - Nothing is emptied. The rows on the page stay, and the three
//     answers are swapped in together once all three have settled — one
//     change, not three, so a row never lands above one that arrives a
//     beat later (the list's Activity page waits for both its halves for
//     the same reason).
//   - A half that fails keeps the rows it had. A timeline that was
//     showing is never blanked by a pull, and a pull that fails over the
//     empty state leaves the empty state: an answer, even "nothing",
//     stands until a newer one replaces it.
//   - Failure is kept per half (`broken`) and means "this half's last
//     word was a failure, with nothing before it to keep". A first load
//     or Try again that fails sets it; a pull that fails leaves it as it
//     was (so a page that failed still says so, and one that had
//     answered still does not), and a pull that answers clears it. The
//     failed state is still said only when nothing at all is there to
//     show.
//   - The crew is read again too (`crew.ships`): the friendships that
//     began are this timeline's third source.
//   - A pull while the first load or Try again is still out sends nothing
//     of its own: those answers are as fresh, and the spinner waits for
//     them. Try again, or a change of reader, while a pull is out drops
//     the pull's answers whole when they land — the newer ask owns the
//     page.
//
// The window moves with the pull: each ask, a first load, Try again or a
// pull, opens the two weeks at its own now (`windowStart`), and `since`
// takes the new instant in the same change that swaps the answers in —
// not when the pull starts — because the friendships are cut at `since`
// on the page and must be cut at the instant the three fetches were. A
// half kept through a failed pull was asked under an older window, so
// the timeline is cut at `since` as well: what that half kept from
// before the new window opened leaves with the rest. Rejected: keeping
// the window where the page first opened. The page is "the last two
// weeks", and a phone left on it across a day would come to show
// fifteen.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { AuthHeader, AuthScreen } from '../components/authUi';
import { Card, EmptyState, GradientCta } from '../components/ui';
import { ActivityGroups, handleOf } from './activity/ActivityRows';
import { SettingRow } from './profile/rows';
import { useSession } from '../lib/auth';
import { windowStart } from '../lib/activityWindow';
import { agoLabel } from '../lib/ago';
import { activityGroups } from '../lib/commentNews';
import { useCollections } from '../lib/catalog';
import {
  fetchApplause, fetchCopies, fetchMyActs, type MyActs, useCuratorAvatarsQuery, useMyCollections,
} from '../lib/data';
import { useCrew } from '../lib/crew';
import { type ActivityItem, type Applause, buildActivity, type Copy, friendsMade, splitFriendships } from '../lib/friends';
import { useFreshNews } from '../lib/freshNews';
import { useI18n } from '../lib/i18n';
import { colors, type } from '../theme';
import type { Nav } from '../nav';

/** One of the three fetches the timeline is built from. */
type Half = 'applause' | 'copies' | 'acts';

export default function ActivityScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const mine = useMyCollections(me);
  const cols = useCollections();

  const [applause, setApplause] = useState<Applause[] | null>(null);
  const [copies, setCopies] = useState<Copy[] | null>(null);
  // The reader's own side: the likes given and copies saved.
  const [acts, setActs] = useState<MyActs | null>(null);
  // Friendships come with the crew, already loaded for Profile.
  const crew = useCrew();
  // The halves whose last word was a failure with nothing to keep — see
  // the header. Said only when nothing came back at all.
  const [broken, setBroken] = useState<readonly Half[]>([]);
  const failed = broken.length > 0;
  // Bumped by Try again, to run the fetches once more, over two weeks
  // opened at that moment.
  const [attempt, setAttempt] = useState(0);
  // Where the two weeks open for what is on the page, so the friendships,
  // read from the crew, are cut at the same instant as the three fetches
  // were asked — set by whichever ask the rows came from (see the header).
  const [since, setSince] = useState(() => windowStart(new Date()));
  // Which ask owns the page: bumped by the first load and Try again, and
  // read by a pull's answers before they touch anything.
  const owner = useRef(0);
  useEffect(() => {
    owner.current += 1;
    if (!me) { setApplause([]); setCopies([]); setActs(NO_ACTS); return; }
    const from = windowStart(new Date());
    setSince(from);
    setApplause(null);
    setCopies(null);
    setActs(null);
    setBroken([]);
    const fail = (half: Half) => setBroken((b) => [...b, half]);
    // Each half on its own: the feed shows what it could get, and a
    // dropped likes call does not take the copies with it.
    fetchApplause(from).then(setApplause).catch(() => { fail('applause'); setApplause([]); });
    // The same window: a copy is news for as long as a like is.
    fetchCopies(from).then(setCopies).catch(() => { fail('copies'); setCopies([]); });
    fetchMyActs(me, from).then(setActs).catch(() => { fail('acts'); setActs(NO_ACTS); });
  }, [me, attempt]);

  const earlier = useMemo<ActivityItem[]>(
    // Cut at `since`, which a fresh answer already is: what this does is
    // take out of a half kept through a failed pull the rows the window
    // has moved past — see the header.
    () => buildActivity(applause ?? [], copies ?? [], acts ?? NO_ACTS, me ? friendsMade(crew.ships.data, me, since) : [])
      .filter((it) => it.at >= since),
    [applause, copies, acts, crew.ships.data, me, since],
  );

  // The faces, by handle: the same lookup the bylines use, because a
  // liker need not be a curator and need not be a friend, so neither the
  // catalog's faces nor the crew's cover everyone here. One batched ask
  // for every actor on the screen; a handle with no face gets the blank
  // disc, as does a like whose liker is unnamed.
  // What happened to the reader in comments — the page's fourth source,
  // and not asked here: the app holds one copy (`lib/freshNews`), which
  // the tab's dot and the bell read as well, so the page cannot show a
  // reply the dot has not heard of. So it is not one of the halves
  // above: a failure of it is not said, the page simply has no comment
  // rows; and a pull asks it again beside them.
  const { news } = useFreshNews();
  // Two groups, what is for the reader above what the reader did — see
  // `lib/commentNews`.
  const groups = useMemo(() => activityGroups(earlier, news.data, since), [earlier, news.data, since]);
  const nothing = groups.forYou.length + groups.yours.length === 0 && !(me && splitFriendships(crew.ships.data, me).incoming.length);

  const actors = useMemo(
    () => earlier.map((it) => handleOf(it, crew.people) ?? '').filter(Boolean),
    [earlier, crew.people],
  );
  const faces = useCuratorAvatarsQuery(actors);

  // A collection id is what the applause carries; the title and the slug
  // are what the row needs. Both shelves are searched — the liked list is
  // yours, but "yours" spans the desk shelf and your own. One lookup for
  // both, so a row with a title always has somewhere to go.
  const theirs = acts?.lists ?? [];
  const collectionOf = (collectionId: string) =>
    [...mine.data, ...cols.data, ...theirs].find((c) => c.id === collectionId) ?? null;

  // The words for "how long ago" are `lib/ago`'s, shared with a person's
  // page since 17 Nov 2026.
  const ago = (iso: string): string => agoLabel(iso, Date.now(), lang, t);

  // Only the three fetches the timeline is built from; the crew's
  // friendships join it when they land.
  const loading = applause === null || copies === null || acts === null || !news.loaded;

  // The pull — see the header. The spinner belongs to the pull, as on the
  // collection page: armed by the gesture, disarmed when what it waits on
  // settles — its own three fetches, the crew, or a first load already
  // out — and never lit by the crew's own return-to-app refresh. The
  // crew's fetch starts over on a reload and drops the answer on its way,
  // so one already out is left to land rather than asked again.
  const [pulling, setPulling] = useState(false);
  const [asking, setAsking] = useState(false);
  const busy = asking || loading || crew.ships.loading || news.loading;
  useEffect(() => {
    if (pulling && !busy) setPulling(false);
  }, [pulling, busy]);
  const pull = () => {
    setPulling(true);
    if (!crew.ships.loading) crew.ships.reload();
    if (!news.loading) news.reload();
    if (!me || loading || asking) return;
    setAsking(true);
    const mine = owner.current;
    const from = windowStart(new Date());
    void Promise.allSettled([fetchApplause(from), fetchCopies(from), fetchMyActs(me, from)])
      .then(([a, c, m]) => {
        setAsking(false);
        if (owner.current !== mine) return;
        setSince(from);
        if (a.status === 'fulfilled') setApplause(a.value);
        if (c.status === 'fulfilled') setCopies(c.value);
        if (m.status === 'fulfilled') setActs(m.value);
        const got: Record<Half, PromiseSettledResult<unknown>> = { applause: a, copies: c, acts: m };
        setBroken((b) => b.filter((h) => got[h].status === 'rejected'));
      });
  };

  // The other tabs, which this screen's stack does not hold. A tab's own
  // first screen needs no `initial: false`; the form, which is not
  // Collections' first, does — see `goTo`.
  const tabs = navigation.getParent();
  const toCollections = (tab: 'yours' | 'community') =>
    tabs?.navigate('Collections', { screen: 'CollectionsHome', params: { tab, at: Date.now() } });
  const hasPublic = mine.data.some((c) => c.is_public);

  const empty = (
    <>
      <EmptyState
        icon="heart"
        title={t('No activity yet', 'Chưa có hoạt động nào', 'まだアクティビティはありません', '还没有动态', '還沒有動態')}
        body={mine.data.length > 0 && !hasPublic
          ? t(
            'Only public collections can be liked or copied — yours are all private for now.',
            'Chỉ bộ sưu tập công khai mới được thích hay sao chép — các bộ sưu tập của bạn đều đang để riêng tư.',
            'いいねやコピーができるのは公開コレクションだけです — あなたのリストは今すべて非公開です。',
            '只有公开的合集才能被点赞或复制 — 你的合集目前都是私密的。', '只有公開的合集才能被按讚或複製 — 你的合集目前都是私密的。',
          )
          : t(
            'When someone likes or copies one of your collections, you will see it here.',
            'Khi có người thích hay sao chép bộ sưu tập của bạn, bạn sẽ thấy ở đây.',
            'あなたのコレクションにいいねやコピーがあると、ここに表示されます。',
            '有人点赞或复制你的合集时，会显示在这里。', '有人按讚或複製你的合集時，會顯示在這裡。',
          )}
        testID="activity-empty"
      >
        {mine.data.length === 0 ? (
          <GradientCta
            icon="add"
            label={t('Create your first collection', 'Tạo bộ sưu tập đầu tiên', '最初のコレクションを作る', '创建你的第一个合集', '建立你的第一個合集')}
            onPress={() => tabs?.navigate('Collections', { screen: 'CollectionForm', initial: false })}
            testID="activity-create"
          />
        ) : !hasPublic ? (
          <GradientCta
            icon="bookmark"
            label={t('See your collections', 'Xem bộ sưu tập của bạn', 'あなたのコレクションを見る', '查看你的合集', '檢視你的合集')}
            onPress={() => toCollections('yours')}
            testID="activity-yours"
          />
        ) : null}
      </EmptyState>
      <Text style={s.head}>{t('You could try', 'Bạn có thể thử', 'こちらもどうぞ', '你可以试试', '你可以試試')}</Text>
      {/* The glyphs these offers already wear elsewhere: the compass on
          Collections' "Explore places", the globe on a public list, the
          bookmark of the Collections tab. */}
      <Card testID="activity-try">
        <SettingRow
          icon="compass-outline"
          label={t('Explore places', 'Khám phá địa điểm', 'スポットを見る', '探索地点', '探索地點')}
          onPress={() => tabs?.navigate('Explore')}
          testID="activity-try-explore"
        />
        <SettingRow
          icon="globe-outline"
          label={t('Browse community collections', 'Xem bộ sưu tập cộng đồng', 'みんなのコレクションを見る', '浏览社区合集', '瀏覽社群合集')}
          onPress={() => toCollections('community')}
          testID="activity-try-community"
        />
        <SettingRow
          icon="bookmark-outline"
          label={t('Save places you love', 'Lưu địa điểm yêu thích', 'お気に入りのスポットを保存', '收藏喜欢的地点', '收藏喜歡的地點')}
          onPress={() => toCollections('yours')}
          last
          testID="activity-try-save"
        />
      </Card>
    </>
  );

  return (
    <AuthScreen onRefresh={pull} refreshing={pulling}>
      {/* The chevron without its disc (owner, 12 Nov 2026), the second
          screen after the friends one to try it. */}
      <AuthHeader backBare compactTitle onBack={() => navigation.goBack()} title={t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')} />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : nothing && failed ? (
        <EmptyState
          icon="cloud-offline"
          title={t("Couldn't load your activity", 'Không tải được hoạt động', 'アクティビティを読み込めませんでした', '无法加载动态', '無法載入動態')}
          body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络连接后重试。', '請檢查網路連線後重試。')}
          testID="activity-failed"
        >
          <GradientCta
            icon="refresh"
            label={t('Try again', 'Thử lại', '再試行', '重试', '重試')}
            onPress={() => setAttempt((n) => n + 1)}
            testID="activity-retry"
          />
        </EmptyState>
      ) : nothing ? (
        empty
      ) : (
        <ActivityGroups
          groups={groups}
          people={crew.people}
          faces={faces.data}
          collectionOf={collectionOf}
          ago={ago}
          navigation={navigation} me={me}
        />
      )}
    </AuthScreen>
  );
}

/** Nothing done yet, or nothing to read: the shape a failed fetch leaves. */
const NO_ACTS: MyActs = { likes: [], copies: [], lists: [] };

const s = StyleSheet.create({
  // The Profile stack's section heading (`profile/styles`' `section`).
  head: { color: colors.text, ...type.section, marginTop: 10 },
});
