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

export default function MapPlaceCard({ place, distanceKm, now, onPress }: {
  place: Place;
  /** Null when there is no fix to measure from — the figure is then left
   *  out rather than written as zero. */
  distanceKm: number | null;
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
  const name = t(place.name_en, place.name_vi, place.name_ja ?? undefined);
  const facts = [
    place.rating != null ? `★ ${place.rating.toFixed(1)}${place.rating_count ? ` (${fmtCount(place.rating_count)})` : ''}` : null,
    distanceKm != null ? `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km` : null,
    hours,
  ].filter((f): f is string => !!f);

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={name} style={s.card}>
      {cover
        ? <Image source={{ uri: cover.photo_uri }} style={s.thumb} contentFit="cover" />
        : <View style={[s.thumb, { backgroundColor: colors.surfaceGlass }]} />}
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <Text style={s.facts} numberOfLines={1}>{facts.join(' · ')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, paddingRight: 14,
    backgroundColor: colors.bgElevated, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    marginHorizontal: space.page,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.card - 6 },
  body: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  facts: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },
});
