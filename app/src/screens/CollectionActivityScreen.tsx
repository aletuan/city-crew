// A list's activity — who liked it and who saved a copy of it, all time,
// newest first (owner, 13 Nov 2026). Threads' "Post activity", for a
// collection: the list itself in a small card at the top, then one row
// per act. Opened from "View activity ›" at the end of the card's
// activity row, which only the list's owner is shown.
//
// ── the two fetches, and what they promise ──
//
// The rows come from the RPCs Activity reads, `likes_on_mine` and
// `copies_of_mine` (`lib/data/people`), asked from the epoch through
// `useListActivityQuery`. Read in the migrations as they stand
// (`20261113150000_activity_rows_carry_face.sql` holds the last of each),
// each takes any `since`: it is a plain
// `created_at >= since`, so 1970 is all time. Neither has a `limit`. What
// they do leave out is what this page should too: a like or copy by the
// owner themselves, and one by somebody the owner has blocked. A like
// taken back or a copy deleted is a row gone, as on Activity: the page
// holds what still stands.
//
// A list that is not public now is asked about like any other (owner,
// 13 Nov 2026). Until that day both functions answered for public lists
// alone, so a list made private again showed nothing here while its
// likes were still in the table, and the page said "Only a public
// collection can be liked or copied" instead. The functions now answer
// the owner whatever the list is now, and the page lists what it
// gathered while it was public. A list that never gathered anything
// gets the ordinary empty state: it is not a different kind of nothing.
//
// The one cap that can apply is not in the repo: PostgREST's "Max rows"
// on the live project, which cuts a set-returning RPC as it cuts a table
// read (1,000 by default on Supabase). Both RPCs answer for every list
// the owner has, so the cap would bite on the owner's total, newest
// kept, oldest gone. Not measured on the live project — this change does
// not touch it.
//
// Rejected: a per-list RPC that took the collection's id. It would cut
// the answer to this list on the server and sidestep the cap, at the
// cost of a migration and of one answer per list; the two that exist
// answer the question, at the cost of reading the owner's other lists'
// acts to throw them away. Worth it if an owner ever nears the cap. The
// all-lists answer also earns its keep now: it is one cached answer for
// every list's page, which is what lets the collection page ask before
// the reader has said which list (below).
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
//     opens their own list (`usePrefetchListActivity` there), not on the
//     tap. By the time "View activity" is pressed it has usually landed.
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
// Loading is the accent spinner under the card, and only while either
// half has nothing at all to show — neither a kept answer nor a fresh
// one. A refresh behind a kept answer draws no spinner: the rows are
// there, and they change in place if the answer did. Nothing to show is
// a state with a heading and one sentence, whatever the list is now —
// public, Friends or Private. A failure that leaves nothing to show says
// so, with Try again; one of the two failing while the other has rows
// still shows the rows, and a refresh that fails behind kept rows keeps
// them.

import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Glyph } from '../components/ui/glyph';
import { Avatar, Card, EmptyState, GradientCta, Screen, useTabBarClearance } from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useProfile, useSession } from '../lib/auth';
import { useListActivityQuery } from '../lib/data';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { actsOn, type ListAct } from '../lib/listActivity';
import { ageWord, listAgeOf } from '../lib/listAge';
import { useMyLists } from '../lib/save';
import { useScheme } from '../lib/theme';
import { bgHex, colors, font, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

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
  // Any list of yours with an id has something to ask about, public or
  // not (see the header). A row from the launch cache may have none.
  const listId = col?.id ?? null;

  // The owner's answer, kept and shared — see the header. Nobody to ask
  // about without a list of yours with an id: no fetch, and the empty
  // state.
  const activity = useListActivityQuery(me && listId ? me : null);
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
            ? <Text style={s.headHandle} numberOfLines={1}>{normalizeHandle(profile.handle)}</Text>
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
    /* Who, as every row of people in the app names them (owner, 13 Nov
       2026): the real name on top in the strong ink, the handle under it
       with its `@` — Crew's rows, and X's. With both on show the `@` is
       what tells the second line from the first. With no name the handle
       is the name, alone and bare, as the collection card's head draws it.

       Rejected the same day, after it shipped: Threads' order, the handle
       on top and bare and the name under it. One list of people drew
       "hado / Ha Do" while Crew drew "Ha Do / @hado" — the same person
       in two arrangements, a screen apart. Crew's is the one kept: this
       is an app about friends, known by their names first. */
    const handle = item.handle ? normalizeHandle(item.handle) : '';
    const top = item.name || handle || someone;
    const under = item.name && handle ? atHandle(handle) : '';
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
        accessibilityLabel={[top, under, did, when].filter(Boolean).join(', ')}
        testID="activity-row"
      >
        {/* Who, and what they did on the face's corner — Activity's
            arrangement, at Threads' sizes. */}
        <View style={s.face}>
          {/* The face off the row itself — see the header. */}
          <Avatar url={item.avatar} size={ROW_FACE} />
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
          {/* The age rides the second line when there is one, after the
              handle as Crew's count does; alone, it follows the name. */}
          {under ? (
            <>
              <Text style={s.handle} numberOfLines={1}>{top}</Text>
              <Text style={s.name} numberOfLines={1}>{`${under} · ${when}`}</Text>
            </>
          ) : (
            <View style={s.lineOne}>
              <Text style={s.handle} numberOfLines={1}>{top}</Text>
              <Text style={s.when}>{when}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const emptyTitle = t('No likes or copies yet', 'Chưa có lượt thích hay bản sao nào', 'まだいいねやコピーはありません', '还没有点赞或复制', '還沒有按讚或複製');
  const state = !col && mine.loading ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} />
  ) : !listId ? (
    // Not yours, gone, or a row from the launch cache with no id to ask
    // about: nothing to show, said as nothing yet rather than as a fault.
    <EmptyState icon="heart" title={emptyTitle} body={waitBody(t)} testID="activity-empty" />
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
        onPress={activity.reload}
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

/** A list nobody has acted on yet: Activity's sentence, for one list. */
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
