// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, SectionList, StyleSheet, Text, type TextInput, type SectionListProps, useWindowDimensions, View, type ViewProps } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import Swipeable from '../components/Swipeable';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AmbientWarmth, Avatar, Card, CHIP_H, Empty, fireHaptic, GradientCta, PressableScale, Screen,
  ScreenTitle, Skeleton, TABS_ROW_GAP, UnderlineTabs, useTabBarClearance,
} from '../components/ui';
import SearchField from '../components/SearchField';
import { useDuckOnScroll, useTabBarDucked } from '../components/tabBarDuck';
import { DockOffer, DockSlot, useDockOffer } from '../components/DockSlot';
import CollectionFilterSheet, { type CollectionFilters } from '../components/CollectionFilterSheet';
import { AddPill } from '../components/add';
import { createDuckTracker } from '../lib/duck';
import { holdResume } from '../lib/resume';
import { useSession } from '../lib/auth';
import { useCityList, useCurrentCity } from '../lib/city';
import { cityShortById } from '../lib/cityName';
import {
  listsWord, placesOf as placesCount, reasonFor as shelfReason, scopeLine, shape, type ShelfRow,
} from '../lib/collectionShelf';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import { Collection, coverUriOf, deleteCollection, fetchProfilesById, type FriendProfile, membersOf } from '../lib/data';
import { atHandle } from '../lib/handle';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { likesWorthShowing } from '../lib/likes';
import { isNewList } from '../lib/newest';
import { leadingCity, mosaicCaption, mosaicGroups, mosaicRows, type MosaicEntry, type MosaicRow } from '../lib/collectionMosaic';
import { collectionKinds as listKinds } from '../lib/collectionKinds';
import NewBadge from '../components/NewBadge';
import { COLLECTION_RECENTS_KEY, RECENTS_SHOWN, rememberSearch } from '../lib/recents';
import { NO_RECENTS, oneOf, RECENTS, useStored } from '../lib/stored';
import { collectionCities, collectionKinds, siftCollections, type SiftMember } from '../lib/search';
import { useMyLists, useSaveActions } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { classifyLoadFail } from '../lib/loadfail';
import { LoadFailBanner, LoadFailEmpty } from '../components/loadFail';
import { accentFade, colors, coverScrim, font, gradAI, mosaicScrim, onPhoto, radius, space, type } from '../theme';
import type { Nav } from '../nav';

type ListRow = ShelfRow<Collection> | MosaicRow<Collection>;

/** Yours keeps its two layouts; Community adds the editorial Mosaic. */
const TILE_OR_ROW = oneOf('tile', 'row');
const COMMUNITY_VIEWS = oneOf('row', 'tile', 'mosaic');

/** What `renderRightActions` hands back, and what the card animates from. */
type Drag = ReturnType<Animated.Value['interpolate']>;

/** The swipe's two actions, in the form a screen reader offers them. */
type RowA11y = Pick<ViewProps, 'accessibilityActions' | 'onAccessibilityAction'>;

/** A section of the list: yours or the community's, with its rows. The
 *  rows are named here, not only by the list: React Native 0.88 types a
 *  section handed back to a render prop as possibly the extra fields alone. */
type Section = { own: boolean; data: ListRow[]; city?: { id: string | null; count: number } };

/** Under the search box; the first block's gap takes it off its own. */
const SEARCH_ROW_GAP = 14;

/**
 * A row's key — and a section's, because the list asks for both.
 *
 * With `onViewableItemsChanged` set, React Native's VirtualizedSectionList
 * runs every token it reports through `_convertViewable`, which calls this
 * extractor on the token's item. For a section's heading or footer that
 * item is the section itself, not a row (`_getItem` returns the section
 * for those two indices). The first build read `row.c.slug` on it and
 * threw on the list's first report — the heading of the first block is
 * always in view — and the app froze on opening this tab, the tab bar
 * included (6 Nov 2026). Measured on the simulator with flow 21: red on
 * every build carrying the city tracker, green with only this guard
 * added, its log showing the throw "on a section" and never on a row.
 * vitest never saw it: jsdom has no layout, so the list never reports.
 */
const rowKey = (row: ListRow | Section): string => {
  // What the key says does not matter — the list keys its own cells; this
  // one only labels the token handed back — only that it is a string.
  if ('data' in row) return `section:${row.city?.id}`;
  return row.kind === 'mosaic' ? `mosaic-${row.items[0].c.slug}` : row.kind === 'pair' ? row.pair[0].slug : row.c.slug;
};
/** What the list says is on screen — `onSeen` reads the city from it. */
type Seen = Parameters<NonNullable<SectionListProps<ListRow, Section>['onViewableItemsChanged']>>[0];

/** What the two actions take up behind an open row: two 62pt buttons, the
 *  8pt between them, and the 8pt separating them from the card. The row
 *  clamps its own travel to whatever they measure, so this figure only sets
 *  how fast the card's insides shrink on the way there. */
const ACTIONS_W = 62 * 2 + 8 + 8;
/** Where the Yours tab's tile/list choice sleeps between launches. */
const VIEW_KEY = 'citycrew.collections.view';
const COMMUNITY_VIEW_KEY = 'citycrew.collections.community.view';
/** The cover's width. Its height is whatever the text beside it comes to,
 *  which is the point: an image with a fixed height floats in a card the
 *  text has made taller, and once the description arrived it made it much
 *  taller. Stretched, there is no gap left for it to float in.
 *
 *  126 is a bit over a third of a 349pt card. It buys the picture more
 *  than twice the area of the 92pt square it replaces *and* leaves the
 *  text wider than before — the chevron paid for both.

  The number is the ceiling; the row draws `coverW`, which is this share of
  the card at 393 and less on a narrower window — see it by `gcardW`. */
const COVER = 126;
const COVER_OPEN = 88;

// The card sells signing in, so it leads with what you get rather than with
// what you are: "browsing as a guest" names a limitation and leaves the
// reader to work out the offer for themselves.
//
// The whole card is the target and the chip inside it is drawn, not pressed —
// a Pressable nested inside a Pressable gives one action two overlapping hit
// areas and two stops in VoiceOver, for no gain.
//
// Sign-in lives in the Profile tab's stack, not this one, so the jump goes
// through the tab navigator above us.
//
// ── one row, since 17 Oct 2026 ──
//
// It was a card of its own: a 40pt icon well beside a title and two lines
// of body, the button on a third row under them — about 150pt, which put
// the first row of lists at 380pt on a 430pt-wide phone. A guest's first
// screen was half invitation and half shelf. The owner chose a compact
// banner (the "after the first row" alternative was turned down: a card
// inside the photo grid reads as an ad, needs its own rule for the list
// view, a search and an empty shelf, and on a 667pt-tall phone falls
// below the fold, where a guest may never see it).
//
// Words and button on one row now, and the icon well gone. Measured
// before it went: with a 32pt well and the button, the text column on a
// 375–393pt phone is about 140pt, and the title at this size needs 155.
// The words say "collection", and the tab below is lit, so the glyph was
// the one thing on the card saying nothing new. The text may still wrap
// on the narrowest phones rather than end in an ellipsis: a cut-off
// invitation is worse than a line taller one.
//
// The line under the title is about collections, not places (owner, same
// day): "save and sort places" described the bookmark, and the card
// beside a shelf of lists invites a list. It said so in full first —
// "…bộ sưu tập riêng của bạn" — which repeated the title and took two
// full lines on a 430pt phone; the owner, seeing it there, cut it to
// the verbs. The title already names the thing they act on.
function GuestNotice({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useSession();
  if (session) return null;
  return (
    <PressableScale
      style={s.noticeWrap}
      contentStyle={s.notice}
      onPress={() => {
        holdResume({
          tab: 'Collections', kind: 'collection', at: Date.now(),
          run: () => navigation.navigate('CollectionForm'),
        });
        navigation.getParent()?.navigate('Profile', { screen: 'SignIn', initial: false });
      }}
      accessibilityRole="button"
      accessibilityLabel={t(
        'Sign in to build your own collections',
        'Đăng nhập để tạo bộ sưu tập của riêng bạn',
        'サインインして自分のコレクションを作る',
        '登录后即可创建自己的合集', '登入後即可建立自己的合集',
      )}
    >
      <View style={s.noticeCopy}>
        <Text style={s.noticeTitle}>
          {t('Start a collection', 'Tạo bộ sưu tập riêng', 'コレクションを作る', '创建合集', '建立合集')}
        </Text>
        <Text style={s.noticeBody}>
          {t(
            'Sign in to create and sort.',
            'Đăng nhập để tạo và sắp xếp.',
            'サインインして作成・整理。',
            '登录后可创建和整理。', '登入後可建立和整理。',
          )}
        </Text>
      </View>
      {/* A rounded rectangle at chip scale, the sheet's primary button
          scaled down. Sized to its label rather than stretched: the card is
          already the target, so this names the action — it does not need to
          be the loudest object on the screen. At the row's end now, centred
          on the two lines beside it. */}
      <LinearGradient {...gradAI} style={s.noticeChip}>
        <Text style={s.noticeChipText}>{t('Sign in', 'Đăng nhập', 'サインイン', '登录', '登入')}</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.accentInk} />
      </LinearGradient>
    </PressableScale>
  );
}

/**
 * The cover slot of a list that has nothing in it yet.
 *
 * A flat grey square reads as a photo that failed to load — the eye has
 * seen too many broken images to read it any other way. A warm tinted well
 * with the tab's own glyph reads as a slot waiting to be filled, which is
 * what it is.
 */
function EmptyCover() {
  return (
    <LinearGradient
      colors={[colors.accentSoft, accentFade]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.thumbFill, s.thumbEmpty]}
    >
      <Ionicons name="bookmark-outline" size={26} color={colors.accentFaint} />
    </LinearGradient>
  );
}

/**
 * Signed in, nothing made yet. This is the one state with room to explain
 * what a collection is and why anyone would want one, so it takes the
 * whole card. The header's "New" pill stays above it (owner, 26 Oct
 * 2026): see the note on the pill.
 *
 * It mirrors the guest card one section up — same tinted well, same
 * gradient action — because they are the same argument aimed at two
 * states: sign in to make lists, and now make one.
 */
function FirstCollection({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.firstWrap}>
      <View style={s.first}>
        <View style={s.firstIcon}>
          <Ionicons name="bookmark" size={27} color={colors.accent} />
        </View>
        <Text style={s.firstTitle}>
          {t('No collections yet', 'Chưa có bộ sưu tập nào', 'コレクションはまだありません', '还没有合集', '還沒有合集')}
        </Text>
        {/* The owner's words (25 Oct 2026), with the app's own category
            names in place of "cafe, ăn uống, cảnh vật hay địa điểm": it
            says what a list is for — sharing, and planning a day from it,
            both of which the app does — where it used to give occasions. */}
        <Text style={s.firstBody}>
          {t(
            'Group the places you love into lists by theme — cafés, eats, views. Share them, or use one to plan a day worth having.',
            'Nhóm địa điểm yêu thích thành bộ sưu tập theo chủ đề — cà phê, ăn uống, ngắm cảnh. Chia sẻ, hoặc dùng để lên kế hoạch cho một ngày ý nghĩa.',
            'お気に入りのスポットをテーマ別にリストにまとめましょう — カフェ、食事、景色。シェアしたり、特別な一日のプランに使ったり。',
            '把喜欢的地点按主题整理成清单 — 咖啡、美食、风景。分享出去，或用来规划有意义的一天。', '把喜歡的地點按主題整理成清單 — 咖啡、美食、風景。分享出去，或用來規劃有意義的一天。',
          )}
        </Text>
        {/* A pill here, where the sheet's primary is a rounded rectangle:
            that one runs the full width, where end caps as tall as the
            button read as a lozenge. This one is sized to its label, which
            is exactly where a pill belongs. */}
        <GradientCta
          icon="add"
          label={t('Create your first collection', 'Tạo bộ sưu tập đầu tiên', '最初のコレクションを作る', '创建你的第一个合集', '建立你的第一個合集')}
          onPress={onPress}
        />
        {/* Private by default, said so that it does not contradict the
            "share" above it: it read "Only you can see your lists." */}
        <Text style={s.firstFoot}>
          {t('Only you can see them until you choose to share.', 'Mặc định chỉ mình bạn thấy — chia sẻ khi bạn muốn.', '共有するまで、あなただけに表示されます。', '默认仅你可见 — 想分享时再分享。', '預設僅你可見 — 想分享時再分享。')}
        </Text>
      </View>
    </View>
  );
}

/**
 * The community shelf, before anybody has stocked it.
 *
 * It used to say "Nothing from the community yet." and stop there, which
 * is a dead end in the one place a dead end costs most: a city the desk
 * has just opened has no public lists at all, and the morning this was
 * written the owner read that honest emptiness as data loss. Emptiness
 * here is a state, not a fault, and the sentence that
 * says so can also hand the reader the way to end it — the same shape
 * `FirstCollection` uses one section up.
 *
 * It named the city while the shelf was scoped to one. The shelf shows
 * every city now, so empty means empty everywhere, and says so plainly.
 */
function CommunityEmpty({ signedIn, onCreate, onExplore }: {
  signedIn: boolean;
  onCreate: () => void;
  onExplore: () => void;
}) {
  const { t } = useI18n();
  return (
    <View style={s.firstWrap}>
      <View style={s.first}>
        <View style={s.firstIcon}>
          <Ionicons name="globe" size={27} color={colors.accent} />
        </View>
        <Text style={s.firstTitle}>
          {t('No public lists yet', 'Chưa có bộ sưu tập công khai nào', 'まだ公開コレクションはありません', '还没有公开的清单', '還沒有公開的清單')}
        </Text>
        {/* True now that a curator's own public list is on this shelf; it
            promised the same thing while the shelf filtered them out. */}
        <Text style={s.firstBody}>
          {t(
            'Yours can be the first — make a list, set it to Public, and it shows up here for everyone.',
            'Bộ sưu tập của bạn có thể là đầu tiên — tạo một bộ sưu tập và đặt Công khai, nó sẽ hiện ở đây cho mọi người.',
            '最初の一つはあなたかも — リストを作って「公開」にすると、ここにみんなの目に並びます。',
            '你的可以成为第一个 — 创建清单并设为公开，所有人都能在这里看到。', '你的可以成為第一個 — 建立清單並設為公開，所有人都能在這裡看到。',
          )}
        </Text>
        {/* Signed out, "make a list" is not yet an offer this reader can
            take, so the button points at the shelf that is already full. */}
        {signedIn
          ? (
            <GradientCta
              icon="add"
              label={t('Create a collection', 'Tạo bộ sưu tập', 'コレクションを作る', '创建合集', '建立合集')}
              onPress={onCreate}
            />
          )
          : (
            <GradientCta
              icon="compass"
              label={t('Explore places', 'Khám phá địa điểm', 'スポットを見る', '探索地点', '探索地點')}
              onPress={onExplore}
            />
          )}
      </View>
    </View>
  );
}

