// The places going into the day, arriving one at a time, and changing as
// the screen works through the plans it has drawn.
//
// This sits where the spinner used to. A ring says "working"; three
// covers say what is being worked on — so the wait shows its material
// rather than its existence.
//
// ── what it is not ──
//
// It is not the answer. The heading above it still says the day is being
// sketched and the list below it still has a step running; these are the
// places going in, in the order the plan puts them, not a result to act
// on. Nothing here is tappable, for that reason.
//
// ── the frames hold still; the contents change ──
//
// The first version dissolved the whole deck and dealt the next set in
// from nothing. It was reported as a jerk, and it was one: the deck went
// to zero, then the cards came back one at a time, so for a quarter of a
// second the row was empty. Three white frames blinking out and back is
// a bigger movement than anything they contain.
//
// A slot keeps its box, its shadow and its lean for as long as the deck
// is up, and only what is inside it cross-fades. Nothing moves on a swap
// except a picture becoming another picture, which is also why a slot
// with nothing in it still draws its frame: the row's geometry is fixed
// by `span` before the first card arrives and does not move again.
//
// The assembly — the rise, the scale, the stagger — happens once, when a
// slot first appears. That is what it is for.
//
// ── the pictures are asked for before they are needed ──
//
// The swap was reported as a jerk on the second plan's first card, and
// it was not the fade: the fade was fine and the picture behind it was
// not there yet. A cover is only requested when something renders it, so
// the first card of a set was asking the network for a photo at the
// exact moment it was being uncovered, and what came back up was an
// empty frame that filled in a beat later.
//
// So the deck is handed the *next* plan's places as well, and asks for
// their covers while the current set is still standing — a second and a
// half of lead where there was none. Nothing extra is downloaded: these
// are the same files the next swap would have fetched anyway, moved
// earlier.
//
// `transition` on the image is the net under that, for the run where the
// lead was not enough: a bitmap that lands late fades in rather than
// appearing between two frames.
//
// ── where the places come from ──
//
// The caller's, not its own. `SketchingScreen` holds the plans and hands
// over one at a time. A component that went looking for its own places
// could disagree with the screen around it, which is the whole reason
// this one cannot.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useArrival } from './ui';
import { coverOf, type Place } from '../lib/data';
import { colors, font, radius } from '../theme';

/** A slot's first arrival, and the gap before the next slot starts. */
const IN_MS = 300;
const STEP_MS = 400;
/** A change of contents: down, swap at the bottom, back up. */
const OUT_MS = 140;
const BACK_MS = 220;
const SWAP_STEP_MS = 80;
/** How far the middle card stands above its neighbours. */
const LIFT = 12;

/**
 * One box in the row, and whatever is in it at the moment.
 *
 * `seen` lags `place` by the length of the dip, which is the point: the
 * picture is changed at the bottom of the fade, where the change cannot
 * be seen. Still the only state here, and it is about drawing rather
 * than about planning.
 */
function Slot({ place, nth, of: count, still }: {
  place: Place | undefined; nth: number; of: number; still: boolean;
}) {
  // Always animated, even under Reduce Motion — what that setting turns
  // off is the travel below, not the fade. This app has said so before:
  // see `GradientCta`, "fade is not motion". A card that blinks into
  // existence is the thing the setting is meant to prevent.
  const arrive = useArrival(IN_MS, nth * STEP_MS, false);
  const dip = useRef(new Animated.Value(1)).current;
  const [seen, setSeen] = useState(place);

  useEffect(() => {
    if (seen?.slug === place?.slug) return;
    if (still) { setSeen(place); return; }
    const out = Animated.timing(dip, {
      toValue: 0, duration: OUT_MS, delay: nth * SWAP_STEP_MS,
      easing: Easing.in(Easing.quad), useNativeDriver: true,
    });
    out.start(({ finished }) => {
      // Stopped rather than run out means a newer change has taken over,
      // or the deck has gone. Swapping here would put back the picture
      // this dip set out for and not the one now asked for.
      if (!finished) return;
      setSeen(place);
      Animated.timing(dip, {
        toValue: 1, duration: BACK_MS, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    });
    return () => out.stop();
    // `seen` is what the effect settles, not what it watches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.slug, still, nth, dip]);

  const cover = seen && coverOf(seen);
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
      {/* Inside the frame, so the box and its shadow never move. */}
      <Animated.View style={[s.face, { opacity: dip }]}>
        {seen ? (
          <>
            {cover
              ? (
                <Image
                  source={{ uri: cover.photo_uri }}
                  style={s.photo}
                  contentFit="cover"
                  transition={180}
                />
              )
              : <View style={[s.photo, s.photoOff]} />}
            <Text style={s.name} numberOfLines={1}>{seen.name_en}</Text>
          </>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

export default function SketchDeck({ places, next, span, still }: {
  /** The stops of the plan showing now. */
  places: readonly Place[];
  /**
   * The stops of the plan after this one, if there is one. Not drawn —
   * their covers are asked for now so that the swap has something to
   * show the instant it uncovers them.
   */
  next?: readonly Place[];
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
  const shown = places.slice(0, span);
  const slots = Math.max(span, shown.length);

  // Joined rather than passed as the array, which is fresh every render.
  const ahead = (next ?? []).slice(0, span)
    .map((pl) => coverOf(pl)?.photo_uri).filter((u): u is string => !!u).join(' ');
  useEffect(() => {
    if (!ahead) return;
    // Nothing waits on this and nothing breaks without it: a cache that
    // refuses is a swap back to how it used to be, not a failure.
    Image.prefetch(ahead.split(' ')).catch(() => {});
  }, [ahead]);
  // The height is held whether or not there is anything to hold it, so
  // the heading under it does not jump when the catalog lands.
  return (
    <View style={s.deck}>
      {Array.from({ length: slots }, (_, i) => (
        <Slot key={`slot-${i}`} place={shown[i]} nth={i} of={slots} still={!!still} />
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
    backgroundColor: colors.bgElevated, borderRadius: radius.card, padding: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  face: { gap: 5 },
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
