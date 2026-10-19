// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type AccessibilityProps, Alert, Animated, Keyboard, SectionList, StyleSheet, Text, type TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AmbientWarmth, Avatar, Card, Chip, Empty, fireHaptic, GradientCta, PressableScale, Screen, Skeleton, UnderlineTabs, useTabBarClearance } from '../components/ui';
import SearchField from '../components/SearchField';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { AddPill } from '../components/add';
import { holdResume } from '../lib/resume';
import { useSession } from '../lib/auth';
import { useCity } from '../lib/city';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import { Collection, coverOf, deleteCollection, fetchProfilesById, type FriendProfile, membersOf } from '../lib/data';
import { atHandle } from '../lib/handle';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { likesWorthShowing } from '../lib/likes';
import { COLLECTION_RECENTS_KEY, RECENTS_SHOWN, rememberSearch } from '../lib/recents';
import { NO_RECENTS, oneOf, RECENTS, useStored } from '../lib/stored';
import { collectionCities, collectionKinds, siftCollections, type SiftMember } from '../lib/search';
import { useMyLists, useSaveActions } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { classifyLoadFail } from '../lib/loadfail';
import { LoadFailBanner, LoadFailEmpty } from '../components/loadFail';
import { accentFade, colors, font, gradAI, onPhoto, radius, space, type } from '../theme';
import type { Nav } from '../nav';

/** The two layouts the list remembers. */
const TILE_OR_ROW = oneOf('tile', 'row');

/** What `renderRightActions` hands back, and what the card animates from. */
type Drag = ReturnType<Animated.Value['interpolate']>;

/** The swipe's two actions, in the form a screen reader offers them. */
type RowA11y = Pick<AccessibilityProps, 'accessibilityActions' | 'onAccessibilityAction'>;

/** What the two actions take up behind an open row: two 62pt buttons, the
 *  8pt between them, and the 8pt separating them from the card. The row
 *  clamps its own travel to whatever they measure, so this figure only sets
 *  how fast the card's insides shrink on the way there. */