/**
 * The last row of your own section: a slot rather than a thing.
 *
 * It sits at the end of the list because that is where you are looking
 * when you have just decided the list is missing something — the same
 * moment, and now the same row, as the one under Explore's places.
 */
/**
 * The tallest row the reading view can draw, drawn invisibly, so that
 * every row is that tall.
 *
 * On 10 Oct 2026 the owner sent two screenshots of the shelf: measured
 * off them, a private list with no description ran about 62pt and a public
 * one with a two-line description and a like count about 121, and the
 * shelf read as uneven steps. Equal heights cannot be one number in pt: Dynamic Type scales
 * the type and not the number, and a fixed height that holds the largest
 * row at the default size clips it at the next one. The ghost is made of
 * the same styles, so it scales with them, and the row's real content is
 * laid over it (`cardFace`) instead of beside it.
 *
 * Four lines on the Community tab: a one-line title, the byline, two
 * lines of description and the foot, which is the most a row there
 * shows. Three on yours, which has no byline (`byline` off): the count
 * and the heart share the foot (owner, 29 Oct 2026), and a fourth line
 * reserved for nothing would leave a gap under every one. The title drops
 * to one line for this. A two-line title would be the one thing able to
 * outgrow the ghost, and reserving a second title line in every row
 * would spend 22pt on space that few titles fill.
 *
 * Rejected: measuring the rows and growing them all to the tallest. The
 * list is virtualised, so a taller row scrolled into view would re-lay
 * every row above it while the reader is in the middle of them.
 */
function RowGhost({ byline = false }: { byline?: boolean }) {
  return (
    <View style={s.ghost} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={s.title} numberOfLines={1}>{' '}</Text>
      {byline ? (
        <View style={s.metaRow}>
          <View style={s.ghostMark} />
          <Text style={s.meta}>{' '}</Text>
        </View>
      ) : null}
      <Text style={s.blurb}>{' \n '}</Text>
      <View style={s.likesRow}><Text style={s.meta}>{' '}</Text></View>
    </View>
  );
}

/**
 * Swipe left on your own row to reveal Edit and Delete — the iOS list
 * convention, and the reason the row itself carries no extra controls.
 *
 * Where this parts company with the stock behaviour is what happens to the
 * row. Swipeable slides its children left by the width of the actions,
 * which on a full-bleed card pushes the cover and the first half of the
 * title off the screen: you end up choosing between two buttons for a list
 * you can no longer read the name of. So the card is pinned — translated
 * back by exactly what the row translates it — and narrowed by the same
 * amount instead, so its left edge stays on the page margin and its right
 * edge stops where the buttons begin.
 *
 * Both actions close the row first. Leaving it open behind a pushed screen
 * or an alert means coming back to a row half off its rails, and the way
 * out of that is another swipe nobody thinks to try.
 *
 * A swipe is a gesture VoiceOver does not perform, so on its own it left
 * Edit and Delete out of reach of anyone reading the screen by ear. The
 * same two actions ride along as accessibility actions — the rotor's
 * "Actions" on iOS — and the row hands them to the card, because the card
 * is the element a screen reader lands on; on the wrapper they would sit
 * on a view nobody can focus. They run the buttons' own path, so Delete
 * still asks first.
 */
function SwipeRow({ children, onEdit, onDelete, editLabel, deleteLabel }: {
  children: (open: boolean, drag: Drag | null, a11y: RowA11y) => React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}) {
  const ref = useRef<Swipeable>(null);
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Swipeable rebuilds the node it drags the row with every time it
  // remeasures, so the one captured on the first pass goes stale. Lifting
  // it out of the render prop keeps the copy the card animates from and the
  // one the row moves by the same node.
  const seen = useRef<Drag | null>(null);
  // No array on purpose: this runs every render precisely to catch the node Swipeable rebuilt
  // behind it, and the ref comparison above is the guard against the loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (seen.current !== drag) setDrag(seen.current); });

  const act = (run: () => void) => { ref.current?.close(); run(); };
  const a11y: RowA11y = {
    accessibilityActions: [{ name: 'edit', label: editLabel }, { name: 'delete', label: deleteLabel }],
    onAccessibilityAction: (e) => {
      if (e.nativeEvent.actionName === 'edit') act(onEdit);
      else if (e.nativeEvent.actionName === 'delete') act(onDelete);
    },
  };

  // Until the row has been measured there is nothing to pin against, and
  // the card sits at its full width the way it always did.
  const pinned = drag && width > 0
    ? { width: Animated.add(width, drag), transform: [{ translateX: Animated.multiply(drag, -1) }] }
    : null;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Swipeable
        ref={ref}
        // The row tracks the thumb 1:1. At 1.6 it travelled 62% of what
        // your hand did, and the gap is not felt as weight — it is felt as
        // the row not having noticed. What people do about a control that
        // has not noticed them is flick harder and shorter, which is the
        // one gesture that lands back inside the tap window.
        friction={1}
        // Threshold is measured on the row, so with friction it was
        // 38 × 1.6 ≈ 61pt of thumb to open. A third of the way across the
        // actions, at friction 1, is ~47pt of thumb and now means what it
        // says.
        rightThreshold={ACTIONS_W / 3}
        // Below this the pan never activates and the press underneath is
        // still live, so a short drag lifts as a tap and opens the list.
        // 10 was too much of the screen spent deciding. It cannot go to
        // zero — some slop has to stay a tap, or nobody can open a row by
        // touching it.
        dragOffsetFromRightEdge={6}
        // Which needs a partner: 6pt of horizontal is cheap enough that a
        // thumb arc could buy it while scrolling. This fails the pan once
        // the finger has gone 12pt down, so the split is by angle —
        // shallower than ~63° opens actions, steeper stays a scroll.
        failOffsetY={[-12, 12]}
        // No rubber-band past the actions. The reason used to be that the
        // row was 92pt tall and an overshoot on something that small read
        // as the row coming loose; with a stretched cover and a
        // description the row is nearer 140 and that argument is spent.
        // What holds instead is that there is nothing behind the two
        // buttons — travel past them reveals the page, not more row.
        overshootRight={false}
        // Width is a layout property, so the pin cannot ride the native
        // driver — a JS-driven value cannot be composed from a native one.
        // The cost is a handful of owned rows animating on the JS thread
        // for the length of a swipe, which is what it takes for the card to
        // stay legible instead of leaving the screen.
        useNativeAnimations={false}
        onSwipeableWillOpen={() => setOpen(true)}
        onSwipeableWillClose={() => setOpen(false)}
        renderRightActions={(_progress, dragX) => {
          seen.current = dragX;
          return (
            <View style={s.actions}>
              <PressableScale
                onPress={() => act(onEdit)}
                accessibilityRole="button"
                accessibilityLabel={editLabel}
                style={s.actionWrap}
                contentStyle={[s.action, s.actionEdit]}
              >
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </PressableScale>
              <PressableScale
                onPress={() => act(onDelete)}
                accessibilityRole="button"
                accessibilityLabel={deleteLabel}
                style={s.actionWrap}
                contentStyle={[s.action, s.actionDelete]}
              >
                <Ionicons name="trash-outline" size={22} color={colors.bad} />
              </PressableScale>
            </View>
          );
        }}
      >
        <Animated.View style={pinned}>{children(open, drag, a11y)}</Animated.View>
      </Swipeable>
    </View>
  );
}

