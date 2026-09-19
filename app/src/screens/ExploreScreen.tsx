// Explore — the guest landing surface. It opens on photography: a
// full-bleed hero built on a featured place's picture, wearing the
// dateline, the sky and the search control the old fixed header used to
// hold, then a horizontal shelf of public collections and the browsable
// places list. The screen has no title of its own — the hero's headline
// names the city, and "Discover Saigon" over "Ideas for a night in
// Saigon" was two headings saying one thing. Signing in is asked for
// where it is needed — bookmarking a place — rather than from a
// permanent control in a corner.

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Animated, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlaceCard from '../components/PlaceCard';
import ExploreFilterSheet, { statusLabel } from '../components/ExploreFilterSheet';
import { AddPill, AddSlot } from '../components/add';
import { CitySwitcherModal } from '../components/CitySwitcher';
import { AmbientWarmth, Chip, Empty, fireHaptic, glassHalo, GlassMaterial, PressableScale, Skeleton, TAB_BAR_HEIGHT, useOwnedStatusBar, useTabBarClearance, useTabBarLift } from '../components/ui';
import { useDuckOnScroll, useTabBarDuck } from '../components/tabBarDuck';
import { createNudgeGate, NUDGE_SETTLE_MS } from '../lib/nudge';
import { CATEGORIES, CATEGORY_ORDER, categoriesOf, categoryLabel } from '../lib/categories';
import { useCity } from '../lib/city';
import { useSky } from '../lib/sky';
import WeatherLayer, { useWeatherStill, WEATHER_EFFECTS } from '../components/weather/WeatherLayer';
import WeatherDebug, { DEBUG_DEFAULT, debugSky, type Debug } from '../components/weather/WeatherDebug';
import type { Sky } from '../lib/weather';
import { dateline } from '../lib/format';
import { Collection, coverOf, membersOf, Place, touchesCity } from '../lib/data';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { useAuth } from '../lib/auth';
import { useSave } from '../lib/save';
import { likesWorthShowing, rankByLikes } from '../lib/likes';
import { bestFirst } from '../lib/rank';
import { filterExplorePlaces, type ExploreFilters, type ExploreOrigin } from '../lib/exploreFilters';
import { cycleStatus, parseView, VIEW_KEY, type ExploreView } from '../lib/exploreView';
import { canDrawMap } from '../components/MiniMap';
import PlacesMap from '../components/PlacesMap';
import MapPlaceCard from '../components/MapPlaceCard';
import { distanceKm } from '../lib/geo';
import { useBrowseTaste } from '../lib/tasteProfile';
import { useI18n } from '../lib/i18n';
import { VIBES } from '../lib/vibes';
import { colors, display, font, gradAI, onPhoto, radius, space, type } from '../theme';
import { useScheme } from '../lib/theme';
import { goTo, type Nav } from '../nav';
import { startupTrace } from '../lib/trace';
import { launchSettled } from '../lib/launch';
import { reportStartup } from '../lib/tracereport';

// The one chip that isn't a category: the whole catalog. It carries no
// glyph — a colourless chip reads as "not a kind of place".
const ALL = 'all';

/**
 * The pinned filter row's own breathing room, above and below its chips.
 *
 * Named because it has to be subtracted somewhere else. Pinned, the row is
 * its own top edge and needs this; at rest it sits under the Places
 * heading, whose `marginBottom` is already the gap the app uses between
 * any heading and its content — and the two were adding up, so that one
 * heading stood 26pt off its content where every other stands 16.
 *
 * Since the screen went full-bleed the row's real top padding is this
 * *plus the safe-area inset*: with no fixed header left above it, pinning
 * means pinning to the raw top of the glass, and without the inset the
 * chips would sit under the clock. The subtraction at the heading grows
 * by the same amount, so the at-rest geometry is unchanged — see the
 * heading's own comment.
 */
const FILTER_PAD = 10;

/**
 * The last row of the list, at the moment you have finished reading and
 * found the list short. Explore has nothing to name — you were browsing,
 * not looking for one thing — so it asks rather than offers.
 */
function ExploreSuggestRow({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <AddSlot
      onPress={onPress}
      // "Thêm địa điểm mới", not "Biết chỗ nào chúng tôi còn thiếu?".
      // The question was 32 characters into a line that holds about 22
      // beside a 52pt circle and a chevron, so it arrived clipped —
      // "Biết chỗ nào chúng tôi còn thi…" — which is worse than blunt.
      //
      // `mới` is carrying real weight: a collection has its own "Thêm
      // địa điểm", and that one adds a place the catalog already has.
      // This one is for a place nobody has put there yet.
      title={t('Add a new place', 'Thêm địa điểm mới', '新しいスポットを追加')}
      // What you do, not what we do about it. "Chúng tôi lo phần còn lại"
      // was a promise about our end of the work, which is not the thing
      // standing between this row and the next screen. What you actually
      // need to know is what to type — and that an address works, which
      // is not obvious and is often all anyone has.
      subtitle={t('Search by name or address', 'Gõ tên quán hoặc địa chỉ để tìm kiếm', '店名や住所で検索')}
    />
  );
}

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
 * The floating offer, once someone is clearly hunting rather than reading.
 *
 * Two things it must not do. It must not say the list is empty — it
 * plainly is not, there are cards under it — so it asks whether what you
 * want is here rather than announcing that it is not. And it must not
 * stay: it goes the moment the tab bar wants its place back.
 *
 * Its place is the tab bar's own dock. Scrolling deep is what hides the
 * bar, and scrolling deep is also what "hunting" looks like — so the slot
 * the bar vacates is empty at exactly the moment this offer is earned,
 * and in thumb reach besides. It wears the dock's geometry (the inset,
 * the island radius) so the slot reads as one place that changes content;
 * everything else about it — the text and the two actions —
 * looks nothing like five glyphs, so a hand reaching for a tab is never
 * fooled. The gate in lib/nudge.ts holds the sharing rules: the bar
 * always wins the slot back the same frame, and every time it leaves,
 * the offer takes the dock again — one barely-visible beat behind, so
 * the two never cross mid-dock.
 */
