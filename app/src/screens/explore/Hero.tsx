// Explore's cover: the city's photograph, its headline, the way into the
// planner and the search on the picture.

import { useTourAnchor } from '../../components/SignupTour';
import { useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CitySwitcherModal } from '../../components/CitySwitcher';
import { PressableScale } from '../../components/ui';
import { useCurrentCity } from '../../lib/city';
import { useSky } from '../../lib/sky';
import { dayline } from '../../lib/format';
import { coverOf, Place } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { balanceBreak } from '../../lib/balance';
import { colors, gradAI, onPhoto } from '../../theme';
import { s } from './styles';

/** Hero photography: the city's hand-picked cover place first, then a
 *  featured place with a views/nightlife vibe, then anything with a photo.
 *  A pinned slug that matches nothing (unpublished, deleted, typo) falls
 *  through to the automatic pick rather than blanking the hero. */
export function heroPlace(places: Place[], pinnedSlug?: string | null): Place | undefined {
  const withPhoto = (p: Place) => !!coverOf(p);
  return (
    (pinnedSlug ? places.find((p) => p.slug === pinnedSlug && withPhoto(p)) : undefined) ??
    places.find((p) => p.is_featured && withPhoto(p)
      && p.vibe_tags.some((v) => v === 'views' || v === 'nightlife')) ??
    places.find((p) => p.is_featured && withPhoto(p)) ??
    places.find(withPhoto)
  );
}

export function Hero({ place, heroH, onStart, onSearch, scrollY }: {
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
}) {
  const searchAnchor = useTourAnchor('search', onSearch);
  const { t, lang } = useI18n();
  const { city } = useCurrentCity();
  const insets = useSafeAreaInsets();
  // The city's centre, never the device's position — someone with the
  // city set to follow their location still keeps it on their phone.
  const sky = useSky(city?.center_lat, city?.center_lng);
  /**
   * Two sources, in order: the city's own photograph, then the cover of
   * whichever place `heroPlace` picked.
   *
   * The city's wins because it was chosen for this frame — somebody at
   * the desk looked at the hero line and picked a picture to sit under
   * it. `hero_place_slug` is the older mechanism and still the fallback,
   * but it can only ever offer a photograph OF A SHOP, which is why Đà
   * Lạt had nothing worth showing under a line about a whole town.
   */
  const cityPhoto = city?.hero_photo_uri ?? null;
  const uri = cityPhoto ?? (place && coverOf(place)?.photo_uri);
  // City covers never render a source handle. A remotely loaded flag
  // cannot hide it reliably on the first frame (its startup default is on).
  // The city switcher, openable from here — see the chip in heroContent.
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const title = city?.hero_title_en
    ? t(city.hero_title_en, city.hero_title_vi, city.hero_title_ja)
    : t(
        `Ideas for a night in ${city?.short_en ?? 'the city'}`,
        `Gợi ý cho một đêm ở ${city?.short_vi ?? 'thành phố'}`,
        `${city?.short_ja ?? city?.short_en ?? 'この街'}、夜のアイデア`,
        `${city?.short_en ?? '这座城市'}的夜晚灵感`,
      );
  /**
   * The headline, broken so its second line is not one word — see
   * `lib/balance` for why and where. `for` ties the answer to the text it
   * was worked out for, so a new city or language measures afresh.
   *
   * Measure, then break, then check: the first paint wraps by itself and
   * reports where; the balanced text replaces it; and if that drew more
   * than two lines (a larger text size than the characters guessed), the
   * natural wrap comes back and stays. The cost is one frame of the
   * natural wrap on mount, under a photograph still fading in.
   */
  const [balanced, setBalanced] = useState<{ for: string; text: string | null } | null>(null);
  const settled = balanced?.for === title;
  const shown = settled && balanced.text ? balanced.text : title;
  const onTitleLayout = (lines: readonly { text: string }[]) => {
    if (!settled) {
      setBalanced({ for: title, text: lines.length === 2 ? balanceBreak(title, lines[0].text) : null });
    } else if (balanced.text && lines.length > 2) {
      setBalanced({ for: title, text: null });
    }
  };
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

       */}
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
        <View style={s.heroDate}>
          <Text style={s.heroDateText}>{dayline(lang, new Date())}</Text>
          {sky ? (
            <>
              <Ionicons name={sky.icon} size={14} color={sky.gold ? onPhoto.sun : onPhoto.textSecondary} />
              <Text style={s.heroDateText}>{`${sky.temp}°`}</Text>
            </>
          ) : null}
        </View>
        <PressableScale
          onPress={onSearch}
          scaleTo={0.9}
          contentStyle={s.heroSearch}
          accessibilityRole="button"
          accessibilityLabel={t('Search', 'Tìm kiếm', '検索', '搜索')}
          anchorRef={searchAnchor}
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
            accessibilityLabel={t('Choose a city', 'Chọn thành phố', '都市を選択', '选择城市')}
            testID="explore-city"
            style={{ alignSelf: 'flex-start' }}
            contentStyle={s.heroCity}
          >
            <Ionicons name="location-outline" size={13} color={onPhoto.textSecondary} />
            <Text style={s.heroDateText}>{t(city.short_en, city.short_vi, city.short_ja)}</Text>
            <Ionicons name="chevron-down" size={12} color={onPhoto.textSecondary} />
          </PressableScale>
        ) : null}
        <Text
          style={s.heroTitle}
          testID="explore-hero-title"
          onTextLayout={(e) => onTitleLayout(e.nativeEvent.lines)}
        >
          {shown}
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
                '浏览公开的合集和地点 — 无需账号。',
              )}
        </Text>
        <PressableScale onPress={onStart} accessibilityRole="button" contentStyle={{ alignSelf: 'flex-start', marginTop: 4 }}>
          <LinearGradient {...gradAI} style={s.heroCta}>
            <Text style={s.heroCtaText}>
              {/* One word, and the arrow beside it already says
                  "start". "Bắt đầu khám phá" spent half its width on
                  the verb the button is; the Japanese was doing the
                  same with 探索を始める. The English was "Let's go" for a
                  while, which named the mood and not the act; the
                  Vietnamese had said "Khám phá" — explore — all along,
                  and the owner asked the other two to say the same.
                  Kept in step with the copy of this default in the
                  desk's City hero screen — the two codebases share no
                  module, so the only thing holding them together is
                  that each says so. */}
              {city?.hero_cta_en
                ? t(city.hero_cta_en, city.hero_cta_vi, city.hero_cta_ja)
                : t('Explore', 'Khám phá', '探索する', '探索')}
            </Text>
            <Ionicons name="arrow-forward" size={17} color={colors.accentInk} />
          </LinearGradient>
        </PressableScale>
      </View>
      <CitySwitcherModal visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </View>
  );
}
