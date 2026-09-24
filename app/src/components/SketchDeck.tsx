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

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useArrival } from './ui';
import { coverOf, type Place } from '../lib/data';
import { colors, font, radius } from '../theme';

/** One card's arrival, and the gap before the next one starts.
 *
 *  Two staggers, because the deck has two jobs. Showing one plan it has
 *  the whole wait, and 400 apart is an unhurried deal. Showing three it
 *  has about a second and a half each, so 250 gets the set assembled in
 *  half of that and leaves the rest of it still. */
const IN_MS = 300;
const STEP_MS = 400;
const STEP_FAST_MS = 250;
/** The dissolve between one plan's places and the next one's. */
const SWAP_MS = 160;
/** How far the middle card stands above its neighbours. */
const LIFT = 12;

/**
 * A place, face up.
 *
 * Cover and name, and deliberately nothing else: a rating or a category
 * here would be a card the reader wants to act on, on a screen where
 * there is nothing yet to act on.
 */
function Card({ place, nth, of: count, still, step }: {
  place: Place; nth: number; of: number; still: boolean; step: number;
}) {
  // Always animated, even under Reduce Motion — what that setting turns
  // off is the travel below, not the fade. This app has said so before:
  // see `GradientCta`, "fade is not motion". A card that blinks into
  // existence is the thing the setting is meant to prevent.
  const arrive = useArrival(IN_MS, nth * step, false);
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
        count === 3 && nth === 1 && { marginBottom: LIFT },
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

export default function SketchDeck({ places, seq, span, still }: {
  /** The stops of the plan being drawn now. */
  places: readonly Place[];
  /**
   * Which plan these are. A change means a swap, and nothing else does —
   * the deck neither knows nor asks how the caller chose.
   */
  seq: number;
  /**
   * How many slots to hold, measured across every plan rather than this
   * one. A slot with nothing in it is an empty frame the same size as a
   * card, which is what keeps the row from re-laying itself out when a
   * three-stop day is followed by a two-stop one — on a narrow phone the
   * cap that hides that does not bind, and every card would jump wider.
   */
  span: number;
  /** The reader asked for less motion. */
  still?: boolean;
}) {
  // The places on screen, which lag the ones passed in by the length of
  // the dissolve. The only state here, and it is about drawing rather
  // than about planning: which set is currently up.
  const [shown, setShown] = useState(places);
  const fade = useRef(new Animated.Value(1)).current;
  const was = useRef(seq);

  useEffect(() => {
    if (was.current === seq) { setShown(places); return; }
    was.current = seq;
    // Out, swap, and let the cards fade themselves back in: their own
    // arrival re-runs on the new key, so a second fade here would be the
    // same move twice.
    //
    // The still path is for the reader who turns Reduce Motion on in the
    // middle of a wait. The caller holds `seq` at zero while it is on, so
    // that flip is the one moment the number changes and the answer is
    // "yes, but not like that": the places swap, without the dissolve.
    if (still) { setShown(places); return; }
    const out = Animated.timing(fade, {
      toValue: 0, duration: SWAP_MS, easing: Easing.in(Easing.quad), useNativeDriver: true,
    });
    out.start(({ finished }) => {
      // A dissolve that was stopped rather than run out is one a newer
      // swap has already taken over, or an unmount. Swapping here would
      // land the deck on the plan this fade set out for and not the one
      // the caller has since asked for.
      if (!finished) return;
      setShown(places);
      fade.setValue(1);
    });
    return () => out.stop();
  }, [seq, places, still, fade]);

  const cards = shown.slice(0, span);
  const stagger = seq > 0 || span < shown.length ? STEP_FAST_MS : STEP_MS;

  // The height is held whether or not there is anything to hold it, so
  // the heading under it does not jump when the catalog lands.
  return (
    <Animated.View style={[s.deck, { opacity: fade }]}>
      {Array.from({ length: Math.max(span, cards.length) }, (_, i) => {
        const place = cards[i];
        // An empty frame rather than nothing: it holds its share of the
        // row so the cards beside it keep their width.
        if (!place) return <View key={`slot-${i}`} style={s.slot} />;
        return (
          <Card
            // Keyed by the plan as well as the place, so a card that
            // appears in two plans arrives again rather than sitting
            // through the swap untouched.
            key={`${seq}-${place.slug}`}
            place={place}
            nth={i}
            of={cards.length}
            still={!!still}
            step={stagger}
          />
        );
      })}
    </Animated.View>
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
  // An empty slot: the same box a card occupies, drawing nothing.
  slot: { flex: 1, maxWidth: 108 },
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
