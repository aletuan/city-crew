// Explore — the guest landing surface. It opens on photography: a
// full-bleed hero built on a featured place's picture, wearing the
// dateline, the sky and the search control the old fixed header used to
// hold, then a horizontal shelf of public collections and the browsable
// places list. The screen has no title of its own — the hero's headline
// names the city, and "Discover Saigon" over "Ideas for a night in
// Saigon" was two headings saying one thing. Signing in is asked for
// where it is needed — bookmarking a place — rather than from a
// permanent control in a corner.

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExploreFilterSheet from '../components/ExploreFilterSheet';
import { AmbientWarmth, Skeleton, useTabBarClearance } from '../components/ui';
import { useCity } from '../lib/city';
import { cityTz, wallClock } from '../lib/clock';
import { heroPlace } from '../lib/data';
import { usePlaces } from '../lib/catalog';
import { useSession } from '../lib/auth';
import { useSaveActions } from '../lib/save';
import { parseView, VIEW_KEY, type ExploreView } from '../lib/exploreView';
import { type Codec, useStored } from '../lib/stored';
import { canDrawMap } from '../components/MiniMap';
import { useFlag } from '../lib/useFlag';
import { useI18n } from '../lib/i18n';
import { classifyLoadFail } from '../lib/loadfail';
import { LoadFailBanner, LoadFailEmpty } from '../components/loadFail';
import { radius, space } from '../theme';
import { useScheme } from '../lib/theme';
import { goTo, type Nav } from '../nav';
import { startupTrace } from '../lib/trace';
import { launchSettled } from '../lib/launch';
import { reportStartup } from '../lib/tracereport';
import { Hero } from './explore/Hero';
import { CollectionShelf } from './explore/CollectionShelf';
import { ScrollNudge } from './explore/ScrollNudge';
import { s } from './explore/styles';
import { useExploreFilters } from './explore/useExploreFilters';
import { useExploreScroll } from './explore/useExploreScroll';
import { FilterBar } from './explore/FilterBar';
import { ExploreList } from './explore/ExploreList';
import { ExploreMap } from './explore/ExploreMap';

/** The list or the map, as remembered: anything stored that is not "map" reads as the list. */
const VIEW_CODEC: Codec<ExploreView> = { parse: parseView, format: (v) => v };

/**
 * The top of the list — the photograph and the shelf of collections —
 * drawn again only when what it is handed moves. The screen redraws on
 * every card scrolled past (`firstVisible`), on the chips row pinning,
 * and on a bookmark; each of those drew the photograph and every cover
 * on the shelf again (owner, 30 Oct 2026). The shelf reads its
 * collections and hearts itself, so it still draws when those change.
 */
const HeroBlock = memo(Hero);
const Shelf = memo(CollectionShelf);


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
  // What is shown and how it is narrowed: `useExploreFilters` (25 Nov 2026).
  const filters = useExploreFilters({ t, places, city, cities, signedIn: !!session, askToSignIn });
  const {
    picked, pick, filterOpen, setFilterOpen, appliedFilters, sortOrigin, setCityIndex, cats,
    filteredFor, shown, locate, applyFilters, filterCount,
  } = filters;
  // One for the screen's life, so a card's props hold still — see `ExploreCard`.
  const openPlace = useCallback((slug: string) => navigation.navigate('PlaceDetail', { slug }), [navigation]);
  const checkinOn = useFlag('place_checkin');
  // For the quick-filter pill's shadow: a light scheme needs less of it.
  const light = useScheme().scheme === 'light';
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
  // The photograph, the pinned row, the status bar, the dock and the
  // tour: `useExploreScroll` (25 Nov 2026).
  const {
    scrollY, heroH, veilOpacity, listRef, onViewable, viewabilityConfig, pinned, onScroll, nudge,
    setHeaderH, barH, setBarH,
  } = useExploreScroll({ navigation, mapMode, pickView, insets, shown, holding, locate, setCityIndex });
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

  const hero = useMemo(() => heroPlace(places, city?.hero_place_slug), [places, city?.hero_place_slug]);

  const startPlan = useCallback(() => goTo('Ideas', { screen: 'IdeasHome' }), []);
  const openSearch = useCallback(() => navigation.navigate('Search'), [navigation]);
  const header = (
    <View onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
      {/* Across to the Ideas tab, not down this screen.
          `goTo` rather than `navigation`: the planner lives in a sibling
          tab's stack, which this screen's own navigator cannot address —
          which is exactly what that helper exists for. */}
      <HeroBlock
        place={hero}
        heroH={heroH}
        onStart={startPlan}
        onSearch={openSearch}
        scrollY={scrollY}
      />
      {fail && !failedEmpty ? (
        <LoadFailBanner kind={fail} onRetry={reload} testID="explore-load-banner" />
      ) : null}
      <Shelf navigation={navigation} />
    </View>
  );

  const bar = (floating: boolean) => (
    <FilterBar
      floating={floating} t={t} insets={insets} setBarH={setBarH} filterCount={filterCount}
      setFilterOpen={setFilterOpen} mapMode={mapMode} pickView={pickView} cats={cats} picked={picked} pick={pick}
    />
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
      {mapMode ? null : (
        <Animated.View
          pointerEvents="none"
          testID="explore-status-veil"
          style={[s.statusVeil, { height: insets.top, opacity: veilOpacity }]}
        />
      )}
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
          <ExploreList
            t={t} navigation={navigation} listRef={listRef} shown={shown} header={header} bar={bar(false)}
            picked={picked} appliedFilters={appliedFilters} sortOrigin={sortOrigin} openPlace={openPlace}
            tabClearance={tabClearance} pulling={pulling} setPulling={setPulling} reload={reload}
            onScroll={onScroll} onViewable={onViewable} viewabilityConfig={viewabilityConfig}
          />
        )}
        {!holding && !failedEmpty && mapMode && city && (
          <ExploreMap
            t={t} navigation={navigation} bar={bar(true)} barH={barH} light={light} checkinOn={checkinOn}
            city={city} setCity={setCity} tabClearance={tabClearance} filters={filters}
          />
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
          // This city's clock, read as the sheet opens: the "now" its
          // slider draws is the one the count is taken at.
          nowMin={wallClock(new Date(), cityTz(cities, city?.id)).mins}
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
