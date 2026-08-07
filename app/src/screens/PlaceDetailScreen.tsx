// Place detail — hero carousel with photo counter, floating share/save,
// rating badge, icon fact row, and Address / Hours / Call / Website cards.

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet,
  Text, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fmtCount, photosOf, Place, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius } from '../theme';
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

/** "Monday: 8:00 AM – 11:00 PM" → ["Monday", "8:00 AM – 11:00 PM"] */
function splitHours(line: string): [string, string] {
  const i = line.indexOf(': ');
  return i > 0 ? [line.slice(0, i), line.slice(i + 2)] : [line, ''];
}

function vibeLabel(place: Place, t: (en: string, vi: string) => string): string {
  const v = place.vibe_tags[0];
  if (v) return v.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
  return place.category === 'food' ? t('Food & drinks', 'Ăn uống') : t('Outdoors', 'Ngoài trời');
}

function RoundIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.roundIcon}>
      <Ionicons name={name} size={19} color={colors.aiAmber} />
    </View>
  );
}

function InfoCard({ icon, label, onPress, chevron, children }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  chevron?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.infoCard}>
      <RoundIcon name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        {children}
      </View>
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
    </Pressable>
  );
}

export default function PlaceDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'PlaceDetail'> }) {
  const { t, lang } = useI18n();
  const { width } = useWindowDimensions();
  const { loading, data: places } = usePlaces();
  const place = useMemo(() => places.find((p) => p.slug === route.params.slug), [places, route.params.slug]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saved, setSaved] = useState(false);

  if (loading && !place) {
    return <SafeAreaView style={s.screen}><ActivityIndicator color={colors.aiPink} style={{ marginTop: 64 }} /></SafeAreaView>;
  }
  if (!place) {
    return <SafeAreaView style={s.screen}><Empty text={t('Place not found.', 'Không tìm thấy địa điểm.')} /></SafeAreaView>;
  }

  const photos = photosOf(place);
  const reviews = fmtCount(place.rating_count);
  const dur = fmtDuration(place.duration_min, place.duration_max, lang === 'vi');
  const heroW = width - 24;
  const mapsUrl = place.lat && place.lng
    ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    : null;
  const hours = (place.opening_hours ?? []).map(splitHours);

  const share = () => {
    Share.share({
      message: `${t(place.name_en, place.name_vi)} — ${place.address ?? ''}${mapsUrl ? `\n${mapsUrl}` : ''}`,
    }).catch(() => {});
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* ── hero carousel ── */}
        <View style={s.heroWrap}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / heroW))}
            >
              {photos.map((ph) => (
                <Image key={ph.photo_uri} source={{ uri: ph.photo_uri }} style={[s.hero, { width: heroW }]} contentFit="cover" transition={200} />
              ))}
            </ScrollView>
          ) : (
            <View style={[s.hero, s.heroFallback, { width: heroW }]}>
              <Text style={{ fontSize: 64 }}>{place.emoji ?? '📍'}</Text>
            </View>
          )}

          <Pressable onPress={() => navigation.goBack()} style={[s.fab, { left: 12, top: 12 }]} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={share} style={[s.fab, { right: 64, top: 12 }]} accessibilityLabel="Share">
            <Ionicons name="share-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setSaved((v) => !v)} style={[s.fab, { right: 12, top: 12 }]} accessibilityLabel="Save">
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? colors.aiPink : '#fff'} />
          </Pressable>

          {photos.length > 0 && (
            <View style={s.counter}>
              <Ionicons name="images-outline" size={13} color="#fff" />
              <Text style={s.counterText}>{photoIndex + 1} / {photos.length}</Text>
            </View>
          )}
          {photos[photoIndex]?.attribution_name ? (
            <Text style={s.attr}>📷 {photos[photoIndex].attribution_name}</Text>
          ) : null}
        </View>

        <View style={s.body}>
          {/* ── title + rating badge ── */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{t(place.name_en, place.name_vi)}</Text>
              <View style={s.locRow}>
                <Ionicons name="location-outline" size={15} color={colors.textTertiary} />
                <Text style={s.loc}>{t(place.neighborhood_en, place.neighborhood_vi)}</Text>
              </View>
            </View>
            {place.rating ? (
              <View style={s.ratingBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="star" size={16} color={colors.aiAmber} />
                  <Text style={s.ratingValue}>{place.rating}</Text>
                </View>
                {reviews ? <Text style={s.ratingCount}>{reviews} {t('reviews', 'đánh giá')}</Text> : null}
              </View>
            ) : null}
          </View>

          {/* ── fact row ── */}
          <View style={s.facts}>
            {place.price_display || place.price_vnd ? (
              <View style={s.fact}>
                <Ionicons name="pricetag-outline" size={15} color={colors.textSecondary} />
                <Text style={s.factText}>{place.price_display ?? `${Math.round((place.price_vnd ?? 0) / 1000)}k₫`}</Text>
              </View>
            ) : null}
            {dur ? (
              <View style={s.fact}>
                <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                <Text style={s.factText}>{dur}</Text>
              </View>
            ) : null}
            <View style={s.fact}>
              <Ionicons name={place.category === 'food' ? 'cafe-outline' : 'leaf-outline'} size={15} color={colors.textSecondary} />
              <Text style={s.factText}>{vibeLabel(place, t)}</Text>
            </View>
          </View>

          {(place.desc_en || place.desc_vi) && <Text style={s.desc}>{t(place.desc_en, place.desc_vi)}</Text>}
          <View style={s.divider} />

          {/* ── info cards ── */}
          {place.address && (
            <InfoCard
              icon="location-outline"
              label={t('Address', 'Địa chỉ')}
              onPress={mapsUrl ? () => Linking.openURL(mapsUrl) : undefined}
              chevron={!!mapsUrl}
            >
              <Text style={s.infoValue}>{place.address}</Text>
            </InfoCard>
          )}

          {hours.length > 0 && (
            <InfoCard icon="time-outline" label={t('Hours', 'Giờ mở cửa')}>
              {hours.map(([day, time]) => (
                <View key={day} style={s.hourRow}>
                  <Text style={s.hourDay}>{day}</Text>
                  <Text style={s.hourTime}>{time}</Text>
                </View>
              ))}
            </InfoCard>
          )}

          {place.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${place.phone!.replace(/\s/g, '')}`)} style={s.infoCard}>
              <RoundIcon name="call-outline" />
              <View style={{ flex: 1 }}>
                <Text style={s.callTitle}>
                  {place.category === 'food' ? t('Call the place', 'Gọi cho quán') : t('Call', 'Gọi điện')}
                </Text>
                <Text style={s.infoValue}>{place.phone}</Text>
              </View>
              <LinearGradient {...gradAI} style={s.goBtn}>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </Pressable>
          )}

          {place.website && (
            <InfoCard
              icon="globe-outline"
              label={t('Website', 'Trang web')}
              onPress={() => Linking.openURL(place.website!)}
              chevron
            >
              <Text style={s.infoValue} numberOfLines={1}>
                {place.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </Text>
            </InfoCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  heroWrap: { marginHorizontal: 12, borderRadius: 24, overflow: 'hidden' },
  hero: { aspectRatio: 4 / 3.4, backgroundColor: colors.surfaceGlass },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute', width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(10,8,13,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  counter: {
    position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(10,8,13,0.65)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6,
  },
  counterText: { color: '#fff', fontSize: 12.5, fontFamily: font.semibold },
  attr: {
    position: 'absolute', right: 12, bottom: 14, fontSize: 9.5, color: '#fff', opacity: 0.8,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },

  body: { paddingHorizontal: 20, paddingTop: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { color: colors.text, fontSize: 27, fontFamily: font.extrabold, letterSpacing: -0.5 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  loc: { color: colors.textTertiary, fontSize: 14.5, fontFamily: font.medium },
  ratingBadge: {
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', gap: 3,
  },
  ratingValue: { color: colors.text, fontSize: 18, fontFamily: font.extrabold },
  ratingCount: { color: colors.textTertiary, fontSize: 11.5, fontFamily: font.medium },

  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 16 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { color: colors.textSecondary, fontSize: 14, fontFamily: font.semibold },

  desc: { color: colors.textSecondary, fontSize: 15, lineHeight: 23, fontFamily: font.regular, marginTop: 14 },
  divider: { height: 1, backgroundColor: colors.borderGlassSoft, marginVertical: 18 },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: 18, padding: 14, marginBottom: 12,
  },
  roundIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(246,164,92,0.10)', borderWidth: 1, borderColor: 'rgba(246,164,92,0.25)',
  },
  infoLabel: {
    color: colors.textTertiary, fontSize: 11, fontFamily: font.bold,
    textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 4,
  },
  infoValue: { color: colors.textSecondary, fontSize: 14.5, lineHeight: 21, fontFamily: font.regular },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  hourDay: { color: colors.textSecondary, fontSize: 13.5, fontFamily: font.medium },
  hourTime: { color: colors.textSecondary, fontSize: 13.5, fontFamily: font.regular },
  callTitle: { color: colors.text, fontSize: 15.5, fontFamily: font.bold, marginBottom: 2 },
  goBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
