import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { coverOf, fmtCount, Place } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import { Card } from './ui';

export default function PlaceCard({ place, onPress }: { place: Place; onPress: () => void }) {
  const { t } = useI18n();
  const cover = coverOf(place);
  const reviews = fmtCount(place.rating_count);
  return (
    <Pressable onPress={onPress}>
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
            <Text style={s.name} numberOfLines={1}>{t(place.name_en, place.name_vi)}</Text>
            {place.price_display ? <Text style={s.price}>{place.price_display}</Text> : null}
          </View>
          <Text style={s.meta} numberOfLines={1}>
            {t(place.neighborhood_en, place.neighborhood_vi)}
            {place.rating ? `  ·  ★ ${place.rating}${reviews ? ` (${reviews})` : ''}` : ''}
          </Text>
          {place.vibe_tags.length > 0 && (
            <View style={s.vibes}>
              {place.vibe_tags.slice(0, 3).map((v) => (
                <Text key={v} style={s.vibe}>{v.replace('_', ' ')}</Text>
              ))}
            </View>
          )}
        </View>
      </Card>
    </Pressable>
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
  body: { padding: space.cardPadding },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, ...type.cardTitle },
  price: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  meta: { color: colors.textTertiary, ...type.meta, marginTop: 4 },
  vibes: { flexDirection: 'row', gap: 6, marginTop: 9 },
  vibe: {
    color: colors.textSecondary, fontSize: 12, fontWeight: font.medium,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 2.5, overflow: 'hidden',
  },
});
