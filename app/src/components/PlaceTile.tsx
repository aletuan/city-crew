// A place as one square of a grid: its cover, and its name on the cover.
//
// ── why a tile and not a small card (owner, 22 Oct 2026) ──
//
// The collection screen draws its places as cards, a photograph a phone
// wide and five lines under it, which is two places a screen. The owner
// asked for the other way of looking at a list too, the way a photo app
// does: three to a row, so a list of twenty is a glance rather than ten
// scrolls. What a tile drops is everything a card says about the place —
// where, open till when, the rating, the save — because a grid is for
// recognising, and the place's own screen is one tap away.
//
// The name stays, on a dark band at the foot of the photograph. The
// reference had pictures alone, and eight bowls of phở in it: a grid of
// photographs alone is a grid of guesses as soon as the places are of a
// kind, which is what a list by theme is. One line, cut short when long:
// it names the place, it does not describe it.
//
// The photograph is the cover, the one the list's cards lead with, chosen
// by the desk for the whole place rather than a dish — so a grid of cafés
// is a grid of shopfronts. The owner took that over a second choice of
// photograph made for the grid alone (same day): one picture per place
// is one judgement to keep right, and a reader moving between the two
// views sees the same picture for the same place.
//
// The credit is the card's, smaller and in the top corner, since the name
// holds the foot: one photograph shown, one credit owed (`PhotoCredit`).

import React from 'react';
import { type GestureResponderEvent, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { coverOf, type Place } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { splitName } from '../lib/name';
import { colors, font, labelScaleCap, onPhoto, radius } from '../theme';
import PhotoCredit from './PhotoCredit';
import { PressableScale } from './ui';

export default function PlaceTile({ place, size, onPress, testID, style }: {
  place: Place;
  /** The tile's side, which the grid works out from the window. */
  size: number;
  onPress: (e: GestureResponderEvent) => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { lang } = useI18n();
  const cover = coverOf(place);
  const name = splitName(localized(place, 'name', lang)).title;
  return (
    // The card's press, so a tile gives under the thumb the way a card does.
    <PressableScale
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={[{ width: size, height: size }, style]}
      contentStyle={[s.tile, { width: size, height: size }]}
    >
      {cover ? (
        <>
          <Image
            source={{ uri: cover.photo_uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            recyclingKey={place.slug}
          />
          <PhotoCredit name={cover.attribution_name} style={s.attr} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, s.fallback]}>
          <Text style={s.emoji}>{place.emoji ?? '📍'}</Text>
        </View>
      )}
      {/* Dark from the foot up to a little over a third, which is the band
          a 12pt line and its padding need and no more: the photograph is
          the point of a grid, and a scrim that reached the middle would be
          a second picture laid over the first. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.62)']}
        style={s.scrim}
        pointerEvents="none"
      />
      <Text style={s.name} numberOfLines={1} maxFontSizeMultiplier={labelScaleCap}>{name}</Text>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  tile: { borderRadius: radius.input, overflow: 'hidden', backgroundColor: colors.surfaceGlass },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 32 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' },
  name: {
    position: 'absolute', left: 8, right: 8, bottom: 6,
    color: onPhoto.text, fontWeight: font.semibold, fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2,
  },
  attr: {
    position: 'absolute', right: 6, top: 5, maxWidth: '70%',
    fontSize: 8, color: onPhoto.text, opacity: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
});
