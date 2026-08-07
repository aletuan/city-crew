import React, { useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fmtCount, photosOf, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';
import { Empty } from '../components/ui';
import type { Nav, RootRoute } from '../nav';

function fmtDuration(min: number | null, max: number | null, vi: boolean): string | null {
  if (!min) return null;
  if ((max ?? min) <= 60) {
    const range = !max || min === max ? `${min}` : `${min}–${max}`;
    return vi ? `${range} phút` : `${range} min`;
  }
  const h = (m: number) => Math.round(m / 30) / 2;
  const range = !max || h(min) === h(max) ? `${h(min)}` : `${h(min)}–${h(max)}`;
  return vi ? `${range} giờ` : `${range}h`;
}

export default function PlaceDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'PlaceDetail'> }) {
  const { t, lang } = useI18n();
  const { width } = useWindowDimensions();
  const { loading, data: places } = usePlaces();
  const place = useMemo(() => places.find((p) => p.slug === route.params.slug), [places, route.params.slug]);

  if (loading && !place) {
    return <SafeAreaView style={s.screen}><ActivityIndicator color={colors.aiPink} style={{ marginTop: 64 }} /></SafeAreaView>;
  }
  if (!place) {
    return <SafeAreaView style={s.screen}><Empty text={t('Place not found.', 'Không tìm thấy địa điểm.')} /></SafeAreaView>;
  }

  const photos = photosOf(place);
  const reviews = fmtCount(place.rating_count);
  const dur = fmtDuration(place.duration_min, place.duration_max, lang === 'vi');

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View>
          {photos[0] ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {photos.map((ph) => (
                <View key={ph.photo_uri}>
                  <Image source={{ uri: ph.photo_uri }} style={[s.hero, { width }]} contentFit="cover" transition={200} />
                  {ph.attribution_name ? <Text style={s.attr}>📷 {ph.attribution_name}</Text> : null}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[s.hero, s.heroFallback]}><Text style={{ fontSize: 64 }}>{place.emoji ?? '📍'}</Text></View>
          )}
          <Pressable onPress={() => navigation.goBack()} style={s.back} accessibilityLabel="Back">
            <Text style={s.backText}>‹</Text>
          </Pressable>
        </View>

        <View style={s.body}>
          <Text style={s.name}>{t(place.name_en, place.name_vi)}</Text>
          <Text style={s.loc}>{t(place.neighborhood_en, place.neighborhood_vi)}</Text>

          <View style={s.stats}>
            {place.rating ? (
              <Text style={s.stat}>★ {place.rating}{reviews ? `  ·  ${reviews} ${t('Google reviews', 'đánh giá Google')}` : ''}</Text>
            ) : null}
            {place.price_display ? <Text style={s.stat}>{place.price_display}</Text> : null}
            {dur ? <Text style={s.stat}>🕐 {dur}</Text> : null}
          </View>

          {(place.desc_en || place.desc_vi) && <Text style={s.desc}>{t(place.desc_en, place.desc_vi)}</Text>}

          {place.address && (
            <View style={s.factRow}>
              <Text style={s.factLabel}>{t('Address', 'Địa chỉ')}</Text>
              <Text style={s.factValue}>{place.address}</Text>
            </View>
          )}
          {place.opening_hours && place.opening_hours.length > 0 && (
            <View style={s.factRow}>
              <Text style={s.factLabel}>{t('Hours', 'Giờ mở cửa')}</Text>
              <Text style={s.factValue}>{place.opening_hours.join('\n')}</Text>
            </View>
          )}
          <View style={s.links}>
            {place.website ? (
              <Pressable style={s.linkBtn} onPress={() => Linking.openURL(place.website!)}>
                <Text style={s.linkText}>{t('Website', 'Trang web')} ↗</Text>
              </Pressable>
            ) : null}
            {place.lat && place.lng ? (
              <Pressable
                style={s.linkBtn}
                onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`)}
              >
                <Text style={s.linkText}>{t('Open in Maps', 'Mở bản đồ')} ↗</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: { aspectRatio: 4 / 3, backgroundColor: colors.surfaceGlass },
  heroFallback: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  attr: {
    position: 'absolute', right: 12, bottom: 10, fontSize: 9.5, color: '#fff', opacity: 0.8,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  back: {
    position: 'absolute', left: 14, top: 12, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(10,8,13,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 26, lineHeight: 30, marginTop: -2 },
  body: { padding: 20 },
  name: { color: colors.text, fontSize: 26, fontFamily: font.extrabold, letterSpacing: -0.4 },
  loc: { color: colors.textTertiary, fontSize: 14, fontFamily: font.medium, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  stat: { color: colors.textSecondary, fontSize: 13.5, fontFamily: font.semibold },
  desc: { color: colors.textSecondary, fontSize: 15, lineHeight: 23, fontFamily: font.regular, marginTop: 16 },
  factRow: {
    marginTop: 16, backgroundColor: colors.bgElevated, borderRadius: radius.input,
    borderWidth: 1, borderColor: colors.borderGlassSoft, padding: 14,
  },
  factLabel: {
    color: colors.textTertiary, fontSize: 11, fontFamily: font.bold,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5,
  },
  factValue: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 21, fontFamily: font.regular },
  links: { flexDirection: 'row', gap: 10, marginTop: 18 },
  linkBtn: {
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  linkText: { color: colors.text, fontSize: 13, fontFamily: font.semibold },
});
