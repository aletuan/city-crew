import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { coverOf, fmtCount, Place } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import PricePill from './PricePill';
import { Card, PressableScale } from './ui';

export default function PlaceCard({ place, onPress }: { place: Place; onPress: () => void }) {
  const { t } = useI18n();
  const cover = coverOf(place);
  const reviews = fmtCount(place.rating_count);
  return (
    <PressableScale onPress={onPress}>
      <Card style={s.card}>
        {cover ? (
          <View>
            <Image source={{ uri: cover.photo_uri }} style={s.photo} contentFit="cover" transition={200} />
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
          {place.rating ? (
            <Text style={s.ratingRow} numberOfLines={1}>
              <Text style={s.star}>★ </Text>
              <Text style={s.ratingValue}>{place.rating}</Text>
              {reviews ? <Text style={s.ratingCount}>  ({reviews})</Text> : null}
            </Text>
          ) : null}
          {place.vibe_tags.length > 0 && (
            <Text style={s.vibes} numberOfLines={1}>
              {place.vibe_tags.slice(0, 3).map((v) => v.replace('_', ' ')).join('   ')}
            </Text>
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
  // ~10% tighter than the standard card body: this is a feed, not a form.
  body: { paddingHorizontal: space.cardPadding, paddingVertical: 13 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, ...type.cardTitle },
  // Rating reads in three weights: a barely-there champagne star, a clear
  // value, a whispered count.
  ratingRow: { marginTop: 4 },
  star: { color: 'rgba(232,212,155,0.55)', fontSize: 13.5 },
  ratingValue: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  ratingCount: { color: colors.textTertiary, fontSize: 13, fontWeight: font.regular },
  // Categories are a whisper — plain lowered text, no chrome.
  vibes: { color: colors.textTertiary, fontSize: 12.5, fontWeight: font.regular, marginTop: 6 },
});
