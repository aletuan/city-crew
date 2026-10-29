// Activity — a log of what happened between you and other people on City
// Crew over the last two weeks, in one timeline: who liked or copied your
// collections, whose collections you liked or copied, and who became your
// friend, whichever of you asked. A row about a list opens it and wears
// the chevron that says so; one on a list that is gone opens nothing and
// wears none, and a friendship row is a line to read.
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
// Friend requests waiting are still not here. They lived here once, as a REQUESTS section above
// the timeline with the same Accept and Decline as the Requests tab on
// Your crew — the same list in two places, and on Profile the same
// request counted twice, as the dot on Connect with friends and inside
// Activity's number. The owner took them out on 20 Oct 2026; Crew has
// been the inbox since #309, and nothing but Profile opens this screen.
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

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthHeader, AuthScreen } from '../components/authUi';
import { Avatar, Card, EmptyState, GradientCta, PressableScale } from '../components/ui';
import { SettingRow } from './profile/rows';
import { useSession } from '../lib/auth';
import { windowStart } from '../lib/activityWindow';
import { numericDate } from '../lib/format';
import { useCollections } from '../lib/catalog';
import {
  fetchApplause, fetchCopies, fetchMyActs, type FriendProfile, type MyActs, useCuratorAvatarsQuery, useMyCollections,
} from '../lib/data';
import { useCrew } from '../lib/crew';
import { type ActivityItem, agoOf, type Applause, buildActivity, type Copy, friendsMade } from '../lib/friends';
import { atHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { colors, space, type } from '../theme';
import type { Nav } from '../nav';

/** How far back the applause reaches. Two weeks: long enough that a
 *  weekly reader misses nothing, short enough that the screen is news
 *  rather than an archive. */


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
  // Either half failing. It is only said when nothing came back at all —
  // see the header.
  const [failed, setFailed] = useState(false);
  // Bumped by Try again, to run the fetches once more.
  const [attempt, setAttempt] = useState(0);
  // Where the two weeks open, fixed per load so the friendships, read from
  // the crew, are cut at the same instant as the three fetches.
  const [since, setSince] = useState(() => windowStart(new Date()));
  useEffect(() => {
    if (!me) { setApplause([]); setCopies([]); setActs(NO_ACTS); return; }
    setApplause(null);
    setCopies(null);
    setActs(null);
    setFailed(false);
    // Each half on its own: the feed shows what it could get, and a
    // dropped likes call does not take the copies with it.
    fetchApplause(since).then(setApplause).catch(() => { setFailed(true); setApplause([]); });
    // The same window: a copy is news for as long as a like is.
    fetchCopies(since).then(setCopies).catch(() => { setFailed(true); setCopies([]); });
    fetchMyActs(me, since).then(setActs).catch(() => { setFailed(true); setActs(NO_ACTS); });
  }, [me, attempt, since]);

  const earlier = useMemo<ActivityItem[]>(
    () => buildActivity(applause ?? [], copies ?? [], acts ?? NO_ACTS, me ? friendsMade(crew.ships.data, me, since) : []),
    [applause, copies, acts, crew.ships.data, me, since],
  );

  // The faces, by handle: the same lookup the bylines use, because a
  // liker need not be a curator and need not be a friend, so neither the
  // catalog's faces nor the crew's cover everyone here. One batched ask
  // for every actor on the screen; a handle with no face gets the blank
  // disc, as does a like whose liker is unnamed.
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

  const agoLabel = (iso: string): string => {
    const ago = agoOf(iso, Date.now());
    if (ago.unit === 'now') return t('just now', 'vừa xong', 'たった今', '刚刚', '剛剛');
    if (ago.unit === 'minutes') return t(`${ago.n}m ago`, `${ago.n} phút trước`, `${ago.n}分前`, `${ago.n} 分钟前`, `${ago.n} 分鐘前`);
    if (ago.unit === 'hours') return t(`${ago.n}h ago`, `${ago.n} giờ trước`, `${ago.n}時間前`, `${ago.n} 小时前`, `${ago.n} 小時前`);
    if (ago.n === 1) return t('yesterday', 'hôm qua', '昨日', '昨天', '昨天');
    // A week of "n days ago", then the date: past a week nobody counts
    // back, they look at a calendar — Mail and Instagram turn the same
    // corner. The date is `numericDate`, the check-in rows' form, so a
    // day already past is written one way across the profile stack.
    if (ago.n > RELATIVE_DAYS) return numericDate(lang, new Date(iso));
    return t(`${ago.n} days ago`, `${ago.n} ngày trước`, `${ago.n}日前`, `${ago.n} 天前`, `${ago.n} 天前`);
  };

  // Only the three fetches the timeline is built from; the crew's
  // friendships join it when they land.
  const loading = applause === null || copies === null || acts === null;

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
    <AuthScreen>
      <AuthHeader onBack={() => navigation.goBack()} title={t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')} />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : earlier.length === 0 && failed ? (
        <EmptyState
          icon="cloud-offline"
          title={t("Couldn't load your activity", 'Không tải được hoạt động', 'アクティビティを読み込めませんでした', '无法加载动态', '無法載入動態')}
          body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络连接后重试。', '請檢查網路連線後重試。')}
          testID="activity-failed"
        >
          <GradientCta
            icon="refresh"
            label={t('Try again', 'Thử lại', '再試行', '重试', '重試')}
            onPress={() => { setSince(windowStart(new Date())); setAttempt((n) => n + 1); }}
            testID="activity-retry"
          />
        </EmptyState>
      ) : earlier.length === 0 ? (
        empty
      ) : (
            <Card testID="earlier-card">
              {earlier.map((item, i) => {
                const col = item.kind === 'friend' ? null : collectionOf(item.collection_id);
                const title = col ? t(col.title_en, col.title_vi, col.title_ja) : null;
                // The handle, not the full name: it is how the rest of the
                // app names a person in public ("by @trang"), and it is the
                // name they chose to be known by. The full name is for the
                // request card on Your crew, where recognising a human is
                // the decision being made.
                const who = handleOf(item, crew.people);
                const by = who ? atHandle(who) : null;
                const shown = title ?? '…';
                const line = lineOf(item, by, shown, t);
                const key = item.kind === 'friend' ? `friend-${item.other}` : `${item.kind}-${item.collection_id}-${item.at}`;
                return (
                  <PressableScale
                    key={key}
                    contentStyle={[s.row, i > 0 && s.rowDivider]}
                    onPress={col ? () => navigation.navigate('CollectionDetail', { slug: col.slug }) : undefined}
                    // A button only when it goes somewhere — VoiceOver has to
                    // hear that this row opens the list.
                    accessibilityRole={col ? 'button' : undefined}
                  >
                    {/* Who, then what: the actor's face leads the row, as
                        every social feed has it (Instagram, Threads), and
                        the kind of thing they did rides on its corner as a
                        badge — the heart or the copy, filled and in the
                        accent, small enough to be a mark and not a second
                        picture. It replaced a bare glyph per row, which
                        told the eye nothing once five rows shared it. */}
                    <View style={s.face} testID="row-face">
                      <Avatar url={who ? faces.data[who] : null} size={FACE} />
                      <View style={s.kind} testID="kind-badge">
                        <Ionicons name={BADGE[item.kind]} size={11} color={colors.accent} />
                      </View>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.line} numberOfLines={2}>
                        {line}
                      </Text>
                      <Text style={s.meta}>{agoLabel(item.at)}</Text>
                    </View>
                    {/* Only where there is somewhere to go: the same
                        condition as the role above, so what VoiceOver
                        hears and what the eye sees agree. */}
                    {col ? <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} /> : null}
                  </PressableScale>
                );
              })}
            </Card>
      )}
    </AuthScreen>
  );
}

