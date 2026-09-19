// The one place the map is talking about, in a strip along its bottom
// edge: its photograph, its name, and the three facts a reader standing
// somewhere wants — how good, how far, how long it stays open.
//
// It knows nothing of the map. It takes a place and a distance somebody
// else worked out, so the same strip could sit under any picker.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { coverOf, fmtCount, type Place } from '../lib/data';
import { openFragment, openState, shutLabel } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

export default function MapPlaceCard({ place, distanceKm, tint, now, onPress }: {
  place: Place;
  /** Null when there is no fix to measure from — the figure is then left
   *  out rather than written as zero. */
  distanceKm: number | null;
  /** The colour this place's pin is wearing on the map, or null where it
   *  is wearing the map's ink. The card repeats it so the eye can walk
   *  from the card back to the pin it is talking about — the coral pin
   *  says "this one", and the mark says which of them it was. */
  tint: string | null;
  now: Date;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const cover = coverOf(place);
  // Open: `openFragment` speaks only when closing is within the hour, and
  // is silent otherwise. Shut: `shutLabel`. One of the two is null by
  // construction, so at most one fact about hours reaches the line —
  // the same split `PlaceCard` makes.
  const state = openState(place.opening_hours, now);
  const hours = state?.open ? openFragment(state, t) : shutLabel(state, t);
  const name = t(place.name_en, place.name_vi, place.name_ja);
  const ratingFact = place.rating ? `${place.rating.toFixed(1)}${place.rating_count ? ` (${fmtCount(place.rating_count)})` : ''}` : null;
  const distanceFact = distanceKm != null ? `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km` : null;
  const facts = [
    ratingFact ? `★ ${ratingFact}` : null,
    distanceFact,
    hours,
  ].filter((f): f is string => !!f);
  // The visual line carries a "★" glyph that screen readers should not
  // announce; speak the same facts as words so the listener hears name,
  // rating, distance, and hours without that confusing symbol.
  const spoken = [
    name,
    ratingFact ? t(`rated ${ratingFact}`, `đánh giá ${ratingFact}`, `評価 ${ratingFact}`) : null,
    distanceFact,
    hours,
  ].filter((f): f is string => !!f).join(', ');

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={spoken} containerStyle={s.gutter} style={s.card}>
      {cover
        ? <Image source={{ uri: cover.photo_uri }} style={s.thumb} contentFit="cover" />
        : <View style={[s.thumb, { backgroundColor: colors.surfaceGlass }]} />}
      <View style={s.body}>
        <View style={s.line}>
          {tint ? <View testID="place-tint" style={[s.dot, { backgroundColor: tint }]} /> : null}
          <Text style={s.name} numberOfLines={1}>{name}</Text>
        </View>
        <Text style={s.facts} numberOfLines={1}>{facts.join(' · ')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </PressableScale>
  );
}

const s = StyleSheet.create({
  // The inset lives on the outer Pressable (`containerStyle`), not the
  // animated inner view: that keeps the page gutters outside the tap
  // target, so a press beside the strip does not open the place.
  gutter: { marginHorizontal: space.page },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, paddingRight: 14,
    backgroundColor: colors.bgElevated, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.card - 6 },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // Small: it is a echo of the pin, not a second heading. No border, so
  // it reads as the same ink the pin is drawn in.
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  // `flexShrink: 1`, because the name now shares a row with the dot and
  // Yoga defaults shrink to 0 unlike CSS: without it a long name sizes to
  // its own content and runs under the chevron instead of truncating.
  name: { color: colors.text, fontSize: 15, fontWeight: font.semibold, flexShrink: 1 },
  facts: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },
});
