import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { coverOf, fmtCount, Place } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { vibeColor, vibeLabel } from '../lib/vibes';
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
        <View>
          {cover ? (
            <>
              <Image source={{ uri: cover.photo_uri }} style={s.photo} contentFit="cover" transition={200} />
              {cover.attribution_name
                ? <Text style={s.attr} numberOfLines={1}>{cover.attribution_name}</Text>
                : null}
            </>
          ) : (
            <View style={[s.photo, s.photoFallback]}>
              <Text style={{ fontSize: 44 }}>{place.emoji ?? '📍'}</Text>
            </View>
          )}
          {/* Price rides the photograph, out of the way of the name. */}
          <View style={s.priceSlot} pointerEvents="none">
            <PricePill place={place} overlay />
          </View>
        </View>
        <View style={s.body}>
          <Text style={s.name} numberOfLines={1}>{t(place.name_en, place.name_vi, place.name_ja)}</Text>
          {place.rating ? (
            <Text style={s.ratingRow} numberOfLines={1}>
              <Text style={s.star}>★ </Text>
              <Text style={s.ratingValue}>{place.rating}</Text>
              {reviews ? <Text style={s.ratingCount}>  ({reviews})</Text> : null}
            </Text>
          ) : null}
          {place.vibe_tags.length > 0 && (
            <View style={s.vibeRow}>
              {place.vibe_tags.slice(0, 3).map((v) => (
                <View key={v} style={s.vibeChip}>
                  <View style={[s.vibeDot, { backgroundColor: vibeColor(v) }]} />
                  <Text style={s.vibeText} numberOfLines={1}>{vibeLabel(v, t)}</Text>
                </View>
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
  // Google requires the photo's author attribution wherever the photo is
  // shown, so this cannot be dropped — only made to recede. The camera
  // glyph is gone (it read as a control), the type is smaller, and it is
  // capped at half the card so a long name can't cross the frame.
  attr: {
    position: 'absolute', right: 10, bottom: 8, maxWidth: '50%',
    fontSize: 8.5, color: '#fff', opacity: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  // ~10% tighter than the standard card body: this is a feed, not a form.
  body: { paddingHorizontal: space.cardPadding, paddingVertical: 13 },
  // Top-right of the image, mirroring the attribution bottom-right.
  priceSlot: { position: 'absolute', top: 10, right: 10 },
  name: { color: colors.text, ...type.cardTitle },
  // Rating reads in three weights: a barely-there accent star, a clear
  // value, a whispered count.
  ratingRow: { marginTop: 4 },
  star: { color: colors.accentFaint, fontSize: 13.5 },
  ratingValue: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  ratingCount: { color: colors.textTertiary, fontSize: 13, fontWeight: font.regular },
  // Vibes read as small glass pills, each carrying its own colour in a dot
  // only — the type stays neutral so the row scans without shouting.
  // One line, never wrapping, so every card keeps the same height.
  vibeRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, marginTop: 8 },
  vibeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
    backgroundColor: colors.surfaceGlass, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  vibeDot: { width: 6, height: 6, borderRadius: 3 },
  vibeText: { color: colors.textSecondary, fontSize: 12, fontWeight: font.medium },
});