function ScrollNudge({ visible, onSearch, onAdd }: {
  visible: boolean;
  onSearch: () => void;
  onAdd: () => void;
}) {
  const { t } = useI18n();
  const lift = useTabBarLift();
  const light = useScheme().scheme === 'light';
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 140,
      useNativeDriver: true,
    }).start();
  }, [visible, fade]);

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        s.nudgeWrap,
        {
          // The same number the bar uses, from the same hook. These were
          // two copies of one formula, and when the bar came down to
          // clear the home indicator rather than the whole safe-area
          // inset, this one stayed 28pt higher — so the offer arrived in
          // the dock the bar had left, and sat above it.
          bottom: lift,
          opacity: fade,
          // Rises into the dock from below — the direction the bar left in.
          transform: [{
            translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
          }],
        },
      ]}
    >
      <PressableScale
        onPress={onSearch}
        scaleTo={0.985}
        style={[s.nudge, { shadowOpacity: light ? 0.16 : 0.35 }]}
        accessibilityRole="button"
      >
        {/* Same clip-on-its-own-layer trick the bar uses: iOS draws
            shadows outside bounds, so overflow:hidden on the shadowed
            view would eat them. */}
        <View style={s.nudgeClip}><GlassMaterial /></View>
        <Ionicons name="search" size={18} color={colors.text} style={glassHalo(light)} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.nudgeTitle, glassHalo(light)]} numberOfLines={1}>
            {t('Not finding it?', 'Chưa thấy chỗ cần tìm?', '見つかりませんか？')}
          </Text>
          <Text style={[s.nudgeSub, glassHalo(light)]} numberOfLines={1}>
            {t('Search, or add your own', 'Tìm nhanh hoặc tự thêm', '検索、または自分で追加')}
          </Text>
        </View>
        <AddPill compact label={t('Add', 'Thêm', '追加')} onPress={onAdd} />
      </PressableScale>
    </Animated.View>
  );
}

// Per-city hero season — headline, CTA and the pinned cover place — comes
// from the city row itself, editable in the data desk's City hero screen.
// Every field is optional: cities keep the default framing, CTA and
// automatic photo pick until an editor overrides them.

/**
 * A collection has no category of its own, so its badge comes from the vibe
 * its members share most — self-maintaining as membership changes. Unknown
 * vibes are skipped, and a collection with none stays badge-free rather
 * than wearing a guess.
 */
