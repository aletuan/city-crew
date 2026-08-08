import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { coverOf, fmtCount, isNew, Place } from '../lib/data';
import { distanceKm, fmtKm, useUserCoords } from '../lib/geo';
import { openState } from '../lib/hours';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import PricePill from './PricePill';
import { Card, PressableScale } from './ui';

export default function PlaceCard({ place, all, onPress }: {
  place: Place;
  /** The full list the card is rendered from — context for the New badge. */
  all?: Place[];
  onPress: () => void;
}) {
  const { t } = useI18n();
  const cover = coverOf(place);
  const reviews = fmtCount(place.rating_count);
  const open = openState(place.opening_hours);
  const coords = useUserCoords();
  const km = coords && place.lat && place.lng
    ? distanceKm(coords.lat, coords.lng, place.lat, place.lng)
    : null;
  // A distance only helps when the user is plausibly in town.
  const showKm = km !== null && km < 60;
  const fresh = all ? isNew(place, all) : false;

  return (
    <PressableScale onPress={onPress}>
      <Card style={s.card}>
        {cover ? (
          <View>
            <Image source={{ uri: cover.photo_uri }} style={s.photo} contentFit="cover" transition={200} />
            {fresh && (
              <View style={s.newPill}>
                <Text style={s.newPillText}>{t('NEW', 'MỚI', '新着')}</Text>
              </View>
            )}
            {cover.attribution_name ? <Text style={s.attr}>📷 {cover.attribution_name}</Text> : null}
          </View>
        ) : (
          <View style={[s.photo, s.photoFallback]}>
            <Text style={{ fontSize: 44 }}>{place.emoji ?? '📍'}</Text>
          </View>
        )}
        <View style={s.body}>
          <View style={s.topRow}>
            <Text style={s.name} numberOfLines={1}>{t(place.name_en, place.name_vi, place.name_ja)}</Text>
            <PricePill place={place} compact />
          </View>
          <Text style={s.meta} numberOfLines={1}>
            {t(place.neighborhood_en, place.neighborhood_vi, place.neighborhood_ja)}
            {place.rating ? `  ·  ★ ${place.rating}${reviews ? ` (${reviews})` : ''}` : ''}
          </Text>
          {(open !== 'unknown' || showKm) && (
            <Text style={s.liveRow} numberOfLines={1}>
              {open !== 'unknown' && (
                <Text style={open === 'open' ? s.openNow : s.closedNow}>
                  ● {open === 'open'
                    ? t('Open now', 'Đang mở cửa', '営業中')
                    : t('Closed', 'Đã đóng cửa', '営業時間外')}
                </Text>
              )}
              {open !== 'unknown' && showKm ? <Text style={s.kmText}>  ·  </Text> : null}
              {showKm ? <Text style={s.kmText}>{fmtKm(km!)}</Text> : null}
            </Text>
          )}
          {place.vibe_tags.length > 0 && (
            <View style={s.vibes}>
              {place.vibe_tags.slice(0, 3).map((v) => (
                <Text key={v} style={s.vibe}>{v.replace('_', ' ')}</Text>
              ))}
            </View>
          )}
        </View>
      </Card>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: space.page, marginBottom: space.cardGap },
  photo: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.surfaceGlass },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  attr: {
    position: 'absolute', right: 10, bottom: 8, fontSize: 9, color: '#fff', opacity: 0.75,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  newPill: {
    position: 'absolute', left: 10, top: 10,
    backgroundColor: 'rgba(10,11,10,0.65)', borderWidth: 1, borderColor: 'rgba(226,168,96,0.5)',
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3,
  },
  newPillText: { color: colors.ember, fontSize: 10.5, fontWeight: font.bold, letterSpacing: 1 },
  body: { padding: space.cardPadding },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, ...type.cardTitle },
  meta: { color: colors.textTertiary, ...type.meta, marginTop: 4 },
  liveRow: { marginTop: 5, fontSize: 13 },
  openNow: { color: colors.ember, fontSize: 13, fontWeight: font.semibold },
  closedNow: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium },
  kmText: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium },
  vibes: { flexDirection: 'row', gap: 6, marginTop: 9 },
  vibe: {
    color: colors.textSecondary, fontSize: 12, fontWeight: font.medium,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 2.5, overflow: 'hidden',
  },
});
