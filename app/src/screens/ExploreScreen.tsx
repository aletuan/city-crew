// Explore — the guest landing surface. It opens on photography: a
// full-bleed hero built on a featured place's picture, wearing the
// dateline, the sky and the search control the old fixed header used to
// hold, then a horizontal shelf of public collections and the browsable
// places list. The screen has no title of its own — the hero's headline
// names the city, and "Discover Saigon" over "Ideas for a night in
// Saigon" was two headings saying one thing. Signing in is asked for
// where it is needed — bookmarking a place — rather than from a
// permanent control in a corner.

import { useSignupTour, useTourAnchor } from '../components/SignupTour';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, SectionList, Text, useWindowDimensions, View } from 'react-native';
import { useScrollToTop, type ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlaceCard from '../components/PlaceCard';
import ExploreFilterSheet, { statusLabel } from '../components/ExploreFilterSheet';
import { AmbientWarmth, Empty, PressableScale, Skeleton, UnderlineChoice, useOwnedStatusBar, useTabBarClearance } from '../components/ui';
import { useDuckOnScroll, useTabBarDuck } from '../components/tabBarDuck';
import { useDockOffer } from '../components/DockSlot';
import { CATEGORIES, categoriesOf, categoryLabel, chosenKind, pinTint, presentCategories } from '../lib/categories';
import { useCity } from '../lib/city';
import { cityTz } from '../lib/clock';
import { fetchPlaceIndex, Place, PlaceIndexRow } from '../lib/data';
import { usePlaces } from '../lib/catalog';
import { useSession } from '../lib/auth';
import { useSavedSlugs, useSaveActions } from '../lib/save';
import { useMyCheckins } from '../lib/checkins';
import { bestFirst } from '../lib/rank';
import { filterExplorePlaces, type ExploreFilters, type ExploreOrigin } from '../lib/exploreFilters';
import { countsByCity } from '../lib/cityCounts';
import { cycleStatus, parseView, VIEW_KEY, type ExploreView } from '../lib/exploreView';
import { type Codec, useStored } from '../lib/stored';
import { canDrawMap } from '../components/MiniMap';
import { Toast, type ToastNote } from '../components/Toast';
import PlacesMap from '../components/PlacesMap';
import MapPlaceCard from '../components/MapPlaceCard';
import { distanceKm } from '../lib/geo';
import { useBrowseTaste } from '../lib/tasteProfile';
import { useFlag } from '../lib/useFlag';
import { useI18n } from '../lib/i18n';
import { classifyLoadFail } from '../lib/loadfail';
import { LoadFailBanner, LoadFailEmpty } from '../components/loadFail';
import { colors, radius, space } from '../theme';
import { useScheme } from '../lib/theme';
import { goTo, type Nav } from '../nav';
import { startupTrace } from '../lib/trace';
import { launchSettled } from '../lib/launch';
import { reportStartup } from '../lib/tracereport';
import { heroPlace, Hero } from './explore/Hero';
import { CollectionShelf } from './explore/CollectionShelf';
import { ExploreSuggestRow, ScrollNudge } from './explore/ScrollNudge';
import { FILTER_PAD, s } from './explore/styles';

/** The list or the map, as remembered: anything stored that is not "map" reads as the list. */
const VIEW_CODEC: Codec<ExploreView> = { parse: parseView, format: (v) => v };

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

/**
 * A card in the list, drawn again only when something it shows has moved.
 *
 * The screen redraws on every bookmark tapped — the reader's taste moves
 * with their lists, and the order is cut from it (`useBrowseTaste`) — and
 * `renderItem` used to hand every card a fresh `onPress` each time, so
 * every card on screen drew again to change one bookmark (owner, 30 Oct
 * 2026). Its props here are the place, two values and one `open` that
 * outlives renders; the press is made in here, from the slug. The
 * bookmark's own fill is the card's subscription (`useIsSaved`), not a
 * prop, so the one card that changes still draws.
 */
const ExploreCard = memo(function ExploreCard({ place, index, chip, distanceKm, open }: {
  place: Place;
  index: number;
  chip: string | null;
  distanceKm: number | null;
  open: (slug: string) => void;
}) {
  return (
    <PlaceCard
      place={place}
      testID={`place-card-${index}`}
      chip={chip}
      distanceKm={distanceKm}
      onPress={() => open(place.slug)}
    />
  );
});

export default function ExploreScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city, cities, setCity } = useCity();
  const { session } = useSession();
  const { askToSignIn } = useSaveActions();
  const { loading, loaded, error, data: places, reload } = usePlaces();
  // The pull spinner belongs to the pull. `loading` alone also covers
  // refreshes nobody asked to watch — the launch cache's background
  // pass, and the revalidate a few minutes of absence triggers on
  // return — and a spinner over freshly drawn content reads as the app
  // second-guessing itself. The old guard (`!fromCache`) silenced only
  // the first of those; the owner caught the second one glowing on a
  // quiet morning open. Armed by the gesture, disarmed when the fetch
  // it started settles.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !loading) setPulling(false);
  }, [pulling, loading]);
  // Skeletons hold until there is something to draw — `loaded`, not
  // `loading`. The distinction was decorative until the catalog started
  // hydrating from the launch cache: hydrated data arrives with the
  // background refresh still in flight, so gating on `loading` kept the
  // skeletons up for the ~700 ms the cache exists to remove. Same lesson
  // the Collections tab's `mineReady` learned about its focus refresh.
  const holding = !loaded;
  // A failed read is the body only when there is nothing under it. With a
  // catalog already in hand — the launch cache, or the last fetch that
  // worked — it is a banner in the list's header and the list stays, pull
  // to refresh and all. The first version hid the list behind the error,
  // and with it the only control that could have fixed anything.
  const fail = classifyLoadFail(error);
  const failedEmpty = fail !== null && places.length === 0;
  // ── the kinds: one at a time, and none is everything ──
  //
  // With none chosen the list is the whole city; a kind tapped narrows to
  // it, another moves to that one, and the chosen one tapped again lets
  // go. There was an "All" chip until 15 Oct 2026: it meant "no chip", and
  // a tap on it was the only way to leave a choice. From then until 24 Oct
  // any number could be chosen, a place showing if it carried any of
  // them; the owner took multiple choice out of every filter in the app
  // that day. A list rather than one key because the map, the cards and
  // the city switch below all read a list of chosen kinds.
  const [picked, setPicked] = useState<string[]>([]);
  // Null is "All" (owner, 25 Oct 2026: back, now that the row has room).
  const pick = (c: string | null) => setPicked((p) => (c === null || p.includes(c) ? [] : [c]));
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ExploreFilters>({
    sort: 'recommended', status: 'any', savedOnly: false, visitedOnly: false,
  });
  // The reader's visits, for the fourth filter. A set of slugs rather
  // than the rows: the rule asks "was I here" per place, and a guest's
  // list is empty, which is the right answer for a guest.
  const visits = useMyCheckins();
  const visitedSlugs = useMemo(() => new Set(visits.data.map((v) => v.place_slug)), [visits.data]);
  const isVisited = useCallback((slug: string) => visitedSlugs.has(slug), [visitedSlugs]);
  // The saved set only while something here asks it: the saved-only filter
  // applied, or the filter sheet open and counting it. Otherwise an empty
  // set that never moves, so a bookmark tapped on a card does not refilter
  // the city (owner, 30 Oct 2026) — the card redraws its own fill alone.
  const savedSlugs = useSavedSlugs(appliedFilters.savedOnly || filterOpen);
  const isSaved = useCallback((slug: string) => savedSlugs.has(slug), [savedSlugs]);
  // One for the screen's life, so a card's props hold still — see `ExploreCard`.
  const openPlace = useCallback((slug: string) => navigation.navigate('PlaceDetail', { slug }), [navigation]);
  const checkinOn = useFlag('place_checkin');
  // For the quick-filter pill's shadow: a light scheme needs less of it.
  const light = useScheme().scheme === 'light';
  const [sortOrigin, setSortOrigin] = useState<ExploreOrigin | null>(null);

  // Every city's places, in the four columns the filters read.
  //
  // A name alone says a city exists; the number is what makes going there
  // a decision. And the number has to be under the same filters as the
  // one here, or the picture lies: "Cafés" narrowing this city to 89
  // beside another city's untouched total of 280 invites exactly the
  // comparison the reader should not make. Asked once, on entering the
  // map; a call that never answers leaves the markers with their names
  // and no numbers.
  const [cityIndex, setCityIndex] = useState<PlaceIndexRow[]>([]);

  // The cities this reader is not in. Named in their language and placed
  // at their centre; the map draws them only where the view is wide
  // enough to reach them, which is exactly when they are worth drawing.
  const elsewhere = useMemo(() => {
    // The same rule the list is filtered by, over every city's rows — so
    // the figure on a marker there and the figure on the marker here are
    // the same kind of thing.
    const counts = cityIndex.length
      ? countsByCity(cityIndex, {
        categories: picked,
        status: appliedFilters.status,
        savedOnly: appliedFilters.savedOnly,
        isSaved,
        visitedOnly: appliedFilters.visitedOnly,
        isVisited,
        now: new Date(),
        // Every city's rows are counted, each on its own clock.
        tz: (id) => cityTz(cities, id),
      })
      : null;
    return cities
      .filter((c) => c.id !== city?.id)
      .map((c) => ({
        id: c.id,
        name: t(c.short_en, c.short_vi, c.short_ja),
        // Absent while the index has not arrived; zero once it has and
        // nothing there survives the filters, which is worth saying.
        count: counts ? counts[c.id] ?? 0 : null,
        lat: c.center_lat,
        lng: c.center_lng,
      }));
  }, [cities, city?.id, cityIndex, picked, appliedFilters.status, appliedFilters.savedOnly, isSaved, appliedFilters.visitedOnly, isVisited, t]);
  // How the places are looked at, remembered the way Collections
  // remembers its tiles-or-rows: one word in storage, read once on
  // mount. Until it has been read the list shows, which is also the
  // default, so a reader who never chose sees no flicker.
  // `useStored` keeps the order rule this screen used to keep for itself:
  // a read that lands after a tap does not undo it.
  const [view, pickView] = useStored<ExploreView>(VIEW_KEY, 'list', VIEW_CODEC);
  // Where the binary cannot draw a map there is no map mode, and no
  // switch to reach it by. `view` may still say 'map' from a device that
  // could; the list is what shows.
  const mapMode = canDrawMap && view === 'map';
  const tabClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();
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

  // Only categories this city actually has, so a chip never leads to an
  // empty list. Order comes from the taxonomy, not from the data.
  const cats = useMemo(() => presentCategories(places), [places]);

  // The two ends of what a reader calls "the app opened": the screen
  // existing at all, and the skeletons giving way to places. Everything
  // between these lines and `city:*`/`catalog:*` in the same log is where
  // a slow launch is actually spent.
  useEffect(() => {
    startupTrace.mark('explore:mounted');
  }, []);
  useEffect(() => {
    if (!loaded) return;
    startupTrace.mark('explore:content');
    // The same fact, told to the one thing waiting on it: the welcome
    // sheet holds until this commit has landed. See `lib/launch`.
    launchSettled.settle();
    // The launch files its report ten seconds after the content arrived:
    // late enough that the avatars — the last settle in the waterfall —
    // are in the marks, and that the insert competes with nothing the
    // reader is waiting on. `reportStartup` sends once per process and
    // swallows failure, so this effect re-running costs nothing.
    const t = setTimeout(() => {
      reportStartup(startupTrace.marks(), {
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        isDev: __DEV__,
      });
    }, 10_000);
    return () => clearTimeout(t);
  }, [loaded]);

  // Switching city can retire a chosen chip — let go of it, keep the rest,
  // rather than leave the screen narrowed by a kind no chip can show.
  useEffect(() => {
    if (places.length > 0 && picked.some((c) => !cats.includes(c))) setPicked((p) => p.filter((c) => cats.includes(c)));
  }, [cats, picked, places.length]);

  /**
   * What this reader leans towards, or null — the same hook Search uses,
   * and deliberately not the planner's. See `useBrowseTaste`.
   */
  const taste = useBrowseTaste();

  /**
   * The list, in an order for the first time.
   *
   * It had none. The query asks for `sort_order` and every published row
   * in every city has that column null, so Postgres was free to return
   * them however the plan happened to — an order nobody chose and nothing
   * promises to repeat. The desk's sequence this was thought to be does
   * not exist, which is why replacing it costs nothing.
   *
   * `bestFirst` is what Search's open-now list used, until that list went
   * as a copy of this one (22 Oct 2026): rating down the column, taste
   * worth one standard deviation of it, and `slug` as the final tie so
   * two renders of the same screen agree.
   * Signed out, `taste` is null and this is the plain rating order — a
   * deterministic list where there was an arbitrary one.
   *
   * The category filter runs first. Ranking either side of it gives the
   * same order within a chip; filtering first just ranks fewer places.
   */
  const recommended = useMemo(() => {
    const inCat = picked.length ? places.filter((p) => categoriesOf(p).some((c) => picked.includes(c))) : places;
    return bestFirst(inCat, taste);
  }, [places, picked, taste]);

  const filteredFor = useCallback((next: ExploreFilters) => filterExplorePlaces(recommended, {
    ...next,
    // Category already ran before recommendation ranking, preserving the
    // feed's existing order exactly when the new controls are untouched.
    categories: [],
    origin: sortOrigin,
    isSaved,
    isVisited,
    now: new Date(),
    tz: (id) => cityTz(cities, id),
  }), [recommended, sortOrigin, isSaved, isVisited, cities]);

  const shown = useMemo(() => filteredFor(appliedFilters), [filteredFor, appliedFilters]);

  // The map's own selection — the pin the reader has tapped, and the
  // strip that stands for it. Cleared implicitly rather than watched: if
  // a chip or a sort takes the selected place out of `shown`, `find`
  // below simply returns null and the strip goes with it.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = useMemo(() => shown.find((p) => p.slug === selectedSlug) ?? null, [shown, selectedSlug]);
  const selectedKm = selected && sortOrigin && selected.lat != null && selected.lng != null
    ? distanceKm(sortOrigin.lat, sortOrigin.lng, selected.lat, selected.lng)
    : null;

  /**
   * The reader's position, or the reason there is none.
   *
   * One function for the two callers that want a fix — the distance sort
   * and the map — so the permission dance is asked once, in one place,
   * and a refusal is one string rather than two.
   */
  const locate = useCallback(async (): Promise<{ origin: ExploreOrigin } | { refused: string }> => {
    const held = await Location.getForegroundPermissionsAsync();
    const permission = held.status === 'granted'
      ? held
      : await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { refused: t(
        'Allow location access to sort places by distance.',
        'Hãy cho phép truy cập vị trí để sắp xếp địa điểm theo khoảng cách.',
        '距離順に並べるには位置情報を許可してください。',
        '允许访问位置信息后，才能按距离排序。', '允許存取位置資訊後，才能按距離排序。',
      ) };
    }
    const position = await Location.getLastKnownPositionAsync()
      ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).catch(() => null);
    if (!position) {
      return { refused: t(
        "Couldn't read your location. Try again in a moment.",
        'Không thể xác định vị trí của bạn. Hãy thử lại sau giây lát.',
        '位置情報を取得できませんでした。しばらくしてからもう一度お試しください。',
        '无法获取你的位置，请稍后再试。', '無法取得你的位置，請稍後再試。',
      ) };
    }
    const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
    setSortOrigin(origin);
    return { origin };
  }, [t]);

  const applyFilters = useCallback(async (next: ExploreFilters): Promise<string | null> => {
    if (next.sort === 'distance' && !sortOrigin) {
      const fix = await locate();
      if ('refused' in fix) return fix.refused;
    }
    setAppliedFilters(next);
    setFilterOpen(false);
    return null;
  }, [sortOrigin, locate]);

  const filterCount = (appliedFilters.sort === 'recommended' ? 0 : 1)
    + (appliedFilters.status === 'any' ? 0 : 1)
    + (appliedFilters.savedOnly ? 1 : 0)
    + (appliedFilters.visitedOnly ? 1 : 0);

  /**
   * What a quick filter on the map just did, said for two seconds.
   *
   * The discs change only their glyph's colour when they switch, and on
   * a busy map that is not enough to tell on from off — the owner could
   * not, from two screenshots side by side. The toast answers the
   * question at the moment it is asked. See `Toast` for why it is a
   * report and not a state.
   *
   * One plain sentence, and no count. It said "Open now · 12 places",
   * which is two answers where the question was one, and the owner asked
   * for the plainer "only showing places open now". Switching off is said
   * as the filter going, not as "all places": the other disc, and the
   * category chips, may well still be narrowing the map.
   */
  const [note, setNote] = useState<ToastNote | null>(null);
  const say = (text: string) => setNote((prev) => ({ id: (prev?.id ?? 0) + 1, text }));
  const pickStatus = () => {
    const next = cycleStatus(appliedFilters.status);
    setAppliedFilters({ ...appliedFilters, status: next });
    say(next === 'open'
      ? t('Showing only places open now.', 'Chỉ hiện những điểm đang mở.', '営業中のスポットのみ表示します。', '仅显示正在营业的地点。', '僅顯示正在營業的地點。')
      : next === 'closed'
        ? t('Showing only places closed now.', 'Chỉ hiện những điểm đã đóng cửa.', '営業時間外のスポットのみ表示します。', '仅显示当前已打烊的地点。', '僅顯示目前已打烊的地點。')
        : t('Opening-hours filter off.', 'Bỏ lọc theo giờ mở cửa.', '営業時間の絞り込みを解除しました。', '已取消营业时间筛选。', '已取消營業時間篩選。'));
  };
  const pickSavedRef = useRef<() => void>(() => {});
  const pickSaved = () => {
    // A guest's filter is off, so the act finished on their return can
    // only turn it on. Through the ref, for the render that knows they
    // are signed in — see `lib/resume`.
    if (!session) { askToSignIn('saved', () => pickSavedRef.current()); return; }
    const on = !appliedFilters.savedOnly;
    setAppliedFilters({ ...appliedFilters, savedOnly: on });
    say(on
      ? t('Showing only places you saved.', 'Chỉ hiện những điểm lưu lại.', '保存したスポットのみ表示します。', '仅显示你保存的地点。', '僅顯示你儲存的地點。')
      : t('Saved-places filter off.', 'Bỏ lọc theo điểm đã lưu.', '保存済みの絞り込みを解除しました。', '已取消已保存筛选。', '已取消已儲存篩選。'));
  };
  pickSavedRef.current = pickSaved;
  // The sheet's Visited row, as a cell: same door for a guest, same
  // reason ('saved' — see the sheet's `onNeedSignIn`), same resume.
  const pickVisitedRef = useRef<() => void>(() => {});
  const pickVisited = () => {
    if (!session) { askToSignIn('saved', () => pickVisitedRef.current()); return; }
    const on = !appliedFilters.visitedOnly;
    setAppliedFilters({ ...appliedFilters, visitedOnly: on });
    say(on
      ? t('Showing only places you checked in at.', 'Chỉ hiện những điểm đã check-in.', 'チェックインしたスポットのみ表示します。', '仅显示你打过卡的地点。', '僅顯示你打過卡的地點。')
      : t('Visited-places filter off.', 'Bỏ lọc theo điểm đã check-in.', '訪問済みの絞り込みを解除しました。', '已取消已打卡筛选。', '已取消已打卡篩選。'));
  };
  pickVisitedRef.current = pickVisited;

  const hero = useMemo(() => heroPlace(places, city?.hero_place_slug), [places, city?.hero_place_slug]);

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
  }, [mapMode, locate]);

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
  const filterAnchor = useTourAnchor('filter', () => setFilterOpen(true));
  const pinnedFilterAnchor = useTourAnchor('filter', () => setFilterOpen(true));
  const tourHandled = useRef(-1);
  useEffect(() => {
    if (tour.step < 0) { tourHandled.current = -1; return; }
    if (mapMode) { pickView('list'); return; }
    if (holding || headerH === 0 || tourHandled.current === tour.step) return;
    tourHandled.current = tour.step;
    if (tour.step === 2) {
      // A real catalog entry, never a fabricated tutorial place or a write.
      if (shown[0]) navigation.navigate('PlaceDetail', { slug: shown[0].slug });
      else tour.next();
    } else {
      if (tour.step === 3) goTo('Explore', { screen: 'ExploreHome' });
      listRef.current?.getScrollResponder()?.scrollTo({
        y: tour.step === 1 ? Math.max(0, headerH - insets.top - 80) : 0,
        animated: false,
      });
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
  const header = (
    <View onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
      {/* Across to the Ideas tab, not down this screen.
          `goTo` rather than `navigation`: the planner lives in a sibling
          tab's stack, which this screen's own navigator cannot address —
          which is exactly what that helper exists for. */}
      <Hero
        place={hero}
        heroH={heroH}
        onStart={() => goTo('Ideas', { screen: 'IdeasHome' })}
        onSearch={() => navigation.navigate('Search')}
        scrollY={scrollY}
      />
      {fail && !failedEmpty ? (
        <LoadFailBanner kind={fail} onRetry={reload} testID="explore-load-banner" />
      ) : null}
      <CollectionShelf navigation={navigation} />
    </View>
  );

  const bar = (floating: boolean) => (
    <View
      style={floating
        ? [s.filterBar, s.filterBarFloating, { paddingTop: insets.top }]
        : [s.filterBar, { paddingTop: FILTER_PAD }]}
      testID={floating ? 'explore-pinned-bar' : undefined}
      onLayout={floating ? (e) => setBarH(Math.round(e.nativeEvent.layout.height)) : undefined}
    >
      <View style={s.filterHair} />
      <View style={s.placesHead}>
        <Text style={s.placesTitle}>{t('Places', 'Địa điểm', 'スポット', '地点', '地點')}</Text>
        <PressableScale
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={filterCount > 0
            ? t(
              `Filter and sort places, ${filterCount} applied`,
              `Lọc và sắp xếp địa điểm, đang áp dụng ${filterCount}`,
              `スポットを絞り込み・並べ替え、${filterCount}件適用中`,
              `筛选和排序地点，已应用 ${filterCount} 项`, `篩選和排序地點，已套用 ${filterCount} 項`,
            )
            : t('Filter and sort places', 'Lọc và sắp xếp địa điểm', 'スポットを絞り込み・並べ替え', '筛选和排序地点', '篩選和排序地點')}
          accessibilityState={{ selected: filterCount > 0 }}
          hitSlop={4}
          contentStyle={s.filterButton}
          anchorRef={floating ? pinnedFilterAnchor : filterAnchor}
          testID={floating ? 'explore-filter-pinned' : 'explore-filter'}
        >
          {/* Ink at rest, coral once something is applied — and that is
              the correction to a coral-always glyph, which this was.
              The argument for coral-always was that a grey mark beside a
              heading reads as decoration. The argument against it is
              stronger: in this app coral means active, selected, acted
              upon. A control that wears it while nothing is filtered
              says the list has been narrowed when it has not, and it
              spends the one signal that would have said so.
              So the two states differ in the glyph's colour and in a
              badge counting the conditions. A badge alone is 16pt of
              evidence; colour is what carries across the screen, and the
              pair is the feedback for having pressed Apply. The disc
              behind it, which also turned coral, went (owner, 24 Oct
              2026): the pair says it already, and a filled disc beside
              the heading was the heaviest thing in the row.
              `accent` rather than `accentFill`: the paper theme's accent
              ink is deliberately the darker coral, because the button's
              bright one on a pale ground is a 3:1 glyph. Same accent,
              adjusted for ink — the app's own rule, not a second
              colour. */}
          <Ionicons
            name="options-outline"
            size={19}
            color={filterCount > 0 ? colors.accent : colors.textSecondary}
          />
          {filterCount > 0 ? (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </PressableScale>
        {canDrawMap ? (
          // One button that names what it does, not two marks that leave
          // the reader to work out which is lit. The list is where this
          // screen lives; the map is somewhere it goes and comes back
          // from, and the way back has to say so — a reader who could
          // find the map and not the way out is the failure this fixes.
          // So the way in is one word, "Map", and the way out keeps its
          // verb: "Close Map" is the half that was ever in doubt.
          <PressableScale
            contentStyle={s.viewBtn}
            style={s.viewBtnSlot}
            scaleTo={0.94}
            haptic="selection"
            hitSlop={6}
            onPress={() => pickView(mapMode ? 'list' : 'map')}
            accessibilityRole="button"
            accessibilityLabel={mapMode
              ? t('Close Map', 'Đóng bản đồ', '地図を閉じる', '关闭地图', '關閉地圖')
              : t('Map', 'Bản đồ', '地図', '地图', '地圖')}
            testID={floating ? 'explore-view-pinned' : 'explore-view'}
          >
            <Ionicons
              name={mapMode ? 'close' : 'map-outline'}
              size={15}
              color={colors.textSecondary}
            />
            <Text style={s.viewBtnText}>
              {mapMode
                ? t('Close Map', 'Đóng bản đồ', '地図を閉じる', '关闭地图', '關閉地圖')
                : t('Map', 'Bản đồ', '地図', '地图', '地圖')}
            </Text>
          </PressableScale>
        ) : null}
      </View>
      {/* Underlined rather than chipped (owner, 24 Oct 2026): see
          `UnderlineChoice`. */}
      <UnderlineChoice
        items={cats.map((c) => ({
          key: c, label: categoryLabel(c, t), icon: CATEGORIES[c]?.icon, iconColor: CATEGORIES[c]?.color,
        }))}
        chosen={picked[0] ?? null}
        onPick={pick}
        all={t('All', 'Tất cả', 'すべて', '全部', '全部')}
        testID={floating ? undefined : 'explore-kinds'}
      />
    </View>
  );

  return (
    // No `Screen`, no safe-area top: the photograph owns the top edge.
    // The dateline, the sky and search — the old header's contents — ride
    // the hero itself, and the screen's title went entirely: the hero's
    // headline names the city, and two headings were saying one thing.
    <View style={s.screen}>
      {/* Over everything, and only once the copy in the list has gone
          under the clock. Rendered rather than hidden, so it takes no
          touches and costs no layout while the reader is at the top. */}
      {pinned && !mapMode ? bar(true) : null}
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {holding && (
          <View style={{ gap: space.cardGap }}>
            <Skeleton style={{ height: heroH, borderRadius: 0, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card }} />
            <View style={{ paddingHorizontal: space.page, gap: space.cardGap }}>
              <View style={{ flexDirection: 'row', gap: space.cardGap }}>
                <Skeleton style={{ width: 176, height: 200 }} />
                <Skeleton style={{ flex: 1, height: 200 }} />
              </View>
              <Skeleton style={{ height: 180, borderRadius: 22 }} />
            </View>
          </View>
        )}
        {!holding && fail && failedEmpty && (
          <View style={{ paddingTop: insets.top + 12 }}>
            <LoadFailEmpty kind={fail} onRetry={reload} testID="explore-load-fail" />
          </View>
        )}
        {!holding && !failedEmpty && !mapMode && (
          <Animated.SectionList
            ref={listRef}
            // One section, whose only job is to give the filter row
            // something to be the header of.
            sections={[{ data: shown }]}
            testID="explore-list"
            keyExtractor={(p) => p.slug}
            ListHeaderComponent={header}
            renderSectionHeader={() => bar(false)}
            // Nothing sticks any more: what used to pin is drawn over the
            // screen instead. See `bar`.
            stickySectionHeadersEnabled={false}
            renderItem={({ item, index }) => (
              <ExploreCard
                place={item}
                index={index}
                chip={chosenKind(item, picked)}
                // The figure goes with the sort, not with the fix: the
                // reader may well have a position from the map or from
                // an earlier sort, and a card under "Recommended" that
                // said "2.1 km" above one that said "0.4 km" would be
                // asking the reader to explain the order. Worked out here
                // rather than kept on the place: one haversine per visible
                // card is nothing, and the filter already did the same
                // sum to order them.
                distanceKm={appliedFilters.sort === 'distance' && sortOrigin && item.lat != null && item.lng != null
                  ? distanceKm(sortOrigin.lat, sortOrigin.lng, item.lat, item.lng)
                  : null}
                open={openPlace}
              />
            )}
            // A footer, not `ListEmptyComponent`, and the difference is not
            // a preference. A section list counts two rows per section for
            // its header and footer whether or not the section has any data
            // (`VirtualizedSectionList.js:197`), so the count is never zero
            // and the empty component would never have rendered — a filter
            // matching nothing would have shown the chips and then blank
            // page. As a footer it lands under the pinned row, which is
            // where it belongs anyway: an empty result is the one moment
            // the filter most needs to be reachable, because changing it is
            // the way out.
            //
            // The suggestion slot rides the same footer, and its placement
            // is the whole argument: scroll depth is a poor trigger —
            // scrolling twenty cards means browsing, which is what this
            // screen is for — but *reaching the end* is not a heuristic. It
            // is the moment you have seen everything there is, which is the
            // only moment "we are missing one" is a useful thing to say.
            ListFooterComponent={(
              <>
                {shown.length === 0
                  ? <Empty text={t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。', '这里还没有内容。', '這裡還沒有內容。')} />
                  : null}
                <ExploreSuggestRow onPress={() => navigation.navigate('AddPlace')} />
              </>
            )}
            contentContainerStyle={{ paddingBottom: tabClearance }}
            showsVerticalScrollIndicator={false}
            onRefresh={() => { setPulling(true); reload(); }}
            refreshing={pulling}
            onScrollToIndexFailed={() => {}}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true, listener: onScrollJS },
            )}
            scrollEventThrottle={16}
            // Both stable refs: React Native refuses to have either of
            // these change between renders.
            onViewableItemsChanged={onViewable}
            viewabilityConfig={viewabilityConfig}
          />
        )}
        {!holding && !failedEmpty && mapMode && city && (
          <View style={{ flex: 1 }}>
            {/* The bar's in-list copy has nothing to scroll away with
                here, so the floating copy stands in for it permanently:
                heading, switch, chips, all clear of the clock. */}
            {bar(true)}
            {/* `marginTop`, not padding: the map fills its parent with
                `absoluteFill`, and an absolutely placed child ignores the
                parent's padding — it would sit under the opaque bar. The
                bar measures itself (it already carries `insets.top`), so
                nothing is added to the figure it reports. */}
            <View style={[s.mapBody, { marginTop: barH }]}>
              {/* Two of the sheet's questions, answerable without opening
                  it — the two a person standing on a street asks. They
                  write to what is applied, which is why nothing has to be
                  synchronised: the badge, the sheet and this row read the
                  same state. Sort stays in the sheet; a cycling button for
                  three sorts is a slot machine. */}
              <View style={s.mapQuick}>
                {/* One pill, not two discs. Each disc wore the look's
                    elevated ground, which is within a few points of the
                    map's land colour in every look: 1.2:1 on Sand against
                    Google's land tint, 1.1:1 on the white looks, 1.04:1
                    on Midnight against its own night land (measured 13
                    Oct 2026). On Sand the discs read as two faint rings
                    on the tiles. A ground the same colour cannot be made
                    to stand off the map by colour, so the pill stands off it the way
                    the place card at the map's foot does — by shadow and
                    a real border — and stays the look's own material,
                    which is what the Profile's theme choice promises.
                    The cells sit inside it as a segmented control does:
                    the one that is on gets the accent wash the bar's
                    chips wear, inset so nothing needs clipping and the
                    shadow survives (iOS draws shadows outside bounds). */}
                <View style={[s.mapPill, { shadowOpacity: light ? 0.14 : 0.35 }]}>
                  <PressableScale
                    onPress={pickStatus}
                    haptic="selection"
                    accessibilityRole="button"
                    accessibilityLabel={`${t('Opening hours', 'Giờ mở cửa', '営業時間', '营业时间', '營業時間')}: ${statusLabel(appliedFilters.status, t)}`}
                    accessibilityState={{ selected: appliedFilters.status !== 'any' }}
                    hitSlop={4}
                    contentStyle={[s.mapCell, appliedFilters.status !== 'any' && s.mapCellOn]}
                  >
                    <Ionicons
                      name={appliedFilters.status === 'closed' ? 'time' : 'time-outline'}
                      size={19}
                      color={appliedFilters.status !== 'any' ? colors.accent : colors.textSecondary}
                    />
                  </PressableScale>
                  <View style={s.mapRule} />
                  <PressableScale
                    onPress={pickSaved}
                    haptic="selection"
                    accessibilityRole="button"
                    accessibilityLabel={t('Bookmarked only', 'Chỉ nơi đã lưu', 'ブックマークのみ', '仅看已保存', '僅看已儲存')}
                    accessibilityState={{ selected: appliedFilters.savedOnly }}
                    hitSlop={4}
                    contentStyle={[s.mapCell, appliedFilters.savedOnly && s.mapCellOn]}
                  >
                    <Ionicons
                      name={appliedFilters.savedOnly ? 'bookmark' : 'bookmark-outline'}
                      size={19}
                      color={appliedFilters.savedOnly ? colors.accent : colors.textSecondary}
                    />
                  </PressableScale>
                  {/* The third question a person on a street asks — "have
                      I been here?" — with the Check-in pill's own ring,
                      and behind the same flag as the sheet's row. */}
                  {checkinOn ? (
                    <>
                      <View style={s.mapRule} />
                      <PressableScale
                        onPress={pickVisited}
                        haptic="selection"
                        testID="map-visited"
                        accessibilityRole="button"
                        accessibilityLabel={t('Visited only', 'Chỉ nơi đã check-in', '訪問済みのみ', '仅看已打卡', '僅看已打卡')}
                        accessibilityState={{ selected: appliedFilters.visitedOnly }}
                        hitSlop={4}
                        contentStyle={[s.mapCell, appliedFilters.visitedOnly && s.mapCellOn]}
                      >
                        <Ionicons
                          name={appliedFilters.visitedOnly ? 'checkmark-circle' : 'checkmark-circle-outline'}
                          size={19}
                          color={appliedFilters.visitedOnly ? colors.accent : colors.textSecondary}
                        />
                      </PressableScale>
                    </>
                  ) : null}
                </View>
                {/* Beside the pill rather than centred or at the foot:
                    the reader's eyes are on the cell they just pressed,
                    and the foot of the map is spoken for — the selected
                    place's strip and the tab bar both live there. Read as
                    the pill's caption, which is what it is for two
                    seconds. */}
                <Toast note={note} testID="explore-map-toast" />
              </View>
              <PlacesMap
                places={shown}
                selectedSlug={selectedSlug}
                onSelect={setSelectedSlug}
                // Under a chip the pins take the chip's colour; with none
                // chosen each speaks for itself. See the prop's own note.
                categories={picked}
                origin={sortOrigin}
                // Where the map opens with neither a fix nor a pin: the
                // city's own centre. `city` is in the render condition
                // above precisely so this never has to invent one.
                fallback={{ lat: city.center_lat, lng: city.center_lng }}
                // Everywhere else the app has places, for a reader who
                // zoomed out past this city — see the prop's own note.
                cities={elsewhere}
                onPickCity={setCity}
                // The map's box already starts under the bar (`marginTop`
                // above), so the top inset is only breathing room; the
                // bottom clears the strip and the tab bar beneath it.
                edgePadding={{ top: 24, right: 40, bottom: tabClearance + 100, left: 40 }}
              />
              {selected ? (
                <View style={[s.mapStrip, { bottom: tabClearance + 12 }]}>
                  <MapPlaceCard
                    place={selected}
                    distanceKm={selectedKm}
                    // The same rule the map draws the pin with, so the
                    // mark on the card and the pin cannot drift apart.
                    tint={pinTint(selected, chosenKind(selected, picked))}
                    now={new Date()}
                    onPress={() => navigation.navigate('PlaceDetail', { slug: selected.slug })}
                  />
                </View>
              ) : null}
            </View>
          </View>
        )}
        {/* Last, so it draws over the list — in the tab bar's own dock,
            which the bar has vacated whenever this is visible. */}
        {!holding && !failedEmpty && (
          <ScrollNudge
            visible={nudge}
            onSearch={() => navigation.navigate('Search')}
            onAdd={() => navigation.navigate('AddPlace')}
          />
        )}
        <ExploreFilterSheet
          visible={filterOpen}
          applied={appliedFilters}
          signedIn={!!session}
          visitedAvailable={checkinOn}
          countFor={(next) => filteredFor(next).length}
          onClose={() => setFilterOpen(false)}
          onApply={applyFilters}
          onNeedSignIn={() => {
            setFilterOpen(false);
            // Wrapped: handed over bare, the frame's timestamp would
            // arrive as `askToSignIn`'s reason.
            requestAnimationFrame(() => askToSignIn('saved'));
          }}
        />
      </View>
    </View>
  );
}
