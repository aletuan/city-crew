// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, SectionList, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AmbientWarmth, Avatar, Card, Empty, fireHaptic, GradientCta, PressableScale, RoundIconButton, Screen, Skeleton, UnderlineTabs, useTabBarClearance } from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { AddSlot } from '../components/add';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { Collection, coverOf, deleteCollection, fetchProfilesById, type FriendProfile, membersOf, touchesCity } from '../lib/data';
import { atHandle } from '../lib/handle';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { likesWorthShowing } from '../lib/likes';
import { findCollections } from '../lib/search';
import { useSave } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, onPhoto, radius, space, type } from '../theme';
import type { Nav } from '../nav';

/** What `renderRightActions` hands back, and what the card animates from. */
type Drag = ReturnType<Animated.Value['interpolate']>;

/** What the two actions take up behind an open row: two 62pt buttons, the
 *  8pt between them, and the 8pt separating them from the card. The row
 *  clamps its own travel to whatever they measure, so this figure only sets
 *  how fast the card's insides shrink on the way there. */
const ACTIONS_W = 62 * 2 + 8 + 8;
/** Where the Yours tab's tile/list choice sleeps between launches. */
const VIEW_KEY = 'citycrew.collections.view';
const THUMB = 92;
const THUMB_OPEN = 64;
/** The disclosure chevron's own footprint — it is a glyph, not a control,
 *  so this is the size of the mark rather than a touch target. */
const CHEVRON = 17;

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
function GuestNotice({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  if (session) return null;
  return (
    <PressableScale
      containerStyle={s.noticeWrap}
      style={s.notice}
      onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'SignIn' })}
      accessibilityRole="button"
      accessibilityLabel={t(
        'Sign in to build your own collections',
        'Đăng nhập để tạo bộ sưu tập của riêng bạn',
        'サインインして自分のコレクションを作る',
      )}
    >
      <View style={s.noticeHead}>
        {/* The Collections tab's own glyph, so the card belongs to this
            screen instead of reading as a generic account banner. */}
        <View style={s.noticeIcon}>
          <Ionicons name="bookmark" size={19} color={colors.accent} />
        </View>
        <View style={s.noticeCopy}>
          <Text style={s.noticeTitle}>
            {t('Start your own collection', 'Tạo bộ sưu tập của riêng bạn', '自分のコレクションを作る')}
          </Text>
          <Text style={s.noticeBody}>
            {t(
              'Sign in to save places you like and group them into lists.',
              'Đăng nhập để lưu địa điểm bạn thích và nhóm lại thành danh sách.',
              'サインインすると気になるスポットを保存し、リストにまとめられます。',
            )}
          </Text>
        </View>
      </View>
      {/* A rounded rectangle at chip scale, the sheet's primary button
          scaled down. Sized to its label rather than stretched: the card is
          already the target, so this names the action — it does not need to
          be the loudest object on the screen. */}
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
      colors={[colors.accentSoft, 'rgba(255,111,91,0.02)']}
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
            'Nhóm địa điểm thành danh sách — buổi hẹn tối, cuối tuần với hội bạn, tour cà phê.',
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
          {t('Only you can see your lists.', 'Chỉ mình bạn thấy danh sách của bạn.', 'リストはあなただけに表示されます。')}
        </Text>
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
function NewCollectionRow({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <AddSlot
      onPress={onPress}
      title={t('New collection', 'Bộ sưu tập mới', '新しいコレクション')}
      subtitle={t('Group places for your next plan', 'Nhóm địa điểm cho kế hoạch tới', '次の予定に向けてスポットをまとめる')}
    />
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
 */
function SwipeRow({ children, onEdit, onDelete, editLabel, deleteLabel }: {
  children: (open: boolean, drag: Drag | null) => React.ReactNode;
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
        // No rubber-band past the actions: the row is 92pt tall and an
        // overshoot on something this small reads as the row coming loose.
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
                containerStyle={s.actionWrap}
                style={[s.action, s.actionEdit]}
              >
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </PressableScale>
              <PressableScale
                onPress={() => act(onDelete)}
                accessibilityRole="button"
                accessibilityLabel={deleteLabel}
                containerStyle={s.actionWrap}
                style={[s.action, s.actionDelete]}
              >
                <Ionicons name="trash-outline" size={22} color={colors.bad} />
              </PressableScale>
            </View>
          );
        }}
      >
        <Animated.View style={pinned}>{children(open, drag)}</Animated.View>
      </Swipeable>
    </View>
  );
}

