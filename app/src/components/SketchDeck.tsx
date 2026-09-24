// The places going into the day, arriving one at a time.
//
// This sits where the spinner used to. A ring says "working"; three
// covers say what is being worked on, out of the plan the screen has
// already computed — so the wait shows its material rather than its
// existence.
//
// ── what it is not ──
//
// It is not the answer. The heading above it still says the day is being
// sketched and the list below it still has a step running; these are the
// places going in, in the order the plan puts them, not a result to act
// on. Nothing here is tappable, for that reason.
//
// ── where the places come from ──
//
// The caller's, not its own. `SketchingScreen` already holds `plans` and
// this takes the stops of the first one — no fetch, no planning, no
// state. A component that went looking for its own places could disagree
// with the screen around it, which is the whole reason this one cannot.

import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useArrival } from './ui';
import { coverOf, type Place } from '../lib/data';
import { colors, font, radius } from '../theme';

/** Three at most. A fourth would shrink all of them below reading size. */
const MAX = 3;
/** One card's arrival, and the gap before the next one starts. */
const IN_MS = 300;
const STEP_MS = 400;
/** How far the middle card stands above its neighbours. */
const LIFT = 12;

/**
 * A place, face up.
 *
 * Cover and name, and deliberately nothing else: a rating or a category
 * here would be a card the reader wants to act on, on a screen where
 * there is nothing yet to act on.
 */
function Card({ place, nth, of: count, still }: {
  place: Place; nth: number; of: number; still: boolean;
}) {
  // Always animated, even under Reduce Motion — what that setting turns
  // off is the travel below, not the fade. This app has said so before:
  // see `GradientCta`, "fade is not motion". A card that blinks into
  // existence is the thing the setting is meant to prevent.
  const arrive = useArrival(IN_MS, nth * STEP_MS, false);
  const cover = coverOf(place);
  // Fanned from the centre, so one card sits straight, two lean apart and
  // three read as a hand laid down. Three degrees is the whole effect:
  // enough that the edges are not parallel, little enough that no name
  // looks crooked.
  const tilt = (nth - (count - 1) / 2) * 3;

  return (
    <Animated.View
      style={[
        s.card,
        count === MAX && nth === 1 && { marginBottom: LIFT },
        { opacity: arrive },
        !still && {
          transform: [
            { translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            { scale: arrive.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            { rotate: `${tilt}deg` },
          ],
        },
        still && { transform: [{ rotate: `${tilt}deg` }] },
      ]}
    >
      {cover
        ? <Image source={{ uri: cover.photo_uri }} style={s.photo} contentFit="cover" />
        : <View style={[s.photo, s.photoOff]} />}
      <Text style={s.name} numberOfLines={1}>{place.name_en}</Text>
    </Animated.View>
  );
}

export default function SketchDeck({ places, still }: {
  /** The stops of the plan being drawn. Only the first three are shown. */
  places: readonly Place[];
  /** The reader asked for less motion; the cards fade without travelling. */
  still?: boolean;
}) {
  const shown = places.slice(0, MAX);
  // The height is held whether or not there is anything to hold it, so
  // the heading under it does not jump when the catalog lands.
  return (
    <View style={s.deck}>
      {shown.map((place, i) => (
        <Card key={place.slug} place={place} nth={i} of={shown.length} still={!!still} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  // `flex-end` so the lifted middle card rises out of a common floor
  // rather than the others dropping. The minimum is the tallest a card
  // gets plus its lift, which is what keeps the layout still while the
  // catalog is still coming.
  deck: {
    alignSelf: 'stretch', minHeight: 104,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10,
  },
  // `flex: 1` with a ceiling: three cards have to fit a 320pt phone as
  // well as they fit a 430pt one, and a fixed width fits exactly one of
  // those.
  card: {
    flex: 1, maxWidth: 108,
    backgroundColor: colors.bgElevated, borderRadius: radius.card, padding: 6, gap: 5,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  // 4:3, so the height follows whatever width the row settled on.
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card - 6 },
  // The same fill every other card in the app shows for a place with no
  // photo — see `MapPlaceCard`.
  photoOff: { backgroundColor: colors.surfaceGlass },
  // 13, which is the caption size the screens that need one write for
  // themselves — `type` stops at `meta` (15). Semibold because it is the
  // only word on the card and has to hold against the photo above it.
  name: {
    fontSize: 13, color: colors.text, fontWeight: font.semibold,
    textAlign: 'center', paddingHorizontal: 2,
  },
});