function collectionIcon(members: Place[]): keyof typeof Ionicons.glyphMap | null {
  const tally = new Map<string, number>();
  for (const p of members) {
    for (const v of p.vibe_tags) {
      if (VIBES[v]) tally.set(v, (tally.get(v) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  for (const [vibe, n] of tally) {
    if (!best || n > tally.get(best)!) best = vibe;
  }
  return best ? VIBES[best].icon : null;
}

/** Hero photography: the city's hand-picked cover place first, then a
 *  featured place with a views/nightlife vibe, then anything with a photo.
 *  A pinned slug that matches nothing (unpublished, deleted, typo) falls
 *  through to the automatic pick rather than blanking the hero. */
function heroPlace(places: Place[], pinnedSlug?: string | null): Place | undefined {
  const withPhoto = (p: Place) => !!coverOf(p);
  return (
    (pinnedSlug ? places.find((p) => p.slug === pinnedSlug && withPhoto(p)) : undefined) ??
    places.find((p) => p.is_featured && withPhoto(p)
      && p.vibe_tags.some((v) => v === 'views' || v === 'nightlife')) ??
    places.find((p) => p.is_featured && withPhoto(p)) ??
    places.find(withPhoto)
  );
}

/**
 * "Has the hero scrolled off the top", as a subscription rather than as
 * screen state.
 *
 * This shipped as `useState` on the screen, and that was a regression
 * dressed as plumbing: every crossing of the hero boundary re-rendered
 * the entire screen — FlatList, shelf, chips — in the middle of the very
 * scroll gesture that caused it. The status bar next to this fact solves
 * the same problem imperatively (`applyBar` repaints without a render);
 * the weather cannot be imperative because a paused animation has to be
 * unmounted-from, so its render is scoped instead: the one component
 * that needs the boolean subscribes to it, and a crossing re-renders the
 * Hero and nothing else.
 */
type HeroGone = {
  set: (past: boolean) => void;
  subscribe: (onChange: () => void) => () => void;
  get: () => boolean;
};

function heroGoneStore(): HeroGone {
  let past = false;
  const subs = new Set<() => void>();
  return {
    set: (next) => {
      if (past === next) return;
      past = next;
      subs.forEach((f) => f());
    },
    subscribe: (f) => { subs.add(f); return () => { subs.delete(f); }; },
    get: () => past,
  };
}

/**
 * The weather and the two hooks that serve it, behind the switch.
 *
 * A component rather than two hook calls in `Hero`, because hooks cannot
 * sit behind a conditional — and with `WEATHER_EFFECTS` off this never
 * mounts, so the focus listener, the AppState listener and the
 * scroll-crossing subscription never exist. Parking the feature has to
 * mean parking its whole cost, not just its pixels.
 */
function HeroWeather({ gone, sky, width, height, hour, intensity }: {
  gone: HeroGone;
  sky: Sky | null;
  width: number;
  height: number;
  hour: number;
  intensity: number;
}) {
  const heroGone = useSyncExternalStore(gone.subscribe, gone.get);
  const still = useWeatherStill(heroGone);
  return (
    <WeatherLayer
      sky={sky}
      width={width}
      height={height}
      still={still}
      hour={hour}
      intensity={intensity}
    />
  );
}

function Hero({ place, heroH, onStart, onSearch, scrollY, gone }: {
  place: Place | undefined;
  /** Decided by the screen, not here: the screen needs the same number
   *  for its status-bar threshold, so there is exactly one of it. */
  heroH: number;
  /** What the button does. It used to scroll to the places list a little
   *  further down the same screen — a jump the reader could make with a
   *  thumb, on a card whose whole job is to be the invitation into the
   *  app. It now opens the planner, which is the one thing on this screen
   *  a reader cannot get to by scrolling. */
  onStart: () => void;
  /** Search rides the photograph now that there is no header to hold it.
   *  It scrolls away with the hero, and that is accepted on purpose: the
   *  pinned filter keeps the list navigable, and the scroll-nudge dock
   *  re-offers search the moment browsing starts to look like hunting. */
  onSearch: () => void;
  scrollY: Animated.Value;
  /** Whether the photograph has scrolled off the top. The screen already
   *  computes this for the status bar; the weather stops for it too, so
   *  nothing animates behind a page nobody is looking at. A store, not a
   *  boolean — see `heroGoneStore` for why. */
  gone: HeroGone;
}) {
  const { t, lang } = useI18n();
  const { city } = useCity();
  const insets = useSafeAreaInsets();
  // The city's centre, never the device's position — someone with the
  // city set to follow their location still keeps it on their phone.
  const sky = useSky(city?.center_lat, city?.center_lng);
  const uri = place && coverOf(place)?.photo_uri;
  const { width: winW } = useWindowDimensions();

  /**
   * The dev override for the weather.
   *
   * `__DEV__` gates both the state and the panel, so a production bundle
   * carries a `null` and a constant. It is reached by holding the date
   * pill — the one control on this screen that is already about the
   * weather, and one no reader has any reason to press for half a
   * second.
   */
  const [debug, setDebug] = useState<Debug | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  // The city switcher, openable from here — see the chip in heroContent.
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const shown = __DEV__ && debug ? debugSky(debug, sky) : sky;
  const hour = __DEV__ && debug ? debug.hour : new Date().getHours();
  // The photo trails the scroll slightly; pre-scaled so no edge shows.
  const parallax = scrollY.interpolate({
    inputRange: [0, heroH], outputRange: [0, Math.round(heroH * 0.08)], extrapolate: 'clamp',
  });
  return (
    <View style={[s.hero, { height: heroH }]}>
      {uri
        ? (
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: parallax }, { scale: 1.12 }] }]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          </Animated.View>
        )
        // No photo: the scrim below still lays its wash over this, so the
        // panel reads as a quiet dark ground in both themes and the type
        // keeps its contrast. A city with no photography at all is a
        // catalog problem, not a layout to design around.
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
      {/* Between the photograph and the scrim, which is the whole of the
          layout decision. Everything it draws is therefore under a wash
          that reaches 0.97 by the foot of the hero, so the rule that
          weather must never fight the headline is enforced by geometry
          rather than by a second gradient that would drift the first time
          either was tuned.

          Behind the switch, and the switch is off — see `WEATHER_EFFECTS`
          for why and for how to turn it back on. */}
      {WEATHER_EFFECTS ? (
        <HeroWeather
          gone={gone}
          sky={shown}
          width={winW}
          height={heroH}
          hour={hour}
          intensity={__DEV__ && debug ? debug.intensity : 1}
        />
      ) : null}
      <LinearGradient
        colors={['rgba(10,11,10,0.45)', 'rgba(10,11,10,0.06)', 'rgba(10,11,10,0.55)', 'rgba(10,11,10,0.97)']}
        locations={[0, 0.22, 0.64, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* What the fixed header used to hold, embedded in the photograph:
          the dateline with the weather hanging off its end — nothing
          moves when the temperature arrives, nothing is missing when it
          does not — and the search control. Both carry their own dark
          glass, because the top of this picture can be any sky. */}
      <View style={[s.heroTop, { top: insets.top + 6 }]}>
        {/* A long press opens the weather tuner, in development only.
            Nothing about the pill changes: no ripple, no scale, no hint.
            It is a back door for whoever is tuning `weatherfx.ts`, and a
            reader who holds it for half a second in a shipped build gets
            what they have always got, which is nothing. */}
        <Pressable
          style={s.heroDate}
          onLongPress={__DEV__ && WEATHER_EFFECTS ? () => { setDebug((d) => d ?? DEBUG_DEFAULT); setDebugOpen(true); } : undefined}
          delayLongPress={600}
        >
          <Text style={s.heroDateText}>{dateline(lang, new Date())}</Text>
          {sky ? (
            <>
              <Ionicons name={sky.icon} size={14} color={sky.gold ? onPhoto.sun : onPhoto.textSecondary} />
              <Text style={s.heroDateText}>{`${sky.temp}°`}</Text>
            </>
          ) : null}
        </Pressable>
        <PressableScale
          onPress={onSearch}
          scaleTo={0.9}
          style={s.heroSearch}
          accessibilityRole="button"
          accessibilityLabel={t('Search', 'Tìm kiếm', '検索')}
          testID="explore-search"
        >
          <Ionicons name="search-outline" size={22} color={onPhoto.text} />
        </PressableScale>
      </View>
      <View style={s.heroContent}>
        {/* The city, named at the headline's shoulder, and tappable. The
            city is the biggest mode this app has, and until now changing
            it lived three taps away behind Profile → Preferences; the
            place to change it is where you can see what it currently is —
            the same grammar Maps and Airbnb use for switching region.
            Hidden until a city resolves: a chip with no name would open
            a sheet over nothing worth switching away from. */}
        {city ? (
          <PressableScale
            haptic="selection"
            onPress={() => setSwitcherOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('Choose a city', 'Chọn thành phố', '都市を選択')}
            testID="explore-city"
            containerStyle={{ alignSelf: 'flex-start' }}
            style={s.heroCity}
          >
            <Ionicons name="location-outline" size={13} color={onPhoto.textSecondary} />
            <Text style={s.heroDateText}>{t(city.short_en, city.short_vi, city.short_ja)}</Text>
            <Ionicons name="chevron-down" size={12} color={onPhoto.textSecondary} />
          </PressableScale>
        ) : null}
        <Text style={s.heroTitle}>
          {city?.hero_title_en
            ? t(city.hero_title_en, city.hero_title_vi, city.hero_title_ja)
            : t(
                `Ideas for a night in ${city?.short_en ?? 'the city'}`,
                `Gợi ý cho một đêm ở ${city?.short_vi ?? 'thành phố'}`,
                `${city?.short_ja ?? city?.short_en ?? 'この街'}、夜のアイデア`,
              )}
        </Text>
        {/* The desk's line for this city, the same way the headline is.
            Cleared, it falls back to the guest-facing sentence it used
            to always be — which is the right default precisely because
            the reader with the most to learn from it is the one who has
            not signed in. */}
        <Text style={s.heroSub}>
          {city?.hero_sub_en
            ? t(city.hero_sub_en, city.hero_sub_vi, city.hero_sub_ja)
            : t(
                'Browse public collections and places — no account needed.',
                'Xem bộ sưu tập và địa điểm công khai — không cần tài khoản.',
                'コレクションとスポットを自由に閲覧 — アカウント不要。',
              )}
        </Text>
        <PressableScale onPress={onStart} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          <LinearGradient {...gradAI} style={s.heroCta}>
            <Text style={s.heroCtaText}>
              {/* Two words at most, and the arrow beside them already
                  says "start". "Bắt đầu khám phá" spent half its width
                  on the verb the button is; the Japanese was doing the
                  same with 探索を始める. Kept in step with the copy of
                  this default in the desk's City hero screen — the two
                  codebases share no module, so the only thing holding
                  them together is that each says so. */}
              {city?.hero_cta_en
                ? t(city.hero_cta_en, city.hero_cta_vi, city.hero_cta_ja)
                : t("Let's go", 'Khám phá', 'はじめる')}
            </Text>
            <Ionicons name="arrow-forward" size={17} color={colors.accentInk} />
          </LinearGradient>
        </PressableScale>
      </View>
      {__DEV__ && WEATHER_EFFECTS && debug ? (
        <WeatherDebug
          visible={debugOpen}
          state={debug}
          onChange={setDebug}
          onClose={() => setDebugOpen(false)}
          onUseLive={() => setDebug(null)}
        />
      ) : null}
      <CitySwitcherModal visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </View>
  );
}

function CollectionShelf({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city } = useCity();
  const cols = useCollections();
  const { likes, myLikes, toggleLike } = useLikes();
  const uid = useAuth().session?.user?.id;
  const { askToSignIn } = useSave();

  // Signed out, the tap is an invitation rather than a failure: the same
  // sheet the bookmark opens, because "sign in to keep this" is the same
  // sentence whether the thing kept is a place or a list.
  //
  // Signed in, everything else belongs to the provider — the write, the
  // refetch, and the local answer that fills the heart before either has
  // finished. This screen and the collection's own had a copy each and
  // the copies had already drifted; worse, a like made here did not show
  // there until a refetch happened to land.
  const onHeart = useCallback((c: Collection) => {
    if (!c.id) return;
    if (!uid) { askToSignIn(); return; }
    fireHaptic('light');
    void toggleLike({ id: c.id, slug: c.slug });
  }, [uid, toggleLike, askToSignIn]);
  const { data: places, loaded: placesLoaded } = usePlaces();
  // `loaded`, not `loading` — hydrated data shows while its background
  // refresh is still in flight; see the note in the screen body below.
  const holding = !cols.loaded || !placesLoaded;
  // Only collections with at least one visible member in this city — an
  // empty collection is a dead end for a browsing guest, and one whose
  // places are all somewhere else is a shelf entry for a different trip.
  // Most liked first, and the shelf's old order underneath it — see
  // `rankByLikes`. While every count is zero, which is the state this
  // ships in, the result is byte-for-byte the shelf that was here before.
  const visible = rankByLikes(
    cols.data.filter((c) => touchesCity(membersOf(c, places), city?.id)),
    likes,
  );

  const coverFor = (c: Collection) =>
    c.cover?.photo_uri ?? (membersOf(c, places)[0] && coverOf(membersOf(c, places)[0])?.photo_uri);

  // The card's width comes from the screen's, and the reason is what a
  // fixed 176 did between devices: a 430pt phone showed a 28pt sliver of
  // the third card, while a 390–402pt one fitted exactly two and cut
  // nothing — a shelf that scrolls with no visible evidence that it
  // does. ~2.15 cards per viewport keeps a ~26pt sliver at every width,
  // and lands on the same 176×220 on the 430pt screens the fixed number
  // was tuned against.
  const { width: winW } = useWindowDimensions();
  const cardW = Math.round((winW - space.page) / 2.15 - space.cardGap);
  const cardH = Math.round(cardW * 1.25);

  if (!holding && visible.length === 0) return null;

  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <View style={s.shelfHeader}>
        {/* The same word its "See all" lands on — the Community tab. It
            was "Public collections", which named a visibility status
            rather than a source, and stopped matching its own
            destination the day the tab got its real name. Your own
            public lists belong on it too: a public list is part of the
            community, yours included. */}
        <Text style={s.section}>{t('From the community', 'Từ cộng đồng', 'みんなのコレクション')}</Text>
        <Pressable
          // "See all" of a *public* shelf lands on the Community tab, not
          // on your library. `CollectionsHome` is the stack's first
          // screen, so no `initial: false` dance — see `goTo`.
          onPress={() => {
            fireHaptic('selection');
            navigation.getParent()?.navigate('Collections', {
              // `at` makes every tap a fresh param, so a second tap
              // re-aims a tab the reader has since switched away from.
              screen: 'CollectionsHome', params: { tab: 'community', at: Date.now() },
            });
          }}
          hitSlop={10}
        >
          <Text style={s.seeAll}>{t('See all', 'Xem tất cả', 'すべて見る')} →</Text>
        </Pressable>
      </View>
      {holding ? (
        <View style={{ flexDirection: 'row', gap: space.cardGap, paddingHorizontal: space.page }}>
          <Skeleton style={{ width: cardW, height: cardH }} />
          <Skeleton style={{ width: cardW, height: cardH }} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Cards settle aligned with the page margin rather than
          // wherever momentum died; the interval is a card and its gap,
          // which is also what makes the padding the snap origin.
          snapToInterval={cardW + space.cardGap}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: space.page, gap: space.cardGap }}
        >
          {visible.map((c) => {
            const uri = coverFor(c);
            const members = membersOf(c, places);
            const count = members.length;
            const badge = collectionIcon(members);
            // Your own published lists are on this shelf now — see
            // `fetchCollections` — and the heart is the one thing that
            // has to know it.
            const owned = !!c.owner_id && c.owner_id === uid;
            return (
              <PressableScale
                key={c.slug}
                style={[s.shelfCard, { width: cardW, height: cardH }]}
                onPress={() => navigation.navigate('CollectionDetail', { slug: c.slug })}
              >
                {uri
                  ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
                <LinearGradient
                  colors={['rgba(10,11,10,0.22)', 'rgba(10,11,10,0.10)', 'rgba(10,11,10,0.94)']}
                  locations={[0, 0.42, 1]}
                  style={StyleSheet.absoluteFill}
                />
                {badge && (
                  <View style={s.shelfBadge}>
                    <Ionicons name={badge} size={15} color={onPhoto.text} />
                  </View>
                )}
                <View style={s.shelfCardText}>
                  {/* One line, always. A second line pushed the count down
                      on some tiles and not others, so a row of cards that
                      should read as one band came out ragged. */}
                  <Text style={s.shelfCardTitle} numberOfLines={1}>{t(c.title_en, c.title_vi, c.title_ja)}</Text>
                  <View style={s.shelfCardFoot}>
                    {/* English is the only of the three that inflects. */}
                    <Text style={s.shelfCardMeta}>{count} {t(count === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}</Text>
                    {/* One heart, and it is both the gesture and the
                        tally.

                        There were two: a 30pt disc in the photograph's
                        top corner that you could press, and a small mark
                        down here that only counted. Two hearts on one
                        card is one heart too many — the reader has to
                        work out which of them is theirs — and the
                        counting one sat next to a number it looked like
                        it was labelling rather than a state it could
                        change. Merged, the shape says both things at
                        once: outline is a list you have not liked, coral
                        filled is one you have, and the figure beside it
                        is how many people agree.

                        The tally still only prints from one, per
                        `likesWorthShowing` — a `0` reads as "nobody liked
                        this" rather than "no votes yet". The heart draws
                        bare below that, which is exactly when it is most
                        obviously an invitation.

                        Pushed to the card's right edge, away from the
                        places count, so the two facts do not read as one
                        phrase and the thumb has a corner rather than the
                        middle of a line. `hitSlop` takes the target past
                        44pt without a disc: the glyph can stay small
                        because the touchable does not have to.

                        Pressable for everyone except the curator. A
                        curator cannot like their own list — the database
                        enforces it — so on your own the same shape is
                        drawn dimmed and inert: you still want to know
                        how the list is doing, and a heart that can only
                        fail is worse than no heart at all. This shelf
                        used not to need the check, because the query
                        left your own lists out; it left them out of the
                        shelf entirely, which is the bug that brought
                        them back. The collection's own screen carries
                        the same rule, drawn the same way, and the
                        Collections grid a third copy. */}
                    {c.id && owned ? (
                      likesWorthShowing(likes[c.slug]) ? (
                        <View style={[s.shelfLikes, s.shelfLikeHit]}>
                          <Ionicons name="heart" size={15} color={onPhoto.textSecondary} />
                          <Text style={s.shelfCardMeta}>{likes[c.slug]}</Text>
                        </View>
                      ) : null
                    ) : c.id ? (
                      <PressableScale
                        containerStyle={s.shelfLikeHit}
                        style={s.shelfLikes}
                        scaleTo={0.82}
                        haptic="none"
                        hitSlop={{ top: 14, bottom: 14, left: 16, right: 12 }}
                        onPress={() => onHeart(c)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: myLikes.includes(c.id) }}
                        accessibilityLabel={myLikes.includes(c.id)
                          ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す')
                          : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね')}
                      >
                        <Ionicons
                          name={myLikes.includes(c.id) ? 'heart' : 'heart-outline'}
                          size={15}
                          color={myLikes.includes(c.id) ? onPhoto.accent : onPhoto.text}
                        />
                        {likesWorthShowing(likes[c.slug]) && (
                          <Text style={s.shelfCardMeta}>{likes[c.slug]}</Text>
                        )}
                      </PressableScale>
                    ) : null}
                  </View>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default function ExploreScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city } = useCity();
  const { session } = useAuth();
  const { isSaved, askToSignIn } = useSave();
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
  const [cat, setCat] = useState<string>(ALL);
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ExploreFilters>({
    sort: 'recommended', status: 'any', savedOnly: false,
  });
  const [sortOrigin, setSortOrigin] = useState<ExploreOrigin | null>(null);
  // How the places are looked at, remembered the way Collections
  // remembers its tiles-or-rows: one word in storage, read once on
  // mount. Until it has been read the list shows, which is also the
  // default, so a reader who never chose sees no flicker.
  const [view, setView] = useState<ExploreView>('list');
  useEffect(() => {
    // Only a value that was actually stored may set the view — the same
    // guard Collections keeps. A null read on a fresh install must not
    // land after a tap and undo it.
    AsyncStorage.getItem(VIEW_KEY).then((v) => { if (v != null) setView(parseView(v)); }).catch(() => {});
  }, []);
  const pickView = (v: ExploreView) => {
    setView(v);
    AsyncStorage.setItem(VIEW_KEY, v).catch(() => {});
  };
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
  useEffect(() => {
    mapModeRef.current = mapMode;
    applyBar();
  }, [mapMode, applyBar]);

  // Only categories this city actually has, so a chip never leads to an
  // empty list. Order comes from the taxonomy, not from the data.
  const cats = useMemo<string[]>(() => {
    const present = new Set<string>();
    for (const p of places) for (const c of categoriesOf(p)) present.add(c);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [places]);

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

  // Switching city can retire the selected chip — fall back to the full
  // list rather than leave the screen stuck on a filter that no longer
  // matches anything.
  useEffect(() => {
    if (places.length > 0 && cat !== ALL && !cats.includes(cat)) setCat(ALL);
  }, [cats, cat, places.length]);

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
   * `bestFirst` is what Search's open-now list has always used: rating
   * down the column, taste worth one standard deviation of it, and
   * `slug` as the final tie so two renders of the same screen agree.
   * Signed out, `taste` is null and this is the plain rating order — a
   * deterministic list where there was an arbitrary one.
   *
   * The category filter runs first. Ranking either side of it gives the
   * same order within a chip; filtering first just ranks fewer places.
   */
  const recommended = useMemo(() => {
    const inCat = cat === ALL ? places : places.filter((p) => categoriesOf(p).includes(cat));
    return bestFirst(inCat, taste);
  }, [places, cat, taste]);

  const filteredFor = useCallback((next: ExploreFilters) => filterExplorePlaces(recommended, {
    ...next,
    // Category already ran before recommendation ranking, preserving the
    // feed's existing order exactly when the new controls are untouched.
    category: ALL,
    allCategory: ALL,
    origin: sortOrigin,
    isSaved,
    now: new Date(),
  }), [recommended, sortOrigin, isSaved]);

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
      ) };
    }
    const position = await Location.getLastKnownPositionAsync()
      ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).catch(() => null);
    if (!position) {
      return { refused: t(
        "Couldn't read your location. Try again in a moment.",
        'Không thể xác định vị trí của bạn. Hãy thử lại sau giây lát.',
        '位置情報を取得できませんでした。しばらくしてからもう一度お試しください。',
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
    + (appliedFilters.savedOnly ? 1 : 0);

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
  const onViewable = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
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
  // A subscription, not state, so a crossing re-renders the Hero alone.
  // See `heroGoneStore`.
  const heroGone = useRef(heroGoneStore()).current;
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
    heroGone.set(false);
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
      // Once per crossing, not per frame — the same budget `applyBar`
      // has always spent here. The weather stops when the photograph
      // it is drawn on is no longer on screen.
      heroGone.set(past);
    }
    duckRef.current?.(e as never);
  }).current;

  // Deep into a list long enough to get lost in. The length test is not
  // belt-and-braces: with four cards you can be five in only by rubber
  // banding, and an offer that appears when you bounce the list is a
  // twitch, not a suggestion.
  const deep = shown.length > DEEP_AFTER + 2 && firstVisible >= DEEP_AFTER;

  // The offer may borrow the tab bar's dock only while the bar is away —
  // the sharing rules live in lib/nudge.ts. The gate keeps no timer, so
  // eligibility re-polls it once the settle time has passed.
  const nudgeGate = useRef(createNudgeGate()).current;
  const [nudge, setNudge] = useState(false);
  useEffect(() => navigation.addListener('focus', () => {
    nudgeGate.reset();
    setNudge(false);
  }), [navigation, nudgeGate]);
  useEffect(() => {
    const eligible = ducked && deep;
    setNudge(nudgeGate.update(eligible, Date.now()));
    if (!eligible) return;
    const id = setTimeout(() => setNudge(nudgeGate.update(true, Date.now())), NUDGE_SETTLE_MS + 20);
    return () => clearTimeout(id);
  }, [ducked, deep, nudgeGate]);

  /**
   * The list header's measured height **is** the offset at which the
   * filter row pins — the row is the very next cell — and the pinning
   * moment is when its backing must be opaque. Measured rather than
   * summed: the shelf's height depends on whether this city has
   * collections at all.
   */
  const [headerH, setHeaderH] = useState(0);
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
        gone={heroGone}
      />
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
        <Text style={s.placesTitle}>{t('Places', 'Địa điểm', 'スポット')}</Text>
        <PressableScale
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={filterCount > 0
            ? t(
              `Filter and sort places, ${filterCount} applied`,
              `Lọc và sắp xếp địa điểm, đang áp dụng ${filterCount}`,
              `スポットを絞り込み・並べ替え、${filterCount}件適用中`,
            )
            : t('Filter and sort places', 'Lọc và sắp xếp địa điểm', 'スポットを絞り込み・並べ替え')}
          accessibilityState={{ selected: filterCount > 0 }}
          hitSlop={4}
          style={[s.filterButton, filterCount > 0 && s.filterButtonOn]}
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
              So the two states differ in every part at once — glyph,
              border, fill, and a badge counting the conditions. A badge
              alone is 16pt of evidence; colour is what carries across
              the screen, and the pair is the feedback for having
              pressed Apply.
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
          <View style={s.viewToggle} testID={floating ? 'explore-view-pinned' : 'explore-view'}>
            {(['list', 'map'] as const).map((v) => (
              <PressableScale
                key={v}
                style={[s.viewBtn, view === v && s.viewBtnOn]}
                scaleTo={0.9}
                haptic="selection"
                hitSlop={6}
                onPress={() => pickView(v)}
                accessibilityRole="button"
                accessibilityState={{ selected: view === v }}
                accessibilityLabel={v === 'map'
                  ? t('Map view', 'Dạng bản đồ', '地図表示')
                  : t('List view', 'Dạng danh sách', 'リスト表示')}
              >
                <Ionicons
                  name={v === 'map' ? 'map-outline' : 'list-outline'}
                  size={15}
                  color={view === v ? colors.accent : colors.textTertiary}
                />
              </PressableScale>
            ))}
          </View>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.page }}
      >
        <Chip
          label={t('All', 'Tất cả', 'すべて')}
          active={cat === ALL}
          onPress={() => setCat(ALL)}
        />
        {cats.map((c) => (
          <Chip
            key={c}
            label={categoryLabel(c, t)}
            icon={CATEGORIES[c]?.icon}
            iconColor={CATEGORIES[c]?.color}
            active={cat === c}
            onPress={() => setCat(c)}
          />
        ))}
      </ScrollView>
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
        {error && (
          <View style={{ paddingTop: insets.top + 12 }}>
            <Empty text={t(`Couldn't load places: ${error}`, `Không tải được địa điểm: ${error}`, `読み込みに失敗しました: ${error}`)} />
          </View>
        )}
        {!holding && !error && !mapMode && (
          <Animated.SectionList
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
              <PlaceCard
                place={item}
                testID={`place-card-${index}`}
                onPress={() => navigation.navigate('PlaceDetail', { slug: item.slug })}
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
                  ? <Empty text={t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。')} />
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
        {!holding && !error && mapMode && city && (
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
                <PressableScale
                  onPress={() => {
                    fireHaptic('selection');
                    setAppliedFilters((f) => ({ ...f, status: cycleStatus(f.status) }));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('Opening hours', 'Giờ mở cửa', '営業時間')}: ${statusLabel(appliedFilters.status, t)}`}
                  accessibilityState={{ selected: appliedFilters.status !== 'any' }}
                  style={[s.filterButton, appliedFilters.status !== 'any' && s.filterButtonOn]}
                >
                  <Ionicons
                    name={appliedFilters.status === 'closed' ? 'time' : 'time-outline'}
                    size={19}
                    color={appliedFilters.status !== 'any' ? colors.accent : colors.textSecondary}
                  />
                </PressableScale>
                <PressableScale
                  onPress={() => {
                    if (!session) { askToSignIn(); return; }
                    fireHaptic('selection');
                    setAppliedFilters((f) => ({ ...f, savedOnly: !f.savedOnly }));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('Bookmarked only', 'Chỉ mục đã lưu', 'ブックマークのみ')}
                  accessibilityState={{ selected: appliedFilters.savedOnly }}
                  style={[s.filterButton, appliedFilters.savedOnly && s.filterButtonOn]}
                >
                  <Ionicons
                    name={appliedFilters.savedOnly ? 'bookmark' : 'bookmark-outline'}
                    size={19}
                    color={appliedFilters.savedOnly ? colors.accent : colors.textSecondary}
                  />
                </PressableScale>
              </View>
              <PlacesMap
                places={shown}
                selectedSlug={selectedSlug}
                onSelect={setSelectedSlug}
                origin={sortOrigin}
                // Where the map opens with neither a fix nor a pin: the
                // city's own centre. `city` is in the render condition
                // above precisely so this never has to invent one.
                fallback={{ lat: city.center_lat, lng: city.center_lng }}
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
        {!holding && !error && (
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
          countFor={(next) => filteredFor(next).length}
          onClose={() => setFilterOpen(false)}
          onApply={applyFilters}
          onNeedSignIn={() => {
            setFilterOpen(false);
            requestAnimationFrame(askToSignIn);
          }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // Full-bleed photography wears no hairline: a translucent border over
  // an image lights up wherever the photo is bright and vanishes where
  // it's dark, reading as a broken frame. Edges end in shadow instead.
  //
  // Only the bottom corners round now that the photo owns the top edge.
  // The gradient's last stop is near-opaque dark, so in the dark theme
  // the edge dissolves into the page and reads as the mockup's fade; on
  // paper the same corners read as a dark sheet ending — a deliberate
  // edge, not a failed blend into white.
  hero: {
    borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card,
    overflow: 'hidden', justifyContent: 'flex-end',
    marginBottom: space.titleToContent,
  },
  // The old fixed header's row, laid on the photograph: dateline left,
  // search right. `top` is inline — it owes the safe area its offset.
  heroTop: {
    position: 'absolute', left: space.page, right: space.page,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  // The eyebrow's voice on the header's glass: photography can be any
  // sky, so unlike the page eyebrow this one brings its own ground.
  heroDate: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8,
    backgroundColor: 'rgba(10,11,10,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  heroDateText: {
    color: onPhoto.text, fontSize: 12, fontFamily: display.semibold,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  // The same disc the detail screen floats on its photos, in the pill's
  // material, so the pair reads as one set.
  heroSearch: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,11,10,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  heroContent: { paddingHorizontal: space.page, paddingBottom: space.cardPadding + 6, gap: 10 },
  // The dateline's material at the headline's shoulder, in the same
  // eyebrow voice (`heroDateText`) — the pills read as one set. The
  // chevron is what makes it read as a control rather than a caption.
  heroCity: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(10,11,10,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  // The screen title's scale, because this is the screen's title now —
  // the display face carrying a whole line, per theme.ts.
  heroTitle: { color: onPhoto.text, ...type.title, lineHeight: 40 },
  heroSub: { color: onPhoto.textSecondary, ...type.meta, lineHeight: 21 },
  // The screen's one loud control: the accent at full strength — the same
  // primary-button material the auth screens use.
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 12,
  },
  heroCtaText: { color: colors.accentInk, fontSize: 16, fontFamily: display.semibold },

  section: {
    color: colors.text, ...type.section,
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },
  // The control sits beside the heading, not out at the margin.
  //
  // `space-between` put it there, and the width of the gap then had
  // nothing to do with the two things it separated — it was whatever the
  // phone was wide. A disc alone on the right edge reads as a second
  // section's worth of distance from the word it belongs to, and on a
  // 430pt screen the thumb has to cross the whole row to reach the sort
  // for the list directly beneath it. Left-aligned, the pair reads as one
  // phrase: the heading, and what you do to it.
  // The gap to the chips is the app's own: `headingToContent`, the same
  // 16 that sits under every other heading in it.
  //
  // It briefly had none, and that was a leftover rather than a choice.
  // While the block still pinned itself, this row was given a fixed
  // height that doubled as the clearance the chips needed under the
  // clock, and the spacing came out of that height. The block stopped
  // pinning itself when the floating copy took the job, the fixed height
  // went with it, and the margin it had been standing in for was never
  // put back — so the heading sat straight on the chips.
  placesHead: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.page,
    marginBottom: space.headingToContent,
  },
  placesTitle: { color: colors.text, ...type.section },
  filterButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  filterButtonOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  viewToggle: {
    marginLeft: 'auto', flexDirection: 'row', gap: 2, padding: 3,
    borderRadius: radius.pill, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  viewBtn: { width: 30, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  viewBtnOn: { backgroundColor: colors.bgElevated },
  filterBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill,
  },
  filterBadgeText: { color: colors.accentInk, fontSize: 9, fontWeight: font.bold },

  shelfHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: space.page },

  // The floating offer, wearing the tab bar's dock: same inset, same
  // island radius, so the bottom slot reads as one place that changes
  // content rather than two things fighting for it.
  nudgeWrap: {
    position: 'absolute', left: 12, right: 12,
  },
  nudge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: TAB_BAR_HEIGHT,
    paddingLeft: 18, paddingRight: 10, paddingVertical: 8,
    borderRadius: radius.tabBar,
    shadowColor: '#000', shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    // The same glass the bar is made of, because this *is* the bar's
    // dock — it appears in the space the bar vacates, at the same lift,
    // width, height and radius, and a solid panel arriving where a
    // translucent one left reads as two different objects sharing a slot.
    //
    // It was opaque on the reasoning that photographs travel under it and
    // a translucent bar over moving pictures smears. The bar has the same
    // pictures moving under it and does not; what smeared was the heavy
    // blur, which is now 38. If motion does turn out to be the difference
    // on a real device, the fix is the blur, not a second material.
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
    overflow: 'visible',
  },
  nudgeClip: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.tabBar,
    overflow: 'hidden',
  },
  nudgeTitle: { color: colors.text, fontSize: 14.5, fontWeight: font.semibold },
  // Full strength, where this was `textTertiary` — which is #6E695E, the
  // exact mid-tone that could not be read on thin glass over a
  // photograph. Size and weight carry the hierarchy instead of colour:
  // 12.5 regular under 14.5 semibold is already two steps down, and it is
  // the pair of steps that survives an unknown ground.
  nudgeSub: { color: colors.text, fontSize: 12.5, opacity: 0.72 },

  // The pinned filter row. Its top padding is inline — FILTER_PAD plus
  // the safe-area inset — because pinned it is the top edge of the whole
  // screen and the chips must clear the clock; the at-rest arithmetic
  // that keeps this invisible lives on the Places heading.
  //
  // No background of its own: that belongs to `filterBarBg`, faded in as
  // the row approaches the top. The page's own colour there, not the tab
  // bar's glass — glass says content is passing beneath me, which is true
  // of the floating bar, but this row pinned is the page's own top edge,
  // the place the list begins under, and it should read as the page.
  // The block in the list: no clearance of its own, because it does not
  // pin. It scrolls off like anything else, and the copy that takes over
  // is the one that has to clear the clock.
  filterBar: {
    paddingBottom: FILTER_PAD,
  },
  // And that copy: over the screen rather than in the list, so nothing
  // it does can move a row or eat a tap meant for one. Opaque, because
  // the list runs underneath it.
  filterBarFloating: {
    position: 'absolute', left: 0, right: 0, top: 0,
    zIndex: 20,
    backgroundColor: colors.bg,
  },
  // Drawn only at the bottom, and only a hairline: it is where the header
  // block ends and the list begins, which is the one edge that has
  // anything to say. A full border would box the row in like a control.
  filterHair: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
  },
  seeAll: { color: colors.accent, fontSize: 14, fontWeight: font.medium },
  // Same rule as the hero: photo cards end in shadow, not in a hairline.
  shelfCard: {
    // Width and height are the screen's business — see `cardW` in the
    // shelf itself.
    borderRadius: radius.image, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  shelfBadge: {
    position: 'absolute', left: 10, top: 10,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,11,10,0.55)',
    borderWidth: 1, borderColor: onPhoto.line,
  },
  shelfCardText: { padding: 13, gap: 3 },
  shelfCardTitle: { color: onPhoto.text, fontSize: 16, fontWeight: font.semibold, lineHeight: 20 },
  shelfCardMeta: { color: onPhoto.textSecondary, fontSize: 13, fontWeight: font.regular },
  shelfCardFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Right edge of the foot row, so the gesture is a corner rather than
  // a word in the middle of a sentence.
  shelfLikeHit: { marginLeft: 'auto' },
  shelfLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  mapBody: { flex: 1 },
  mapStrip: { position: 'absolute', left: 0, right: 0 },
  // Top-left of the map, in the same discs as the sort control: the
  // reader has already learned what that disc means.
  // `pointerEvents` as a style, not a prop: the prop form is deprecated in
  // this React Native, and a style travels with the element it is on.
  mapQuick: {
    position: 'absolute', left: space.page, top: 12, zIndex: 5,
    flexDirection: 'row', gap: 10, pointerEvents: 'box-none',
  },
});
