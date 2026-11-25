// How Explore moves: the photograph's height and the veil over the clock,
// the status bar's ink, the filter row that pins, the dock's offer, the
// tab pressed again, and the sign-up tour's steps.
//
// Out of `ExploreScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, type SectionList, useWindowDimensions } from 'react-native';
import { useScrollToTop, type ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { useDockOffer } from '../../components/DockSlot';
import { useSignupTour } from '../../components/SignupTour';
import { useDuckOnScroll, useTabBarDuck } from '../../components/tabBarDuck';
import { useOwnedStatusBar } from '../../components/ui';
import { fetchPlaceIndex, type Place, type PlaceIndexRow } from '../../lib/data';
import type { ExploreView } from '../../lib/exploreView';
import { goTo, type Nav } from '../../nav';
import { FILTER_PAD } from './styles';
import type { ExploreFiltering } from './useExploreFilters';


/**
 * How many cards have to pass overhead before the screen offers a hand.
 *
 * Two — it was five when the offer cut into the top of the screen, where
 * arriving early meant interrupting someone who was merely reading. It
 * lives in the tab bar's vacated dock now, at the screen's edge, below
 * the reading line: an offer, not an interruption, and an offer can
 * afford to arrive as soon as browsing starts to look like looking for
 * something — past the hero, past the shelf, a couple of cards in. The
 * bar leaves that slot within the first flick; a dock that then sits
 * empty for two thousand points reads as the feature not working, which
 * is exactly how it was reported.
 *
 * The footer row is still the honest answer to "I reached the end". This
 * is the other case: a long list is a list you can be lost in without
 * ever reaching the end of it.
 */
const DEEP_AFTER = 2;

export function useExploreScroll({ navigation, mapMode, pickView, insets, shown, holding, locate, setCityIndex }: {
  navigation: Nav;
  mapMode: boolean;
  pickView: (v: ExploreView) => void;
  insets: EdgeInsets;
  shown: Place[];
  /** The catalog not answered yet: the tour waits for the list. */
  holding: boolean;
  locate: ExploreFiltering['locate'];
  setCityIndex: (rows: PlaceIndexRow[]) => void;
}) {
  const scrollY = useRef(new Animated.Value(0)).current;

  // Just under half the window, banded: enough photograph to be the
  // front door — and no more. At 56% the shelf barely cleared the fold
  // and not one place card did; 48% buys the fold back for the content
  // this screen exists to show, with the first card's top edge peeking
  // in as the scroll invitation. The floor came down with it (330, was
  // 380) so small phones share the ratio instead of being clamped back
  // to a taller cover than anyone else's. One number, decided here,
  // because the hero draws it and the status-bar threshold reads it.
  const { height: winH } = useWindowDimensions();
  const heroH = Math.min(500, Math.max(330, Math.round(winH * 0.48)));

  /**
   * Which ink the status bar wants, now that the clock sits on the
   * photograph. Over the hero the scrim is dark whatever the theme, so
   * both want light type there; past it the page is its own ground again
   * and the scheme decides.
   *
   * The crossing is tracked in a ref rather than state because the scroll
   * listener below is built once and holds its first closure — and
   * because the answer changing must not cost this screen a render
   * mid-transition. See `useOwnedStatusBar`.
   */
  const pastHeroRef = useRef(false);
  const heroEndRef = useRef(0);
  // Past once the photo's last 44pt are leaving — the moment the dark
  // ground stops being what is under the clock.
  heroEndRef.current = heroH - insets.top - 44;
  // The page's own ground under the clock, from the moment the clock
  // turns to dark ink. Until 12 Nov 2026 the clock's strip stayed clear
  // until the Places row pinned, and everything between scrolled under
  // the time: the hero's headline and its Explore button in light ink
  // first (owner's screenshot, 20:48), then the whole collection shelf
  // in dark ink over dark covers, which is where the time could not be
  // read at all. Faded in over the same last 44pt of photograph the ink
  // already turns on, so it is opaque at the crossing and dark ink never
  // sits on the picture; the pinned row's ground is the same colour, so
  // the two meet without a seam.
  const veilOpacity = scrollY.interpolate({
    inputRange: [heroEndRef.current - 44, heroEndRef.current],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // Map mode has no hero under the clock — the floating bar's own ground
  // is `colors.bg`, the page's, not the hero's dark scrim — so it wants
  // the scheme's own ink exactly the way past-the-hero already does.
  const mapModeRef = useRef(false);
  // Null past the hero: there the page is its own ground again and the
  // right ink is exactly the scheme's own, which is what the hook's null
  // means. Taking, handing back, and the mid-transition cost all live in
  // `useOwnedStatusBar` — a place's screen wants the same thing.
  const applyBar = useOwnedStatusBar(() => ((pastHeroRef.current || mapModeRef.current) ? null : 'light'));
  // `mapModeRef` mirrors `mapMode` for the closure above; this effect is
  // what keeps the mirror honest and repaints on every crossing, both
  // into map mode and back out of it — unlike the reset effect below,
  // which only ever runs on the way in.
  //
  // A layout effect, in the commit that draws the map. The tab-press
  // handler below reads this mirror, and as a passive effect it could
  // still say "list" after the map was on screen: a press in that gap was
  // ignored. The Explore suite caught it in CI ("its tab, pressed again"),
  // where the wait saw the map before the effect had run.
  useLayoutEffect(() => {
    mapModeRef.current = mapMode;
    applyBar();
  }, [mapMode, applyBar]);

  /**
   * Explore's tab, pressed again, walks back one step at a time — the
   * convention every tab bar on the phone keeps, from the App Store to
   * Instagram: the first press leaves whatever was opened on top of this
   * screen, the next closes the map, the one after scrolls to the cover.
   *
   * The first step is the stack's own (a native stack pops to its root
   * when its tab is pressed while focused) and the last is
   * `useScrollToTop` below. This is the middle one. `isFocused` is what
   * keeps them in order: under a place's page this screen is not
   * focused, so the press that pops back to it does not also close the
   * map it pops back to.
   *
   * The map is left the way its own "Close Map" leaves it, remembered
   * and all — a press on the tab is the reader asking for the list, not
   * for a list this once.
   */
  useEffect(() => navigation.getParent<BottomTabNavigationProp<ParamListBase>>()?.addListener('tabPress', (e) => {
    if (e.defaultPrevented || !navigation.isFocused() || !mapModeRef.current) return;
    pickView('list');
  }), [navigation, pickView]);
  const listRef = useRef<SectionList<Place>>(null);
  // React Navigation types the list it scrolls as a ScrollView or a thing
  // with `scrollTo`; React Native 0.88 (SDK 58) types a SectionList as
  // neither, though it answers `getScrollResponder` as it always did.
  useScrollToTop(listRef as unknown as Parameters<typeof useScrollToTop>[0]);

  // How far down the list the reader currently is, measured in cards
  // rather than pixels: a card's height depends on its photograph, so a
  // pixel threshold would mean something different on every list. This is
  // the topmost card on screen, so scrolling back up puts the number down
  // again and the offer withdraws itself.
  const [firstVisible, setFirstVisible] = useState(0);
  // Everything below this line is frozen at first render — React Native
  // refuses a changing `onViewableItemsChanged`, and `Animated.event` is
  // built once — so the shared setter is a ref too, guarding on its own
  // mirror of the value rather than on state it cannot see.
  const firstRef = useRef(0);
  const setFirst = useRef((n: number) => {
    if (firstRef.current === n) return;
    firstRef.current = n;
    setFirstVisible(n);
  }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: { index: number | null | undefined }[] }) => {
    const idx = viewableItems.map((v) => v.index).filter((i): i is number => i != null);
    // An empty batch happens between frames and means nothing; taking it
    // as zero would blink the offer off and on again.
    if (idx.length) setFirst(Math.min(...idx));
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  /**
   * The offset half of the same question, and it is not redundant.
   *
   * Viewability reports changes to a *set*, and a fast fling can carry the
   * list from "cards 4–6 showing" to "no cards showing" without a batch in
   * between. The last number the offer saw would then be 4, and it would
   * sit over the hero photograph at the top of a screen nobody is lost on.
   * The offset never has that gap.
   */
  // The duck handler is identity-stable, but this listener is created
  // once and holds its first closure — the ref indirection keeps that
  // guarantee honest whatever the hook does across renders.
  const duckScroll = useDuckOnScroll();
  const duckRef = useRef(duckScroll);
  duckRef.current = duckScroll;
  /**
   * Whether the chips row has reached the top of the screen.
   *
   * A boolean where the backing beside it is an interpolation, because
   * what it decides is not an opacity: pinned, the block shows the
   * clock's worth of clearance where at rest it shows the heading. One
   * render per crossing, not one per frame — the same guard `setFirst`
   * above uses, on a ref the once-built listener can actually see.
   */
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  const pinAtRef = useRef(0);

  // `show` surfaces the tab bar regardless of scroll — moved up here
  // (its sibling `ducked` is still read below, by the nudge) because the
  // reset effect just below needs it: the tab bar's only way onto this
  // screen is a scroll-up (see `report` in `tabBarDuck.tsx`), and the map
  // emits no scroll at all.
  const { ducked, show } = useTabBarDuck();

  // On entering the map, ask once. A refusal is not an error here — the
  // map is still a map — so nothing is said; the strip simply carries no
  // distance and there is no blue dot.
  const askedRef = useRef(false);
  // `locate` is in the dependencies and is remade whenever `t` is; the
  // ref is what keeps that from asking twice. Leave the array as it is.
  useEffect(() => {
    if (!mapMode || askedRef.current) return;
    askedRef.current = true;
    void locate();
    // Same trip, same reason: nothing off this city is drawn until the
    // map is open, so nothing is asked for until then either.
    fetchPlaceIndex().then(setCityIndex).catch(() => {});
  }, [mapMode, locate, setCityIndex]);

  // The list is unmounted in map mode, and everything the screen derives
  // from its scroll — the hero's parallax, whether the bar has pinned,
  // the clock's ink past the hero, the weather's pause, which card is
  // first — is updated only by the list's own events. Left alone it
  // would still say "scrolled" when the list comes back at offset 0. So
  // entering the map puts all of it back to rest; the list returns to a
  // screen that agrees with it. The tab bar is shown by scrolling up,
  // which the map never does, so it is surfaced here too rather than
  // left ducked with nothing above it to bring it back.
  useEffect(() => {
    if (!mapMode) return;
    scrollY.setValue(0);
    pinnedRef.current = false;
    setPinned(false);
    pastHeroRef.current = false;
    applyBar();
    setFirst(0);
    show();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs and once-built setters; only the mode matters
  }, [mapMode]);

  const onScrollJS = useRef((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < 320) setFirst(0);
    // The moment the heading in the list would slide under the clock.
    // The floating copy draws its heading at exactly the safe-area
    // inset, so handing over here puts it where the other one was.
    const stuck = pinAtRef.current > 0 && y >= pinAtRef.current;
    if (stuck !== pinnedRef.current) {
      pinnedRef.current = stuck;
      setPinned(stuck);
    }
    // The status-bar crossing — everything through refs, because this
    // closure is built once. Only while focused: a background screen
    // repainting the bar would fight whoever owns it now.
    const past = y > heroEndRef.current;
    if (past !== pastHeroRef.current) {
      pastHeroRef.current = past;
      applyBar();
    }
    duckRef.current?.(e as never);
  }).current;
  // Built once, as the comment over `firstRef` says it is. It was written
  // inline on the list, so every redraw — each card scrolled past moves
  // `firstVisible` — handed the list a new native event to detach the old
  // one for and attach (owner, 30 Oct 2026). `scrollY` and the listener
  // are both the screen's for its life.
  const [onScroll] = useState(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true, listener: onScrollJS },
  ));

  // Deep into a list long enough to get lost in. The length test is not
  // belt-and-braces: with four cards you can be five in only by rubber
  // banding, and an offer that appears when you bounce the list is a
  // twitch, not a suggestion.
  const deep = shown.length > DEEP_AFTER + 2 && firstVisible >= DEEP_AFTER;

  // The offer may borrow the tab bar's dock only while the bar is away —
  // the sharing rules live in lib/nudge.ts, applied by `useDockOffer`.
  const nudge = useDockOffer(ducked && deep, navigation);

  /**
   * The list header's measured height **is** the offset at which the
   * filter row pins — the row is the very next cell — and the pinning
   * moment is when its backing must be opaque. Measured rather than
   * summed: the shelf's height depends on whether this city has
   * collections at all.
   */
  const [headerH, setHeaderH] = useState(0);
  const tour = useSignupTour();
  const tourHandled = useRef(-1);
  useEffect(() => {
    if (tour.step < 0) { tourHandled.current = -1; return; }
    if (mapMode) { pickView('list'); return; }
    if (holding || headerH === 0 || tourHandled.current === tour.step) return;
    tourHandled.current = tour.step;
    if (tour.step === 1) {
      // A real catalog entry, never a fabricated tutorial place or a write.
      if (shown[0]) navigation.navigate('PlaceDetail', { slug: shown[0].slug });
      else tour.next();
    } else if (tour.step === 0) {
      listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
    } else if (tour.step === 2) {
      // Collections on Community, from the place's page, which is let go.
      navigation.popToTop();
      goTo('Collections', { screen: 'CollectionsHome', params: { tab: 'community', at: Date.now() } });
    } else if (tour.step === 3) {
      goTo('Profile', { screen: 'ProfileHome' });
    } else if (tour.step === 4) {
      goTo('Ideas', { screen: 'IdeasHome' });
    }
  }, [tour, holding, headerH, shown, navigation, mapMode, pickView, insets.top]);
  // The floating bar's own measured height, in map mode: there the bar
  // stands in permanently for the list's scrolled-away copy, and the map
  // beneath it has to start clear of it rather than guess its height.
  const [barH, setBarH] = useState(0);
  // Where the list header ends is where the block begins, so the crossing
  // is that offset plus the block's own padding, less the inset the
  // floating copy will put above the heading instead.
  pinAtRef.current = headerH > 0 ? headerH + FILTER_PAD - insets.top : 0;
  return {
    scrollY, heroH, veilOpacity, listRef, onViewable, viewabilityConfig, pinned, onScroll, nudge,
    setHeaderH, barH, setBarH,
  };
}
