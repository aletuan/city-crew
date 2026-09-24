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
// ── laid down, not lined up ──
//
// The row was three cards of equal height sitting on a common floor with
// a gap between each, the middle one twelve points proud and every card
// leaning three degrees. Tidy, and tidy was the fault: a rack, not a
// hand. Cards somebody has just put down on a table overlap, sit at
// angles that do not match, and hang at heights that do not mirror each
// other about the middle.
//
// So `lieOf` hangs them from a ceiling instead of standing them on a
// floor, leans them five degrees with an offset so none of them is quite
// straight, brings the slots past the middle up by twelve so no two share
// a baseline, and the cards overlap by twelve points rather than clearing
// each other by ten. The one that stands highest is the one in front.
//
// Behind all of it, `SketchTrail` — a dotted run with a pin at the end
// and a few loose strokes. Scenery: it joins nothing, measures nothing,
// and moves with nothing.
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
// is up, and only what is inside it changes. Nothing moves on a swap
// except a picture becoming another picture, which is also why a slot
// with nothing in it still draws its frame: the row's geometry is fixed
// by `span` before the first card arrives and does not move again.
//
// The assembly — the rise, the scale, the stagger — happens once, when a
// slot first appears. That is what it is for.
//
// ── nothing is ever uncovered, because nothing is ever covered ──
//
// Four reports of a jerk on the swap, and the last one located it: the
// picture *appearing* rather than the picture leaving. Three attempts had
// gone at the fade — lengthen it, stagger it wider, ride a little scale
// with it — and all three treated the symptom, because the fault was not
// the fade's shape. It was that there was a gap at all.
//
// The card dipped to nothing, the contents changed where the change could
// not be seen, and the card came back. But a change of contents is a new
// `expo-image` view, and a new view has to decode before it draws — so
// the decode landed part-way up the return, and the picture materialised
// while the card was already half-visible. That is not a fade that is too
// fast. That is a picture arriving after the frame that should have held
// it, and no duration fixes it.
//
// So the dip is gone. The card stays at full opacity through a swap and
// the picture dissolves into the next one *in place*, which is what
// `transition` on `expo-image` is: the view keeps the bitmap it has until
// the next one is ready and cross-fades between the two. There is no
// moment when the card is empty, so there is no moment for a decode to
// land badly in — a picture that is slow simply delays its own dissolve
// while the one before it stays up.
//
// #669 read the same property as a fault, and it was one *then*: the
// source was switched at the bottom of a dip, so an old-to-new blend ran
// while the card was hidden and was still running as the card came back,
// and what came up was two photos mixed. Keying the view by its uri
// stopped the blend by throwing the old view away. Removing the dip
// stops the collision instead — and the blend, no longer colliding with
// anything, is the effect. Hence no `key` here now.
//
// ── the word waits; the picture does not ──
//
// The two halves of a card move on different clocks and have to. A
// picture can dissolve because both bitmaps exist at once; a word cannot
// overlap another word legibly, so the name dips out, changes where the
// change cannot be read, and comes back — 200 down and 320 up, landing
// inside the picture's 520 so the label settles as the photo does.
//
// Text has none of the trouble the picture had: it needs nothing loaded,
// so its dip has no gap for anything to arrive late into.
//
// ── the pictures are asked for before they are needed ──
//
// The deck is handed the *next* plan's places as well and asks for their
// covers while the current set is still standing — a second and a half of
// lead. Nothing extra is downloaded: these are the same files the next
// swap would have fetched anyway, moved earlier.
//
// It matters less than it did, now that a slow picture costs a late
// dissolve rather than an empty frame. It is kept because a dissolve that
// starts on time is still better than one that waits.
//
// ── where the places come from ──
//
// The caller's, not its own. `SketchingScreen` holds the plans and hands
// over one at a time. A component that went looking for its own places
// could disagree with the screen around it, which is the whole reason
// this one cannot.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';
import { useArrival } from './ui';
import { coverOf, type Place } from '../lib/data';
import { useScheme } from '../lib/theme';
import { colors, font, radius } from '../theme';

/** A slot's first arrival, and the gap before the next slot starts. */
const IN_MS = 300;
const STEP_MS = 400;
/**
 * One picture becoming another, handed to `expo-image` as its own
 * cross-fade. Long, because it is the whole of the change now: there is
 * no travel and no frame going dark, only two photographs overlapping.
 */
export const CROSS_MS = 520;
/**
 * The first picture a slot ever draws, which fades from the fill behind
 * it rather than from another picture. Kept short so the assembly stays
 * crisp — that part of this screen was never what was reported.
 */
const FIRST_MS = 180;
/**
 * The name, which cannot overlap another name and be read. It leaves,
 * changes where the change cannot be seen, and comes back — inside the
 * picture's dissolve, so the two halves of a card settle together.
 */