export default function CollectionsScreen({ navigation, route }: {
  navigation: Nav;
  route: { params?: { tab?: 'community' } };
}) {
  const { t } = useI18n();
  const { session } = useAuth();
  const { city } = useCity();
  const cols = useCollections();
  // Shared with the save sheet — see SaveProvider. Reading it here through
  // its own hook is what let the two disagree.
  const { mine, askToSignIn } = useSave();
  // Counts for both tabs; the heart itself only on the community grid.
  // Your own rows still refuse it — a tappable heart inside a swipeable
  // row is a third gesture competing for the same thumb — but a
  // community card does not swipe, so there it is the same control the
  // Explore shelf taps, backed by the same provider, one copy of the
  // truth.
  const { likes, myLikes, toggleLike } = useLikes();
  const { data: places, loading: placesLoading, loaded: placesLoaded } = usePlaces();
  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
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
  // without this you would come back to the list you left. The first focus
  // is skipped — the hook has already loaded on mount, and refetching there
  // is a second identical request for nothing.
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    mine.reload();
  // `mine.reload` is stable; `mine` is a new object on every load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.reload]));

  // A public collection with nothing in this city is somebody else's trip,
  // and one with nothing at all is a dead end, so both stay hidden. Your
  // own are neither: an empty one is new, and one made in another city is
  // still yours — `mine` is filtered by neither test.
  const visible = cols.data.filter((c) => touchesCity(membersOf(c, places), city?.id));

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
  const me = session?.user?.id;
  const onHeart = useCallback((c: Collection) => {
    if (!c.id) return;
    if (!me) { askToSignIn(); return; }
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
            deleteCollection(c.slug)
              .then(() => mine.reload())
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
  // mounted, so a fresh param re-aims the switch.
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);
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

  // The search over what is already here. Everything it reads — both
  // lists, every member — is in memory, so this is a filter that runs on
  // the keystroke, offline, with no query behind it. It answers by a
  // list's own words, by the places inside it, and by @handle; the
  // arithmetic lives in `findCollections`, under the gate, beside the
  // rules it shares with the search box on Explore.
  //
  // Closed, it is one glyph in the space the left-aligned tabs leave
  // free. The field only exists while wanted — the lesson of the Crew
  // tray, spent here before the fact.
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim();
  const closeSearch = () => { setSearching(false); setQuery(''); };

  // `loaded`, not `!loading`: the focus refresh flips `loading` back on,
  // and hiding the list for that made a visit look like a double load.
  const mineReady = mine.loaded;
  const sift = (list: Collection[]) => (q
    ? findCollections(list.map((c) => ({ c, members: membersOf(c, places) })), q)
    : list);

  // Both halves default to tiles — covers first, in the Explore shelf's
  // own card language, six covers where the rows showed three — and one
  // small switch turns both back into rows, because a shelf is browsed
  // on some days and scanned by name on others. One preference, not one
  // per tab: a reader who chose rows chose how they read lists, not how
  // they read one tab. The choice is remembered. What your own tiles
  // give up — the swipe shortcuts — the rows keep, one flick away, and
  // the collection's own screen has in its ⋯ menu regardless.
  const { width: winW } = useWindowDimensions();
  const gcardW = Math.round((winW - space.page * 2 - space.cardGap) / 2);
  const gcardH = Math.round(gcardW * 1.18);
  const [view, setView] = useState<'tile' | 'row'>('tile');
  useEffect(() => {
    AsyncStorage.getItem(VIEW_KEY)
      .then((v) => { if (v === 'row' || v === 'tile') setView(v); })
      .catch(() => {});
  }, []);
  const pickView = (v: 'tile' | 'row') => {
    setView(v);
    AsyncStorage.setItem(VIEW_KEY, v).catch(() => {});
  };

  // SectionList knows nothing of columns, so the grid packs itself: two
  // cards per row-item, and the odd last card keeps a spacer where its
  // neighbour would be. Every row-item carries whose it is — a tile
  // shows a padlock for your own and a byline for everyone else's, and
  // the two row shapes split the same way: yours swipe, the community's
  // do not.
  type ListRow =
    | { kind: 'own'; c: Collection }
    | { kind: 'com'; c: Collection }
    | { kind: 'pair'; pair: Collection[]; own: boolean };
  const pairUp = (list: Collection[], own: boolean): ListRow[] => {
    const out: ListRow[] = [];
    for (let i = 0; i < list.length; i += 2) out.push({ kind: 'pair', pair: list.slice(i, i + 2), own });
    return out;
  };
  const shape = (list: Collection[], own: boolean): ListRow[] => (view === 'tile'
    ? pairUp(list, own)
    : list.map((c): ListRow => ({ kind: own ? 'own' : 'com', c })));
  const sections = session && tab === 'yours'
    ? (mineReady ? [{ own: true, data: shape(sift(mine.data), true) }] : [])
    : [{ own: false, data: shape(sift(visible), false) }];

  return (
    // No control in the header: creating belongs to the Yours tab, which
    // always shows one door — the dashed row under the list, or the empty
    // card's own button. (The "New" pill that rode the section heading
    // went with the heading itself when the sections became tabs: it was
    // the same action a third time.)
    <Screen
      title={t('Collections', 'Bộ sưu tập', 'コレクション')}
      // The search lives where every screen keeps its utility — the
      // header's right, in the same grey disc the Crew screen gives ⊕
      // and Explore gives its own magnifier. It sat as a bare 18pt glyph
      // on the tabs row first, and the owner's review was right: a
      // feature nobody notices is a feature nobody has. Up here it is
      // also a door guests get — the tabs row below is signed-in only,
      // the community list is not.
      right={(
        <RoundIconButton
          icon={searching ? 'close' : 'search'}
          label={searching
            ? t('Close search', 'Đóng tìm kiếm', '検索を閉じる')
            : t('Search collections', 'Tìm bộ sưu tập', 'コレクションを検索')}
          onPress={() => (searching ? closeSearch() : setSearching(true))}
        />
      )}
    >
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {/* The tab bar's own glyph for your shelf; the globe every public
            row already wears for everyone else's. Guests have no library,
            so they get the one half with no switch in front of it. */}
        {session ? (
          <UnderlineTabs
            tabs={[
              { key: 'yours', icon: 'bookmark-outline', label: t('Yours', 'Của bạn', '自分の') },
              { key: 'community', icon: 'globe-outline', label: t('Community', 'Cộng đồng', 'みんなの') },
            ]}
            active={tab}
            onChange={setTab}
            // One preference, both shelves — see `shape`.
            right={(
              <View style={s.viewToggle}>
                {(['row', 'tile'] as const).map((v) => (
                  <PressableScale
                    key={v}
                    style={[s.viewBtn, view === v && s.viewBtnOn]}
                    scaleTo={0.9}
                    haptic="selection"
                    hitSlop={6}
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
        {searching ? (
          <View style={s.searchRow}>
            <Ionicons name="search" size={15} color={colors.textTertiary} />
            <TextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              // The three things it answers by, named in the box itself —
              // and in the app's own word for the third: "username" is
              // what the Crew screen's add flow already calls it, where
              // "handle" is what this codebase calls it. Readers get the
              // screen's vocabulary, not the repository's.
              placeholder={t('Name, place, or @username', 'Tên, địa điểm, hoặc @username', '名前・スポット・@ユーザー名')}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <PressableScale
                scaleTo={0.85}
                hitSlop={8}
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('Clear', 'Xoá', 'クリア')}
              >
                <Ionicons name="close-circle" size={17} color={colors.textTertiary} />
              </PressableScale>
            )}
          </View>
        ) : null}
        {holding && (
          <View>
            <GuestNotice navigation={navigation} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.row}>
                <Card style={s.card}>
                  <Skeleton style={s.thumb} />
                  <View style={s.cardText}>
                    <Skeleton style={{ height: 18, width: '70%', borderRadius: 8 }} />
                    <Skeleton style={{ height: 13, width: '45%', borderRadius: 7 }} />
                  </View>
                </Card>
              </View>
            ))}
          </View>
        )}
        {!holding && cols.error && <Empty text={t(`Couldn't load collections: ${cols.error}`, `Không tải được bộ sưu tập: ${cols.error}`, `読み込みに失敗しました: ${cols.error}`)} />}
        {!holding && !cols.error && (
          <SectionList
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
                    {item.pair.map((c) => {
                      const uri = coverFor(c);
                      const members = membersOf(c, places).length;
                      const my = !!c.id && myLikes.includes(c.id);
                      return (
                        <PressableScale
                          key={c.slug}
                          style={[s.gcard, { width: gcardW, height: gcardH }]}
                          onPress={() => navigation.navigate('CollectionDetail', { slug: c.slug })}
                        >
                          {uri
                            ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                            : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
                          {/* The Explore shelf's scrim, verbatim — same
                              object, same card language, second surface. */}
                          <LinearGradient
                            colors={['rgba(10,11,10,0.22)', 'rgba(10,11,10,0.10)', 'rgba(10,11,10,0.94)']}
                            locations={[0, 0.42, 1]}
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={s.gcardText}>
                            <Text style={s.gcardTitle} numberOfLines={1}>
                              {t(c.title_en, c.title_vi, c.title_ja)}
                            </Text>
                            {/* Whose list this is, said with a face: the
                                avatar beside the handle carries the whole
                                of "by", so the word goes — owner review,
                                and right. The list rows keep the word,
                                because down there no face does that work.
                                On your own tab neither appears: the
                                byline would only say your own name, so
                                the padlock speaks instead. */}
                            {!item.own && c.curator_handle ? (
                              <View style={s.gcardByRow}>
                                <Avatar url={c.owner_id ? faces[c.owner_id]?.avatar_url : undefined} size={18} />
                                <Text style={s.gcardBy} numberOfLines={1}>
                                  {atHandle(c.curator_handle)}
                                </Text>
                              </View>
                            ) : null}
                            <View style={s.gcardFoot}>
                              {item.own && (
                                <Ionicons
                                  name={c.is_public ? 'globe-outline' : 'lock-closed-outline'}
                                  size={12}
                                  color={c.is_public ? colors.ok : onPhoto.textSecondary}
                                />
                              )}
                              <Text style={s.gcardMeta}>
                                {members === 0
                                  ? t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません')
                                  : `${members} ${t(members === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}`}
                              </Text>
                              {/* Only where a like is possible: a private
                                  list is one nobody may like, and a heart
                                  on it would be an invitation to nothing. */}
                              {c.id && c.is_public ? (
                                <PressableScale
                                  containerStyle={{ marginLeft: 'auto' }}
                                  style={s.gcardLikes}
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
              // byline instead of padlock, the quiet likes line instead
              // of a tappable heart, and nothing behind a swipe, because
              // none of it is yours to edit.
              if (item.kind === 'com') {
                const c = item.c;
                const n = membersOf(c, places).length;
                const cover = coverFor(c);
                return (
                  <View style={s.row}>
                    <PressableScale onPress={() => navigation.navigate('CollectionDetail', { slug: c.slug })}>
                      <Card style={s.card}>
                        <View style={s.thumb}>
                          {cover
                            ? <Image source={{ uri: cover }} style={s.thumbFill} contentFit="cover" transition={200} />
                            : <EmptyCover />}
                        </View>
                        <View style={s.cardText}>
                          <Text style={s.title} numberOfLines={2}>{t(c.title_en, c.title_vi, c.title_ja)}</Text>
                          <View style={s.metaRow}>
                            <Text style={s.meta} numberOfLines={1}>
                              {n} {t(n === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}
                              {c.curator_handle ? `  ·  ${t('by', 'bởi', 'by')} ${atHandle(c.curator_handle)}` : ''}
                            </Text>
                          </View>
                          {likesWorthShowing(likes[c.slug]) && (
                            <View style={s.likesRow}>
                              <Ionicons name="heart" size={13} color={colors.accentFaint} />
                              <Text style={s.meta}>
                                {likes[c.slug]} {t('likes', 'lượt thích', 'いいね')}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={s.chevron}>
                          <Ionicons name="chevron-forward" size={CHEVRON} color={colors.textTertiary} />
                        </View>
                      </Card>
                    </PressableScale>
                  </View>
                );
              }
              const own = item.c;
              const count = membersOf(own, places).length;
              const uri = coverFor(own);
              // Narrowed to roughly a third of its width, the card has room
              // for a name and a count and nothing else. So the cover comes
              // down to 64pt, the chevron closes up — the row is already
              // open, it has nothing left to announce — and the title drops
              // to a single line rather than wrapping into the space the
              // meta needs. All of it rides the same drag as the pin, so
              // the card reflows under your thumb instead of snapping when
              // you let go.
              const card = (open: boolean, drag: Drag | null) => (
                <PressableScale onPress={() => navigation.navigate('CollectionDetail', { slug: own.slug })}>
                  <Card style={s.card}>
                    <Animated.View
                      style={[s.thumb, drag && {
                        width: Animated.add(THUMB, Animated.multiply(drag, (THUMB - THUMB_OPEN) / ACTIONS_W)),
                        height: Animated.add(THUMB, Animated.multiply(drag, (THUMB - THUMB_OPEN) / ACTIONS_W)),
                      }]}
                    >
                      {uri
                        ? <Image source={{ uri }} style={s.thumbFill} contentFit="cover" transition={200} />
                        : <EmptyCover />}
                    </Animated.View>
                    <View style={s.cardText}>
                      <Text style={s.title} numberOfLines={open ? 1 : 2}>{t(own.title_en, own.title_vi, own.title_ja)}</Text>
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
                          {count === 0
                            ? t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません')
                            : `${count} ${t(count === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}`}
                          {`  ·  ${own.is_public
                            ? t('Public', 'Công khai', '公開')
                            : t('Private', 'Riêng tư', '非公開')}`}
                        </Text>
                      </View>
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

                          Absent counts and zero both draw nothing —
                          `likesWorthShowing` explains why, and a private
                          list is always the absent case: the counts come
                          from a function that returns public rows only,
                          because a private list is one nobody may like. So
                          the line never appears under a padlock, and never
                          claims that a list nobody *could* like is a list
                          nobody *did*. */}
                      {likesWorthShowing(likes[own.slug]) && (
                        <View style={s.likesRow}>
                          {/* Filled, and quiet. The fill is legibility: an
                              outline heart at 13pt spends most of its ink
                              on a hairline and reads as a smudge, while
                              the solid shape is recognisable at a glance.

                              The colour is what keeps the fill honest. A
                              coral heart already means two things in this
                              app — "you liked this" on the detail screen,
                              and "tap me" on the Explore shelf — and this
                              heart is neither: it is not your state and it
                              is not a control. `accentFaint` exists for
                              exactly this, a mark that registers as warmth
                              rather than as a second thing to read, and at
                              that weight nobody's thumb mistakes it for a
                              button that does not respond. */}
                          <Ionicons name="heart" size={13} color={colors.accentFaint} />
                          <Text style={s.meta}>
                            {likes[own.slug]} {t('likes', 'lượt thích', 'いいね')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Animated.View
                      style={[s.chevron, drag && {
                        // The gap the card lays out before it closes up
                        // too, or the title keeps paying for a control
                        // that is no longer there.
                        width: Animated.add(CHEVRON, Animated.multiply(drag, CHEVRON / ACTIONS_W)),
                        marginLeft: Animated.multiply(drag, space.cardPadding / ACTIONS_W),
                        opacity: drag.interpolate({
                          inputRange: [-40, 0], outputRange: [0, 1], extrapolate: 'clamp',
                        }),
                      }]}
                    >
                      <Ionicons name="chevron-forward" size={CHEVRON} color={colors.textTertiary} />
                    </Animated.View>
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
              if (q) {
                return section.data.length === 0
                  ? <Empty text={t(`Nothing here matches "${q}".`, `Không có gì khớp với "${q}".`, `「${q}」に一致するものはありません。`)} />
                  : null;
              }
              if (section.own) {
                return section.data.length === 0
                  ? <FirstCollection onPress={() => navigation.navigate('CollectionForm')} />
                  : <NewCollectionRow onPress={() => navigation.navigate('CollectionForm')} />;
              }
              return section.data.length === 0
                ? <Empty text={t('Nothing from the community yet.', 'Cộng đồng chưa có bộ sưu tập nào.', 'みんなのコレクションはまだありません。')} />
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
  notice: {
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, paddingHorizontal: space.cardPadding, paddingVertical: 17,
  },
  noticeHead: { flexDirection: 'row', gap: 13 },
  // Tinted well, not a filled disc: the filled accent shape belongs to the
  // selected tab, and two of them on one screen both claim to be the
  // thing you last touched.
  noticeIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { color: colors.text, ...type.cardTitle },
  // A step down from `type.body`: this is the supporting line, and at body
  // size it read as loud as the collection titles underneath it.
  noticeBody: { color: colors.textSecondary, fontSize: 14.5, lineHeight: 20 },
  noticeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    // 40 + 13: the icon well and its gap, so the chip starts on the text's
    // left edge rather than under the icon.
    marginTop: 14, marginLeft: 53,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14,
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
  gcardTitle: { color: onPhoto.text, fontSize: 15.5, fontWeight: font.semibold, lineHeight: 19 },
  gcardByRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  gcardBy: { color: onPhoto.textSecondary, fontSize: 12.5, fontWeight: font.medium, flexShrink: 1 },
  gcardFoot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  gcardMeta: { color: onPhoto.textSecondary, fontSize: 12.5 },
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

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: space.page, marginBottom: 14,
    paddingHorizontal: 14, height: 42,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.pill,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },

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
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.cardPadding,
    padding: space.cardPadding,
  },
  // The box, which is what the swipe resizes; the cover inside fills it.
  thumb: {
    width: THUMB, height: THUMB, borderRadius: radius.image,
    backgroundColor: colors.surfaceGlass,
  },
  thumbFill: { width: '100%', height: '100%', borderRadius: radius.image },
  thumbEmpty: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.accentLine,
  },

  // Revealed behind an owned row. Height comes from the row, so the two
  // buttons stay square-ish whatever the title wraps to.
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
  cardText: { flex: 1, gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { color: colors.text, ...type.cardTitle },
  meta: { color: colors.textTertiary, ...type.meta },
  // Same 5pt gap the meta row keeps between the padlock and its sentence,
  // so the two lines start on the same optical edge — the heart and the
  // padlock are both glyphs standing in for a word.
  likesRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // A disclosure indicator, which is a mark and not a control: a bare
  // chevron, the way the rest of the app already draws one. In a 44pt
  // well with a fill and a hairline it looked like a button, and a button
  // beside a tappable row raises a question the row cannot answer — what
  // does pressing the circle do that pressing the row does not. Nothing:
  // the row is the target, and always was. `overflow` is what lets the
  // mark clip away as the swipe closes the space up.
  chevron: { width: CHEVRON, alignItems: 'center', overflow: 'hidden' },
});