/** The other person in a row, by handle: who liked or copied, whose list
 *  it was, or who the new friend is — whoever the face is of. */
function handleOf(it: ActivityItem, people: Record<string, FriendProfile>): string | null {
  if (it.kind === 'applause') return it.liker_handle;
  if (it.kind === 'copy') return it.copier_handle;
  if (it.kind === 'friend') return people[it.other]?.handle ?? null;
  return it.owner_handle;
}

type Translate = (en: string, vi: string, ja: string, zh?: string, hant?: string) => string;

/** The mark on the face's corner: what kind of thing happened. A like is
 *  the heart and a copy the copy glyph whoever did it; a friendship is two
 *  people. */
const BADGE: Record<ActivityItem['kind'], keyof typeof Ionicons.glyphMap> = {
  applause: 'heart', liked: 'heart', copy: 'copy', copied: 'copy', friend: 'people',
};

/**
 * The sentence a row says. Two kinds are other people's acts on your
 * lists, two are yours on theirs, one is a friendship; each has the one
 * shape, and a missing name falls back rather than going blank. The
 * copy's verb is the button's own words — "Save a copy" is what was
 * pressed. Your own rows lead with you (owner's wording, 28 Oct 2026:
 * "Bạn đã thích “Y” của @b").
 */
function lineOf(item: ActivityItem, by: string | null, shown: string, t: Translate): string {
  switch (item.kind) {
    case 'applause':
      return by
        ? t(`${by} liked “${shown}”`, `${by} đã thích “${shown}”`, `${by} が「${shown}」にいいねしました`, `${by} 点赞了“${shown}”`, `${by} 按讚了「${shown}」`)
        : t(`Someone liked “${shown}”`, `Ai đó đã thích “${shown}”`, `誰かが「${shown}」にいいねしました`, `有人点赞了“${shown}”`, `有人按讚了「${shown}」`);
    case 'copy':
      return by
        ? t(`${by} saved a copy of “${shown}”`, `${by} đã lưu bản sao “${shown}”`, `${by} が「${shown}」のコピーを保存しました`, `${by} 保存了“${shown}”的副本`, `${by} 儲存了「${shown}」的副本`)
        : t(`Someone saved a copy of “${shown}”`, `Ai đó đã lưu bản sao “${shown}”`, `誰かが「${shown}」のコピーを保存しました`, `有人保存了“${shown}”的副本`, `有人儲存了「${shown}」的副本`);
    case 'liked':
      return by
        ? t(`You liked ${by}’s “${shown}”`, `Bạn đã thích “${shown}” của ${by}`, `${by} の「${shown}」にいいねしました`, `你点赞了 ${by} 的“${shown}”`, `你按讚了 ${by} 的「${shown}」`)
        : t(`You liked “${shown}”`, `Bạn đã thích “${shown}”`, `「${shown}」にいいねしました`, `你点赞了“${shown}”`, `你按讚了「${shown}」`);
    case 'copied':
      return by
        ? t(`You saved a copy of ${by}’s “${shown}”`, `Bạn đã lưu bản sao “${shown}” của ${by}`, `${by} の「${shown}」のコピーを保存しました`, `你保存了 ${by} 的“${shown}”的副本`, `你儲存了 ${by} 的「${shown}」的副本`)
        : t(`You saved a copy of “${shown}”`, `Bạn đã lưu bản sao “${shown}”`, `「${shown}」のコピーを保存しました`, `你保存了“${shown}”的副本`, `你儲存了「${shown}」的副本`);
    case 'friend':
      if (item.asked === 'you') {
        return by
          ? t(`${by} accepted your friend request`, `${by} đã chấp nhận lời mời kết bạn của bạn`, `${by} があなたの友達リクエストを承認しました`, `${by} 接受了你的好友请求`, `${by} 接受了你的好友請求`)
          : t('Someone accepted your friend request', 'Ai đó đã chấp nhận lời mời kết bạn của bạn', '誰かがあなたの友達リクエストを承認しました', '有人接受了你的好友请求', '有人接受了你的好友請求');
      }
      return by
        ? t(`You and ${by} are now friends`, `Bạn và ${by} đã thành bạn bè`, `${by} と友達になりました`, `你和 ${by} 成为了好友`, `你和 ${by} 成為了好友`)
        : t('You made a new friend', 'Bạn đã có thêm một người bạn', '新しい友達ができました', '你有了一位新朋友', '你有了一位新朋友');
  }
}

