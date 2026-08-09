// Explore — the guest landing surface, modeled on the mockup's home:
// dated eyebrow + editorial title, a hero built on a featured place's
// photography, a horizontal shelf of public collections, then the
// browsable places list. Guests get a quiet "Make it yours" close.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PlaceCard from '../components/PlaceCard';
import { AmbientWarmth, Chip, Empty, fireHaptic, PressableScale, RoundIconButton, Screen, Skeleton, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { CATEGORY_ORDER, categoriesOf, categoryLabel } from '../lib/categories';
import { useCity } from '../lib/city';
import { Collection, coverOf, membersOf, Place, useCollections, usePlaces } from '../lib/data';
import { Lang, useI18n } from '../lib/i18n';
import { VIBES } from '../lib/vibes';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav } from '../nav';

/** The one chip that filters by curation rather than by category. */
const FOR_YOU = 'foryou';

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

// Per-city hero seasons: a hand-picked cover place and headline override.
// Cities without an entry keep the default night-out framing.
const CITY_HERO: Record<string, { slug: string; en: string; vi: string; ja: string }> = {
  hcmc: {
    slug: 'saigon-night-cruise',
    en: 'Ideas for a night in Saigon',
    vi: 'Gợi ý cho một đêm ở Sài Gòn',
    ja: 'サイゴン、夜のアイデア',
  },
  hanoi: {
    slug: 'imperial-citadel-of-thang-long',
    en: 'Autumn ideas in Hanoi',
    vi: 'Gợi ý mùa thu ở Hà Nội',
    ja: 'ハノイ、秋のアイデア',
  },
};

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
 *  featured place with a views/nightlife vibe, then anything with a photo. */
