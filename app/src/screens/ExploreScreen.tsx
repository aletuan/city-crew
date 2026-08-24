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
  Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlaceCard from '../components/PlaceCard';
import { AddPill, AddSlot } from '../components/add';
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
import { Lang, useI18n } from '../lib/i18n';
import { VIBES } from '../lib/vibes';
import { colors, display, font, gradAI, onPhoto, radius, space, type } from '../theme';
import { useScheme } from '../lib/theme';
import { goTo, type Nav } from '../nav';

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
        >
          <Ionicons name="search-outline" size={22} color={onPhoto.text} />
        </PressableScale>
      </View>
      <View style={s.heroContent}>
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
  const { data: places, loading: placesLoading } = usePlaces();
  const loading = cols.loading || placesLoading;
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

  if (!loading && visible.length === 0) return null;

  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <View style={s.shelfHeader}>
        <Text style={s.section}>{t('Public collections', 'Bộ sưu tập công khai', '公開コレクション')}</Text>
        <Pressable
          onPress={() => { fireHaptic('selection'); navigation.getParent()?.navigate('Collections'); }}
          hitSlop={10}
        >
          <Text style={s.seeAll}>{t('See all', 'Xem tất cả', 'すべて見る')} →</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={{ flexDirection: 'row', gap: space.cardGap, paddingHorizontal: space.page }}>
          <Skeleton style={{ width: 176, height: 220 }} />
          <Skeleton style={{ width: 176, height: 220 }} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.page, gap: space.cardGap }}
        >
          {visible.map((c) => {
            const uri = coverFor(c);
            const members = membersOf(c, places);
            const count = members.length;
            const badge = collectionIcon(members);
            return (
              <PressableScale
                key={c.slug}
                style={s.shelfCard}
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
                    <Text style={s.shelfCardMeta}>{count} {t('places', 'địa điểm', 'スポット')}</Text>
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
                        because the touchable does not have to. */}
                    {c.id && (
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
                    )}
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
  const { loading, error, data: places, reload } = usePlaces();
  const [cat, setCat] = useState<string>(ALL);
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
  // Null past the hero: there the page is its own ground again and the
  // right ink is exactly the scheme's own, which is what the hook's null
  // means. Taking, handing back, and the mid-transition cost all live in
  // `useOwnedStatusBar` — a place's screen wants the same thing.
  const applyBar = useOwnedStatusBar(() => (pastHeroRef.current ? null : 'light'));

  // Only categories this city actually has, so a chip never leads to an
  // empty list. Order comes from the taxonomy, not from the data.
  const cats = useMemo<string[]>(() => {
    const present = new Set<string>();
    for (const p of places) for (const c of categoriesOf(p)) present.add(c);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [places]);

  // Switching city can retire the selected chip — fall back to the full
  // list rather than leave the screen stuck on a filter that no longer
  // matches anything.
  useEffect(() => {
    if (places.length > 0 && cat !== ALL && !cats.includes(cat)) setCat(ALL);
  }, [cats, cat, places.length]);

  const shown = useMemo(() => {
    if (cat === ALL) return places;
    return places.filter((p) => categoriesOf(p).includes(cat));
  }, [places, cat]);

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
  const onScrollJS = useRef((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < 320) setFirst(0);
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
  const { ducked } = useTabBarDuck();
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
      {/* Short of the usual gap by exactly the filter row's top padding —
          FILTER_PAD and the safe-area inset the row carries for its
          pinned life — so the space you see between this heading and its
          chips is the same 16 that sits under every other heading. The
          inset's worth of the row overlaps this heading at rest, and
          harmlessly: the row's backing is transparent until it pins, and
          neither the heading nor the row's padding is a touch target. */}
      <Text style={[s.section, { marginBottom: space.headingToContent - FILTER_PAD - insets.top }]}>
        {t('Places', 'Địa điểm', 'スポット')}
      </Text>
    </View>
  );

  /**
   * The row's backing, faded in just before it pins. At rest the row must
   * be transparent — its safe-area padding overlaps the Places heading —
   * and pinned it must be opaque, or the list would read through the
   * chips and the status bar. The crossover is the pin offset, which is
   * `headerH`: fully opaque 8pt early, so the backing is already solid
   * when the first card slides under. Until the header has reported a
   * height nothing has scrolled, so the plain 0 stands in.
   */
  const filterBg = headerH > 0
    ? scrollY.interpolate({
        inputRange: [Math.max(0, headerH - 28), Math.max(1, headerH - 8)],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      })
    : 0;

  /**
   * The filter row, pinned for as long as the places are on screen.
   *
   * It is a section header rather than part of the list header, and that
   * is the whole mechanism: a FlatList can only pin its header entire,
   * which here would mean pinning the hero photograph too. As a section
   * header it pins exactly while its own section is showing — not before
   * the places begin, not after they end.
   *
   * Pinning it costs about 56pt of a 611pt reading area, and buys back
   * something the scroll had been taking away: which chip is lit. A
   * filtered list of three cards with the filter scrolled out of sight
   * looks like an app that has run out of places, not like a choice you
   * made. The state of a filter is context for reading its results, not
   * a control you touch once at the start.
   */
  const filters = (
    <View style={[s.filterBar, { paddingTop: FILTER_PAD + insets.top }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, s.filterBarBg, { opacity: filterBg }]} />
      <View style={s.filterHair} />
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
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {loading && (
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
        {!loading && !error && (
          <Animated.SectionList
            // One section, whose only job is to give the filter row
            // something to be the header of.
            sections={[{ data: shown }]}
            keyExtractor={(p) => p.slug}
            ListHeaderComponent={header}
            renderSectionHeader={() => filters}
            stickySectionHeadersEnabled
            renderItem={({ item }) => (
              <PlaceCard place={item} onPress={() => navigation.navigate('PlaceDetail', { slug: item.slug })} />
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
            onRefresh={reload}
            refreshing={loading}
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
        {/* Last, so it draws over the list — in the tab bar's own dock,
            which the bar has vacated whenever this is visible. */}
        {!loading && !error && (
          <ScrollNudge
            visible={nudge}
            onSearch={() => navigation.navigate('Search')}
            onAdd={() => navigation.navigate('AddPlace')}
          />
        )}
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
    ...StyleSheet.absoluteFillObject,
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
  filterBar: {
    paddingBottom: FILTER_PAD,
  },
  filterBarBg: { backgroundColor: colors.bg },
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
    width: 176, height: 220, borderRadius: radius.image, overflow: 'hidden',
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

});
