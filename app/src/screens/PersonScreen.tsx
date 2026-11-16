// A person's page — opened by pressing their face.
//
// ── what it is, and what it is the first step of (owner, 16 Nov 2026) ──
//
// The owner wants a page per person that grows the way a social profile
// does, with places at the middle of it: the lists someone publishes,
// then the photographs they add, where they have been, a moment at a
// table. This is the first step and it is deliberately the cheapest one:
// **only what was already public**. The profile, which the policy has
// always said other users can see (`lib/legal`), and the lists a person
// published. No table, no migration, no change to the policy — and so
// nothing here that a later step has to take back.
//
// What a later step adds, and what each costs, was written down before
// this one was built:
//
//   - photographs they contributed — naming the contributor is a change
//     to what the policy says;
//   - check-ins — a person's movements; needs a decision on who may see
//     them, most likely an opt-in, and the policy;
//   - moments — a new kind of content, with storage, reporting and a desk
//     to review it.
//
// So the body is built as sections stacked under a head, and a later
// step is a section added, not a page drawn again: "Collections" was the
// first, and "In common" (`InCommon`, 16 Nov 2026) the second, above it —
// built, and switched off the same day (`IN_COMMON_ON`).
//
// No count line. "11 collections" stood between the head and the
// sections until 16 Nov 2026, when the owner found it not needed: the
// collections are right under it, to be seen rather than counted.
//
// ── the head ──
//
// A cover across the top and the face overlapping its lower edge, as the
// owner asked. The cover is **the cover of their newest list that has
// one** (`coverAmong`), not a picture they upload: it says where this
// person goes, the desk has already seen it, and there is no upload to
// build or moderate. Somebody with no list has the accent's tint for a
// cover — the ground the Statistics row and the "add a photo" offer
// stand on — so a page with nothing on it still reads as meant. Most
// pages are that page today: the live project has about ninety profiles
// and fewer public lists than that.
//
// Under the app's ordinary header, as a card, and not bled to the top of
// the screen behind floating buttons as the sketch drew it. `Screen`
// owns the safe area and the back control on every pushed page; a second
// way of doing both, for one screen, is more than a first step should
// carry. Rejected for now, not for good.
//
// The name beside the picture, then the handle under them with its
// `@`, quieter; then the bio, when they wrote one (owner, 16 Nov 2026).
//
// Name first here, though every row of people leads with the handle
// (15 Nov): the owner's exception, and the one their own Profile
// already makes — a page about one person is headed as that person's
// Profile is, "Tuan Anh" over "@tuananh". A row names somebody among
// many, where the handle is what tells two people apart.
//
// Beside the picture, not under it. The handle, the name and the count
// stood in three lines under the face with the width beside it empty,
// and the collections began a quarter of a screen lower for it.
//
// The handle right under the name, both beside the picture. For an
// evening the handle ran under the whole row instead, at the page's
// left edge: a second line beside the picture had been ruled out when
// that line was "name · 11 collections", too long for the room. With
// the count gone the line is a handle, which is short — and under the
// row it sat a picture's width to the left of the name it belongs to,
// which the owner read, rightly, as out of line.
//
// Somebody with no name is headed by their handle, `@` and all, and
// has no second line.
//
// ── the friend button ──
//
// The one a list's activity page draws (`useFriendButtons`), by the same
// rule (`rowButton`): nothing for yourself or across a block, Add friend,
// Accept, or the quiet word for what stands. In a row of its own under
// the head, beside a Message that is not built yet (`Acts`), and again,
// small, in the header once that row has scrolled away (`usePastRow`).
// A block is not otherwise
// read here: the lists on this page are public, and a block is a contact
// policy, not a content filter — the policy's own words.
//
// ── the ⋯ (16 Nov 2026) ──
//
// Report, block, and taking a block back: `usePersonMenu`, where the
// reasoning is. It came with the second door to this page — a press on
// the author's face at the head of a list — whose sheet used to hold
// the block.
//
// ── what was not measured ──
//
// Whether anybody presses a face. That is the question this step exists
// to answer, and nothing in it counts the press: the production build
// sends no usage analytics (`lib/legal`), so the answer will come from
// asking people.
import React, { useState } from 'react';
import {
  ActivityIndicator, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Avatar, Card, EmptyState, GradientCta, PressableScale, Screen, SECONDARY_CONTROL_H, useTabBarClearance,
} from '../components/ui';
import { Glyph } from '../components/ui/glyph';
import { useFriendButtons } from '../components/FriendButton';
import InCommon from '../components/InCommon';
import { usePersonMenu } from '../components/PersonMenu';
import PersonRole from '../components/RoleBadge';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useSession } from '../lib/auth';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { type Collection, coverUriOf, membersOf, useProfileByHandle } from '../lib/data';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { coverAmong, IN_COMMON_ON, listsBy, TOP_FRIEND_ON } from '../lib/person';
import { useScheme } from '../lib/theme';
import { bgHex, colors, display, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

/** The face: 88, the size Edit profile draws your own at. */
const FACE = 88;
/** The cover's height. Not measured on a phone: a little under the 16:9
 *  of a 346pt card, so the face and the handle are on the first screen. */
const COVER_H = 148;
/** How far the name shrinks to stay on its line beside the picture
 *  before it is cut: 22 to about 17, still the largest words on the
 *  page. */
const TITLE_SHRINK = 0.78;
/** A list's photograph on its tile. */
const TILE_PHOTO_H = 108;

export default function PersonScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'Person'>;
}) {
  const { t, lang } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const handle = normalizeHandle(route.params.handle);
  const who = useProfileByHandle(handle || null);
  const person = who.data;

  const shelf = useCollections();
  const places = usePlaces();
  const { likes } = useLikes();
  const lists = listsBy(person?.id, shelf.data);
  const coverFor = (c: Collection) => coverUriOf(c, membersOf(c, places.data));
  const cover = coverAmong(lists, coverFor);

  const { friendButton, crew } = useFriendButtons(me, 'person', 'page');
  // Report, block, unblock — `usePersonMenu`.
  const menu = usePersonMenu(me, person, crew);

  const personId = person?.id ?? null;
  const friend = friendButton(personId);
  // The same button, small, for the header once the row has scrolled
  // away — a thing to do only (`actsOnly`): a fact is not worth the
  // header's room. Switched off for now: `TOP_FRIEND_ON`.
  const top = usePastRow(useDuckOnScroll());
  const topFriend = TOP_FRIEND_ON && top.past ? friendButton(personId, { size: 'row', prefix: 'person-top', actsOnly: true }) : null;

  const tabClearance = useTabBarClearance();
  // A ring is a border, and a dynamic colour on a border flattens against
  // the phone's appearance rather than the app's (`bgHex`).
  const { scheme } = useScheme();
  const ring = { borderColor: bgHex[scheme] };

  const placesWord = (n: number) => (n === 1
    ? t('1 place', '1 địa điểm', '1か所', '1 个地点', '1 個地點')
    : t(`${n} places`, `${n} địa điểm`, `${n}か所`, `${n} 个地点`, `${n} 個地點`));
  const likesWord = (n: number) => (n === 1
    ? t('1 like', '1 lượt thích', 'いいね1件', '1 个赞', '1 個讚')
    : t(`${n} likes`, `${n} lượt thích`, `いいね${n}件`, `${n} 个赞`, `${n} 個讚`));

  const tile = (c: Collection) => {
    const liked = likes[c.slug] ?? 0;
    return (
      <ListTile
        key={c.slug}
        title={localized(c, 'title', lang)}
        uri={coverFor(c)}
        meta={[placesWord(c.collection_places.length), liked > 0 ? likesWord(liked) : ''].filter(Boolean).join(' · ')}
        onPress={() => navigation.navigate('CollectionDetail', { slug: c.slug })}
      />
    );
  };

  // Two to a row. Pairs rather than a wrapping row: a wrapping row needs a
  // width, and the width is the screen's.
  const rows: Collection[][] = [];
  for (let i = 0; i < lists.length; i += 2) rows.push(lists.slice(i, i + 2));

  const page = person ? (
    <>
      <View style={s.coverCard} testID="person-cover">
        {cover
          ? <Image source={{ uri: cover }} style={s.coverPhoto} contentFit="cover" transition={160} />
          : <View style={[s.coverPhoto, s.tint]} testID="person-cover-tint" />}
      </View>
      <View style={s.headRow}>
        <View style={[s.faceRing, ring]}>
          <Avatar url={person.avatar_url || null} size={FACE} />
          {/* A local guide's star or an editor's medal, on the picture's
              corner, with the sheet that says what it means —
              `PersonRole` (owner, 16 Nov 2026). */}
          <PersonRole me={me} personId={person.id} />
        </View>
        {/* The name, beside the picture, and the handle right under it
            — or the handle alone, for somebody who gave no name. The
            name shrinks before it is cut: see `title`. */}
        <View style={s.names}>
          {person.full_name
            ? <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={TITLE_SHRINK} testID="person-name">{person.full_name}</Text>
            : null}
          <Text style={person.full_name ? s.handle : s.title} numberOfLines={1} testID="person-handle">{atHandle(person.handle)}</Text>
        </View>
      </View>
      {/* What there is to do about this person, in a row of its own —
          `Acts`. Not on your own page, nor signed out: no friend button,
          no row. */}
      {friend ? <Acts friend={friend} onLayout={top.onRowLayout} /> : null}
      {person.bio ? <Text style={s.bio} testID="person-bio">{person.bio}</Text> : null}
      {/* What the two of you have in common — `InCommon`. It took the
          "mutual saves" this line counted, for a friend only, until 16
          Nov 2026. Hidden the same day, not removed: `IN_COMMON_ON`. */}
      {IN_COMMON_ON ? <InCommon me={me} otherId={person.id} navigation={navigation} /> : null}

      <Text style={s.sectionLabel}>{t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')}</Text>
      {lists.length === 0 ? (
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
        <View style={s.grid}>
          {rows.map((pair) => (
            <View key={pair[0].slug} style={s.gridRow}>
              {pair.map(tile)}
              {pair.length === 1 ? <View style={s.tileSlot} /> : null}
            </View>
          ))}
        </View>
      )}
    </>
  ) : who.loading ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} testID="person-loading" />
  ) : who.error ? (
    <EmptyState
      icon="cloud-offline"
      title={t("Couldn't load this profile", 'Không tải được hồ sơ này', 'プロフィールを読み込めませんでした', '无法加载这个主页', '無法載入這個主頁')}
      body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络后重试。', '請檢查網路後重試。')}
      testID="person-failed"
    >
      <GradientCta icon="refresh" label={t('Try again', 'Thử lại', '再試行', '重试', '重試')} onPress={who.reload} testID="person-retry" />
    </EmptyState>
  ) : (
    <EmptyState
      icon="person-outline"
      title={t('Nobody here', 'Không có ai ở đây', '該当するユーザーがいません', '这里没有人', '這裡沒有人')}
      body={t(
        'This account may have been removed, or the handle has changed.',
        'Tài khoản này có thể đã bị xoá, hoặc handle đã đổi.',
        'アカウントが削除されたか、ハンドルが変更された可能性があります。',
        '该账号可能已被删除，或已更改 handle。', '該帳號可能已被刪除，或已更改 handle。',
      )}
      testID="person-missing"
    />
  );

  return (
    <Screen
      title={t('Profile', 'Hồ sơ', 'プロフィール', '主页', '主頁')}
      onBack={() => navigation.goBack()}
      backTestID="person-back"
      backBare
      compactTitle
      right={<View style={s.topRight}>{topFriend}{menu.button}</View>}
    >
      <ScrollView
        onScroll={top.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[s.content, { paddingBottom: tabClearance }]}
        showsVerticalScrollIndicator={false}
      >
        {page}
      </ScrollView>
      {menu.node}
    </Screen>
  );
}