function heroPlace(places: Place[], cityId?: string): Place | undefined {
  const withPhoto = (p: Place) => !!coverOf(p);
  const pick = cityId ? CITY_HERO[cityId]?.slug : undefined;
  return (
    (pick ? places.find((p) => p.slug === pick && withPhoto(p)) : undefined) ??
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
  const { session, email } = useAuth();
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
          <View style={s.heroPill}>
            <Text style={s.heroPillText}>
              {session
                ? `✓ ${t('Signed in as', 'Đã đăng nhập:', 'サインイン中:')} ${email}`
                : `👋 ${t('Browsing as guest', 'Đang xem với tư cách khách', 'ゲストとして閲覧中')}`}
            </Text>
          </View>
          <Text style={s.heroTitle}>
            {city && CITY_HERO[city.id]
              ? t(CITY_HERO[city.id].en, CITY_HERO[city.id].vi, CITY_HERO[city.id].ja)
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
              <Text style={s.heroCtaText}>{t('Start exploring', 'Bắt đầu khám phá', '探索を始める')}</Text>
              <Ionicons name="arrow-forward" size={17} color="#141310" />
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
                    <Ionicons name={badge} size={15} color={colors.text} />
                  </View>
                )}
                <View style={s.shelfCardText}>
                  <Text style={s.shelfCardTitle} numberOfLines={2}>{t(c.title_en, c.title_vi, c.title_ja)}</Text>
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

function MakeItYours({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  if (session) return null;
  return (
    <View style={s.yoursCard}>
      <Text style={s.yoursTitle}>{t('Make it yours', 'Biến nơi này thành của bạn', '自分だけのアプリに')}</Text>
      <Text style={s.yoursBody}>
        {t(
          'Sign in to save favorites and build your own collections.',
          'Đăng nhập để lưu địa điểm yêu thích và tạo bộ sưu tập của riêng bạn.',
          'サインインしてお気に入りを保存し、自分のコレクションを作りましょう。',
        )}
      </Text>
      <PressableScale
        onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'SignIn' })}
        accessibilityRole="button"
      >
        <LinearGradient {...gradAI} style={s.yoursBtn}>
          <Text style={s.yoursBtnText}>{t('Sign in', 'Đăng nhập', 'サインイン')}</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

export default function ExploreScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { city } = useCity();
  const { loading, error, data: places, reload } = usePlaces();
  const [cat, setCat] = useState<string>(FOR_YOU);
  const tabClearance = useTabBarClearance();
  const listRef = useRef<FlatList<Place>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Only categories this city actually has, so a chip never leads to an
  // empty list. Order comes from the taxonomy, not from the data.
  const cats = useMemo<string[]>(() => {
    const present = new Set<string>();
    for (const p of places) for (const c of categoriesOf(p)) present.add(c);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [places]);

  // Switching city can retire the selected chip — fall back rather than
  // leave the list stuck on a filter that no longer exists.
  useEffect(() => {
    if (cat !== FOR_YOU && places.length > 0 && !cats.includes(cat)) setCat(FOR_YOU);
  }, [cats, cat, places.length]);

  const shown = useMemo(() => {
    if (cat === FOR_YOU) return places.filter((p) => p.is_featured);
    return places.filter((p) => categoriesOf(p).includes(cat));
  }, [places, cat]);

  const hero = useMemo(() => heroPlace(places, city?.id), [places, city?.id]);

  const scrollToPlaces = () => {
    if (shown.length > 0) {
      listRef.current?.scrollToIndex({ index: 0, viewOffset: 116, animated: true });
    }
  };

  const header = (
    <>
      <Hero place={hero} onExplore={scrollToPlaces} scrollY={scrollY} />
      <CollectionShelf navigation={navigation} />
      <Text style={s.section}>{t('Places', 'Địa điểm', 'スポット')}</Text>
      <View style={{ paddingBottom: space.headingToContent }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.page }}
        >
          <Chip
            label={t('For you', 'Cho bạn', 'おすすめ')}
            active={cat === FOR_YOU}
            onPress={() => setCat(FOR_YOU)}
          />
          {cats.map((c) => (
            <Chip key={c} label={categoryLabel(c, t)} active={cat === c} onPress={() => setCat(c)} />
          ))}
        </ScrollView>
      </View>
    </>
  );

  return (
    <Screen
      eyebrow={dateline(lang)}
      title={t(`Discover ${city?.short_en ?? '…'}`, `Khám phá ${city?.short_vi ?? '…'}`, `${city?.short_ja ?? city?.short_en ?? '…'}を発見`)}
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
          <Animated.FlatList
            ref={listRef}
            data={shown}
            keyExtractor={(p) => p.slug}
            ListHeaderComponent={header}
            renderItem={({ item }) => (
              <PlaceCard place={item} onPress={() => navigation.navigate('PlaceDetail', { slug: item.slug })} />
            )}
            ListEmptyComponent={<Empty text={t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。')} />}
            ListFooterComponent={<MakeItYours navigation={navigation} />}
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
  heroPill: {
    alignSelf: 'flex-start', borderRadius: radius.pill,
    backgroundColor: 'rgba(10,11,10,0.55)', borderWidth: 1, borderColor: colors.borderGlassSoft,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  heroPillText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: font.medium },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: font.bold, letterSpacing: 0.2, lineHeight: 30 },
  heroSub: { color: colors.textSecondary, ...type.meta, lineHeight: 21 },
  // The screen's one loud control: solid champagne, dark text — the same
  // primary-button material the auth screens use.
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 12,
  },
  heroCtaText: { color: '#141310', fontSize: 16, fontWeight: font.semibold },

  section: {
    color: colors.text, ...type.section,
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },
  shelfHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: space.page },
  seeAll: { color: colors.champagne, fontSize: 14, fontWeight: font.medium },
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
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  shelfCardText: { padding: 13, gap: 3 },
  shelfCardTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold, lineHeight: 20 },
  shelfCardMeta: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },

  yoursCard: {
    marginHorizontal: space.page, marginTop: 10,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, padding: space.cardPadding, gap: 12,
  },
  yoursTitle: { color: colors.text, ...type.cardTitle },
  yoursBody: { color: colors.textSecondary, ...type.body, lineHeight: 23 },
  yoursBtn: { borderRadius: radius.input, paddingVertical: 13, alignItems: 'center' },
  yoursBtnText: { color: '#141310', fontSize: 16, fontWeight: font.semibold },
});
