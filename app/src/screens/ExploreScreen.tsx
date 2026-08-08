// Explore — the guest landing surface, modeled on the mockup's home:
// dated eyebrow + editorial title, a hero built on a featured place's
// photography, a horizontal shelf of public collections, then the
// browsable places list. Guests get a quiet "Make it yours" close.

import React, { useMemo, useRef, useState } from 'react';
import {
  Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import PlaceCard from '../components/PlaceCard';
import { AmbientWarmth, Chip, Empty, fireHaptic, PressableScale, Screen, Skeleton, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { Collection, coverOf, membersOf, Place, useCollections, usePlaces } from '../lib/data';
import { Lang, useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav } from '../nav';

const CATS = [
  { key: 'foryou', en: 'For you', vi: 'Cho bạn' },
  { key: 'food', en: 'Food & drinks', vi: 'Ăn uống' },
  { key: 'out', en: 'Outdoors & culture', vi: 'Ngoài trời & văn hóa' },
] as const;

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Today as an editorial dateline: "Thursday, August 7" / "Thứ Năm, 7 tháng 8". */
function dateline(lang: Lang): string {
  const d = new Date();
  return lang === 'vi'
    ? `${DAYS_VI[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`
    : `${DAYS_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
}

/** The hero is a night-out invitation, so it leans on after-dark
 *  aerial photography: the rooftop-bar panorama first, then the night
 *  cruise, then any skyline shot the catalog has. */
function heroPlace(places: Place[]): Place | undefined {
  const withPhoto = (p: Place) => !!coverOf(p);
  return (
    places.find((p) => p.slug === 'chill-skybar' && withPhoto(p)) ??
    places.find((p) => p.slug === 'saigon-night-cruise' && withPhoto(p)) ??
    places.find((p) => p.slug.includes('landmark') && withPhoto(p)) ??
    places.find((p) => p.slug.includes('bitexco') && withPhoto(p)) ??
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
                ? `✓ ${t('Signed in as', 'Đã đăng nhập:')} ${email}`
                : `👋 ${t('Browsing as guest', 'Đang xem với tư cách khách')}`}
            </Text>
          </View>
          <Text style={s.heroTitle}>
            {t('Ideas for a night in Ho Chi Minh City', 'Gợi ý cho một đêm ở TP. Hồ Chí Minh')}
          </Text>
          <Text style={s.heroSub}>
            {t(
              'Browse public collections and places — no account needed.',
              'Xem bộ sưu tập và địa điểm công khai — không cần tài khoản.',
            )}
          </Text>
          <PressableScale style={s.heroCta} onPress={onExplore} accessibilityRole="button">
            <Text style={s.heroCtaText}>{t('Start exploring →', 'Bắt đầu khám phá →')}</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

function CollectionShelf({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const cols = useCollections();
  const { data: places } = usePlaces();

  const coverFor = (c: Collection) =>
    c.cover?.photo_uri ?? (membersOf(c, places)[0] && coverOf(membersOf(c, places)[0])?.photo_uri);

  if (!cols.loading && cols.data.length === 0) return null;

  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <View style={s.shelfHeader}>
        <Text style={s.section}>{t('Public collections', 'Bộ sưu tập công khai')}</Text>
        <Pressable
          onPress={() => { fireHaptic('selection'); navigation.getParent()?.navigate('Collections'); }}
          hitSlop={10}
        >
          <Text style={s.seeAll}>{t('See all', 'Xem tất cả')} →</Text>
        </Pressable>
      </View>
      {cols.loading ? (
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
          {cols.data.map((c) => {
            const uri = coverFor(c);
            const count = membersOf(c, places).length || c.collection_places.length;
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
                <View style={s.shelfCardText}>
                  <Text style={s.shelfCardTitle} numberOfLines={2}>{t(c.title_en, c.title_vi)}</Text>
                  <Text style={s.shelfCardMeta}>{count} {t('places', 'địa điểm')}</Text>
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
      <Text style={s.yoursTitle}>{t('Make it yours', 'Biến nơi này thành của bạn')}</Text>
      <Text style={s.yoursBody}>
        {t(
          'Sign in to save favorites and build your own collections.',
          'Đăng nhập để lưu địa điểm yêu thích và tạo bộ sưu tập của riêng bạn.',
        )}
      </Text>
      <PressableScale
        onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'SignIn' })}
        accessibilityRole="button"
      >
        <LinearGradient {...gradAI} style={s.yoursBtn}>
          <Text style={s.yoursBtnText}>{t('Sign in', 'Đăng nhập')}</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

export default function ExploreScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { loading, error, data: places, reload } = usePlaces();
  const [cat, setCat] = useState<(typeof CATS)[number]['key']>('foryou');
  const tabClearance = useTabBarClearance();
  const listRef = useRef<FlatList<Place>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const shown = useMemo(() => {
    if (cat === 'foryou') return places.filter((p) => p.is_featured);
    return places.filter((p) => p.category === cat);
  }, [places, cat]);

  const hero = useMemo(() => heroPlace(places), [places]);

  const scrollToPlaces = () => {
    if (shown.length > 0) {
      listRef.current?.scrollToIndex({ index: 0, viewOffset: 116, animated: true });
    }
  };

  const header = (
    <>
      <Hero place={hero} onExplore={scrollToPlaces} scrollY={scrollY} />
      <CollectionShelf navigation={navigation} />
      <Text style={s.section}>{t('Places', 'Địa điểm')}</Text>
      <View style={{ paddingBottom: space.headingToContent }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.page }}
        >
          {CATS.map((c) => (
            <Chip key={c.key} label={t(c.en, c.vi)} active={cat === c.key} onPress={() => setCat(c.key)} />
          ))}
        </ScrollView>
      </View>
    </>
  );

  return (
    <Screen eyebrow={dateline(lang)} title={t('Discover Saigon', 'Khám phá Sài Gòn')}>
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
        {error && <Empty text={t(`Couldn't load places: ${error}`, `Không tải được địa điểm: ${error}`)} />}
        {!loading && !error && (
          <Animated.FlatList
            ref={listRef}
            data={shown}
            keyExtractor={(p) => p.slug}
            ListHeaderComponent={header}
            renderItem={({ item }) => (
              <PlaceCard place={item} onPress={() => navigation.navigate('PlaceDetail', { slug: item.slug })} />
            )}
            ListEmptyComponent={<Empty text={t('Nothing here yet.', 'Chưa có gì ở đây.')} />}
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
  heroCta: {
    alignSelf: 'flex-start', marginTop: 4,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlass,
    backgroundColor: 'rgba(10,11,10,0.45)', paddingHorizontal: 18, paddingVertical: 10,
  },
  heroCtaText: { color: colors.champagne, fontSize: 15, fontWeight: font.semibold },

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
