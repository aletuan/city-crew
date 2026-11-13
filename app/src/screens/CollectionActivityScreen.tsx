// A list's activity — who liked it and who saved a copy of it, all time,
// newest first (owner, 13 Nov 2026). Threads' "Post activity", for a
// collection: the list itself in a small card at the top, then one row
// per act. Opened from "View activity ›" at the end of the card's
// activity row, which only the list's owner is shown.
//
// ── the two fetches, and what they promise ──
//
// The rows come from the RPCs Activity reads, `likes_on_mine` and
// `copies_of_mine` (`lib/data/people`), asked from the epoch. Read in the
// migrations as they stand (`20260823180000_blocks.sql` holds the last
// `likes_on_mine`, `20261007120000_collection_copies.sql` the only
// `copies_of_mine`), each takes any `since`: it is a plain
// `created_at >= since`, so 1970 is all time. Neither has a `limit`. What
// they do leave out is what this page should too: a like or copy by the
// owner themselves, one by somebody the owner has blocked, and every row
// on a list that is not public — so a list made private again shows
// nothing here even though its likes are still counted. A like taken back
// or a copy deleted is a row gone, as on Activity: the page holds what
// still stands.
//
// The one cap that can apply is not in the repo: PostgREST's "Max rows"
// on the live project, which cuts a set-returning RPC as it cuts a table
// read (1,000 by default on Supabase). Both RPCs answer for every list
// the owner has, so the cap would bite on the owner's total, newest
// kept, oldest gone. Not measured on the live project — this change does
// not touch it.
//
// Rejected: a per-list RPC that took the collection's id. It would cut
// the answer to this list on the server and sidestep the cap, but it is
// a migration, and this change ships no migration; the two that exist
// answer the question, at the cost of reading the owner's other lists'
// acts to throw them away. Worth it if an owner ever nears the cap.
//
// ── only the owner ──
//
// The list is looked up among your own (`useMyLists`), and nowhere else.
// Somebody else's list is never there, and the RPCs would answer nothing
// for it anyway — they name the owner's likes to the owner alone — so a
// list that is not yours reads as a list with nothing on it: the empty
// state, no card, no fetch. A list you have just deleted, opened from a
// stale screen, is the same.
//
// ── what a row does ──
//
// Nothing, for now. The app has no page for a person — the collection
// card's own curator head says so: "there is no public profile screen to
// open" — and the one sheet about a person (`PersonSheet`) is a menu of
// acts, each wired by the screen that opens it (block and report on a
// list's curator, unfriend on a friend), not a profile. Opening it here
// would put Block on every liker, which is a decision about the feature
// and not this page's to make; Follow and Add friend were deferred by the
// owner. So the row is inert, and VoiceOver reads it as one line.
//
// ── states, as Activity has them ──
//
// Loading is the accent spinner under the card. Nothing to show is a
// state with a heading, and its sentence depends on why: a private list
// cannot be liked or copied at all, a public one has simply not been
// yet. A failure that leaves nothing to show says so, with Try again;
// one of the two failing while the other has rows still shows the rows.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Glyph } from '../components/ui/glyph';
import { Avatar, Card, EmptyState, GradientCta, Screen, useTabBarClearance } from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useProfile, useSession } from '../lib/auth';
import { fetchApplause, fetchCopies, useCuratorAvatarsQuery } from '../lib/data';
import type { Applause, Copy } from '../lib/friends';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { actsOn, type ListAct } from '../lib/listActivity';
import { ageWord, listAgeOf } from '../lib/listAge';
import { useMyLists } from '../lib/save';
import { useScheme } from '../lib/theme';
import { bgHex, colors, font, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

/** All time: the RPCs read `created_at >= since`, so the epoch is every row. */
const EVER = new Date(0).toISOString();

export default function CollectionActivityScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'CollectionActivity'>;
}) {
  const { t, lang } = useI18n();
  const { session } = useSession();
  const { profile } = useProfile();
  const me = session?.user?.id ?? null;
  const mine = useMyLists();
  const col = mine.data.find((c) => c.slug === route.params.slug) ?? null;
  // Only a public list has anything to fetch: both RPCs answer for public
  // lists alone (see the header), so a private one is asked nothing.
  const listId = col?.is_public && col.id ? col.id : null;

  const [likes, setLikes] = useState<Applause[] | null>(null);
  const [copies, setCopies] = useState<Copy[] | null>(null);
  // Either half failing; said only when nothing came back — see the header.
  const [failed, setFailed] = useState(false);
  // Bumped by Try again, to run both once more.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFailed(false);
    if (!me || !listId) { setLikes([]); setCopies([]); return; }
    setLikes(null);
    setCopies(null);
    // Each on its own, as on Activity: a dropped likes call does not take
    // the copies with it.
    fetchApplause(EVER).then(setLikes).catch(() => { setFailed(true); setLikes([]); });
    fetchCopies(EVER).then(setCopies).catch(() => { setFailed(true); setCopies([]); });
  }, [me, listId, attempt]);

  const acts = useMemo(
    () => (listId ? actsOn(listId, likes ?? [], copies ?? []) : []),
    [listId, likes, copies],
  );
  // One batched ask for every face on the page, as Activity's; a handle
  // with no face, or an act with no handle, gets the blank disc.
  const faces = useCuratorAvatarsQuery(acts.map((a) => a.handle ?? ''));
  const loading = likes === null || copies === null;

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
    ageWord(listAgeOf(iso, new Date()), lang, t, t('now', 'Vừa xong', 'たった今', '刚刚', '剛剛'));

  /* ── the list, in a card ──
     The collection page's card, smaller: the face and the two lines
     beside it as its head draws them (40, `BYLINE_LINE` each), then the
     title and the words. Three lines of them and no "Read more": it is a
     reminder of which list this is, and the whole of it is one Back away.
     The handle is yours from the profile, as the page's head takes it,
     not the `curator_handle` stamped on the row. */
  const title = col ? t(col.title_en, col.title_vi, col.title_ja) : '';
  const desc = col ? t(col.desc_en, col.desc_vi, col.desc_ja) : '';
  const age = col?.created_at ? listAgeOf(col.created_at, new Date()) : null;
  const card = col ? (
    <Card style={s.card} testID="activity-list">
      <View style={s.head}>
        <Avatar url={profile?.avatar_url || null} size={HEAD_FACE} />
        <View style={s.headLines}>
          {profile?.handle
            ? <Text style={s.headHandle} numberOfLines={1}>{atHandle(profile.handle)}</Text>
            : null}
          {age
            ? <Text style={s.headAge}>{ageWord(age, lang, t, t('New', 'Mới tạo', '作成したばかり', '刚创建', '剛建立'))}</Text>
            : null}
        </View>
      </View>
      <View style={s.words}>
        <Text style={s.title} testID="activity-list-title">{title}</Text>
        {desc
          ? <Text style={s.desc} numberOfLines={3} testID="activity-list-desc">{desc}</Text>
          : null}
      </View>
    </Card>
  ) : null;

  const someone = t('Someone', 'Ai đó', '誰か', '有人', '有人');
  const row = ({ item, index }: { item: ListAct; index: number }) => {
    const who = item.handle ? atHandle(item.handle) : someone;
    const when = ageOf(item.at);
    const did = item.kind === 'like'
      ? t('Liked', 'Đã thích', 'いいね', '点赞', '按讚')
      : t('Saved a copy', 'Đã lưu bản sao', 'コピーを保存', '保存了副本', '儲存了副本');
    return (
      <View
        style={s.row}
        accessible
        // What the badge says by its shape is said in words, since
        // VoiceOver cannot see the heart.
        accessibilityLabel={[who, item.name, did, when].filter(Boolean).join(', ')}
        testID="activity-row"
      >
        {/* Who, and what they did on the face's corner — Activity's
            arrangement, at Threads' sizes. */}
        <View style={s.face}>
          <Avatar url={item.handle ? faces.data[normalizeHandle(item.handle)] : null} size={ROW_FACE} />
          <View style={[s.badge, ring, item.kind === 'like' ? s.badgeLike : s.badgeCopy]} testID={`activity-badge-${item.kind}`}>
            <Glyph
              name={item.kind === 'like' ? 'heart' : 'duplicate'}
              size={BADGE_GLYPH}
              color={item.kind === 'like' ? LIKE_INK : colors.accentInk}
            />
          </View>
        </View>
        {/* The hairline is the text column's, not the row's, so it starts
            where the words do and the faces stand clear of it — Threads'
            inset separator. */}
        <View style={[s.lines, index > 0 && s.divider]}>
          <View style={s.lineOne}>
            <Text style={s.handle} numberOfLines={1}>{who}</Text>
            <Text style={s.when}>{when}</Text>
          </View>
          {item.name ? <Text style={s.name} numberOfLines={1}>{item.name}</Text> : null}
        </View>
      </View>
    );
  };

  const emptyTitle = t('No likes or copies yet', 'Chưa có lượt thích hay bản sao nào', 'まだいいねやコピーはありません', '还没有点赞或复制', '還沒有按讚或複製');
  const state = !col && mine.loading ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} />
  ) : !col || (!listId && col.is_public) ? (
    // Not yours, gone, or a row from the launch cache with no id to ask
    // about: nothing to show, said as nothing yet rather than as a fault.
    <EmptyState icon="heart" title={emptyTitle} body={waitBody(t)} testID="activity-empty" />
  ) : !listId ? (
    <EmptyState
      icon="lock-closed"
      title={emptyTitle}
      body={t(
        'Only a public collection can be liked or copied — this one is private.',
        'Chỉ bộ sưu tập công khai mới được thích hay sao chép — bộ này đang để riêng tư.',
        'いいねやコピーができるのは公開コレクションだけです — このコレクションは非公開です。',
        '只有公开的合集才能被点赞或复制 — 这个合集是私密的。', '只有公開的合集才能被按讚或複製 — 這個合集是私密的。',
      )}
      testID="activity-private"
    />
  ) : loading ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} testID="activity-loading" />
  ) : acts.length > 0 ? null : failed ? (
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
  ) : (
    <EmptyState icon="heart" title={emptyTitle} body={waitBody(t)} testID="activity-empty" />
  );

  return (
    <Screen
      title={t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')}
      onBack={() => navigation.goBack()}
      backTestID="activity-back"
      backBare
      compactTitle
    >
      <FlatList
        data={loading ? [] : acts}
        renderItem={row}
        keyExtractor={(a, i) => `${a.kind}-${a.at}-${a.handle ?? ''}-${i}`}
        ListHeaderComponent={<>{card}{state}</>}
        onScroll={duckScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[s.content, { paddingBottom: tabClearance }]}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

type T = (en: string, vi: string, ja: string, zh?: string, hant?: string) => string;

/** A public list nobody has acted on yet: Activity's sentence, for one list. */
const waitBody = (t: T) => t(
  'When someone likes or copies this collection, you will see it here.',
  'Khi có người thích hay sao chép bộ sưu tập này, bạn sẽ thấy ở đây.',
  'このコレクションにいいねやコピーがあると、ここに表示されます。',
  '有人点赞或复制这个合集时，会显示在这里。', '有人按讚或複製這個合集時，會顯示在這裡。',
);

/** The card head's face: the collection page's 40 (`FACE` there), so the
 *  two lines beside it stand its height as they do on the page. */
const HEAD_FACE = 40;
/** Each of the head's two lines — half the face, as on the page. */
const HEAD_LINE = HEAD_FACE / 2;
/** A row's face: 40 (owner, 13 Nov 2026), the size the collection
 *  card's head gives a face with two lines beside it, for the reason
 *  written there — Facebook and X draw 40 — and the two lines here stand
 *  about its height. */
const ROW_FACE = 40;
/** The badge's glyph: Activity's 11, a mark rather than an icon to tap. */
const BADGE_GLYPH = 11;
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
  // The collection page's card rhythm (`descCard` there): 20 above the
  // face, whose disc is solid ink to its edge, and 14 between the head and
  // the words. 16 below, not the page's 9: that 9 gave back the heart
  // row's air, and this card ends on a line of text, whose 24pt line
  // already carries about 4 under the ink — 20 in all, the page's figure.
  card: {
    gap: 14, padding: space.cardPadding, paddingTop: space.cardPadding + 4,
    marginBottom: space.cardGap,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headLines: { flexShrink: 1 },
  headHandle: { color: colors.text, fontSize: 15, fontWeight: font.semibold, lineHeight: HEAD_LINE },
  headAge: { color: colors.textSecondary, ...type.meta, lineHeight: HEAD_LINE },
  // The title and the words as one block, 4 apart (`space.nameToMeta`, a
  // name and the line that qualifies it).
  words: { gap: space.nameToMeta },
  // The words' own size and line, bold: the first line of the same text,
  // not a heading over it.
  title: { color: colors.text, ...type.body, fontWeight: font.bold, lineHeight: 24 },
  // The page's description, set as the page sets it: justified, both
  // edges (owner, 3 Nov 2026, and again 13 Nov for this card). It was
  // ragged here at first, as a summary's; the owner wanted the one text
  // to look the same in both places.
  desc: { color: colors.textSecondary, ...type.body, lineHeight: 24, textAlign: 'justify' },
  spinner: { marginTop: 20 },
  // Centred: a face beside two lines wants its middle on theirs.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  // 12 above and below, inside the column, so the hairline at its top is
  // the row's edge where the words are.
  lines: { flex: 1, paddingVertical: 12, gap: 2 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  lineOne: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  // The handle gives when it is long; the age never does.
  handle: { color: colors.text, fontSize: 15, fontWeight: font.semibold, flexShrink: 1 },
  when: { color: colors.textTertiary, ...type.meta, flexShrink: 0 },
  name: { color: colors.textSecondary, ...type.meta },
});