/** Nothing done yet, or nothing to read: the shape a failed fetch leaves. */
const NO_ACTS: MyActs = { likes: [], copies: [], lists: [] };

/** The feed line's line height, and the box that holds a 19pt glyph's
 *  whole line — see `mark`. */
const LINE = 21;
/** How many days a time is told as a distance before it is told as a date. */
const RELATIVE_DAYS = 7;
/** The face's side: the 44pt the slot it replaced had, so the text
 *  column stays where it was. */
const FACE = 44;

const s = StyleSheet.create({
  // Centred: a 44pt face beside one or two lines of text wants its
  // middle on theirs. The rows were top-aligned while the mark was a
  // 19pt glyph set on the first line; a face has no first line to sit on.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  meta: { color: colors.textTertiary, ...type.meta },
  // The row aligns its top so the mark can sit on the first line of text;
  // the chevron keeps the middle, as Profile's rows do it.
  rowEnd: { alignSelf: 'center' },
  face: { width: FACE, height: FACE },
  // The badge: a 20pt disc on the card's own ground with the row's
  // hairline around it, hung a hair past the face's corner so it reads
  // as pinned on rather than printed on. 11pt glyph: the heart is a
  // mark here, not an icon to tap.
  kind: {
    position: 'absolute', right: -3, bottom: -3,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { color: colors.text, fontSize: 15, lineHeight: LINE },
  // The Profile stack's section heading (`profile/styles`' `section`).
  head: { color: colors.text, ...type.section, marginTop: 10 },
});