export const NAME_OUT = 200;
export const NAME_IN = 320;
/**
 * The gap between one slot starting its change and the next.
 *
 * At 80 the three slots moved near enough together to read as one blink
 * of the whole row; at 140 they read as three things changing in order.
 *
 * A row therefore finishes a swap at 2 × 140 + 520 = 800ms, which is what
 * `DECK_HOLD_MS` has to stay clear of — the test below holds that.
 */
export const SWAP_STEP_MS = 140;
/** The band above the cards that the drawing has to itself. */
const SKY = 30;

/**
 * Where a card lies in the row.
 *
 * Fanned from the centre and hung from it: the middle card stands
 * highest and the ones beside it drop away, so three cards read as a
 * hand laid down rather than as three things in a rack.
 *
 * The drop is *not* symmetrical, and that is the whole of it. Mirrored
 * about the middle, a row is a diagram — the eye finds the axis, reads
 * the pattern, and stops looking. The slots past the middle come up
 * twelve points, which is enough that no two cards share a baseline and
 * little enough that the row still reads as one row.
 *
 * A formula rather than a table of three, so a row of any width lies the
 * same way. `deckSpan` caps the caller at three today; a table would
 * have had a fourth card falling out of the pattern the day that moved.
 */
export function lieOf(nth: number, count: number) {
  const mid = (count - 1) / 2;
  const out = Math.abs(nth - mid);
  const hang = Math.round(out * 26) - (nth > mid ? 12 : 0);
  return {
    hang,
    // Three degrees was the old fan and it was too polite to see under a
    // photograph. Five leans; the offset means no card in an odd row
    // stands perfectly straight, which is what separates a drawing from
    // a layout.
    tilt: (nth - mid) * 5 - 1,
    // The card that stands highest is the one in front. Derived from the
    // hang rather than set beside it, so the two can never disagree.
    over: 40 - hang,
  };
}

/** The drawing's ink: the reference's coral, brighter than the accent
 *  token is on paper, chosen against the drawing exactly as the welcome
 *  screen's heart was. See `welcomeArt`. */
const TRAIL_INK = { light: '#E8542F', dark: '#FF6F5B' } as const;
/** The trail's own grid. Drawn to a fixed box and stretched to whatever
 *  width the row turns out to be — a dashed line and five loose strokes
 *  have no proportion to keep, so this needs no measuring pass. */
const TRAIL_W = 340;
const TRAIL_H = 84;
/** Out from behind the first card, up over the gap, to the pin. */
const TRAIL = `M ${0.18 * TRAIL_W} ${0.90 * TRAIL_H}`
  + ` C ${0.31 * TRAIL_W} ${0.86 * TRAIL_H}, ${0.35 * TRAIL_W} ${0.26 * TRAIL_H}, ${0.60 * TRAIL_W} ${0.18 * TRAIL_H}`;
/** Two strokes off the left shoulder and three off the right — the same
 *  hand as the heart's, and the same thing they say: this is being drawn
 *  right now. */
const SPARKS = 'M 34 46 l -12 -8 M 27 62 l -13 -3'
  + ' M 300 26 l 12 -8 M 308 38 l 14 -3 M 309 50 l 12 5';

/**
 * What the cards are laid out on.
 *
 * A dotted run with a pin at the end of it, and a few loose strokes where
 * a hand would have flicked them. It is scenery and nothing else: it says
 * no distance, joins no two places, and moves with nothing — which is
 * exactly why it can be here. The deck's rule is that it must not look
 * like the answer, and a doodle is the one kind of mark that cannot be
 * mistaken for one.
 *
 * Stretched rather than measured. `preserveAspectRatio="none"` lets the
 * box be whatever the row is wide without a layout pass and without the
 * state one would need, and the cost is a dash that is a few percent
 * longer on a big phone than on a small one.
 *
 * The pin is a glyph rather than a path, because a glyph is the one thing
 * in here that would show the stretching.
 */