const ACTIONS_W = 62 * 2 + 8 + 8;
/** Where the Yours tab's tile/list choice sleeps between launches. */
const VIEW_KEY = 'citycrew.collections.view';
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
      )}
    >
      <View style={s.noticeCopy}>
        <Text style={s.noticeTitle}>
          {t('Start a collection', 'Tạo bộ sưu tập riêng', 'コレクションを作る')}
        </Text>
        <Text style={s.noticeBody}>
          {t(
            'Sign in to create and sort.',
            'Đăng nhập để tạo và sắp xếp.',
            'サインインして作成・整理。',
          )}
        </Text>
      </View>
      {/* A rounded rectangle at chip scale, the sheet's primary button
          scaled down. Sized to its label rather than stretched: the card is
          already the target, so this names the action — it does not need to
          be the loudest object on the screen. At the row's end now, centred
          on the two lines beside it. */}
      <LinearGradient {...gradAI} style={s.noticeChip}>
        <Text style={s.noticeChipText}>{t('Sign in', 'Đăng nhập', 'サインイン')}</Text>
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
 * whole card and the section's other create controls stand down.
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
          {t('No collections yet', 'Chưa có bộ sưu tập nào', 'コレクションはまだありません')}
        </Text>
        <Text style={s.firstBody}>
          {t(
            'Group places into lists — date nights, crew weekends, coffee crawls.',
            'Nhóm địa điểm thành bộ sưu tập — buổi hẹn tối, cuối tuần với hội bạn, tour cà phê.',
            'スポットをリストにまとめましょう — デートの夜、仲間との週末、カフェ巡り。',
          )}
        </Text>
        {/* A pill here, where the sheet's primary is a rounded rectangle:
            that one runs the full width, where end caps as tall as the
            button read as a lozenge. This one is sized to its label, which
            is exactly where a pill belongs. */}
        <GradientCta
          icon="add"
          label={t('Create your first collection', 'Tạo bộ sưu tập đầu tiên', '最初のコレクションを作る')}
          onPress={onPress}
        />
        <Text style={s.firstFoot}>
          {t('Only you can see your lists.', 'Chỉ mình bạn thấy bộ sưu tập của bạn.', 'リストはあなただけに表示されます。')}
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
          {t('No public lists yet', 'Chưa có bộ sưu tập công khai nào', 'まだ公開コレクションはありません')}
        </Text>
        {/* True now that a curator's own public list is on this shelf; it
            promised the same thing while the shelf filtered them out. */}
        <Text style={s.firstBody}>
          {t(
            'Yours can be the first — make a list, set it to Public, and it shows up here for everyone.',
            'Bộ sưu tập của bạn có thể là đầu tiên — tạo một bộ sưu tập và đặt Công khai, nó sẽ hiện ở đây cho mọi người.',
            '最初の一つはあなたかも — リストを作って「公開」にすると、ここにみんなの目に並びます。',
          )}
        </Text>
        {/* Signed out, "make a list" is not yet an offer this reader can
            take, so the button points at the shelf that is already full. */}
        {signedIn
          ? (
            <GradientCta
              icon="add"
              label={t('Create a collection', 'Tạo bộ sưu tập', 'コレクションを作る')}
              onPress={onCreate}
            />
          )
          : (
            <GradientCta
              icon="compass"
              label={t('Explore places', 'Khám phá địa điểm', 'スポットを見る')}
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
 * Four lines: a one-line title, the meta line, two lines of description
 * and the likes line, which is the most any row shows. The title drops
 * to one line for this. A two-line title would be the one thing able to
 * outgrow the ghost, and reserving a second title line in every row
 * would spend 22pt on space that few titles fill.
 *
 * Rejected: measuring the rows and growing them all to the tallest. The
 * list is virtualised, so a taller row scrolled into view would re-lay
 * every row above it while the reader is in the middle of them.
 */
function RowGhost() {
  return (
    <View style={s.ghost} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={s.title} numberOfLines={1}>{' '}</Text>
      <View style={s.metaRow}>
        <View style={s.ghostMark} />
        <Text style={s.meta}>{' '}</Text>
      </View>
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
  const { cities } = useCity();
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
  const { likes, myLikes, toggleLike } = useLikes();
  const { data: places, loading: placesLoading, loaded: placesLoaded } = usePlaces();
  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<SectionList<ListRow, { own: boolean }>>(null);
  useScrollToTop(scrollRef);
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

  const cityName = useCallback((id: string | null | undefined) => {
    const c = id ? cities.find((x) => x.id === id) : undefined;
    return c ? t(c.short_en, c.short_vi, c.short_ja ?? c.short_en) : (id ?? '');
  }, [cities, t]);

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

  const coverFor = (c: Collection) =>
    c.cover?.photo_uri ?? (membersOf(c, places)[0] && coverOf(membersOf(c, places)[0])?.photo_uri);

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
      t('Delete this collection?', 'Xoá bộ sưu tập này?', 'このコレクションを削除しますか？'),
      t(`"${name}" will be gone for good.`, `"${name}" sẽ mất hẳn.`, `「${name}」は完全に削除されます。`),
      [
        { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
        {
          text: t('Delete', 'Xoá', '削除'),
          style: 'destructive',
          onPress: () => {
            // Both catalogs, as the detail screen's publish does: a public
            // list is on the Community shelf (and Explore's) too, and
            // reloading only your library left it standing there.
            deleteCollection(c.slug)
              .then(() => { mine.reload(); cols.reload(); })
              .catch((e: Error) => Alert.alert(t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message));
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
  // then the cities, then the kinds of place — opened by focus and closed
  // by Cancel, for the reasons VisitedScreen gives at length. One city
  // and one kind at a time, a chosen chip tapped again lets go.
  //
  // What the panel adds that the words could not: a chip asks about the
  // *places* in a list. Under "Cafés" a list is listed for the cafés in
  // it, and the card says how many of its places those are, because a
  // list of eight with three cafés and a list of three cafés are
  // different answers to the same chip.
  const [query, setQuery] = useState('');
  const q = query.trim();
  const [panel, setPanel] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  // The city chip: unset is every city, on both shelves; a city narrows
  // to the lists with a place there. It had a third state, 'all', while
  // Community was scoped to the app's city and letting go of that chip
  // had to mean something other than unset.
  const [cityPick, setCityPick] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const cancel = () => {
    setPanel(false); setQuery(''); setKind(null); setCityPick(null);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };
  // A chip is an answer, and the keyboard asks for words. Tapped, it
  // puts the keyboard away and leaves the panel up (the panel closes on
  // Cancel, not on blur — see VisitedScreen): the reader sees the shelf
  // the chip just narrowed, and the box is one tap away if words are
  // still wanted. Before this the keyboard stood over the results of
  // every chip (the owner, 14 Oct 2026).
  const answered = () => { inputRef.current?.blur(); Keyboard.dismiss(); };

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
  const kindChoices = useMemo(() => collectionKinds(shelf), [shelf]);
  const scopeCity = cityPick;
  const offerCities = cityChoices.length > 1 || (cityChoices.length === 1 && cityChoices[0] !== scopeCity);
  const asked = !!(q || kind || cityPick);

  const hits = useMemo(
    () => siftCollections(shelf, { query: q, city: scopeCity, kind }),
    [shelf, q, scopeCity, kind],
  );
  const hitBy = useMemo(() => new Map(hits.map((h) => [h.c.slug, h])), [hits]);

  /**
   * Why a card is listed, when the shelf is narrowed — the line under its
   * name. "matches MONO Coffee Lab" when the words landed on a place
   * rather than on the list; "3 of 8 places · Cafés" when a chip reached
   * part of it. Null when the ordinary count says it all: nothing asked
   * (every place is a hit then, by construction), or a list found by its
   * own words with every place still counted.
   */
  const placesOf = (n: number) => `${n} ${t(n === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}`;
  const reasonFor = (slug: string): string | null => {
    const hit = hitBy.get(slug);
    if (!hit) return null;
    const parts: string[] = [];
    if (hit.place) {
      const name = t(hit.place.name_en ?? '', hit.place.name_vi ?? '', hit.place.name_ja ?? undefined);
      parts.push(t(`matches ${name}`, `khớp ${name}`, `${name} に一致`));
    }
    if (hit.hits !== hit.total) {
      parts.push(t(
        `${hit.hits} of ${placesOf(hit.total)}`,
        `${hit.hits} trong ${placesOf(hit.total)}`,
        `${placesOf(hit.total)}のうち${hit.hits}`,
      ));
      if (kind) parts.push(categoryLabel(kind, t));
      if (cityPick) parts.push(cityName(cityPick));
    }
    return parts.length ? parts.join(' · ') : null;
  };

  // The line under the title: how many lists, and across how many cities
  // — the same on both shelves now that both show every city. Narrowed,
  // it names the chips instead, as the visits screen does.
  const listsWord = (n: number) => t(n === 1 ? '1 collection' : `${n} collections`, `${n} bộ sưu tập`, `${n}件のコレクション`);
  const chosen = [
    kind ? categoryLabel(kind, t) : null,
    cityPick ? cityName(cityPick) : null,
  ].filter((x): x is string => !!x);
  const scopeLine = (() => {
    if (chosen.length) return [listsWord(hits.length), ...chosen].join(' · ');
    const k = cityChoices.length;
    if (k === 0) return listsWord(hits.length);
    return `${listsWord(hits.length)} · ${k === 1 ? cityName(cityChoices[0]) : t(`${k} cities`, `${k} thành phố`, `${k}都市`)}`;
  })();

  // `loaded`, not `!loading`: the focus refresh flips `loading` back on,
  // and hiding the list for that made a visit look like a double load.
  const mineReady = mine.loaded;
  // The shelf, as the sift ordered it — by likes when nothing is asked,
  // lists found by their own words first and then by hits when it is.
  const sifted = hits.map((h) => h.c);

  // Both halves default to tiles — covers first, in the Explore shelf's
  // own card language, six covers where the rows showed three — and one
  // small switch turns both back into rows, because a shelf is browsed
  // on some days and scanned by name on others. One preference, not one
  // per tab: a reader who chose rows chose how they read lists, not how
  // they read one tab. The choice is remembered. What your own tiles
  // give up — the swipe shortcuts — the rows keep, one flick away, and
  // the collection's own screen has in its ⋯ menu regardless.
  //
  // The switch rides the tabs row, though, and only a signed-in reader
  // has one — so a guest gets tiles and no way out of them.
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
  const [view, pickView] = useStored<'tile' | 'row'>(VIEW_KEY, 'tile', TILE_OR_ROW);

  // SectionList knows nothing of columns, so the grid packs itself: two
  // cards per row-item, and the odd last card keeps a spacer where its
  // neighbour would be. Every row-item carries whose it is — a tile
  // shows a padlock for your own and a byline for everyone else's, and
  // the two row shapes split the same way: yours swipe, the community's
  // do not.
  //
  // `at` is a card's place in its whole list, not in its row-item: the
  // smoke flows open "the first community collection" as
  // `collection-card-0`, and it has to be the same card whichever shape
  // the reader last picked.
  type ListRow =
    | { kind: 'own'; c: Collection }
    | { kind: 'com'; c: Collection; at: number }
    | { kind: 'pair'; pair: Collection[]; own: boolean; at: number };
  const pairUp = (list: Collection[], own: boolean): ListRow[] => {
    const out: ListRow[] = [];
    for (let i = 0; i < list.length; i += 2) out.push({ kind: 'pair', pair: list.slice(i, i + 2), own, at: i });
    return out;
  };
  const shape = (list: Collection[], own: boolean): ListRow[] => (view === 'tile'
    ? pairUp(list, own)
    : list.map((c, at): ListRow => (own ? { kind: 'own', c } : { kind: 'com', c, at })));
  const sections = onYours
    ? (mineReady ? [{ own: true, data: shape(sifted, true) }] : [])
    : [{ own: false, data: shape(sifted, false) }];

  return (
    // The door to a new list is the Trips screen's pill, in the header's
    // right, on the Yours tab once there is a list. It was a dashed row at
    // the foot of the list, on the argument that the tab always showed
    // one door and a "New" pill on the heading was the same action a
    // third time. True at four lists and wrong at fifteen: the owner's
    // review (14 Oct 2026) found the row only by scrolling past every
    // list to reach it. The empty library keeps its own card and button,
    // as Trips keeps its first-trip card, so on Yours the pill is never
    // one of two doors on one screen.
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
      title={t('Collections', 'Bộ sưu tập', 'コレクション')}
      right={(onYours ? mineReady && mine.data.length > 0 : !!session) ? (
        <AddPill
          tall
          label={t('New', 'Tạo mới', '新規')}
          onPress={startNew}
          accessibilityLabel={t('New collection', 'Bộ sưu tập mới', '新しいコレクション')}
          testID="collection-new"
        />
      ) : undefined}
      // The search was a disc up here, where every screen keeps its
      // utility; it is a box under the tabs now — see `panel`.
    >
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {/* The line under the title is in the body, as the Trips lede is,
            and not the header's `lede`: the header row aligns its right
            slot to the bottom of the title column, so a line in that
            column drops the pill a line below the title — the owner saw
            the two screens' pills at two heights (14 Oct 2026). */}
        {!holding && (onYours ? mineReady : true) ? (
          <Text style={s.scope} numberOfLines={1} testID="collections-scope">{scopeLine}</Text>
        ) : null}
        {/* The tab bar's own glyph for your shelf; the globe every public
            row already wears for everyone else's. Guests have no library,
            so they get the one half with no switch in front of it. */}
        {session ? (
          <UnderlineTabs
            tabs={[
              { key: 'yours', icon: 'bookmark-outline', label: t('Yours', 'Của bạn', '自分の'), testID: 'collections-yours' },
              { key: 'community', icon: 'globe-outline', label: t('Community', 'Cộng đồng', 'みんなの') },
            ]}
            active={tab}
            onChange={pickTab}
            // One preference, both shelves — see `shape`.
            right={(
              <View style={s.viewToggle}>
                {(['row', 'tile'] as const).map((v) => (
                  <PressableScale
                    key={v}
                    contentStyle={[s.viewBtn, view === v && s.viewBtnOn]}
                    scaleTo={0.9}
                    haptic="selection"
                    // 26×22 drawn, and the two halves touch, so the slop
                    // grows each outward only: up, down, and away from its
                    // neighbour — 44×44 apiece without either stealing the
                    // other's taps. It was 38×34 at a flat 6.
                    hitSlop={v === 'row'
                      ? { top: 11, bottom: 11, left: 18, right: 1 }
                      : { top: 11, bottom: 11, left: 1, right: 18 }}
                    onPress={() => pickView(v)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: view === v }}
                    accessibilityLabel={v === 'tile'
                      ? t('Tile view', 'Dạng lưới', 'タイル表示')
                      : t('List view', 'Dạng danh sách', 'リスト表示')}
                  >
                    <Ionicons
                      name={v === 'tile' ? 'grid-outline' : 'list-outline'}
                      size={14}
                      color={view === v ? colors.accent : colors.textTertiary}
                    />
                  </PressableScale>
                ))}
              </View>
            )}
          />
        ) : null}
        {/* The box, and the panel it opens. Outside the list rather than
            as its header: a box that scrolled away with the shelf was the
            one the owner's review called hard to find, and the panel is
            short-lived — open while choosing, gone on Cancel. */}
        {!holding && (
          <View style={s.searchRow}>
            <SearchField
              inputRef={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setPanel(true)}
              onSubmitEditing={noteSearch}
              testID={{ input: 'collections-input', cancel: 'collections-cancel' }}
              // The four things it answers by, named in the box itself —
              // and in the app's own word for the last: "username" is
              // what the Crew screen's add flow already calls it.
              placeholder={t('Name, place, city, or @username', 'Tên, địa điểm, thành phố, hoặc @username', '名前・スポット・都市・@ユーザー名')}
              // Inside the box, while the panel is up — see `SearchField`.
              cancel={{ shown: panel, label: t('Cancel', 'Hủy', 'キャンセル'), onPress: cancel }}
            />
          </View>
        )}
        {!holding && panel && (
          <Card style={s.panel} testID="collections-panel">
            {suggestions.length > 0 && (
              <View style={s.group}>
                <View style={s.legendRow}>
                  <Text style={s.legend}>{t('Suggestions', 'Gợi ý', '候補')}</Text>
                  <PressableScale
                    onPress={() => keepRecents([])}
                    scaleTo={0.92}
                    hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Clear suggestions', 'Xóa gợi ý', '候補を消去')}
                  >
                    <Text style={s.clear}>{t('Clear', 'Xóa', '消去')}</Text>
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
              </View>
            )}
            {offerCities && (
              <View style={s.group}>
                <Text style={s.legend}>{t('City', 'Thành phố', '都市')}</Text>
                <View style={s.chipWrap}>
                  {cityChoices.map((id) => (
                    <Chip
                      key={id}
                      label={cityName(id)}
                      active={scopeCity === id}
                      onPress={() => { setCityPick(scopeCity === id ? null : id); answered(); }}
                    />
                  ))}
                </View>
              </View>
            )}
            {kindChoices.length > 1 && (
              <View style={s.group}>
                <Text style={s.legend}>{t('Kind of place', 'Thể loại', '種類')}</Text>
                <View style={s.chipWrap}>
                  {kindChoices.map((k) => (
                    <Chip
                      key={k}
                      label={categoryLabel(k, t)}
                      icon={CATEGORIES[k]?.icon}
                      iconColor={CATEGORIES[k]?.color}
                      active={kind === k}
                      onPress={() => { setKind(kind === k ? null : k); answered(); }}
                    />
                  ))}
                </View>
              </View>
            )}
            {suggestions.length === 0 && !offerCities && kindChoices.length <= 1 && (
              <Text style={s.legend}>{t('Type a name, a place, or a city.', 'Gõ tên bộ sưu tập, địa điểm hoặc thành phố.', '名前、スポット、都市を入力。')}</Text>
            )}
          </Card>
        )}
        {holding && (
          <View>
            <GuestNotice navigation={navigation} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.row}>
                <Card style={s.card}>
                  <Skeleton style={[s.thumb, { width: coverW }]} />
                  <View style={s.cardText}>
                    <RowGhost />
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
        {!holding && colsFail && cols.data.length > 0 && (
          <LoadFailBanner kind={colsFail} onRetry={cols.reload} testID="collections-load-banner" />
        )}
        {!holding && !(colsFail && cols.data.length === 0) && (
          <SectionList
            ref={scrollRef}
            sections={sections}
            keyExtractor={(row) => (row.kind === 'pair' ? row.pair[0].slug : row.c.slug)}
            onScroll={duckScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={<GuestNotice navigation={navigation} />}
            renderItem={({ item }) => {
              if (item.kind === 'pair') {
                return (
                  <View style={s.gridRow}>
                    {item.pair.map((c, j) => {
                      const uri = coverFor(c);
                      const members = membersOf(c, places).length;
                      const reason = reasonFor(c.slug);
                      const my = !!c.id && myLikes.includes(c.id);
                      return (
                        <PressableScale
                          key={c.slug}
                          contentStyle={[s.gcard, { width: gcardW, height: gcardH }]}
                          onPress={() => { noteSearch(); navigation.navigate('CollectionDetail', { slug: c.slug }); }}
                          testID={item.own ? undefined : `collection-card-${item.at + j}`}
                          accessibilityRole="button"
                          accessibilityLabel={t(c.title_en, c.title_vi, c.title_ja)}
                        >
                          {uri
                            ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                            : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
                          {/* The Explore shelf's scrim, verbatim — same
                              object, same card language, second surface. */}
                          <LinearGradient
                            colors={['rgba(10,11,10,0.22)', 'rgba(10,11,10,0.10)', 'rgba(10,11,10,0.94)']}
                            // Was 0.42, when the text ran to three lines. Two
                            // lines need less covering, and every point the ramp
                            // starts later is picture given back.
                            locations={[0, 0.55, 1]}
                            style={StyleSheet.absoluteFill}
                          />
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
                                name, so the padlock speaks instead. */}
                            <View style={s.gcardFoot} testID="collection-tile-foot">
                              {item.own && (
                                <Ionicons
                                  name={c.is_public ? 'globe-outline' : 'lock-closed-outline'}
                                  size={14}
                                  color={c.is_public ? colors.ok : onPhoto.textSecondary}
                                />
                              )}
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
                              ) : item.own && (
                                <Text style={s.gcardMeta} numberOfLines={1}>
                                  {members === 0
                                    ? t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません')
                                    : `${members} ${t(members === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}`}
                                </Text>
                              )}
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
                                    ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す')
                                    : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね')}
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
                const byline = c.curator_handle
                  ? `${t('by', 'bởi', 'by')} ${atHandle(c.curator_handle)}, ${reason ?? placesOf(n)}`
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
                      accessibilityLabel={byline
                        ? `${t(c.title_en, c.title_vi, c.title_ja)}, ${byline}`
                        : t(c.title_en, c.title_vi, c.title_ja)}
                    >
                      <Card style={s.card}>
                        <View style={[s.thumb, { width: coverW }]}>
                          {cover
                            ? <Image source={{ uri: cover }} style={s.thumbFill} contentFit="cover" transition={200} />
                            : <EmptyCover />}
                        </View>
                        <View style={s.cardText}>
                          <RowGhost />
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

                                Width is a wash, not a saving: the word gave
                                back about 26pt and the face spends 23. What
                                changes is that the line is now facts
                                separated by a dot, the same grammar the
                                Yours row has always used, rather than half a
                                sentence.

                                The label is the part that is not decoration.
                                `Avatar` is `accessible={false}`, so the face
                                says nothing aloud, and this row has never
                                carried a label — dropping the word without
                                one would leave a screen reader saying
                                "@trang, 5 places" and nothing to mark the
                                handle as a name. So the sentence survives
                                where it is still doing work. */}
                            <View style={s.metaRow}>
                              <Avatar url={c.owner_id ? faces[c.owner_id]?.avatar_url : undefined} size={18} />
                              <Text
                                style={s.meta}
                                numberOfLines={1}
                                accessibilityLabel={byline}
                              >
                                {c.curator_handle ? `${atHandle(c.curator_handle)}  ·  ` : ''}
                                {reason ?? placesOf(n)}
                              </Text>
                            </View>
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
                                style={s.likesWrap}
                                contentStyle={s.likesRow}
                                scaleTo={0.82}
                                haptic="none"
                                hitSlop={{ top: 10, bottom: 10, left: 12, right: 16 }}
                                onPress={() => onHeart(c)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: my }}
                                accessibilityLabel={my
                                  ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す')
                                  : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね')}
                              >
                                <Ionicons
                                  name={my ? 'heart' : 'heart-outline'}
                                  size={15}
                                  color={my ? colors.accent : colors.textTertiary}
                                />
                                {likesWorthShowing(likes[c.slug]) && (
                                  <Text style={s.meta}>
                                    {likes[c.slug]} {t(likes[c.slug] === 1 ? 'like' : 'likes', 'lượt thích', 'いいね')}
                                  </Text>
                                )}
                              </PressableScale>
                            ) : null}
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
                  accessibilityLabel={t(own.title_en, own.title_vi, own.title_ja)}
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
                        <View style={s.metaRow}>
                          {/* The padlock says whose it is without spending a
                              word on it. It used to be the only answer,
                              because every owned list was private; now the
                              glyph carries which of the two it is, and the
                              detail screen uses the same pair for the same
                              fact. */}
                          <Ionicons
                            name={own.is_public ? 'globe-outline' : 'lock-closed-outline'}
                            size={13}
                            color={own.is_public ? colors.ok : colors.textTertiary}
                          />
                          <Text style={s.meta} numberOfLines={1}>
                            {/* "0 places" reads like a broken count; an empty
                                list you just made deserves a sentence. */}
                            {reasonFor(own.slug) ?? (count === 0
                              ? t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません')
                              : placesOf(count))}
                            {`  ·  ${own.is_public
                              ? t('Public', 'Công khai', '公開')
                              : t('Private', 'Riêng tư', '非公開')}`}
                          </Text>
                        </View>
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
                        {/* How many people liked it — the answer to "is
                            anybody reading this list", which the shelf could
                            not give before and which a curator has no other
                            way to find out.

                            Its own line rather than the end of the meta one.
                            On the meta line it was the fourth clause of a
                            sentence that already reads "2 places · Public ·
                            by @minh", competing with the byline for the last
                            few points of width — and it is not the same kind
                            of fact as the others. Those describe what the
                            list *is*; this one is what other people did
                            about it. A line of its own is also what buys the
                            word "likes", so the number is read rather than
                            decoded.

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
                            the heart's own line. */}
                        {own.id && own.is_public ? (
                          <PressableScale
                            style={s.likesWrap}
                            contentStyle={s.likesRow}
                            scaleTo={0.82}
                            haptic="none"
                            hitSlop={{ top: 10, bottom: 10, left: 12, right: 16 }}
                            onPress={() => onHeart(own)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: myLikes.includes(own.id) }}
                            accessibilityLabel={myLikes.includes(own.id)
                              ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す')
                              : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね')}
                          >
                            <Ionicons
                              name={myLikes.includes(own.id) ? 'heart' : 'heart-outline'}
                              size={15}
                              color={myLikes.includes(own.id) ? colors.accent : colors.textTertiary}
                            />
                            {likesWorthShowing(likes[own.slug]) && (
                              <Text style={s.meta}>
                                {likes[own.slug]} {t(likes[own.slug] === 1 ? 'like' : 'likes', 'lượt thích', 'いいね')}
                              </Text>
                            )}
                          </PressableScale>
                        ) : null}
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
                    editLabel={t('Edit', 'Sửa', '編集')}
                    deleteLabel={t('Delete', 'Xoá', '削除')}
                  >
                    {card}
                  </SwipeRow>
                </View>
              );
            }}
            renderSectionFooter={({ section }) => {
              // Under a query, the only footer is the honest one: nothing
              // matched. The creation rows stay out of it — "start your
              // first collection" under a search that found nothing would
              // be answering a question nobody asked.
              if (asked) {
                if (section.data.length > 0) return null;
                return q
                  ? <Empty text={t(`Nothing here matches "${q}".`, `Không có gì khớp với "${q}".`, `「${q}」に一致するものはありません。`)} />
                  : <Empty text={t('No collections match that choice.', 'Không có bộ sưu tập nào khớp lựa chọn đó.', 'その条件に合うコレクションはありません。')} />;
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
            onRefresh={() => { setPulling(true); cols.reload(); mine.reload(); }}
            refreshing={pulling}
          />
        )}
      </View>
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
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
  },
  noticeChipText: { color: colors.accentInk, fontSize: 15, fontWeight: font.semibold },

  // The community grid. Sized in the component — the width is the
  // screen's business — and dressed in the Explore shelf card's clothes:
  // photo, three-stop scrim, light ink.
  gridRow: {
    flexDirection: 'row', gap: space.cardGap,
    marginHorizontal: space.page, marginBottom: space.cardGap,
  },
  gcard: { borderRadius: radius.image, overflow: 'hidden', justifyContent: 'flex-end' },
  gcardText: { padding: 12, gap: 2 },
  gcardTitle: { color: onPhoto.text, fontSize: 16, fontWeight: font.semibold, lineHeight: 19 },
  gcardBy: { color: onPhoto.textSecondary, fontSize: 13, fontWeight: font.medium, flexShrink: 1 },
  // As tall as the avatar on every tile (owner, 17 Oct 2026). A
  // community tile leads with an 18pt face, your own with a 14pt glyph,
  // and the shorter row sat the title 2–3pt lower on one tab than the
  // other — the same list moved as you switched tabs.
  gcardFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, minHeight: 18 },
  gcardMeta: { color: onPhoto.textSecondary, fontSize: 13 },
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: space.page, marginBottom: 14 },
  panel: { marginHorizontal: space.page, marginBottom: 14, padding: space.cardPadding, gap: space.headingToContent },
  group: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legend: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  clear: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  suggestionText: { flex: 1, color: colors.text, fontSize: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },

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
  // Shrink-to-fit, on the Pressable rather than the row inside it. A
  // column parent stretches its children, so without this the community
  // row's heart would carry a tap target the full width of the text
  // block — and every tap along that line would like the list instead of
  // opening it. `alignSelf` positions the element in its parent, which is
  // the half that belongs on the container; see `PressableScale`.
  likesWrap: { alignSelf: 'flex-start' },
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