/**
 * Whether the row of acts has scrolled out from under the header.
 *
 * The page's one act is under the name, and a page of collections is
 * long: three rows down, Add friend is a scroll back up. So once the row
 * has gone the header offers it again, small, beside the ⋯ — where
 * Instagram and Threads keep theirs — and takes it back when the row
 * returns.
 *
 * The row's foot in the scroller's content, from its layout; past it
 * when the offset is. State only on the crossing, not on every frame.
 * The tab bar's duck still hears every scroll.
 */
function usePastRow(duck: ((e: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined) {
  const [foot, setFoot] = useState<number | null>(null);
  const [past, setPast] = useState(false);
  return {
    past,
    onRowLayout: (e: LayoutChangeEvent) => setFoot(e.nativeEvent.layout.y + e.nativeEvent.layout.height),
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      duck?.(e);
      const now = foot !== null && e.nativeEvent.contentOffset.y > foot;
      if (now !== past) setPast(now);
    },
  };
}

/**
 * What there is to do about this person: the friend button, and Message.
 *
 * A row of its own under the name (owner, 16 Nov 2026). The friend
 * button stood at the end of the name's row for an evening, and at 44 it
 * took nearly half the width beside the picture: "Le Nguyen Ngoc Minh"
 * shrank as far as it could and "@lenguyenngocminh" was cut. Under the
 * head the name has the whole width and the buttons have theirs.
 *
 * Rejected for it: the button as an icon alone (four states become four
 * glyphs, two of them ticks), and the button on the cover photograph
 * (the grey words for "Requested" and "Friends" cannot be read on a
 * photograph, and would need the pill they had just lost).
 *
 * Message is not built. It is drawn anyway, dimmed and said to be
 * coming — the owner's choice over leaving the place empty — as
 * `ActionSheet` draws a row that is not yet a thing to do: 0.45, the
 * figure the app's dimmed controls share, "Soon" beside the word, and
 * the press refused, so nothing pretends to answer one. When messages
 * exist it becomes a button where it stands.
 */
function Acts({ friend, onLayout }: { friend: React.ReactNode; onLayout: (e: LayoutChangeEvent) => void }) {
  const { t } = useI18n();
  const message = t('Message', 'Nhắn tin', 'メッセージ', '发消息', '發訊息');
  const soon = t('Soon', 'Sắp có', '近日公開', '即将推出', '即將推出');
  return (
    <View style={s.acts} onLayout={onLayout} testID="person-acts">
      {friend}
      <PressableScale
        // `disabled` alone, as `ActionSheet`'s rows that are not yet a
        // thing to do: the press is dropped and VoiceOver says dimmed.
        disabled
        scaleTo={1}
        contentStyle={s.message}
        accessibilityRole="button"
        accessibilityLabel={`${message}, ${soon}`}
        testID="person-message"
      >
        <Glyph name="chatbubble-outline" size={15} color={colors.accent} />
        <Text style={s.messageText}>{message}</Text>
        <Text style={s.messageSoon}>{soon}</Text>
      </PressableScale>
    </View>
  );
}

/** One of their lists: its photograph, its title, and how much is on
 *  it. A tile with no photograph wears the tint, as the cover does. */
function ListTile({ title, uri, meta, onPress }: {
  title: string; uri: string | undefined; meta: string; onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      style={s.tileSlot}
      accessibilityRole="button"
      accessibilityLabel={[title, meta].join(', ')}
      testID="person-list"
    >
      <Card>
        {uri
          ? <Image source={{ uri }} style={s.tilePhoto} contentFit="cover" transition={160} />
          : <View style={[s.tilePhoto, s.tint]} />}
        <View style={s.tileWords}>
          <Text style={s.tileTitle} numberOfLines={2}>{title}</Text>
          <Text style={s.tileMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </Card>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.page },
  spinner: { marginTop: 20 },
  // The accent's tint: a cover or a tile with no photograph to wear.
  tint: { backgroundColor: colors.accentSoft },
  coverCard: { borderRadius: radius.card, overflow: 'hidden' },
  coverPhoto: { width: '100%', height: COVER_H },
  // The face half over the cover's lower edge, at the card's own inset,
  // and the name beside it. On the picture's foot: its upper half lies
  // over the cover.
  headRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
    marginTop: -(FACE / 2), paddingHorizontal: space.cardPadding,
  },
  // The page's ground around the face, so it parts from the photograph.
  faceRing: { borderWidth: 4, borderRadius: FACE / 2 + 4 },
  // The name over the handle, one column beside the picture: 28 and 20,
  // the 48 of the picture's half under the cover, so the two lines stand
  // exactly on it.
  //
  // A handle alone (nobody's name) stands in the middle of that 48.
  names: { flex: 1, minHeight: FACE / 2 + 4, justifyContent: 'center' },
  // The display face at 22, the size the page's own Profile heads its
  // sections in. It has the row to itself beside the picture — about
  // 240pt on a 390pt phone, by arithmetic — since the friend button left
  // for a row of its own; it still shrinks to `TITLE_SHRINK` before it
  // is cut, for the name that is longer than that.
  title: {
    color: colors.text, fontSize: 22, lineHeight: 28, fontFamily: display.bold,
    letterSpacing: 0.2,
  },
  // The row of acts, under the head: the friend button's 44, 14 under
  // the picture's foot.
  acts: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  // Add friend's dress (`FriendButton`), dimmed: a button that is not
  // one yet.
  message: {
    flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.45,
    minHeight: SECONDARY_CONTROL_H, borderRadius: radius.pill, paddingHorizontal: 16,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  messageText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },
  messageSoon: { color: colors.textTertiary, fontSize: 13 },
  // The header's end: the small friend button, when it is there, then
  // the ⋯.
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // The handle, right under the name: an address, quieter.
  handle: { color: colors.textTertiary, ...type.meta, lineHeight: 20 },
  bio: { color: colors.textSecondary, ...type.body, lineHeight: 23, marginTop: 10 },
  // A section's label: the small capitals the place page heads a fact with.
  sectionLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginTop: 22, marginBottom: 10,
  },
  grid: { gap: space.cardGap },
  gridRow: { flexDirection: 'row', gap: space.cardGap },
  tileSlot: { flex: 1 },
  tilePhoto: { width: '100%', height: TILE_PHOTO_H },
  tileWords: { padding: 12, gap: 6 },
  tileTitle: { color: colors.text, fontSize: 15, fontWeight: font.semibold, lineHeight: 20 },
  tileMeta: { color: colors.textTertiary, fontSize: 13 },
  none: { padding: space.cardPadding, gap: 6 },
  noneTitle: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  noneBody: { color: colors.textSecondary, ...type.meta },
});
