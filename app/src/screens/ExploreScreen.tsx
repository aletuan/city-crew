// Explore — the guest landing surface, modeled on the mockup's home:
// dated eyebrow + editorial title, a hero built on a featured place's
// photography, a horizontal shelf of public collections, then the
// browsable places list. Signing in is asked for where it is needed —
// bookmarking a place — rather than from a permanent control in a corner.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Pressable, ScrollView, SectionList, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PlaceCard from '../components/PlaceCard';
import { AmbientWarmth, Chip, Empty, EyebrowText, fireHaptic, PressableScale, RoundIconButton, Screen, Skeleton, useTabBarClearance } from '../components/ui';
import { CATEGORIES, CATEGORY_ORDER, categoriesOf, categoryLabel } from '../lib/categories';
import { useCity } from '../lib/city';
import { useSky } from '../lib/sky';
import { Collection, coverOf, membersOf, Place } from '../lib/data';
import { useCollections, usePlaces } from '../lib/catalog';
import { Lang, useI18n } from '../lib/i18n';
import { VIBES } from '../lib/vibes';
import { colors, display, font, gradAI, onPhoto, radius, space, type } from '../theme';
import type { Nav } from '../nav';

// The one chip that isn't a category: the whole catalog. It carries no
// glyph — a colourless chip reads as "not a kind of place".
const ALL = 'all';

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** Today as an editorial dateline: "Thursday, August 7" / "Thứ Năm, 7 tháng 8" / "8月7日（木）". */
function dateline(lang: Lang): string {
  const d = new Date();
  if (lang === 'vi') return `${DAYS_VI[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
  if (lang === 'ja') return `${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`;
  return `${DAYS_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
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

function Hero({ place, onExplore, scrollY }: {
  place: Place | undefined;
  onExplore: () => void;
  scrollY: Animated.Value;
}) {
  const { t } = useI18n();
  const { city } = useCity();
  const uri = place && coverOf(place)?.photo_uri;
  // The photo trails the scroll slightly; pre-scaled so no edge shows.
  const parallax = scrollY.interpolate({ inputRange: [0, 320], outputRange: [0, 26], extrapolate: 'clamp' });
  return (
    <View style={s.heroWrap}>
      <View style={s.hero}>
        {uri
          ? (
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: parallax }, { scale: 1.12 }] }]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            </Animated.View>
          )
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
        <LinearGradient
          colors={['rgba(10,11,10,0.45)', 'rgba(10,11,10,0.06)', 'rgba(10,11,10,0.55)', 'rgba(10,11,10,0.97)']}
          locations={[0, 0.22, 0.64, 1]}
          style={StyleSheet.absoluteFill}
        />
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
          <Text style={s.heroSub}>
            {t(
              'Browse public collections and places — no account needed.',
              'Xem bộ sưu tập và địa điểm công khai — không cần tài khoản.',
              'コレクションとスポットを自由に閲覧 — アカウント不要。',
            )}
          </Text>
          <PressableScale onPress={onExplore} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <LinearGradient {...gradAI} style={s.heroCta}>
              <Text style={s.heroCtaText}>
                {city?.hero_cta_en
                  ? t(city.hero_cta_en, city.hero_cta_vi, city.hero_cta_ja)
                  : t('Start exploring', 'Bắt đầu khám phá', '探索を始める')}
              </Text>
              <Ionicons name="arrow-forward" size={17} color={colors.accentInk} />
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

function CollectionShelf({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const cols = useCollections();
  const { data: places, loading: placesLoading } = usePlaces();
  const loading = cols.loading || placesLoading;
  // Only collections with at least one visible member — an empty
  // collection is a dead end for a browsing guest.
  const visible = cols.data.filter((c) => membersOf(c, places).length > 0);

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
                  <Text style={s.shelfCardMeta}>{count} {t('places', 'địa điểm', 'スポット')}</Text>
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
  const { t, lang } = useI18n();
  const { city } = useCity();
  // The city's centre, never the device's position — someone with the
  // city set to follow their location still keeps it on their phone.
  const sky = useSky(city?.center_lat, city?.center_lng);
  const { loading, error, data: places, reload } = usePlaces();
  const [cat, setCat] = useState<string>(ALL);
  const tabClearance = useTabBarClearance();
  const listRef = useRef<SectionList<Place>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  // Lands on the filter row, which is where it pins anyway. The old
  // offset of 116 existed to keep the chips in frame after the jump; they
  // hold that position themselves now, so an offset would only push them
  // back under the header they are meant to sit below.
  const scrollToPlaces = () => {
    if (shown.length > 0) {
      listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
    }
  };

  const header = (
    <>
      <Hero place={hero} onExplore={scrollToPlaces} scrollY={scrollY} />
      <CollectionShelf navigation={navigation} />
      <Text style={s.section}>{t('Places', 'Địa điểm', 'スポット')}</Text>
    </>
  );

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
    <View style={s.filterBar}>
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
    <Screen
      // Weather hangs off the end of the date rather than sitting in its
      // own slot: nothing moves when it arrives, and nothing is missing
      // when it does not.
      eyebrow={(
        <>
          <EyebrowText>{dateline(lang)}</EyebrowText>
          {sky ? (
            <>
              <Ionicons name={sky.icon} size={14} color={sky.gold ? colors.sun : colors.textSecondary} />
              <EyebrowText>{`${sky.temp}°`}</EyebrowText>
            </>
          ) : null}
        </>
      )}
      title={t(`Discover ${city?.short_en ?? '…'}`, `Khám phá ${city?.short_vi ?? '…'}`, `${city?.short_ja ?? city?.short_en ?? '…'}を発見`)}
      // Search only. A header action should act on the screen it sits
      // above; getting to your profile is the tab bar's job, and it is
      // on screen already.
      right={(
        <RoundIconButton
          icon="search-outline"
          onPress={() => navigation.navigate('Search')}
          label={t('Search', 'Tìm kiếm', '検索')}
        />
      )}
    >
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {loading && (
          <View style={{ paddingHorizontal: space.page, gap: space.cardGap }}>
            <Skeleton style={{ height: 320, borderRadius: 22 }} />
            <View style={{ flexDirection: 'row', gap: space.cardGap }}>
              <Skeleton style={{ width: 176, height: 200 }} />
              <Skeleton style={{ flex: 1, height: 200 }} />
            </View>
            <Skeleton style={{ height: 180, borderRadius: 22 }} />
          </View>
        )}
        {error && <Empty text={t(`Couldn't load places: ${error}`, `Không tải được địa điểm: ${error}`, `読み込みに失敗しました: ${error}`)} />}
        {!loading && !error && (
          <Animated.SectionList
            ref={listRef}
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
            ListFooterComponent={shown.length === 0
              ? <Empty text={t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。')} />
              : null}
            contentContainerStyle={{ paddingBottom: tabClearance }}
            showsVerticalScrollIndicator={false}
            onRefresh={reload}
            refreshing={loading}
            onScrollToIndexFailed={() => {}}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
            scrollEventThrottle={16}
          />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  heroWrap: { paddingHorizontal: space.page, marginBottom: space.titleToContent },
  // Full-bleed photography wears no hairline: a translucent border over
  // an image lights up wherever the photo is bright and vanishes where
  // it's dark, reading as a broken frame. Edges end in shadow instead.
  hero: {
    borderRadius: radius.card, overflow: 'hidden', minHeight: 340,
    justifyContent: 'flex-end',
  },
  heroContent: { padding: space.cardPadding + 2, gap: 10 },
  heroTitle: { color: onPhoto.text, fontSize: 24, fontFamily: display.bold, letterSpacing: 0.2, lineHeight: 30 },
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

  // The pinned filter row.
  //
  // The page's own colour, not the tab bar's glass, and the difference is
  // what sits immediately above it. Glass says content is passing beneath
  // me — true of the tab bar, which floats with the list running under and
  // past it. Here the thing directly above is the opaque header, which
  // says the opposite about the very same edge, and two bars making
  // contradictory claims a hairline apart is the seam you see rather than
  // a material you read.
  //
  // Opaque, the pinned row reads as the bottom of the header instead: one
  // block that holds the title and the filter, with the list beginning
  // underneath it.
  //
  // Padding is symmetric because once pinned there is no heading above it
  // to sit under — it is its own top edge.
  filterBar: {
    paddingVertical: 10,
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

});
