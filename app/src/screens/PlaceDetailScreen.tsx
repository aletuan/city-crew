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
import { fmtCount, photosOf, Place } from '../lib/data';
import { usePlaces } from '../lib/catalog';
import { dotWindow, fmtDuration, groupHours, openState } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useSave } from '../lib/save';
import { colors, font, gradAI, onPhoto, radius, space, type } from '../theme';
import { AmbientWarmth, Empty, PressableScale, useTabBarClearance } from '../components/ui';
import PricePill from '../components/PricePill';
import type { Nav, RootRoute } from '../nav';

function vibeLabel(place: Place, t: (en: string, vi: string, ja?: string) => string): string {
  const v = place.vibe_tags[0];
  if (v) return v.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
  return place.category === 'food' ? t('Food & drinks', 'Ăn uống', 'グルメ') : t('Outdoors', 'Ngoài trời', 'アウトドア');
}

function RoundIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.roundIcon}>
      <Ionicons name={name} size={19} color={colors.accent} />
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
  const { save, isSaved } = useSave();
  const { width } = useWindowDimensions();
  const { loading, data: places } = usePlaces();
  const place = useMemo(() => places.find((p) => p.slug === route.params.slug), [places, route.params.slug]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const saved = isSaved(route.params.slug);
  const tabClearance = useTabBarClearance();

  if (loading && !place) {
    return <SafeAreaView style={s.screen}><ActivityIndicator color={colors.accent} style={{ marginTop: 64 }} /></SafeAreaView>;
  }
  if (!place) {
    return <SafeAreaView style={s.screen}><Empty text={t('Place not found.', 'Không tìm thấy địa điểm.', 'スポットが見つかりません。')} /></SafeAreaView>;
  }

  const photos = photosOf(place);
  const reviews = fmtCount(place.rating_count);
  const dur = fmtDuration(place.duration_min, place.duration_max, lang);
  const heroW = width - 24;
  const mapsUrl = place.lat && place.lng
    ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    : null;
  // Grouped, not one row per day: see groupHours. A place open the same
  // seven days a week becomes one line instead of seven identical ones.
  const hours = groupHours(place.opening_hours ?? []);
  // Read at render rather than on a timer. The screen re-renders on every
  // visit, which is when the answer is being asked for; a ticking clock
  // would only matter to someone parked on this screen at closing time,
  // and would cost a re-render a minute on every place in the app.
  const openNow = openState(place.opening_hours, new Date());

  const share = () => {
    Share.share({
      message: `${t(place.name_en, place.name_vi, place.name_ja)} — ${place.address ?? ''}${mapsUrl ? `\n${mapsUrl}` : ''}`,
    }).catch(() => {});
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <AmbientWarmth style={{ top: 300, height: 620 }} />
      <ScrollView contentContainerStyle={{ paddingBottom: tabClearance }} showsVerticalScrollIndicator={false}>
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

          <PressableScale
            onPress={() => navigation.goBack()} scaleTo={0.9}
            containerStyle={{ position: 'absolute', left: 12, top: 12 }} style={s.fab} accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={onPhoto.text} />
          </PressableScale>
          <PressableScale
            onPress={share} scaleTo={0.9}
            containerStyle={{ position: 'absolute', right: 64, top: 12 }} style={s.fab} accessibilityLabel="Share"
          >
            <Ionicons name="share-outline" size={20} color={onPhoto.text} />
          </PressableScale>
          {/* The same control as the bookmark on the card that got you
              here — same glyph, same sheet, same rows underneath. It was a
              heart wired to component state: it filled in, it meant
              nothing, and it forgot on the way back. */}
          <PressableScale
            onPress={() => save(place)} scaleTo={0.9} haptic="selection"
            containerStyle={{ position: 'absolute', right: 12, top: 12 }} style={s.fab}
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            accessibilityLabel={saved
              ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更')
              : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存')}
          >
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? onPhoto.accent : onPhoto.text} />
          </PressableScale>

          {photos.length > 0 && (
            <View style={s.counter}>
              <Ionicons name="images-outline" size={13} color={onPhoto.text} />
              <Text style={s.counterText}>{photoIndex + 1} / {photos.length}</Text>
            </View>
          )}
          {photos.length > 1 && (
            <View style={s.dots}>
              {dotWindow(photos.length, photoIndex).map((i) => (
                <View key={i} style={[s.dot, i === photoIndex && s.dotOn]} />
              ))}
            </View>
          )}
          {photos[photoIndex]?.attribution_name ? (
            <Text style={s.attr} numberOfLines={1}>{photos[photoIndex].attribution_name}</Text>
          ) : null}
        </View>

        <View style={s.body}>
          {/* ── title + rating badge ── */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{t(place.name_en, place.name_vi, place.name_ja)}</Text>
              <View style={s.locRow}>
                <Ionicons name="location-outline" size={15} color={colors.textTertiary} />
                <Text style={s.loc}>{t(place.neighborhood_en, place.neighborhood_vi, place.neighborhood_ja)}</Text>
              </View>
            </View>
            {place.rating ? (
              <View style={s.ratingBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="star" size={16} color={colors.accent} />
                  <Text style={s.ratingValue}>{place.rating}</Text>
                </View>
                {reviews ? <Text style={s.ratingCount}>{reviews} {t('reviews', 'đánh giá', '件のレビュー')}</Text> : null}
              </View>
            ) : null}
          </View>

          {/* ── fact row ── */}
          <View style={s.facts}>
            {place.price_display || place.price_vnd != null ? (
              <PricePill place={place} />
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

          {(place.desc_en || place.desc_vi) && <Text style={s.desc}>{t(place.desc_en, place.desc_vi, place.desc_ja)}</Text>}
          <View style={s.divider} />

          {/* ── info cards ── */}
          {place.address && (
            <InfoCard
              icon="location-outline"
              label={t('Address', 'Địa chỉ', '住所')}
              onPress={mapsUrl ? () => Linking.openURL(mapsUrl) : undefined}
              chevron={!!mapsUrl}
            >
              <Text style={s.infoValue}>{place.address}</Text>
            </InfoCard>
          )}

          {hours.length > 0 && (
            <InfoCard icon="time-outline" label={t('Hours', 'Giờ mở cửa', '営業時間')}>
              {/* The one line most people came for, above the table they
                  would otherwise have to read today's row out of. Green
                  when open; closed is a fact about a café, not a fault, so
                  it stays in the quiet grey rather than going red. */}
              {openNow && (
                <Text style={[s.openNow, !openNow.open && s.openNowShut]}>
                  {/* Whole sentences per language, not a preposition glued
                      to a time: Japanese puts "まで" after the hour, so
                      concatenating a translated "until" in front of it
                      reads backwards. */}
                  {openNow.open
                    ? openNow.until
                      ? t(
                        `Open now · until ${openNow.until}`,
                        `Đang mở cửa · đến ${openNow.until}`,
                        `営業中 · ${openNow.until}まで`,
                      )
                      : t('Open now · 24 hours', 'Đang mở cửa · 24 giờ', '営業中 · 24時間')
                    : openNow.opensAt
                      ? t(
                        `Closed · opens ${openNow.opensAt}`,
                        `Đã đóng cửa · mở lúc ${openNow.opensAt}`,
                        `閉店中 · ${openNow.opensAt}開店`,
                      )
                      : t('Closed today', 'Hôm nay đóng cửa', '本日休業')}
                </Text>
              )}
              {hours.map((row) => (
                <View key={row.label} style={s.hourRow}>
                  <Text style={s.hourDay}>{row.label}</Text>
                  <Text style={s.hourTime}>{row.hours}</Text>
                </View>
              ))}
            </InfoCard>
          )}

          {place.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${place.phone!.replace(/\s/g, '')}`)} style={s.infoCard}>
              <RoundIcon name="call-outline" />
              <View style={{ flex: 1 }}>
                <Text style={s.callTitle}>
                  {place.category === 'food' ? t('Call the place', 'Gọi cho quán', 'お店に電話') : t('Call', 'Gọi điện', '電話する')}
                </Text>
                <Text style={s.infoValue}>{place.phone}</Text>
              </View>
              <LinearGradient {...gradAI} style={s.goBtn}>
                {/* accentInk, like every other glyph on the accent
                    gradient. This one was white — 2.7:1, and worse over the
                    orange end — and it was the last one left. */}
                <Ionicons name="arrow-forward" size={18} color={colors.accentInk} />
              </LinearGradient>
            </Pressable>
          )}

          {place.website && (
            <InfoCard
              icon="globe-outline"
              label={t('Website', 'Trang web', 'ウェブサイト')}
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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(10,8,13,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  counter: {
    position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(10,8,13,0.65)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6,
  },
  counterText: { color: onPhoto.text, fontSize: 12.5, fontWeight: font.semibold },
  dots: {
    position: 'absolute', bottom: 15, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(10,8,13,0.45)', borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotOn: { width: 8, height: 8, borderRadius: 4, backgroundColor: onPhoto.text },
  // Required attribution, kept quiet — see the note in PlaceCard.
  attr: {
    position: 'absolute', right: 12, bottom: 14, maxWidth: '55%',
    fontSize: 9, color: '#fff', opacity: 0.55,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },

  body: { paddingHorizontal: space.page, paddingTop: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // 26, not the 28 this was: the display face runs wider than the system
  // one, and place names are long enough to wrap without help.
  name: { color: colors.text, ...type.titleDetail },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  loc: { color: colors.textTertiary, ...type.meta },
  ratingBadge: {
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', gap: 3,
  },
  ratingValue: { color: colors.text, fontSize: 18, fontWeight: font.bold },
  ratingCount: { color: colors.textTertiary, fontSize: 12, fontWeight: font.regular },

  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginTop: 16 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { color: colors.textSecondary, fontSize: 14.5, fontWeight: font.medium },

  desc: { color: colors.textSecondary, ...type.body, lineHeight: 24, marginTop: 14 },
  divider: { height: 1, backgroundColor: colors.borderGlassSoft, marginVertical: 18 },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, padding: space.cardPadding, marginBottom: space.cardGap,
  },
  roundIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  infoLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4,
  },
  infoValue: { color: colors.textSecondary, ...type.meta, lineHeight: 22 },
  // Semibold and a size up on the rows under it: this is the answer, and
  // they are the working it was derived from.
  openNow: {
    color: colors.ok, fontSize: 15.5, fontWeight: font.semibold,
    marginBottom: 6,
  },
  openNowShut: { color: colors.textTertiary },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  hourDay: { color: colors.textSecondary, fontSize: 14.5, fontWeight: font.medium },
  hourTime: { color: colors.textSecondary, fontSize: 14.5, fontWeight: font.regular },
  callTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold, marginBottom: 2 },
  goBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