export default function CollectionsScreen({ navigation, route }: {
  navigation: Nav;
  route: { params?: { tab?: 'yours' | 'community'; at?: number } };
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const { cities } = useCityList();
  const { city: here } = useCurrentCity();
  const cols = useCollections();
  const colsFail = classifyLoadFail(cols.error);
  // Shared with the save sheet — see SaveProvider. Reading it here through
  // its own hook is what let the two disagree.
  const mine = useMyLists();
  const { askToSignIn } = useSaveActions();
  // One heart on every public list, yours included (owner, 17 Oct 2026):
  // a curator may like their own list, and the shelves rank by everyone's
  // likes but theirs (`rankLikes`, read where a shelf is sorted). It is
  // the control the Explore shelf taps, backed by the same provider, one
  // copy of the truth.
  const { likes, rankLikes, myLikes, toggleLike } = useLikes();
  const { data: places, loading: placesLoading, loaded: placesLoaded, reload: placesReload } = usePlaces();
  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<SectionList<ListRow, Section>>(null);
  // Typed through, as on Explore: React Navigation's idea of a scrollable
  // and React Native 0.88's SectionList do not meet, though the list
  // answers `getScrollResponder` as it always did.
  useScrollToTop(scrollRef as unknown as Parameters<typeof useScrollToTop>[0]);
  const toTop = () => scrollRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });

  // Keep the natural header's geometry. The overlay pins only tabs and
  // layouts on descent; reversing reveals the full header in place.
  // The tab bar's tracker supplies hysteresis and overscroll clamping.
  const tabsYRef = useRef(0);
  const topHRef = useRef(0);
  const [headerTracker] = useState(() => createDuckTracker({ topSlack: 0 }));
  const [pinned, setPinned] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  // The city block under the pinned row, once its own heading has gone
  // under the row (see `onSeen`); null while a heading is in view. Its key
  // only — the city's id, '' for "elsewhere" — never the section's object:
  // see the freeze noted at `onSeen`.
  const [atKey, setAtKey] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  // How tall the pinned tabs are, so a jump lands its heading just
  // under them rather than behind them.
  const tabsHRef = useRef(0);
  const [deep, setDeep] = useState(false);
  const onShelfScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    duckScroll?.(e);
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
    const y = Math.min(maxY, Math.max(0, contentOffset.y));
    const direction = headerTracker.report(y, maxY);
    if (direction) setHeaderExpanded(direction === 'show');
    // Keep the revealed header until the natural one is fully at rest.
    const nowPinned = tabsYRef.current > 0 && (y >= tabsYRef.current || (pinned && y > 0));
    if (nowPinned !== pinned) setPinned(nowPinned);
    const nowDeep = topHRef.current > 0 && y >= topHRef.current;
    if (nowDeep !== deep) setDeep(nowDeep);
  };
  const ducked = useTabBarDucked();
  // Counting and filtering need the places catalog — until it's in, hold
  // the skeleton rather than showing raw DB membership numbers.
  //
  // "In" means `loaded`, not `!loading` — the same distinction `mineReady`
  // below spells out, and it stopped being decorative when the catalog
  // started hydrating from the launch cache: hydrated data arrives with
  // its background refresh still in flight.
  const holding = !cols.loaded || !placesLoaded;
  const loading = cols.loading || placesLoading;
  // The pull spinner belongs to the pull — same rule and same repair as
  // the Explore list beside this one. `loading` also covers the launch
  // cache's background pass and the return-to-app revalidate, neither of
  // which is anybody's pull; the old `!fromCache` guard silenced only
  // the first. Armed by the gesture, disarmed when the fetch settles.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !loading) setPulling(false);
  }, [pulling, loading]);

  // Reload on return: creating a collection happens on another screen, and
  // without this you would come back to the list you left. Every focus
  // reloads, including the first — Collections is not the launch tab, so
  // the first time it is ever focused in a session can just as easily be
  // right after creating the session's first list elsewhere as it can be
  // an ordinary visit, and there is no way to tell those apart from here.
  // See TripsScreen for the full argument; the fix that came from it.
  useFocusEffect(useCallback(() => {
    mine.reload();
  // `mine.reload` is stable; `mine` is a new object on every load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.reload]));

  const me = session?.user?.id;
  // Read once a render: a list that turns eight days old while the tab is
  // open keeps its badge until the next one, which is soon enough.
  const now = Date.now();
  const newWord = t('New', 'Mới', '新着', '新', '新');

  const cityName = useCallback(
    (id: string | null | undefined) => cityShortById(cities, id, t) ?? (id ?? ''),
    [cities, t],
  );

  // A public collection with nothing at all is a dead end, so it stays
  // hidden. Your own are not: an empty one is new — `mine` is not
  // filtered by it.
  //
  // ── every city, as Yours is (owner, 15 Oct 2026) ──
  //
  // This shelf was scoped to the app's city, Yours to none, and nothing
  // on the screen said the two differed until a subtitle did. The owner
  // asked for Community to show every city by default, as Yours does: a
  // reader in Saigon planning a week in Hanoi is the reader most in need
  // of Hanoi's lists, and the city chip still narrows to one. The
  // members come embedded whole (`withMembers`), so a list from another
  // city has its places and its cover without that city's catalog.
  //
  // Your own published lists are on this shelf too, as everyone sees
  // them. They were filtered out here (a list under both tabs reads as
  // two lists), and the owner's review (14 Oct 2026) found what that
  // cost: on Hội An the one public list was the owner's, so Community
  // read "0 collections · Hội An" and the empty card promised that a
  // list set to Public "shows up here" — which, under that filter, it
  // never would. The two tabs answer two questions, "what do I keep" and
  // "what does everyone see here", and a list that is the answer to both
  // belongs on both. A curator's own card wears their own byline, and the
  // same heart as everybody else's.
  const community = cols.data.filter((c) => membersOf(c, places).length > 0);

  const coverFor = (c: Collection) => coverUriOf(c, membersOf(c, places));

  // The faces behind the community tiles, fetched once per catalog load
  // through the same batched lookup the Crew screen uses. A miss leaves
  // the Avatar drawing its placeholder circle — the seat is always
  // there, which is what keeps a bare @handle reading as a signature
  // rather than a stray tag.
  const [faces, setFaces] = useState<Record<string, FriendProfile>>({});
  useEffect(() => {
    const ids = [...new Set(cols.data.map((c) => c.owner_id).filter(Boolean))] as string[];
    if (!ids.length) return;
    fetchProfilesById(ids).then((more) => setFaces((prev) => ({ ...prev, ...more }))).catch(() => {});
  // `cols.data` is a new array every load; `loadedAt` is the honest tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols.loadedAt]);

  // The same wiring as the Explore shelf: signed out, the tap is the
  // sign-in invitation; signed in, the provider owns the write and the
  // optimistic count, so a like made here shows there.
  const onHeart = useCallback((c: Collection) => {
    if (!c.id) return;
    if (!me) { askToSignIn('like'); return; }
    fireHaptic('light');
    void toggleLike({ id: c.id, slug: c.slug });
  }, [me, toggleLike, askToSignIn]);

  const remove = (c: Collection) => {
    const name = t(c.title_en, c.title_vi, c.title_ja);
    Alert.alert(
      t('Delete this collection?', 'Xoá bộ sưu tập này?', 'このコレクションを削除しますか？', '删除这个合集？', '刪除這個合集？'),
      t(`"${name}" will be gone for good.`, `"${name}" sẽ mất hẳn.`, `「${name}」は完全に削除されます。`, `“${name}”将被永久删除。`, `「${name}」將被永久刪除。`),
      [
        { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
        {
          text: t('Delete', 'Xoá', '削除', '删除', '刪除'),
          style: 'destructive',
          onPress: () => {
            // Both catalogs, as the detail screen's publish does: a public
            // list is on the Community shelf (and Explore's) too, and
            // reloading only your library left it standing there.
            deleteCollection(c.slug)
              .then(() => { mine.reload(); cols.reload(); })
              .catch((e: Error) => Alert.alert(t('Could not delete', 'Không xoá được', '削除できませんでした', '无法删除', '無法刪除'), e.message));
          },
        },
      ],
    );
  };

  // The two halves were one scroll, and the second half lost: four owned
  // lists already pushed "Public collections" to the fold, and a library
  // that grows pushes it further every month. A tab each — the same
  // shape as the Crew screen, for the same reason: two questions, asked
  // at different moments. Guests skip the switch entirely; with no
  // library there is only the one half to show.
  //
  // "Community", not "Public": on this screen "Public" is already the
  // status word each owned row wears, and one word must not mean the tab
  // and the badge at once. It also pairs with "Yours" as an answer to
  // the same question — whose lists these are.
  const [tab, setTab] = useState<'yours' | 'community'>(route.params?.tab ?? 'yours');
  // Explore's "See all" aims here while the screen may already be
  // mounted, so a fresh param re-aims the switch. Keyed on `at` as well
  // as `tab`: the second "See all" carries the same tab as the first, and
  // a reader who had switched to Yours in between was left there, because
  // an unchanged value never re-ran this.
  //
  // And a fresh `at` starts the list from its top: the screen is the one
  // left behind when the reader went into a collection, still scrolled
  // to where they were, and a door that says "your collections" opens on
  // the first of them (UX-09).
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
    if (route.params?.at) scrollRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  }, [route.params?.tab, route.params?.at]);
  // An empty library greets with the community shelf instead of an empty
  // room — decided once per visit, the first time the answer lands, and
  // never re-decided under the reader's thumb (the Crew screen's rule).
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current || !session || !mine.loaded || route.params?.tab) return;
    greeted.current = true;
    if (mine.data.length === 0) setTab('community');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.loaded]);
  // A list started from Community lands on Yours, where it now is: the
  // form goes back to whichever tab sent it, and on Community the new
  // list is invisible until it is made public. Keyed on the count, not on
  // the return — a cancelled form adds nothing and leaves the reader where
  // they were. The count rather than the focus because the form's
  // `mine.reload()` lands after the screen is focused again. A tab the
  // reader picks by hand in between drops the errand.
  const startedFromCommunity = useRef<number | null>(null);
  useEffect(() => {
    if (startedFromCommunity.current === null || mine.data.length <= startedFromCommunity.current) return;
    startedFromCommunity.current = null;
    setTab('yours');
  }, [mine.data.length]);
  const pickTab = (next: 'yours' | 'community') => {
    startedFromCommunity.current = null;
    setTab(next);
  };
  const startNew = () => {
    startedFromCommunity.current = onYours ? null : mine.data.length;
    navigation.navigate('CollectionForm');
  };

  // The search over what is already here. Everything it reads — both
  // lists, every member — is in memory, so this is a filter that runs on
  // the keystroke, offline, with no query behind it. It answers by a
  // list's own words, by the places inside it, by their city, and by
  // @handle; the arithmetic lives in `siftCollections`, under the gate,
  // beside the rules it shares with the search box on Explore.
  //
  // It was a glyph in the header and a field that existed only while
  // wanted. The owner's review (14 Oct 2026): the check-ins screen had
  // meanwhile grown a box under its title with a panel of chips behind
  // it, and a reader who had learned that screen looked for the same
  // thing here. So this is that box, with that panel — recent searches,
  // then the cities, then the kinds of place — opened by focus, folded by
  // a choice (see `answered`) and let go of by Cancel. One city and one
  // kind at a time, a chosen chip tapped again lets go.
  //
  // What the panel adds that the words could not: a chip asks about the
  // *places* in a list. Under "Cafés" a list is listed for the cafés in
  // it, and the card says how many of its places those are, because a
  // list of eight with three cafés and a list of three cafés are
  // different answers to the same chip.
  //
  // Since 25 Oct 2026 the cities and the kinds are two `UnderlineChoice`
  // rows, each with "All" first, where they were two wraps of chips (the
  // owner, on the review board that took Explore's boxes away). With
  // seven cities and nine kinds the wraps were five lines of chips; the
  // rows are two, and scroll, so the panel is a band under the box rather
  // than a sheet over the shelf.
  //
  // And later that day the owner moved them out of the panel altogether:
  // the city and the kind are a sheet from below now, opened by Explore's
  // filter glyph beside the title (`CollectionFilterSheet`), so the box is
  // for words and the glyph for narrowing, on both screens. The panel is
  // the box's own: what was searched here before.
  const [query, setQuery] = useState('');
  const q = query.trim();
  const [panel, setPanel] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  // The city chip: unset is every city, on both shelves; a city narrows
  // to the lists with a place there. It had a third state, 'all', while
  // Community was scoped to the app's city and letting go of that chip
  // had to mean something other than unset.
  const [cityPick, setCityPick] = useState<string | null>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  // Cancel is the box's: it lets go of the words and closes the panel.
  // It let go of the city and the kind too while they were chosen in the
  // panel; since they moved to the sheet (25 Oct 2026) they are the
  // sheet's, shown under the box with a ✕ each, and outlive a search.
  const cancel = () => {
    setPanel(false); setQuery('');
    inputRef.current?.blur();
    Keyboard.dismiss();
  };
  // A chip is an answer, and the keyboard asks for words. Tapped, it
  // puts the keyboard away (the owner, 14 Oct 2026: the keyboard stood
  // over the results of every chip) — and since 24 Oct the panel folds
  // with it, down to the chips that are on.
  //
  // It used to stay up until Cancel, for the reason VisitedScreen gives:
  // closing it on a blur would take the chips out from under the reader
  // mid-choice. Here that left the reader with no way to read the shelf.
  // The panel was not in the list then, as VisitedScreen's is, so it did
  // not scroll away; with seven cities and nine kinds it stood over all but
  // a fifth of the screen, and the only way out was Cancel, which let go
  // of the chips it was meant to keep (the owner's screenshot, 24 Oct
  // 2026). Folded, what it chose stays in sight under the box, so a
  // filter is never one nobody can see; the shelf gets the screen, and
  // the box opens the panel again for a second choice. Dragging the shelf
  // folds it too: that is the reader asking to read.
  //
  // The folded row was chips, each with a ✕, behind a "Filters" chip.
  // Since 25 Oct 2026 it is the review board's: Explore's filter glyph,
  // with no word beside it (the owner: the glyph says it), then what is
  // chosen as words with no ground, each a tap back into the panel and
  // each with its own ✕. Left from the board: its "Clear all", which
  // turned letting go of one of two choices into two taps (it shipped in
  // a draft and came out the same day — the owner asked why the ✕ had
  // gone; with two choices at most, a ✕ each is enough, and Cancel lets
  // go of everything); its filter sheet, a fourth way of choosing beside
  // the underline rows Explore, this panel and the visits panel now
  // share; and several cities at once, which the owner took out of every
  // filter on 24 Oct.
  const answered = () => { inputRef.current?.blur(); Keyboard.dismiss(); setPanel(false); };
  const fold = () => { if (panel) answered(); };
  // The filter sheet (`CollectionFilterSheet`), opened by the glyph
  // beside the title and by the chosen words under the box. The keyboard
  // goes: the sheet rises from where it stood.
  const [filterOpen, setFilterOpen] = useState(false);
  const openFilters = () => { Keyboard.dismiss(); setFilterOpen(true); };
  // One choice in the row under the box: its words, which open the sheet
  // as the glyph does, and a ✕ of its own that lets go of it and nothing else
  // (owner, 25 Oct 2026: with two choices on, letting go of one was a tap
  // on a ✕, and the board's single "Clear all" made it two). Two targets
  // side by side rather than one inside the other: VoiceOver reads an
  // element that is a button as one thing, and a ✕ inside it would never
  // be reached.
  const chosenItem = (
    label: string,
    glyph: { icon: keyof typeof Ionicons.glyphMap } | null,
    letGo: () => void,
    testID: string | undefined,
  ) => (
    <View style={s.chosenItem} testID={testID}>
      <PressableScale
        style={s.chosenWordsSlot}
        contentStyle={s.chosenWords}
        scaleTo={0.98}
        haptic="selection"
        onPress={openFilters}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('Opens the filters', 'Mở bộ lọc', 'フィルターを開く', '打开筛选', '開啟篩選')}
      >
        {/* The word's ink, as the rows' glyphs wear it — see `UnderlineChoice`. */}
        {glyph ? <Ionicons name={glyph.icon} size={16} color={colors.text} /> : null}
        <Text style={s.chosenText} numberOfLines={1}>{label}</Text>
      </PressableScale>
      <PressableScale
        contentStyle={s.chosenX}
        scaleTo={0.9}
        haptic="selection"
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 8 }}
        onPress={letGo}
        accessibilityRole="button"
        accessibilityLabel={`${t('Remove', 'Bỏ', '外す', '移除', '移除')} ${label}`}
      >
        <Ionicons name="close" size={14} color={colors.textTertiary} />
      </PressableScale>
    </View>
  );

  // What this box remembered, in its own drawer — the visits screen's
  // mechanism, for its reasons: kept when a search *worked* (a card
  // opened, or the return key), never on a keystroke.
  const [recents, keepRecents] = useStored(COLLECTION_RECENTS_KEY, NO_RECENTS, RECENTS);
  const noteSearch = () => {
    const next = rememberSearch(recents, query);
    if (next !== recents) keepRecents(next);
  };
  const suggestions = recents
    .filter((term) => term.toLowerCase().includes(q.toLowerCase()) && term.trim() !== q)
    .slice(0, RECENTS_SHOWN);

  // Guests have one shelf and no switch; see the tabs below.
  const onYours = !!session && tab === 'yours';
  // Every member with the words a reader types for its city — the sift
  // matches "da nang" against a member's city as it does against its
  // name. Built once per catalog, not per keystroke.
  const pairOf = useCallback((c: Collection): { c: Collection; members: SiftMember[] } => ({
    c,
    members: membersOf(c, places).map((p): SiftMember => ({ ...p, city_name: cityName(p.city_id) })),
  }), [places, cityName]);
  const shelf = useMemo(
    () => (onYours ? mine.data : community).map(pairOf),
    // `community` is derived from `cols.data`, `me` and `places`, all listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onYours, mine.data, cols.data, me, places, pairOf],
  );
  // The chips a shelf can offer: only what its lists actually hold, so no
  // chip leads to an empty shelf. A city group with one city is a fact
  // and not a choice — unless a chip is already chosen, when the group
  // is the way back to it.
  const cityChoices = useMemo(() => collectionCities(shelf), [shelf]);
  // Every name a city answers to, for the filter's city search: the city
  // sheet's list (`CitySwitcher`), so "saigon" finds Sài Gòn whatever
  // language the app is in.
  const cityNames = (id: string) => {
    const c = cities.find((x) => x.id === id);
    return c ? [c.short_en, c.short_vi, c.short_ja, c.name_en, c.name_vi, c.name_ja] : [id];
  };
  const kindChoices = useMemo(() => collectionKinds(shelf), [shelf]);
  const scopeCity = cityPick;
  const offerCities = cityChoices.length > 1 || (cityChoices.length === 1 && cityChoices[0] !== scopeCity);
  const asked = !!(q || kind || cityPick);

  const hits = useMemo(
    () => siftCollections(shelf, { query: q, city: scopeCity, kind }),
    [shelf, q, scopeCity, kind],
  );
  const hitBy = useMemo(() => new Map(hits.map((h) => [h.c.slug, h])), [hits]);

  // The chips' own labels, as the heading and the cards' reasons print
  // them. The words themselves are `lib/collectionShelf`'s.
  const chosen = [
    kind ? categoryLabel(kind, t) : null,
    cityPick ? cityName(cityPick) : null,
  ].filter((x): x is string => !!x);
  const placesOf = (n: number) => placesCount(n, t);
  // A row's like count, as a screen reader says it: the row prints the
  // number bare beside its heart, and a bare number aloud is just a number.
  const likesSaid = (n: number) => t(n === 1 ? '1 like' : `${n} likes`, `${n} lượt thích`, `いいね${n}件`, `${n} 个赞`, `${n} 個讚`);
  // Who can see a list of yours, in words, for VoiceOver: on screen the
  // globe or the lock says it, and a glyph is not read out.
  const visibilityOf = (c: { is_public?: boolean | null }) => (c.is_public
    ? t('Public', 'Công khai', '公開', '公开', '公開')
    : t('Private', 'Riêng tư', '非公開', '私密', '私密'));
  const reasonFor = (slug: string) => shelfReason(hitBy.get(slug), chosen, t);
  // The line under the title (owner, 2 Nov 2026). At rest it says what
  // the tab is, in a sentence: "39 collections · 7 cities" read as a
  // ledger, and the count is the one thing the grid under it already
  // shows. Asked anything — words in the box, a kind, a city — it goes
  // back to the count and the chips (`scopeLine`), since then the line is
  // the answer to the question and the only place the chips are named.
  const scope = asked
    ? scopeLine({ count: hits.length, chosen, cities: cityChoices, cityName }, t)
    : !onYours
      ? t('Good corners, through the community’s eyes.', 'Những góc hay, qua lăng kính cộng đồng.', 'みんなの目で見つけた、いい場所。', '社区眼中的好去处。', '社群眼中的好去處。')
      : t('Your own favourite places.', 'Nơi chốn yêu thích của riêng bạn.', 'あなただけのお気に入りの場所。', '专属于你的心仪去处。', '專屬於你的心儀去處。');

  // `loaded`, not `!loading`: the focus refresh flips `loading` back on,
  // and hiding the list for that made a visit look like a double load.
  const mineReady = mine.loaded;
  // The shelf, as the sift ordered it — the catalog's own order, newest
  // first, when nothing is asked (it said "by likes" here, and never was);
  // lists found by their own words first and then by hits when it is.
  // Memoised with `hits`: the city blocks and the sections are built from
  // it, and a new array every render rebuilt them every render — see the
  // freeze noted at `onSeen`.
  const sifted = useMemo(() => hits.map((h) => h.c), [hits]);

  // Community explores by default; Yours keeps its management grid and
  // its existing preference. A separate key lets either shelf remember a
  // choice without the other tab changing it. Guests explore in Mosaic too.
  const { width: winW } = useWindowDimensions();
  const gcardW = Math.round((winW - space.page * 2 - space.cardGap) / 2);
  const gcardH = Math.round(gcardW * 1.18);
  // The reading row's cover, at the share of the card COVER is on a
  // 393pt phone and never wider. Fixed at 126 it left the text column
  // 118pt on a 320pt window — an SE, or any iPhone with Display Zoom on
  // — which is thirteen characters a line where the blurb's two lines
  // were budgeted for twenty-three. At 320 this comes out at 99, and the
  // column keeps 145.
  const coverW = Math.min(COVER, Math.round((winW - space.page * 2) * 0.36));
  const [ownView, pickOwnView] = useStored<'tile' | 'row'>(VIEW_KEY, 'tile', TILE_OR_ROW);
  const [communityView, pickCommunityView] = useStored<'row' | 'tile' | 'mosaic'>(COMMUNITY_VIEW_KEY, 'mosaic', COMMUNITY_VIEWS);
  const view = onYours ? ownView : communityView;

  // Tiles pack two to a row-item; see `ShelfRow` for why every row-item
  // carries whose it is and where it sits in the whole list.
  //
  // The Community Mosaic at rest is one block a city, each under its name
  // (owner, 5 Nov 2026); see `mosaicGroups` for the order and for what was
  // ruled out. Asked anything, it is one shelf again, in the answer's
  // order — a chip already says which city, and a search ranks by hits.
  const groups = useMemo(() => (onYours || communityView !== 'mosaic' || asked ? null : mosaicGroups(sifted, {
    cityOf: (c) => leadingCity(membersOf(c, places).map((p) => p.city_id), c.city_id),
    kindOf: (c) => listKinds(membersOf(c, places), { hidden: c.kinds_hidden ?? [] })[0] ?? null,
    likes: rankLikes,
    home: here?.id,
  })), [onYours, communityView, asked, sifted, places, rankLikes, here?.id]);
  // Memoised: a new array here makes the list reset what it has reported
  // in view and report it again — see the freeze noted at `onSeen`.
  const sections: Section[] = useMemo(() => (onYours
    ? (mineReady ? [{ own: true, data: shape(sifted, true, ownView) }] : [])
    : groups?.length
      ? groups.map((g) => ({ own: false, data: g.rows, city: { id: g.city, count: g.count } }))
      : [{ own: false, data: communityView === 'mosaic' ? mosaicRows(sifted) : shape(sifted, false, communityView) }]
  ), [onYours, mineReady, sifted, ownView, groups, communityView]);
  const atCity = atKey == null ? null : sections.find((x) => x.city && (x.city.id ?? '') === atKey)?.city ?? null;

  // ── the city you are in, pinned, and a way to the others (owner,
  // 6 Nov 2026) ──
  //
  // Six blocks, the first sixteen lists long: a reader after Huế scrolled
  // past thirty cards to find it, and half-way down nothing on screen said
  // which city the cards were in. The block's heading now rides under the
  // pinned tabs once its own has gone up past them, and either heading
  // opens the list of cities to jump to.
  //
  // Rejected, from the same reference: a "preferred city" setting of this
  // tab's own. The reader's city already leads, and a third place to pick
  // a city — after the app's city and the filter's — would leave nobody
  // sure which one decides what. A jump does the job without being a
  // setting.
  //
  // Which block is under the row is read from what the list says is in
  // view: the section of the first row on screen. While that block's own
  // heading is still in view — it is the header token of the same section,
  // ahead of its rows — the pinned copy stays away, so the name is never
  // printed twice.
  //
  // ── the freeze it shipped with (6 Nov 2026) ──
  //
  // The state is the city's key, a string, which React drops when it is
  // unchanged, and the sections are memoised, so a render the list did not
  // cause hands it the same data: a list given new `data` reports what is
  // in view again (`resetViewableIndices`), and an object in state would
  // turn every report into a render. These were the first guess at the
  // 6 Nov freeze and did not cure it — the cause was `rowKey`'s, above —
  // but they keep the report from costing a render it does not need.
  //
  // The first block draws no heading of its own (see `renderSectionHeader`),
  // so its slot in view says nothing: its rows count as the first city's
  // from the top, and the pinned bar names it as soon as the tabs pin.
  const firstSection = useRef<Section | undefined>(undefined);
  firstSection.current = sections[0];
  const onSeen = useRef(({ viewableItems }: Seen) => {
    const sectionOf = (v: Seen['viewableItems'][number]) => v.section as Section | undefined;
    const row = viewableItems.find((v) => v.index != null && sectionOf(v)?.city);
    const heading = row && row.section !== firstSection.current
      && viewableItems.find((v) => v.index == null && v.section === row.section);
    setAtKey(row && !heading ? (sectionOf(row)!.city!.id ?? '') : null);
  }).current;
  // One retry per jump, never a chase: a block the list still cannot
  // reach after it has scrolled near it stays where the scroll left it.
  const jumpRetried = useRef(false);
  const jumpTo = (sectionIndex: number, again = false) => {
    jumpRetried.current = again;
    setJumpOpen(false);
    scrollRef.current?.scrollToLocation({
      sectionIndex, itemIndex: 0, viewOffset: pinned ? tabsHRef.current : 0, animated: true,
    });
  };
  const cityWord = (id: string | null) => (id
    ? cityName(id)
    : t('Elsewhere', 'Nơi khác', 'その他の街', '其他城市', '其他城市'));
  const jumpActions: SheetAction[] = (groups ?? []).map((g, i) => ({
    key: g.city ?? 'elsewhere',
    icon: 'location-outline' as const,
    title: cityWord(g.city),
    desc: listsWord(g.count, t),
    selected: atCity ? atCity.id === g.city : i === 0,
    onPress: () => jumpTo(i),
  }));
  const cityHead = (city: { id: string | null; count: number }, pinnedCopy: boolean) => (
    <PressableScale
      onPress={() => setJumpOpen(true)}
      contentStyle={pinnedCopy ? [s.cityBar, !session && s.cityBarAlone] : s.cityHead}
      // Under the tabs the bar takes their 14 below for its reach up, so
      // the target is 14 + the line + 12 — past 44 — with nothing of the
      // tabs' own under it.
      hitSlop={pinnedCopy && session ? { top: TABS_ROW_GAP } : undefined}
      testID={pinnedCopy ? 'collections-city-bar' : `collection-mosaic-city-${city.id ?? 'elsewhere'}`}
      accessibilityRole="button"
      accessibilityLabel={`${cityWord(city.id)}, ${listsWord(city.count, t)}`}
      accessibilityHint={t('Go to another city', 'Đến thành phố khác', '別の都市へ移動', '前往其他城市', '前往其他城市')}
    >
      <Text style={pinnedCopy ? s.cityBarName : s.cityHeadName} numberOfLines={1}>{cityWord(city.id)}</Text>
      <Ionicons name="chevron-down" size={pinnedCopy ? 16 : 18} color={colors.textSecondary} style={s.cityHeadChevron} />
      <Text style={[s.cityHeadCount, pinnedCopy && s.cityBarCount]}>{listsWord(city.count, t)}</Text>
    </PressableScale>
  );

  // Not while the panel is up: the box it would focus is already open.
  const dock = useDockOffer(ducked && deep && !panel && !holding && !(pinned && headerExpanded), navigation);
  // The dock's search: the box, at the top of the list, focused — which
  // opens the panel as a tap on it does.
  const findFromDock = () => { toTop(); inputRef.current?.focus(); };

  // The tab bar's own glyph for your shelf; the globe every public row
  // already wears for everyone else's. Guests have no library, so they
  // get the one half with no switch in front of it. Drawn twice: in the
  // list, where it is measured (`tabsY`), and as the pinned copy once
  // the list has carried it to the top — see `pinned`. The copy has no
  // test names, so a test finds exactly one of each.
  const tabsRow = (floating: boolean) => (session ? (
      <UnderlineTabs
        tabs={[
          { key: 'yours', icon: 'bookmark-outline', label: t('Yours', 'Của bạn', '自分の', '我的', '我的'), testID: floating ? undefined : 'collections-yours' },
          { key: 'community', testID: floating ? undefined : 'collections-community', icon: 'globe-outline', label: t('Community', 'Cộng đồng', 'みんなの', '社区', '社群') },
        ]}
        active={tab}
        onChange={pickTab}
        // The community adds Mosaic to the existing list/grid capsule.
        right={(
          <View style={s.viewToggle}>
            {(onYours ? ['row', 'tile'] as const : ['row', 'tile', 'mosaic'] as const).map((v) => (
              <PressableScale
                key={v}
                contentStyle={[s.viewBtn, view === v && s.viewBtnOn]}
                scaleTo={0.9}
                haptic="selection"
                // Keep the capsule compact; extend the outer edges and the
                // vertical hit area without overlapping neighbouring modes.
                hitSlop={v === 'row'
                  ? { top: 11, bottom: 11, left: 18, right: 1 }
                  : { top: 11, bottom: 11, left: 1, right: v === 'mosaic' || onYours ? 18 : 1 }}
                onPress={() => {
                  if (onYours && v !== 'mosaic') pickOwnView(v);
                  else pickCommunityView(v);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: view === v }}
                aria-selected={view === v}
                testID={floating ? undefined : `collections-view-${v}`}
                accessibilityLabel={v === 'mosaic'
                  ? t('Mosaic view', 'Dạng Mosaic', 'モザイク表示', '拼贴视图', '拼貼檢視')
                  : v === 'tile'
                  ? t('Tile view', 'Dạng lưới', 'タイル表示', '卡片视图', '卡片檢視')
                  : t('List view', 'Dạng danh sách', 'リスト表示', '列表视图', '列表檢視')}
              >
                <Ionicons
                  name={v === 'mosaic' ? 'albums-outline' : v === 'tile' ? 'grid-outline' : 'list-outline'}
                  size={14}
                  color={view === v ? colors.accent : colors.textTertiary}
                />
              </PressableScale>
            ))}
          </View>
        )}
      />
  ) : null);

  // What the filters chose, under the box: the words, each with its ✕,
  // so a filter that is on is never one the reader cannot see. Pinned
  // with the tabs once they reach the top. The filter glyph that led the
  // row is beside the title now (`filterButton`).
  const chosenRow = (floating: boolean) => (!holding && (cityPick || kind) ? (
    <View style={s.chosen} testID={floating ? undefined : 'collections-chosen'}>
      {cityPick && chosenItem(cityName(cityPick), null, () => setCityPick(null), floating ? undefined : 'collections-chosen-city')}
      {kind && chosenItem(categoryLabel(kind, t), CATEGORIES[kind] ?? null, () => setKind(null), floating ? undefined : 'collections-chosen-kind')}
    </View>
  ) : null);

  // The filter, beside the title (owner, 25 Oct 2026): Explore's glyph,
  // in Explore's two states — ink at rest, coral with a count once
  // something is applied (see the note on Explore's own) — and the sheet
  // behind it. It opens only where the shelf has a choice to make, or one
  // is on. For a signed-in reader it is drawn either way, dimmed when
  // there is nothing to choose: the owner found it missing on an empty
  // Yours (26 Oct 2026), and a glyph that came and went with the tab
  // moved the title, as the pill once did.
  const filterCount = (cityPick ? 1 : 0) + (kind ? 1 : 0);
  const canFilter = offerCities || kindChoices.length > 1 || filterCount > 0;
  const filterButton = (floating: boolean) => (canFilter || session ? (
    <PressableScale
      contentStyle={[s.filterBtn, !canFilter && s.filterOff]}
      scaleTo={0.94}
      haptic="selection"
      hitSlop={4}
      onPress={openFilters}
      disabled={!canFilter}
      aria-disabled={!canFilter}
      accessibilityRole="button"
      accessibilityLabel={filterCount > 0
        ? `${t('Filters', 'Bộ lọc', 'フィルター', '筛选', '篩選')}, ${filterCount}`
        : t('Filters', 'Bộ lọc', 'フィルター', '筛选', '篩選')}
      testID={floating ? undefined : 'collections-filters'}
    >
      <Ionicons name="options-outline" size={19} color={filterCount > 0 ? colors.accent : colors.textSecondary} />
      {filterCount > 0 ? (
        <View style={s.filterBadge}>
          <Text style={s.filterBadgeText}>{filterCount}</Text>
        </View>
      ) : null}
    </PressableScale>
  ) : null);
  const filtersApplied = useMemo<CollectionFilters>(() => ({ city: cityPick, kind }), [cityPick, kind]);

  // Everything above the shelf, as the list's own header since 25 Oct
  // 2026 (owner): the title, the line under it, the tabs, the box and its
  // panel go up with the shelf, as Explore's hero does, and the tabs pin
  // at the top once they get there. Fixed, they took a third of the phone
  // from the lists. Measured, for the dock: past its foot is "deep".
  const top = (floating = false) => (
    <View
      onLayout={floating ? undefined : (e) => { topHRef.current = Math.round(e.nativeEvent.layout.height); }}
      testID={floating ? 'collections-floating-top' : 'collections-top'}
      // Preserve layout while exposing only one copy to touch and a11y.
      style={!floating && pinned && session ? [s.hiddenHeader, { height: topHRef.current }] : undefined}
      pointerEvents={!floating && pinned && session ? 'none' : 'auto'}
      accessibilityElementsHidden={!floating && pinned && !!session}
      importantForAccessibility={!floating && pinned && session ? 'no-hide-descendants' : 'auto'}
      aria-hidden={!floating && pinned && !!session}
    >
      <ScreenTitle
        title={t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')}
        accessory={filterButton(floating)}
        right={session ? (
          <AddPill
            quiet
            label={t('New', 'Tạo mới', '新規', '新建', '新增')}
            onPress={startNew}
            accessibilityLabel={t('New collection', 'Bộ sưu tập mới', '新しいコレクション', '新建合集', '新增合集')}
            testID={floating ? 'collection-floating-new' : 'collection-new'}
          />
        ) : undefined}
      />
      {/* The line under the title is in the body, as the Trips lede is,
          and not the header's `lede`: the header row aligns its right
          slot to the bottom of the title column, so a line in that
          column drops the pill a line below the title — the owner saw
          the two screens' pills at two heights (14 Oct 2026). */}
      {!holding && (onYours ? mineReady : true) ? (
        <Text style={s.scope} numberOfLines={1} testID={floating ? 'collections-floating-scope' : 'collections-scope'}>{scope}</Text>
      ) : null}
      <View onLayout={floating ? undefined : (e) => { tabsYRef.current = Math.round(e.nativeEvent.layout.y); }} testID={floating ? 'collections-floating-tabs' : 'collections-tabs'}>
        {tabsRow(floating)}
      </View>
      {/* The box, and the panel it opens. It stood outside the list
          until 25 Oct 2026 — a box that scrolled away with the shelf was
          the one the owner's review of 14 Oct called hard to find — and
          goes up with the shelf now, because the dock brings it back from
          any depth (`findFromDock`) and the screen it took is the lists'. */}
      {!holding && (
        <View style={s.searchRow}>
          <SearchField
            inputRef={!floating && pinned && headerExpanded && session ? undefined : inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setPanel(true)}
            onSubmitEditing={noteSearch}
            testID={{ input: floating ? 'collections-floating-input' : 'collections-input', cancel: floating ? 'collections-floating-cancel' : 'collections-cancel' }}
            // The four things it answers by, named in the box itself.
            // A person, not "@username" (owner, 21 Oct 2026): on a phone
            // the box cut it to "@use…", which read as nothing, and the
            // search finds a curator by the handle typed with or without
            // the @ anyway. No "or": a list of four needs no conjunction
            // to be read as one.
            placeholder={t('Name, place, city, user', 'Tên, địa điểm, thành phố, người dùng', '名前・スポット・都市・ユーザー', '名称、地点、城市、用户', '名稱、地點、城市、使用者')}
            // Inside the box, while the panel is up or anything it chose
            // is still on — see `SearchField`.
            cancel={{ shown: panel || !!q, label: t('Cancel', 'Hủy', 'キャンセル', '取消', '取消'), onPress: cancel }}
          />
        </View>
      )}
      {chosenRow(floating)}
      {/* Drawn only when there is something in it: the box's own
          placeholder already says what it answers, and a hint under it
          saying the same was the owner's to strike (25 Oct 2026). */}
      {!holding && panel && suggestions.length > 0 && (
        <View style={s.panel} testID={floating ? 'collections-floating-panel' : 'collections-panel'}>
          {suggestions.length > 0 && (
            <Card style={s.recents}>
              <View style={s.legendRow}>
                <Text style={s.legend}>{t('Suggestions', 'Gợi ý', '候補', '推荐', '推薦')}</Text>
                <PressableScale
                  onPress={() => keepRecents([])}
                  scaleTo={0.92}
                  hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('Clear suggestions', 'Xóa gợi ý', '候補を消去', '清除推荐', '清除推薦')}
                >
                  <Text style={s.clear}>{t('Clear', 'Xóa', '消去', '清除', '清除')}</Text>
                </PressableScale>
              </View>
              {suggestions.map((term) => (
                <PressableScale
                  key={term}
                  contentStyle={s.suggestion}
                  scaleTo={0.97}
                  onPress={() => { setQuery(term); answered(); }}
                  accessibilityRole="button"
                  accessibilityLabel={term}
                >
                  <Ionicons name="search-outline" size={17} color={colors.textTertiary} />
                  <Text style={s.suggestionText} numberOfLines={1}>{term}</Text>
                </PressableScale>
              ))}
            </Card>
          )}
        </View>
      )}
    </View>
  );

  const mosaicCard = ({ c, at }: MosaicEntry<Collection>, width: number, height: number, featured = false) => {
    const caption = mosaicCaption(c.slug);
    const below = caption === 'below';
    const uri = coverFor(c);
    const title = t(c.title_en, c.title_vi, c.title_ja);
    const author = c.curator_handle ? atHandle(c.curator_handle) : '';
    const blurb = featured && !below ? t(c.desc_en, c.desc_vi, c.desc_ja)?.trim() : '';
    const words = (
      <View style={[
        s.mosaicWords,
        below && s.mosaicWordsBelow,
        featured && !below && s.mosaicWordsFeatured,
      ]}>
        <Text
          style={[s.gcardTitle, featured && s.mosaicTitleFeatured, below ? s.mosaicTitleBelow : s.mosaicInkShadow]}
          numberOfLines={2}
        >{title}</Text>
        {blurb ? <Text style={[s.mosaicBlurb, s.mosaicInkShadow]} numberOfLines={2}>{blurb}</Text> : null}
        {author ? <Text style={[s.mosaicAuthor, below ? s.mosaicAuthorBelow : s.mosaicInkShadow]} numberOfLines={1}>{author}</Text> : null}
      </View>
    );
    return (
      <PressableScale
        key={c.slug}
        contentStyle={[s.mosaicCard, { width, height }]}
        onPress={() => { noteSearch(); navigation.navigate('CollectionDetail', { slug: c.slug }); }}
        testID={`collection-card-${at}`}
        accessibilityRole="button"
        accessibilityLabel={`${title}${author ? `, ${author}` : ''}`}
      >
        <View style={s.mosaicPhoto} testID={`collection-mosaic-${c.slug}-${caption}`}>
          {uri
            ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <EmptyCover />}
          {!below ? (
            // The dark lives inside the caption, so it is exactly as long
            // as the words are, and the tail hangs off its far side into
            // the photograph — no measuring, no first frame without it.
            // Both run from the edge the caption sits on. See `mosaicScrim`.
            <View
              style={[s.mosaicOverlay, caption === 'top' ? s.mosaicWordsTop : s.mosaicWordsBottom]}
              pointerEvents="none"
              testID={`collection-mosaic-scrim-${c.slug}`}
            >
              <LinearGradient
                colors={mosaicScrim.body}
                start={{ x: 0, y: caption === 'top' ? 0 : 1 }}
                end={{ x: 0, y: caption === 'top' ? 1 : 0 }}
                style={StyleSheet.absoluteFill}
                testID={`collection-mosaic-body-${c.slug}`}
              />
              <LinearGradient
                colors={mosaicScrim.tail}
                locations={mosaicScrim.tailLocations}
                start={{ x: 0, y: caption === 'top' ? 0 : 1 }}
                end={{ x: 0, y: caption === 'top' ? 1 : 0 }}
                style={[s.mosaicTail, caption === 'top' ? s.mosaicTailBelow : s.mosaicTailAbove]}
                testID={`collection-mosaic-tail-${c.slug}`}
              />
              {words}
            </View>
          ) : null}
        </View>
        {below ? words : null}
      </PressableScale>
    );
  };

  return (
    // The door to a new list is the Trips screen's pill, in the header's
    // right, on both tabs for every signed-in reader. It was a dashed row at
    // the foot of the list, on the argument that the tab always showed
    // one door and a "New" pill on the heading was the same action a
    // third time. True at four lists and wrong at fifteen: the owner's
    // review (14 Oct 2026) found the row only by scrolling past every
    // list to reach it. The empty library keeps its own card and button,
    // as Trips keeps its first-trip card, and until 26 Oct 2026 the pill
    // stood down beside it so as not to be a second door. The owner saw
    // what that cost: the header lost the pill's height, and the title
    // and the tabs under it sat higher on an empty Yours than on
    // Community. Two doors to one room is the smaller fault.
    //
    // On Community it shows for every signed-in reader, lists or none
    // (owner, 16 Oct 2026): browsing other people's lists is when the idea
    // for one of your own arrives, and the pill coming and going with the
    // tab moved the title under the reader's thumb. It was hidden there on
    // the argument that Community's lists are not yours to add to — true,
    // but the pill never added to them; it starts one of yours, and
    // `startNew` takes the reader to Yours once it exists. Guests have no
    // library, so no pill.
    <Screen
      title={t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')}
      // The title is the list's to draw, and goes up with it — see `top`.
      titleScrolls
    >
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {holding || (colsFail && cols.data.length === 0) ? top() : null}
        {holding && (
          <View>
            <GuestNotice navigation={navigation} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.row}>
                <Card style={s.card}>
                  <Skeleton style={[s.thumb, { width: coverW }]} />
                  <View style={s.cardText}>
                    <RowGhost byline />
                    <View style={s.cardFace}>
                      <Skeleton style={{ height: 18, width: '70%', borderRadius: 8 }} />
                      <Skeleton style={{ height: 13, width: '45%', borderRadius: 7 }} />
                    </View>
                  </View>
                </Card>
              </View>
            ))}
          </View>
        )}
        {/* A failed read is the body only when there is nothing under it.
            With a shelf already in hand — the launch cache, or the last
            fetch that worked — it is a banner above the shelf, and the
            shelf stays; see `components/loadFail`. */}
        {!holding && colsFail && cols.data.length === 0 && (
          <LoadFailEmpty kind={colsFail} onRetry={cols.reload} testID="collections-load-fail" />
        )}
        {!holding && !(colsFail && cols.data.length === 0) && (
          <SectionList
            testID={cols.loaded && !cols.loading && !cols.fromCache && !cols.error && placesLoaded && !placesLoading ? 'collections-ready' : undefined}
            ref={scrollRef}
            sections={sections}
            keyExtractor={rowKey}
            onScroll={onShelfScroll}
            onScrollBeginDrag={fold}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            // The banner under the title rather than over it, now that the
            // title is the list's.
            ListHeaderComponent={(
              <>
                {top()}
                {colsFail && cols.data.length > 0 ? (
                  <LoadFailBanner kind={colsFail} onRetry={cols.reload} testID="collections-load-banner" />
                ) : null}
                <GuestNotice navigation={navigation} />
              </>
            )}
            renderItem={({ item }) => {
              if (item.kind === 'mosaic') {
                const width = winW - space.page * 2;
                return (
                  <View style={s.gridRow} testID={`collection-mosaic-row-${item.layout}`}>
                    {item.layout === 'feature'
                      ? mosaicCard(item.items[0], width, Math.round(gcardW * 1.28), true)
                      : item.layout === 'stack' ? (
                        <>
                          {mosaicCard(item.items[0], gcardW, gcardH * 2 + space.cardGap)}
                          <View style={{ gap: space.cardGap }}>
                            {item.items.slice(1).map((entry) => mosaicCard(entry, gcardW, gcardH))}
                          </View>
                        </>
                      ) : item.items.map((entry) => mosaicCard(entry, gcardW, gcardH))}
                  </View>
                );
              }
              if (item.kind === 'pair') {
                return (
                  <View style={s.gridRow}>
                    {item.pair.map((c, j) => {
                      const uri = coverFor(c);
                      const members = membersOf(c, places).length;
                      const reason = reasonFor(c.slug);
                      const my = !!c.id && myLikes.includes(c.id);
                      const fresh = isNewList(c, now);
                      return (
                        <PressableScale
                          key={c.slug}
                          contentStyle={[s.gcard, { width: gcardW, height: gcardH }]}
                          onPress={() => { noteSearch(); navigation.navigate('CollectionDetail', { slug: c.slug }); }}
                          testID={item.own ? undefined : `collection-card-${item.at + j}`}
                          accessibilityRole="button"
                          accessibilityLabel={item.own
                            ? `${t(c.title_en, c.title_vi, c.title_ja)}${fresh ? `, ${newWord}` : ''}, ${visibilityOf(c)}`
                            : `${t(c.title_en, c.title_vi, c.title_ja)}${fresh ? `, ${newWord}` : ''}`}
                        >
                          {uri
                            ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                            : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
                          {/* The Explore shelf's scrim, the one `coverScrim`
                              — same object, same card language, second
                              surface. It began at 55% here once, to give the
                              picture back; that left a white photograph's
                              title at 2.5:1. See `coverScrim`. */}
                          <LinearGradient
                            colors={coverScrim.colors}
                            locations={coverScrim.locations}
                            style={StyleSheet.absoluteFill}
                            testID="collection-card-scrim"
                          />
                          {fresh ? <NewBadge /> : null}
                          {/* ── only the exception is marked (owner, 2 Nov 2026) ──
                              A private list of yours wears a padlock in the
                              top-right corner; a public one wears nothing.
                              The globe stood in every tile's foot, and most
                              of your lists are public (five of six on the
                              owner's screen), so it said the default on
                              nearly every tile. The padlock alone says the
                              one thing that differs, and its absence reads
                              as "anyone can see this".

                              In a 24pt disc of the card ground, the "New"
                              badge's own (top-left, 10pt in), so the two
                              marks on a photograph are one kind of thing:
                              a bare glyph under the scrim's 0.22 top was
                              lost on a white sky. VoiceOver still hears
                              Public or Private in the tile's name. */}
                          {item.own && !c.is_public ? (
                            <View style={s.gcardLock} testID="collection-tile-lock">
                              <Ionicons name="lock-closed" size={12} color={colors.text} />
                            </View>
                          ) : null}
                          <View style={s.gcardText}>
                            <Text style={s.gcardTitle} numberOfLines={1}>
                              {t(c.title_en, c.title_vi, c.title_ja)}
                            </Text>
                            {/* One meta line, not two.
                                
                                The byline had a row and the count-and-heart
                                had another, and between them they put three
                                lines of text over 40% of the photograph —
                                in the view whose whole reason is the
                                photograph. They are one row now: who made
                                it on the left, the heart on the right.

                                Whose list this is, said with a face: the
                                avatar beside the handle carries the whole
                                of "by", so the word goes. The list rows do
                                the same now, and the detail screen did it
                                before either — three surfaces, one grammar,
                                no verb in any of them. On your own tab neither
                                appears — the byline would only say your own
                                name — and the padlock, which once led this
                                row, sits in the top corner now, private
                                lists only. */}
                            <View style={s.gcardFoot} testID="collection-tile-foot">
                              {!item.own && c.curator_handle ? (
                                <>
                                  <Avatar url={c.owner_id ? faces[c.owner_id]?.avatar_url : undefined} size={18} />
                                  <Text style={s.gcardBy} numberOfLines={1}>
                                    {atHandle(c.curator_handle)}
                                  </Text>
                                </>
                              ) : null}
                              {/* How many places, on your own tiles only.

                                  Dropped from other people's tiles because
                                  it is the weakest of the four things this
                                  card can say: ten places against seven
                                  rarely decides a tap, where who made it and
                                  how many liked it do — and the like count
                                  also explains the order the shelf is in.
                                  The full number is still one tap away, and
                                  still on the list view, which is the view
                                  for reading rather than looking.

                                  Zero is said in words rather than as a
                                  count. A list you made and never filled is
                                  the one size that changes what you do next
                                  — and only yours can be empty here: the
                                  community shelf drops empty lists before
                                  they reach a tile (see `visible`). */}
                              {/* Narrowed, the reason stands in for the count
                                  on every tile — the one time a community
                                  tile says anything about its places, since
                                  which of them the chip reached is what the
                                  reader just asked. */}
                              {reason ? (
                                <Text style={s.gcardMeta} numberOfLines={1}>{reason}</Text>
                              ) : item.own && (members === 0 ? (
                                <Text style={s.gcardMeta} numberOfLines={1}>
                                  {t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません', '还没有地点', '還沒有地點')}
                                </Text>
                              ) : (
                                // The pin and the figure (owner, 2 Nov 2026),
                                // as on the Explore shelf and the list's own
                                // card; spoken in full.
                                <View
                                  style={s.gcardCount}
                                  accessible
                                  accessibilityLabel={placesOf(members)}
                                  testID="collection-tile-count"
                                >
                                  <Ionicons name="location-outline" size={13} color={onPhoto.textSecondary} />
                                  <Text style={s.gcardMeta}>{members}</Text>
                                </View>
                              ))}
                              {/* Only where a like is possible: a private
                                  list is one nobody may like, and a heart
                                  on it would be an invitation to nothing.

                                  On your own tile too, the same control
                                  (owner, 17 Oct 2026): a curator may like
                                  their own list, and it draws at any count
                                  — the list nobody has liked yet is the
                                  one that most needs the invitation. */}
                              {c.id && c.is_public ? (
                                <PressableScale
                                  style={{ marginLeft: 'auto' }}
                                  contentStyle={s.gcardLikes}
                                  scaleTo={0.82}
                                  haptic="none"
                                  hitSlop={{ top: 14, bottom: 14, left: 16, right: 12 }}
                                  onPress={() => onHeart(c)}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: my }}
                                  accessibilityLabel={my
                                    ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す', '取消点赞这个合集', '取消按讚這個合集')
                                    : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね', '点赞这个合集', '按讚這個合集')}
                                >
                                  <Ionicons
                                    name={my ? 'heart' : 'heart-outline'}
                                    size={15}
                                    color={my ? onPhoto.accent : onPhoto.text}
                                  />
                                  {likesWorthShowing(likes[c.slug]) && (
                                    <Text style={s.gcardMeta}>{likes[c.slug]}</Text>
                                  )}
                                </PressableScale>
                              ) : null}
                            </View>
                          </View>
                        </PressableScale>
                      );
                    })}
                    {item.pair.length === 1 ? <View style={{ width: gcardW }} /> : null}
                  </View>
                );
              }
              // The community row — the tile's facts at reading density:
              // byline instead of padlock, the same heart the tile wears,
              // and nothing behind a swipe, because none of it is yours to
              // edit.
              if (item.kind === 'com') {
                const c = item.c;
                const n = membersOf(c, places).length;
                const reason = reasonFor(c.slug);
                const cover = coverFor(c);
                // The same test the tile makes, for the same glyph: the
                // `pair` branch has asked it all along, and this one never
                // did.
                const my = !!c.id && myLikes.includes(c.id);
                const blurb = t(c.desc_en, c.desc_vi, c.desc_ja)?.trim() || '';
                const fresh = isNewList(c, now);
                const byline = c.curator_handle
                  ? `${t('by', 'bởi', 'by', '来自', '來自')} ${atHandle(c.curator_handle)}, ${reason ?? placesOf(n)}`
                  : undefined;
                return (
                  <View style={s.row}>
                    {/* Named by its title — and, where there is a
                        curator, by the byline sentence below too: a
                        label on the pressable is what a screen reader
                        says for the whole row, so the title alone would
                        silence the one the meta line keeps. */}
                    <PressableScale
                      onPress={() => { noteSearch(); navigation.navigate('CollectionDetail', { slug: c.slug }); }}
                      testID={`collection-card-${item.at}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${t(c.title_en, c.title_vi, c.title_ja)}${fresh ? `, ${newWord}` : ''}${byline ? `, ${byline}` : ''}`}
                    >
                      <Card style={s.card}>
                        <View style={[s.thumb, { width: coverW }]}>
                          {cover
                            ? <Image source={{ uri: cover }} style={s.thumbFill} contentFit="cover" transition={200} />
                            : <EmptyCover />}
                          {fresh ? <NewBadge /> : null}
                        </View>
                        <View style={s.cardText}>
                          <RowGhost byline />
                          <View style={s.cardFace}>
                            <Text style={s.title} numberOfLines={1}>{t(c.title_en, c.title_vi, c.title_ja)}</Text>
                            {/* A face and a handle, and no word between
                                them. This row was the last "by" in the app:
                                the tile dropped it when the avatar arrived,
                                and the detail screen never had one. A verb
                                was never what marked @trang as a person —
                                the `@` does that, and the face does the
                                rest. Repeated down a column the word carried
                                nothing at all, which is what made it visible.

                                The handle leads because the layout leaves no
                                choice. `Avatar` is a sibling `View` in the
                                row, not a glyph inside the text, so it can
                                only sit at the head of the line; with the
                                count still first the face would be reading
                                as the count's. Moving the handle up puts
                                this line in the same order the detail screen
                                uses, which is the order to be in.

                                The seat is drawn whether or not there is a
                                photograph to fill it — `faces` explains why
                                where it is fetched, and the fetch is already
                                paid for by the tiles.

                                The line is the person and nothing else now
                                (owner, 29 Oct 2026): the count that followed
                                the handle went down to the foot, beside the
                                heart, as on your own rows. A long handle had
                                been cut to make room for it. No handle, no
                                line: a list without one has nobody to name,
                                and the ghost keeps the line's height so its
                                row stands as tall as the rest.

                                The label is the part that is not decoration.
                                `Avatar` is `accessible={false}`, so the face
                                says nothing aloud — dropping the word without
                                a label would leave a screen reader saying
                                "@trang" and nothing to mark the handle as a
                                name. So the "by" survives where it is still
                                doing work. */}
                            {c.curator_handle ? (
                              <View style={s.metaRow}>
                                <Avatar url={c.owner_id ? faces[c.owner_id]?.avatar_url : undefined} size={18} />
                                <Text
                                  style={s.meta}
                                  numberOfLines={1}
                                  accessibilityLabel={`${t('by', 'bởi', 'by', '来自', '來自')} ${atHandle(c.curator_handle)}`}
                                >
                                  {atHandle(c.curator_handle)}
                                </Text>
                              </View>
                            ) : null}
                            {/* The sentence the curator wrote, which was
                                the one thing about this list you could
                                search for and not read.
                                `collectionHaystack` has always folded
                                `desc_*` into what a query matches, so the
                                shelf would hand you a list on the strength
                                of a line it never showed you.

                                It earns the height here and nowhere else.
                                The tiles are the looking mode and #430 spent
                                that argument taking text off them; this is
                                the reading mode, and a reading mode that
                                omits the author's own description of the
                                list is the grid with a smaller photograph.
                                What made it urgent is that the shelf has
                                changed under us: the desk's lists described
                                themselves in their titles — "Rooftops with a
                                view", "Cafés worth the detour" — and the
                                lists people make are called "Family",
                                "Study", "Dating". Those titles separate
                                nothing. The sentence is the only thing that
                                does.

                                Two lines, because the column is 176pt wide
                                on a 393pt phone — cover, chevron, and two
                                card paddings take the rest — which is about
                                23 characters a line, and the descriptions
                                average 53. So two lines hold most of the
                                typical one and clamp the long ones; one line
                                would cut the average in half, and three
                                would spend 20pt more on the tail of a
                                minority. It costs the row about 45pt either
                                way, roughly a fifth of a screenful, which is
                                the trade this view exists to make. */}
                            {blurb ? (
                              <Text style={s.blurb} numberOfLines={2}>{blurb}</Text>
                            ) : null}
                            {/* The foot, as on your own rows below: what the list
                                holds, then the heart (owner, 29 Oct 2026). The count
                                left the byline for it, which hands a long handle the
                                width it was being cut at. The pin, because nothing
                                else on this line says what the number counts. */}
                            <View style={s.foot}>
                              <View style={[s.metaRow, s.footFacts]}>
                                <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                                {/* The figure alone beside the pin (owner, 2 Nov 2026);
                                    a reason, when the shelf is narrowed, says more. */}
                                <Text style={s.meta} numberOfLines={1} accessibilityLabel={reason ?? placesOf(n)}>{reason ?? n}</Text>
                              </View>
                              {/* The heart the tile wears, wearing it for the
                                  same reasons. On a public list somebody else
                                  made, this glyph is your own answer and the
                                  way you change it — the tile has always known
                                  that, and this row drew a tally instead:
                                  always filled, always coral, on every row at
                                  once. So a reader who had liked two lists saw
                                  six that claimed they had liked all six.

                                  `accentFaint` was picked to keep the tally
                                  quiet, and it does keep it quiet — on
                                  charcoal, where it resolves to #904035 under
                                  an accent of #FF6F5B. On paper the same token
                                  resolves to #D27161 under an accent of
                                  #C4402C, and a dimmed coral is just coral.
                                  The lesson is in which axis was used: the
                                  split has to be **hue**, not weight. Grey is
                                  a count; coral is you. Weight does not
                                  survive a change of theme.

                                  None of the rest is new either. The glyph
                                  pair, the two colours and the 15pt are what
                                  `CollectionDetailScreen` already draws for
                                  this exact fact, down to the count's gate —
                                  of the three places that show a like, this
                                  row was the only one not drawing it. 15
                                  rather than the tally's 13 because an outline
                                  heart that small spends its ink on a hairline
                                  and reads as a smudge, and because 15 is what
                                  a 15pt `meta` line is tuned for. `hitSlop`
                                  and no haptic of its own come from the tile:
                                  they are what let a button sit inside a row
                                  that is itself the target.

                                  The heart draws at any count. It is a control
                                  now, and the list nobody has liked yet is
                                  precisely the one that needs one. Only the
                                  number keeps the old rule. */}
                              {c.id && c.is_public ? (
                                <PressableScale
                                  style={s.footHeart}
                                  contentStyle={s.likesRow}
                                  scaleTo={0.82}
                                  haptic="none"
                                  hitSlop={{ top: 10, bottom: 10, left: 12, right: 16 }}
                                  onPress={() => onHeart(c)}
                                  accessibilityRole="button"
                                  aria-valuetext={likesWorthShowing(likes[c.slug]) ? likesSaid(likes[c.slug]) : undefined}
                                  accessibilityState={{ selected: my }}
                                  accessibilityLabel={my
                                    ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す', '取消点赞这个合集', '取消按讚這個合集')
                                    : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね', '点赞这个合集', '按讚這個合集')}
                                >
                                  <Ionicons
                                    name={my ? 'heart' : 'heart-outline'}
                                    size={15}
                                    color={my ? colors.accent : colors.textTertiary}
                                  />
                                  {likesWorthShowing(likes[c.slug]) && (
                                    <Text style={s.meta}>{likes[c.slug]}</Text>
                                  )}
                                </PressableScale>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      </Card>
                    </PressableScale>
                  </View>
                );
              }
              const own = item.c;
              const count = membersOf(own, places).length;
              const uri = coverFor(own);
              const ownBlurb = t(own.desc_en, own.desc_vi, own.desc_ja)?.trim() || '';
              // Narrowed to roughly a third of its width, the card has room
              // for a name and a count and nothing else. So the cover comes
              // down to 88pt, the title drops to a single line rather than
              // wrapping into the space the meta needs, and the description
              // goes entirely. All of it rides the same drag as the pin, so
              // the card reflows under your thumb instead of snapping when
              // you let go.
              //
              // Width only, now that the cover's height is the card's. The
              // old pair animated both and had to, because the cover was a
              // square with a height of its own; stretched, the height
              // follows the text and animating it would fight the layout
              // for the length of every swipe.
              const card = (open: boolean, drag: Drag | null, a11y: RowA11y) => (
                <PressableScale
                  onPress={() => { noteSearch(); navigation.navigate('CollectionDetail', { slug: own.slug }); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(own.title_en, own.title_vi, own.title_ja)}, ${visibilityOf(own)}`}
                  {...a11y}
                >
                  <Card style={s.card}>
                    <Animated.View
                      style={[s.thumb, { width: coverW }, drag && {
                        width: Animated.add(coverW, Animated.multiply(drag, (coverW - COVER_OPEN) / ACTIONS_W)),
                      }]}
                    >
                      {uri
                        ? <Image source={{ uri }} style={s.thumbFill} contentFit="cover" transition={200} />
                        : <EmptyCover />}
                    </Animated.View>
                    <View style={s.cardText}>
                      <RowGhost />
                      <View style={s.cardFace}>
                        <Text style={s.title} numberOfLines={1}>{t(own.title_en, own.title_vi, own.title_ja)}</Text>
                        {/* The same sentence, for the same reason, because
                            this is the same view. The argument for showing
                            it is weakest on your own lists — you wrote them
                            — but a reading mode that describes other
                            people's lists and not yours is two designs
                            wearing one toggle.

                            Gone while the row is open, which is the one
                            difference. Open, the card is pinned to about a
                            third of its width and the text column falls
                            from 176pt to roughly 36: the title already
                            drops to a single line rather than wrap into the
                            space the meta needs, and a two-line sentence
                            there would shred into four characters a line.
                            The note above the card says what the open row
                            is for — a name and a count — and a description
                            is exactly what that excludes. */}
                        {!open && ownBlurb ? (
                          <Text style={s.blurb} numberOfLines={2}>{ownBlurb}</Text>
                        ) : null}
                        {/* ── the foot (owner, 29 Oct 2026) ──
                            What the list holds at the start, the heart at the
                            end: the line the list's own screen closes its card
                            with, and the corner the tile keeps its heart in, so
                            the three shapes put each fact in the same place.
                            Pinned to the row's bottom (`foot`), so a list with no
                            description ends where one with a description does.

                            It replaced two lines. The count sat under the title,
                            and the likes had a line of their own, which bought
                            them the word "likes" — the old argument being that a
                            number alone on a line is decoded rather than read.
                            Beside a heart it is read: the tile and the list's own
                            screen have printed it bare all along. Spoken, it is
                            still a sentence: `aria-valuetext`, which React
                            Native reads as the heart's value and which the
                            web build keeps, where it drops
                            `accessibilityValue`.

                            The count keeps its pin: the padlock before it, on a
                            private list, says who can see the list and not what
                            is in it, and "4" after a padlock is four of
                            nothing. */}
                        <View style={s.foot}>
                          <View style={[s.metaRow, s.footFacts]}>
                            {/* The padlock says whose it is without spending a
                                word on it. It used to be the only answer,
                                because every owned list was private; now the
                                glyph carries which of the two it is, and the
                                detail screen uses the same pair for the same
                                fact.

                                The glyph alone, as on the tiles (owner, 22 Oct
                                2026). The row said it twice, the glyph and then
                                "· Public" after the count, and the word was the
                                one the eye did not need: the lock is the lock
                                everywhere, and the globe is the Community tab's
                                own glyph a few points above. The word is still
                                on the list's own screen, where it is the switch
                                that changes it, and it is in the card's spoken
                                name, which had never carried it at all.

                                And then private only (owner, 2 Nov 2026), as on
                                the tiles: a public list is the default and
                                wears nothing; the padlock marks the exception. */}
                            {own.is_public ? null : (
                              <Ionicons name="lock-closed-outline" size={13} color={colors.textTertiary} />
                            )}
                            {/* "0 places" reads like a broken count; an empty
                                list you just made deserves a sentence. Any
                                other count is the pin and the figure (owner,
                                2 Nov 2026), spoken in full. */}
                            {!reasonFor(own.slug) && count > 0 ? (
                              <View style={s.metaRow} accessible accessibilityLabel={placesOf(count)}>
                                <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                                <Text style={s.meta} numberOfLines={1}>{count}</Text>
                              </View>
                            ) : (
                              <Text style={s.meta} numberOfLines={1}>
                                {reasonFor(own.slug) ?? t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません', '还没有地点', '還沒有地點')}
                              </Text>
                            )}
                          </View>
                          {/* How many people liked it — the answer to "is
                              anybody reading this list", which the shelf could
                              not give before and which a curator has no other
                              way to find out.

                              The heart draws on every public list of yours, at
                              any count, and you may press it (owner, 17 Oct
                              2026): a curator may like their own list, and the
                              shelves rank by everybody's likes but theirs. The
                              number keeps `likesWorthShowing`'s rule. A private
                              list has none: the counts come from a function
                              that returns public rows only, because a private
                              list is one nobody else can see to like.

                              A button inside a row that swipes, as the
                              community row already has inside a row that
                              opens: a tap is not a pan, and `hitSlop` stops at
                              the foot's own line.

                              Not while the row is open. The column is about
                              36pt then, and the heart would sit on the count;
                              an open row is for its Edit and Delete. */}
                          {own.id && own.is_public && !open ? (
                            <PressableScale
                              style={s.footHeart}
                              contentStyle={s.likesRow}
                              scaleTo={0.82}
                              haptic="none"
                              hitSlop={{ top: 10, bottom: 10, left: 12, right: 16 }}
                              onPress={() => onHeart(own)}
                              accessibilityRole="button"
                              aria-valuetext={likesWorthShowing(likes[own.slug]) ? likesSaid(likes[own.slug]) : undefined}
                              accessibilityState={{ selected: myLikes.includes(own.id) }}
                              accessibilityLabel={myLikes.includes(own.id)
                                ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す', '取消点赞这个合集', '取消按讚這個合集')
                                : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね', '点赞这个合集', '按讚這個合集')}
                            >
                              <Ionicons
                                name={myLikes.includes(own.id) ? 'heart' : 'heart-outline'}
                                size={15}
                                color={myLikes.includes(own.id) ? colors.accent : colors.textTertiary}
                              />
                              {likesWorthShowing(likes[own.slug]) && (
                                <Text style={s.meta}>{likes[own.slug]}</Text>
                              )}
                            </PressableScale>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Card>
                </PressableScale>
              );
              // The margins sit on the wrapper, not on the swipeable row:
              // actions revealed behind a full-bleed row would slide out
              // past the page margin the rest of the screen keeps.
              return (
                <View style={s.row}>
                  <SwipeRow
                    onEdit={() => navigation.navigate('CollectionForm', {
                      slug: own.slug,
                      title: t(own.title_en, own.title_vi, own.title_ja),
                      desc: t(own.desc_en, own.desc_vi, own.desc_ja),
                    })}
                    onDelete={() => remove(own)}
                    editLabel={t('Edit', 'Sửa', '編集', '编辑', '編輯')}
                    deleteLabel={t('Delete', 'Xoá', '削除', '删除', '刪除')}
                  >
                    {card}
                  </SwipeRow>
                </View>
              );
            }}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (!section.city ? null : section === sections[0]
              ? <View style={s.firstGap} testID="collections-first-gap" />
              : cityHead(section.city, false))}
            onViewableItemsChanged={onSeen}
            // A jump to a block not yet drawn: go near it on the average
            // row, which draws it, then land on its heading.
            onScrollToIndexFailed={(info) => {
              if (jumpRetried.current) return;
              scrollRef.current?.getScrollResponder()?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
              setTimeout(() => {
                const sectionIndex = sections.findIndex((x, i) => sections.slice(0, i).reduce((n, y) => n + y.data.length + 2, 0) === info.index);
                if (sectionIndex >= 0) jumpTo(sectionIndex, true);
              }, 100);
            }}
            renderSectionFooter={({ section }) => {
              // Under a query, the only footer is the honest one: nothing
              // matched. The creation rows stay out of it — "start your
              // first collection" under a search that found nothing would
              // be answering a question nobody asked.
              if (asked) {
                if (section.data.length > 0) return null;
                return q
                  ? <Empty text={t(`Nothing here matches "${q}".`, `Không có gì khớp với "${q}".`, `「${q}」に一致するものはありません。`, `没有与“${q}”匹配的内容。`, `沒有與「${q}」相符的內容。`)} />
                  : <Empty text={t('No collections match that choice.', 'Không có bộ sưu tập nào khớp lựa chọn đó.', 'その条件に合うコレクションはありません。', '没有符合条件的合集。', '沒有符合條件的合集。')} />;
              }
              if (section.own) {
                return section.data.length === 0
                  ? <FirstCollection onPress={() => navigation.navigate('CollectionForm')} />
                  : null;
              }
              return section.data.length === 0
                ? (
                  <CommunityEmpty
                    signedIn={!!session}
                    onCreate={() => navigation.navigate('CollectionForm')}
                    onExplore={() => navigation.getParent()?.navigate('Explore')}
                  />
                )
                : null;
            }}
            contentContainerStyle={{ paddingBottom: tabClearance }}
            showsVerticalScrollIndicator={false}
            // The catalog too (owner, 23 Oct 2026): a community list draws
            // its places from it, so a place the desk approved since the
            // last load stayed missing from every list holding it until
            // the catalog happened to revalidate on its own.
            onRefresh={() => { setPulling(true); cols.reload(); mine.reload(); placesReload(); }}
            refreshing={pulling}
          />
        )}
        {/* The tabs, pinned: a copy over the shelf rather than a sticky
            header, as Explore's filter row is, so nothing it does can
            move a row or eat a tap meant for one. */}
        {pinned && !holding && (session || (groups && atCity)) ? (
          <View style={s.pinned} testID="collections-pinned">
            {session ? (
              <View onLayout={(e) => { tabsHRef.current = Math.round(e.nativeEvent.layout.height); }}>
                {headerExpanded ? top(true) : tabsRow(true)}
              </View>
            ) : null}
            {groups && atCity ? cityHead(atCity, true) : null}
          </View>
        ) : null}
        <ActionSheet
          visible={jumpOpen}
          onClose={() => setJumpOpen(false)}
          actions={jumpActions}
          header={<Text style={s.jumpTitle}>{t('Go to a city', 'Đến thành phố', '都市へ移動', '前往城市', '前往城市')}</Text>}
        />
      </View>
      <CollectionFilterSheet
        visible={filterOpen}
        applied={filtersApplied}
        cities={offerCities ? cityChoices.map((id) => ({ key: id, label: cityName(id), names: cityNames(id) })) : []}
        kinds={kindChoices.map((k) => ({ key: k, label: categoryLabel(k, t), icon: CATEGORIES[k]?.icon }))}
        countFor={(f) => siftCollections(shelf, { query: q, city: f.city, kind: f.kind }).length}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => { setCityPick(f.city); setKind(f.kind); setFilterOpen(false); }}
      />
      {/* Explore's dock, with this screen's two actions: the whole island
          is the box (`findFromDock`), the pill a new list. "+ Bộ sưu tập",
          "+ Tạo mới", the word every pill that makes something wears, as
          this screen's own header pill does. Guests start no lists. */}
      <DockSlot visible={dock} onPress={findFromDock} accessibilityRole="button" testID="collections-dock">
        <DockOffer
          icon="search"
          title={t('Find a collection', 'Tìm bộ sưu tập', 'コレクションを探す', '查找合集', '查詢合集')}
          // Short, for one line beside the pill: about 23 characters fit
          // there (CollectionDetail's dock measured it, 17 Oct 2026).
          sub={t('By name or place', 'Theo tên hoặc địa điểm', '名前やスポットで', '按名称或地点', '按名稱或地點')}
        />
        {session ? (
          <AddPill
            label={t('New', 'Tạo mới', '新規', '新建', '新增')}
            accessibilityLabel={t('New collection', 'Bộ sưu tập mới', '新しいコレクション', '新建合集', '新增合集')}
            onPress={startNew}
            testID="collections-dock-new"
          />
        ) : null}
      </DockSlot>
    </Screen>
  );
}

const s = StyleSheet.create({
  // Margins stay on the Pressable; the card itself is what scales.
  noticeWrap: { marginHorizontal: space.page, marginBottom: space.titleToContent },
  // One row: the words, then the chip at the end. 14 above and below the
  // two lines, so the banner is about 72pt where the card was 150.
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  noticeCopy: { flex: 1, gap: 2 },
  // 16, a step under the card title's 18: the banner introduces the shelf
  // rather than being an item on it, and at 18 it outranked the tiles.
  noticeTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold, lineHeight: 21 },
  // A step down again: the supporting line, read after the title.
  noticeBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 19 },
  noticeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: CHIP_H, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
  },
  noticeChipText: { color: colors.accentInk, fontSize: 15, fontWeight: font.semibold },

  // The community grid. Sized in the component — the width is the
  // screen's business — and dressed in the Explore shelf card's clothes:
  // photo, three-stop scrim, light ink.
  // A city's name over its block: the section size, so it reads as a
  // heading over cards and not as one more card's caption; the count
  // beside it in the quiet step, as the scope line prints its numbers.
  // Above it, the row gap already left by the block before plus the
  // page's title gap; below, the theme's heading-to-content step, so the
  // name sits closer to the cards it heads than to the ones it follows.
  cityHead: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8,
    paddingHorizontal: space.page, paddingTop: space.titleToContent, paddingBottom: space.headingToContent,
  },
  // The first block has no heading at rest (owner, 7 Nov 2026): the city
  // is named once the list moves, by the bar under the pinned tabs. What
  // stands in its slot is the gap — the search box's 14 and this make
  // `titleToContent`, the gap under a screen's head everywhere else (6 Nov:
  // with the heading, "Hà Nội" had floated 43pt under the box). Later
  // blocks keep their headings: those are where one city ends.
  firstGap: { height: space.titleToContent - SEARCH_ROW_GAP },
  cityHeadName: { ...type.section, color: colors.text, flexShrink: 1 },
  // The ▾ says the name opens something: the list of cities to jump to.
  cityHeadChevron: { alignSelf: 'center', marginLeft: -4 },
  // "16 collections", not "16": a bare number beside a city's name read
  // as anything — a rank, a district (owner, 6 Nov 2026).
  cityHeadCount: { fontSize: 15, fontWeight: font.medium, color: colors.textTertiary },
  // The same heading, pinned under the tabs: a step smaller so the row it
  // rides under stays the bigger thing, the count pushed to the far edge
  // as the reference drew it.
  //
  // Close under the tabs (owner, 7 Nov 2026): it sat ~29pt below their
  // underline — the tabs' own 14, a hairline, then the name centred in a
  // 44pt row. Now the tabs' 14 is the whole gap, the same the tabs leave
  // above the search box at rest; the hairline went, the underline and
  // the bar's ground part them already. The target stays past 44 through
  // `hitSlop` (see `cityHead`).
  cityBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.page, paddingBottom: 12,
  },
  // A guest's pinned row is the bar alone, at the top of the screen.
  cityBarAlone: { paddingTop: 12 },
  cityBarName: { ...type.cardTitle, color: colors.text, flexShrink: 1 },
  cityBarCount: { marginLeft: 'auto', fontSize: 13 },
  jumpTitle: { color: colors.text, ...type.cardTitle },
  gridRow: {
    flexDirection: 'row', gap: space.cardGap,
    marginHorizontal: space.page, marginBottom: space.cardGap,
  },
  gcard: { borderRadius: radius.image, overflow: 'hidden', justifyContent: 'flex-end' },
  gcardText: { padding: 12, gap: 2 },
  mosaicCard: { gap: 0 },
  mosaicPhoto: { flex: 1, borderRadius: radius.image, overflow: 'hidden' },
  mosaicWords: { gap: 6, padding: 14 },
  mosaicOverlay: { position: 'absolute', left: 0, right: 0 },
  mosaicTail: { position: 'absolute', left: 0, right: 0, height: mosaicScrim.tailHeight },
  mosaicTailBelow: { top: '100%' },
  mosaicTailAbove: { bottom: '100%' },
  mosaicWordsBottom: { position: 'absolute', bottom: 0 },
  mosaicWordsTop: { position: 'absolute', top: 0 },
  mosaicWordsBelow: { paddingHorizontal: 2, paddingTop: 11, paddingBottom: 0 },
  mosaicWordsFeatured: { padding: 20 },
  mosaicTitleFeatured: { ...type.titleDetail, color: onPhoto.text, lineHeight: 32 },
  mosaicInkShadow: { textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  mosaicTitleBelow: { color: colors.text },
  // Full white on a photograph, not the 82% secondary ink: at 82% a 12–13pt
  // line over a white picture needs 0.65 of dark, at full white 0.58, and
  // `mosaicScrim` holds 0.60 behind every line. Size carries the order.
  mosaicAuthor: { color: onPhoto.text, fontSize: 12, lineHeight: 16 },
  mosaicAuthorBelow: { color: colors.textSecondary },
  mosaicBlurb: { color: onPhoto.text, fontSize: 13, lineHeight: 18 },
  gcardTitle: { color: onPhoto.text, fontSize: 16, fontWeight: font.semibold, lineHeight: 19 },
  gcardBy: { color: onPhoto.textSecondary, fontSize: 13, fontWeight: font.medium, flexShrink: 1 },
  // As tall as the avatar on every tile (owner, 17 Oct 2026). A
  // community tile leads with an 18pt face, your own with a 14pt glyph,
  // and the shorter row sat the title 2–3pt lower on one tab than the
  // other — the same list moved as you switched tabs.
  gcardFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, minHeight: 18 },
  gcardMeta: { color: onPhoto.textSecondary, fontSize: 13 },
  gcardLock: {
    position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceCard,
  },
  gcardCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gcardLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // The tile/list switch — two glyphs in a quiet glass capsule, the
  // chosen one seated on a solid thumb. Small on purpose: it is a
  // preference, not a destination.
  viewToggle: {
    flexDirection: 'row', gap: 2, padding: 3,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.pill,
  },
  viewBtn: {
    width: 26, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  viewBtnOn: { backgroundColor: colors.surfaceCard },

  // The visits screen's box and panel, to the point: the same row, the
  // same Cancel inside the box, the same card of groups, so the two screens
  // that let a reader narrow a list of their own do it with one grammar.
  // The header's own subtitle type (`s.subtitle` in ui/surfaces.tsx), in the page's
  // margins. The header ends 14 under the title; -6 brings this line to
  // the 8 a subtitle sits under its title in that header.
  scope: { color: colors.textSecondary, fontSize: 14, lineHeight: 18, marginHorizontal: space.page, marginTop: -6, marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: space.page, marginBottom: SEARCH_ROW_GAP },
  // The panel on the page's own ground, not in a card: its rows run to
  // the screen's edge and fade into the page, which a card's ground —
  // translucent in every dark look — would not match. The suggestions,
  // words in a list rather than a row, keep the card.
  panel: { marginBottom: 14, gap: space.headingToContent },
  recents: { marginHorizontal: space.page, padding: space.cardPadding, gap: 10 },
  group: { gap: 10 },
  onPage: { marginHorizontal: space.page },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legend: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  clear: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  suggestionText: { flex: 1, color: colors.text, fontSize: 16 },
  // Under the box, where the panel was, with the box's own margins: the
  // review board's folded filter (owner, 25 Oct 2026) — no chips, the
  // glyph and the words, a hairline between them, a ✕ after each word.
  // 36pt tall, Explore's filter button's box; the slop makes it 44.
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: space.page, marginBottom: 14 },
  // The pinned copy: over the shelf, opaque because the shelf runs under
  // it, and a hairline at its foot — the edge between the switch and the
  // lists, the one Explore's pinned row draws too.
  pinned: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft,
  },
  // Explore's filter button's box (`filterButton` there): 36 with the
  // 4pt slop is the 44 a target is, and the badge rides its corner.
  filterBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // Nothing to choose: there, and plainly not for now. The disabled
  // opacity the other controls use (`choiceOff`).
  filterOff: { opacity: 0.45 },
  filterBadge: {
    position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill,
  },
  filterBadgeText: { color: colors.accentInk, fontSize: 9, fontWeight: font.bold },
  chosenItem: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  hiddenHeader: { opacity: 0 },
  chosenWordsSlot: { flexShrink: 1 },
  chosenWords: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  // The ✕ quiet, in the tertiary ink: the words are what is read, the
  // ✕ is there for the hand. Its box is the row's height and 24 wide.
  chosenX: { width: 24, height: 36, alignItems: 'center', justifyContent: 'center' },
  chosenText: { color: colors.text, fontSize: 15, fontWeight: font.medium, flexShrink: 1 },

  firstWrap: { marginHorizontal: space.page, marginBottom: space.titleToContent },
  first: {
    alignItems: 'center', gap: 10,
    paddingHorizontal: space.cardPadding + 6, paddingTop: 26, paddingBottom: 22,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card,
  },
  firstIcon: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
    marginBottom: 2,
  },
  firstTitle: { color: colors.text, ...type.headline },
  firstBody: {
    color: colors.textSecondary, fontSize: 15, lineHeight: 21,
    textAlign: 'center', marginBottom: 6,
  },
  firstFoot: { color: colors.textTertiary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },

  row: { marginHorizontal: space.page, marginBottom: space.cardGap },
  // Built the way `PlaceCard` is built, which is the way every other card
  // in this app that leads with a photograph is built: the picture runs to
  // the card's own edges and the padding lives on the text beside it. This
  // row was the one exception — an inset square with its own `radius.image`
  // floating in a padded box — and the exception was invisible until the
  // description made the text taller than the square, at which point the
  // square began floating in a gap it could not fill.
  //
  // No `alignItems` and no radius on the cover: the row stretches its
  // children by default, and `Card` already clips to `radius.card`, which
  // is what rounds the cover's outer corners and leaves its inner edge
  // square against the text. `PlaceCard` has relied on exactly that since
  // it was written.
  card: { flexDirection: 'row' },
  // The box, which is what the swipe resizes; the cover inside fills it.
  // Height deliberately absent — see COVER.
  // `alignSelf` says out loud what the row would do anyway, because this
  // is the line the whole change rests on and a reader should not have to
  // know Yoga's default to see it.
  thumb: { width: COVER, alignSelf: 'stretch', backgroundColor: colors.surfaceGlass },
  // `flex: 1` rather than `height: '100%'`: the cover's height arrives from
  // the stretch during layout, and filling it along the main axis of its
  // own column needs no percentage to resolve against.
  thumbFill: { width: '100%', flex: 1 },
  // No hairline any more. Flush to three of the card's edges it doubled
  // the card's own border, and on the fourth it drew a rule between the
  // cover and the text that no cover with a photograph draws.
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },

  // Revealed behind an owned row. Height comes from the row, which used to
  // keep the two buttons square-ish and now makes them full-height bars —
  // the row went from 92pt to nearer 140 when the cover stretched and the
  // description arrived. That is the shape iOS reveals behind a swiped row
  // anyway, so it is left to follow the row rather than pinned to a height
  // of its own, which would only put the buttons afloat the way the cover
  // used to be.
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginLeft: 8 },
  // Width on the Pressable, the painted box on its animated child: the
  // child is what scales on press, and `flex: 1` is what makes it as tall
  // as the row instead of as tall as its glyph.
  actionWrap: { width: 62 },
  action: {
    flex: 1, borderRadius: radius.image,
    alignItems: 'center', justifyContent: 'center',
  },
  actionEdit: { backgroundColor: colors.surfaceGlassStrong, borderWidth: 1, borderColor: colors.borderGlassSoft },
  // A tinted well with a red glyph, not a solid red slab with a dark one.
  // Both buttons are then built the same way and differ only in colour,
  // which is what makes the pair scan: two shapes of equal weight, one of
  // them red. The slab did the opposite — it shouted before you had
  // decided anything, and its near-black glyph made the destructive
  // button the one place the red was *not* on the thing you tap.
  // Same hairline as Edit. A red-tinted border of its own came out near
  // black against the dark ground, which put a hard outline around the
  // one button that should read as soft. The fill carries the warning;
  // the edge is just what gives both buttons an edge.
  actionDelete: { backgroundColor: colors.badSoft, borderWidth: 1, borderColor: colors.borderGlassSoft },
  // The padding the card gave up. 13 vertical rather than 16 is
  // `PlaceCard`'s figure and its reason — ~10% tighter than a standard
  // card body, because this is a feed and not a form — and here it also
  // gives back 6pt of the height the description costs.
  cardText: {
    flex: 1, gap: 5,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  // What the row shows, laid over the ghost that sized it (`RowGhost`),
  // with the same padding and gap so a full row lands line for line on
  // the ghost's lines.
  //
  // From the top, not centred. Centred was the first answer (#864), on the
  // argument that a row with less to say would otherwise hang from the
  // top of the card over a band of nothing. The owner chose the top on
  // 10 Oct 2026 after seeing it on the phone: down a column, every title
  // then starts on the same line of its card, so the eye runs down the
  // names, where centring set each title at a different depth by how
  // much the row had under it.
  cardFace: {
    ...StyleSheet.absoluteFill, gap: 5, justifyContent: 'flex-start',
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  ghost: { opacity: 0, gap: 5 },
  // The face and the hearts are what make a meta line taller than its
  // text alone; the ghost's stand-in is the larger of the two, the face.
  ghostMark: { width: 18, height: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { color: colors.text, ...type.cardTitle },
  // `flexShrink: 1`: in `metaRow` this sits beside an 18pt face or a
  // padlock, and a Text that cannot shrink sizes to its words — "@handle
  // · 5 places" is wider than the column on a 320pt window, and the card's
  // `overflow: hidden` cut it rather than the ellipsis it asks for.
  meta: { color: colors.textTertiary, ...type.meta, flexShrink: 1 },
  // A third step, between the title and the metadata. The title is what
  // the list is called and the meta line is bookkeeping; this is the only
  // thing on the card a person wrote about it, so it takes the middle
  // weight — `meta`'s size, `textSecondary`'s ink — rather than competing
  // with the 18pt name above it or disappearing into the tertiary grey
  // below.
  //
  // 20 rather than the 21 this file pairs with 15pt elsewhere: a wrapped
  // paragraph pays its leading twice, and the row is already spending
  // 45pt to be here.
  blurb: { color: colors.textSecondary, ...type.meta, lineHeight: 20 },
  // Same 5pt gap the meta row keeps between the padlock and its sentence,
  // so the two lines start on the same optical edge — the heart and the
  // padlock are both glyphs standing in for a word.
  likesRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // A row's last line: what the list holds, then its heart at the far
  // end. `marginTop: 'auto'` sends it to the bottom of the face, so every
  // row's foot sits on the same line whatever is above it.
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 'auto' },
  // The facts give way first: a long reason clamps to one line rather
  // than pushing the heart off the card.
  footFacts: { flexShrink: 1 },
  // On the Pressable rather than the row inside it, since `marginLeft`
  // positions the element in its parent — the half that belongs on the
  // container; see `PressableScale`. In a row the heart already
  // shrink-wraps: it only has to be sent to the end.
  footHeart: { marginLeft: 'auto' },
  // The chevron that used to close this row is gone, and its 17pt plus
  // the 16pt gap beside it are what paid for the wider cover: the text
  // column still came out wider than it was.
  //
  // It was drawn as a disclosure mark rather than a control, which was
  // the right call for what it was. What it was, though, was filler —
  // `SearchScreen` says so out loud about its own, kept only so "the
  // right edge is never simply empty". `PlaceCard` carries none, and it
  // is the card this app shows most; a whole card of photograph and
  // title is not a row that needs an arrow to say it opens.
});