function SketchTrail() {
  const { scheme } = useScheme();
  const ink = TRAIL_INK[scheme];
  return (
    <View style={s.trail} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${TRAIL_W} ${TRAIL_H}`} preserveAspectRatio="none">
        <Path
          d={TRAIL}
          stroke={ink}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="1 11"
          fill="none"
          opacity={0.7}
        />
        <Path d={SPARKS} stroke={ink} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </Svg>
      <Ionicons name="location" size={20} color={ink} style={s.trailPin} />
    </View>
  );
}

/**
 * One box in the row, and whatever is in it at the moment.
 *
 * Two pieces of state, because the picture and the word move on
 * different clocks. `src` is what the picture has been asked for and
 * changes as soon as the slot's turn comes; `seen` is the word under it
 * and lags by the length of its own dip. Both are about drawing rather
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
  const [src, setSrc] = useState(place);
  const [seen, setSeen] = useState(place);
  const word = useRef(new Animated.Value(1)).current;
  // The first picture fades from the fill; every one after it dissolves
  // from the picture before it, which is a longer thing and a different
  // one. Set before the source that will be drawn with it.
  const swapped = useRef(false);

  useEffect(() => {
    if (seen?.slug === place?.slug) return;
    if (still) { setSrc(place); setSeen(place); return; }
    swapped.current = true;
    // The stagger is a timer rather than an animation delay because the
    // picture's half of the change is not an animation here: it is the
    // moment the source is handed over, and `expo-image` times the rest.
    const id = setTimeout(() => {
      setSrc(place);
      const out = Animated.timing(word, {
        toValue: 0, duration: NAME_OUT, easing: Easing.in(Easing.quad), useNativeDriver: true,
      });
      out.start(({ finished }) => {
        // Stopped rather than run out means a newer change has taken
        // over, or the deck has gone. Swapping here would put back the
        // name this dip set out for and not the one now asked for.
        if (!finished) return;
        setSeen(place);
        Animated.timing(word, {
          toValue: 1, duration: NAME_IN, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }).start();
      });
    }, nth * SWAP_STEP_MS);
    return () => { clearTimeout(id); word.stopAnimation(); };
    // `seen` is what the effect settles, not what it watches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.slug, still, nth, word]);

  const cover = src && coverOf(src);
  // A picture dissolves into another picture by itself. A slot filling
  // from empty, or emptying, has nothing to dissolve with — so there the
  // whole face borrows the word's fade, which is the only case left in
  // which this card ever goes dark.
  const alone = !src || !seen;
  // Where this one lies. Layout rather than motion, so Reduce Motion
  // keeps all of it: a card lying at an angle is not a card moving.
  const { hang, tilt, over } = lieOf(nth, count);

  return (
    <Animated.View
      style={[
        s.card,
        { marginTop: hang, zIndex: over, opacity: arrive },
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
      <Animated.View style={[s.face, alone && { opacity: word }]}>
        {/* No `key`. The view is meant to be the same one across a swap:
            keeping it is what lets it hold the picture it has while the
            next one loads, and dissolve rather than cut. */}
        {src
          ? (cover
            ? (
              <Image
                source={{ uri: cover.photo_uri }}
                style={s.photo}
                contentFit="cover"
                transition={swapped.current ? CROSS_MS : FIRST_MS}
              />
            )
            : <View style={s.photo} />)
          : null}
        {seen
          ? (
            <Animated.Text style={[s.name, !alone && { opacity: word }]} numberOfLines={1}>
              {seen.name_en}
            </Animated.Text>
          )
          : null}
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
      <SketchTrail />
      {Array.from({ length: slots }, (_, i) => (
        <Slot key={`slot-${i}`} place={shown[i]} nth={i} of={slots} still={!!still} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  // `flex-start`, because the cards hang from a common ceiling now rather
  // than standing on a common floor: `lieOf` says how far each one drops
  // and a floor would have fought it.
  //
  // The padding is the band the drawing has to itself, and the minimum is
  // the tallest a card gets plus the furthest one hangs plus that band —
  // which is what keeps the heading below from jumping while the catalog
  // is still coming.
  deck: {
    alignSelf: 'stretch', minHeight: 148, paddingTop: SKY,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
  },
  // The drawing sits in the band above the cards and reaches a little way
  // behind their tops, which is where the dotted run disappears.
  trail: { position: 'absolute', left: 0, right: 0, top: 0, height: TRAIL_H },
  trailPin: { position: 'absolute', left: '60%', top: 4, marginLeft: -10 },
  // `flex: 1` with a ceiling: three cards have to fit a 320pt phone as
  // well as they fit a 430pt one, and a fixed width fits exactly one of
  // those.
  //
  // The negative margin is the overlap. Laid cards touch; a row with a
  // gap down the middle of it is a row of three separate cards, which is
  // what this was and what the reference is not.
  card: {
    flex: 1, maxWidth: 108, marginHorizontal: -6,
    backgroundColor: colors.bgElevated, borderRadius: radius.card, padding: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  face: { gap: 5 },
  // 4:3, so the height follows whatever width the row settled on.
  //
  // The fill is under every photo, not only under the places that have
  // none. A picture that is not decoded yet draws nothing, and nothing
  // over an elevated card is a white hole the size of the photo; the
  // same grey every other card in the app shows for a place without one
  // — see `MapPlaceCard` — makes that moment a placeholder instead of a
  // flash, and it is covered the instant the bitmap lands.
  photo: {
    width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card - 6,
    backgroundColor: colors.surfaceGlass,
  },
  // 13, which is the caption size the screens that need one write for
  // themselves — `type` stops at `meta` (15). Semibold because it is the
  // only word on the card and has to hold against the photo above it.
  name: {
    fontSize: 13, color: colors.text, fontWeight: font.semibold,
    textAlign: 'center', paddingHorizontal: 2,
  },
});
