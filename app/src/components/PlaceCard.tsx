import React, { useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { fmtCount, Place, photosOf } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { vibeColor, vibeLabel } from '../lib/vibes';
import { colors, font, radius, space, type } from '../theme';
import PricePill from './PricePill';
import { Card, PressableScale } from './ui';

/** More than this on a feed card is scrolling for its own sake. */
const MAX_SLIDES = 6;

export default function PlaceCard({ place, onPress }: { place: Place; onPress: () => void }) {
  const { t } = useI18n();
  const photos = photosOf(place).slice(0, MAX_SLIDES);
  const reviews = fmtCount(place.rating_count);

  // Slide width is measured rather than derived from the window: the card's
  // margins and hairline border would each have to be subtracted by hand,
  // and a slide one point too wide makes paging drift a little further out
  // with every swipe.
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  // How many slides have been mounted as real images. A feed of cards that
  // each eagerly loaded six photos would pay for pictures almost nobody
  // swipes to, so the rest stay empty until a finger arrives.
  const [mounted, setMounted] = useState(1);

  const carousel = photos.length > 1 && width > 0;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const reveal = (upTo: number) => setMounted((m) => Math.max(m, upTo));
  const current = photos[Math.min(index, photos.length - 1)];

  return (
    <PressableScale onPress={onPress}>
      <Card style={s.card}>
        <View onLayout={onLayout}>
          {photos.length === 0 ? (
            <View style={[s.photo, s.photoFallback]}>
              <Text style={{ fontSize: 44 }}>{place.emoji ?? '📍'}</Text>
            </View>
          ) : carousel ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              // Touching the strip is enough of a signal to load the
              // neighbour, so the next slide is ready before it is needed.
              onScrollBeginDrag={() => reveal(index + 2)}
              onMomentumScrollEnd={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / width);
                setIndex(i);
                reveal(i + 2);
              }}
            >
              {photos.map((ph, i) => (
                i < mounted
                  ? <Image key={ph.photo_uri} source={{ uri: ph.photo_uri }} style={[s.photo, { width }]} contentFit="cover" transition={200} />
                  : <View key={ph.photo_uri} style={[s.photo, { width }]} />
              ))}
            </ScrollView>
          ) : (
            <Image source={{ uri: photos[0].photo_uri }} style={s.photo} contentFit="cover" transition={200} />
          )}
          {/* Credit follows the photo on screen, not the cover. */}
          {current?.attribution_name ? <Text style={s.attr}>📷 {current.attribution_name}</Text> : null}
          {photos.length > 1 && (
            <View style={s.dots} pointerEvents="none">
              {photos.map((ph, i) => (
                <View key={ph.photo_uri} style={[s.dot, i === index && s.dotOn]} />
              ))}
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
  attr: {
    position: 'absolute', right: 10, bottom: 8, fontSize: 9, color: '#fff', opacity: 0.75,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  // ~10% tighter than the standard card body: this is a feed, not a form.
  body: { paddingHorizontal: space.cardPadding, paddingVertical: 13 },
  // Top-right of the image, mirroring the attribution bottom-right.
  priceSlot: { position: 'absolute', top: 10, right: 10 },
  // Same dot language as the detail gallery, one size down. The pill behind
  // them is what makes a white dot survive a bright photograph.
  dots: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(10,8,13,0.40)', borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 6,
  },
  dot: { width: 5.5, height: 5.5, borderRadius: 2.75, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotOn: { width: 6.5, height: 6.5, borderRadius: 3.25, backgroundColor: '#fff' },
  name: { color: colors.text, ...type.cardTitle },
  // Rating reads in three weights: a barely-there champagne star, a clear
  // value, a whispered count.
  ratingRow: { marginTop: 4 },
  star: { color: 'rgba(232,212,155,0.55)', fontSize: 13.5 },
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
