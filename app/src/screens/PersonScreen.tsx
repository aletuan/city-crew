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
// So the body is built as sections stacked under a head, one today
// ("Collections"), and a later step is a section added, not a page drawn
// again. A count line sits between the two for the same reason.
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
// Handle first, then the name, quieter — the order every row of people
// took on 15 Nov. Then the bio, when they wrote one.
//
// ── the friend button ──
//
// The one a list's activity page draws (`useFriendButtons`), by the same
// rule (`rowButton`): nothing for yourself or across a block, Add friend,
// Accept, or the quiet word for what stands. A block is not otherwise
// read here: the lists on this page are public, and a block is a contact
// policy, not a content filter — the policy's own words.
//
// ── what was not measured ──
//
// Whether anybody presses a face. That is the question this step exists
// to answer, and nothing in it counts the press: the production build
// sends no usage analytics (`lib/legal`), so the answer will come from
// asking people.
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Avatar, Card, EmptyState, GradientCta, PressableScale, Screen, useTabBarClearance } from '../components/ui';
import { useFriendButtons } from '../components/FriendButton';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useSession } from '../lib/auth';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { type Collection, coverUriOf, membersOf, useProfileByHandle } from '../lib/data';
import { normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { coverAmong, listsBy } from '../lib/person';
import { useScheme } from '../lib/theme';
import { bgHex, colors, display, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

/** The face: 88, the size Edit profile draws your own at. */
const FACE = 88;
/** The cover's height. Not measured on a phone: a little under the 16:9
 *  of a 346pt card, so the face and the handle are on the first screen. */
const COVER_H = 148;
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

  const { friendButton, crew } = useFriendButtons(me, 'person');
  const mutual = person ? crew.mutual[person.id] ?? 0 : 0;

  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
  // A ring is a border, and a dynamic colour on a border flattens against
  // the phone's appearance rather than the app's (`bgHex`).
  const { scheme } = useScheme();
  const ring = { borderColor: bgHex[scheme] };

  const listsWord = (n: number) => (n === 1
    ? t('1 collection', '1 bộ sưu tập', 'コレクション1件', '1 个合集', '1 個合集')
    : t(`${n} collections`, `${n} bộ sưu tập`, `コレクション${n}件`, `${n} 个合集`, `${n} 個合集`));
  const savesWord = (n: number) => (n === 1
    ? t('1 mutual save', '1 chỗ cùng lưu', '共通の保存1件', '1 个共同收藏', '1 個共同收藏')
    : t(`${n} mutual saves`, `${n} chỗ cùng lưu`, `共通の保存${n}件`, `${n} 个共同收藏`, `${n} 個共同收藏`));
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
        </View>
        {friendButton(person.id)}
      </View>
      <View style={s.names}>
        <Text style={s.handle} numberOfLines={1} testID="person-handle">{normalizeHandle(person.handle)}</Text>
        {person.full_name
          ? <Text style={s.name} numberOfLines={1} testID="person-name">{person.full_name}</Text>
          : null}
      </View>
      {person.bio ? <Text style={s.bio} testID="person-bio">{person.bio}</Text> : null}
      <Text style={s.counts} testID="person-counts">
        {[listsWord(lists.length), mutual > 0 ? savesWord(mutual) : ''].filter(Boolean).join(' · ')}
      </Text>

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
    >
      <ScrollView
        onScroll={duckScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[s.content, { paddingBottom: tabClearance }]}
        showsVerticalScrollIndicator={false}
      >
        {page}
      </ScrollView>
    </Screen>
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
  // The face half over the cover's lower edge, at the card's own inset;
  // the button on the same row, level with the face's lower half.
  headRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: -(FACE / 2), paddingHorizontal: space.cardPadding,
  },
  // The page's ground around the face, so it parts from the photograph.
  faceRing: { borderWidth: 4, borderRadius: FACE / 2 + 4 },
  names: { marginTop: 12, gap: 2 },
  handle: { color: colors.text, fontSize: 24, fontFamily: display.bold, letterSpacing: 0.2 },
  name: { color: colors.textTertiary, ...type.meta },
  bio: { color: colors.textSecondary, ...type.body, lineHeight: 23, marginTop: 10 },
  counts: { color: colors.textSecondary, ...type.meta, marginTop: 10 },
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
