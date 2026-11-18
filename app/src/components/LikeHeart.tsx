// The heart of a collection: the one button that likes it, wherever it is
// drawn.
//
// ── one heart (owner, 18 Nov 2026) ──
//
// Four screens each wrote this out: a list's own page, a card in a
// person's activity, Explore's shelf and the Collections tab's tiles.
// They had drifted the way four copies do — 15pt here and 20 there, the
// accent when liked on one and the colour for deleting things on another
// — and were brought level by hand the day before this. The owner then
// asked for what every app a reader has used does when a heart is
// pressed: it moves, and the number moves. Four copies of an animation
// would drift faster than four copies of a glyph, so this is the one.
//
// What a caller still owns: where the button stands and how its row is
// laid out (`style`, `contentStyle`, `hitSlop`), the type its tally is
// set in (`countStyle`), and what a press does. What is here: the glyph,
// its two sizes and inks (`tone`), the tally's rule (`likesWorthShowing`),
// what VoiceOver hears, and the motion.
//
// ── the motion ──
//
// Liked: the heart swells to `POP_PEAK` and settles back, as Instagram's
// and Threads' do.
// Unliked: nothing. Taking a like back is not an occasion.
// The tally: the old figure slides out and the new one in, upward when
// it grew and downward when it fell — X's counter. A figure arriving at
// one, or leaving at zero, slides the same way with nothing opposite it.
//
// No burst, no particles (X, TikTok): louder than anything else this app
// does, for the act it wants to be most casual.
//
// ── only for the reader's own press ──
//
// The same props change when nobody pressed anything: the tallies arrive
// from the server a moment after a shelf is drawn, a like made on another
// screen shows here, and a refresh brings what other people did. If each
// of those moved, opening Explore would be twenty hearts counting up. So
// a change is animated only when it lands within `PRESS_WINDOW_MS` of a
// press on this very button; any other change is drawn at once, as all
// of them were. The provider answers a press optimistically in the same
// tick (`catalog.toggleLike`), so the window is generous at a second.
//
// A press that changes nothing — signed out, the tap is the invitation to
// sign in — moves nothing, since nothing changed.
//
// ── Reduce Motion ──
//
// Everything above is off, and the heart and the tally change at once
// (`useReducedMotion`, the app's one reading of the setting).
//
// ── the numbers ──
//
// Judged by eye on the owner's phone, not timed: `Animated` does not
// tick where the tests run. The note above the constants has the first
// set and why it was wrong.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type Insets, type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import { PressableScale } from './ui/controls';
import { Glyph, ICON, type IconSize } from './ui/glyph';
import { useReducedMotion } from './ui/motion';
import { useI18n } from '../lib/i18n';
import { likesWorthShowing } from '../lib/likes';
import { colors, onPhoto } from '../theme';

// ── tuned once, on the owner's phone (18 Nov 2026) ──
//
// The first numbers were 1.25, a spring with a bounce of 12, and a tally
// that slid 10pt in 180ms on an ease-out cubic. On the phone: "the heart
// bounces a little too hard, the number goes a little too fast". Why,
// looked at afterwards:
//
//   - the swell multiplies the press. The button has already sunk to
//     0.82 under the thumb, so 1.25 was a swing from 0.82 to 1.25 — over
//     half the heart's size, not the quarter the number says;
//   - a bounce of 12 carries the heart back past its size and out again,
//     a second beat nobody's heart has;
//   - an ease-out cubic covers half its distance in the first fifth of
//     its time: 180ms read as under 100, and the figure leaving was gone
//     before it was seen to leave;
//   - both were squeezed into a quarter second for fear of feeling slow.
//     X plays its heart over 0.8s (a 29-frame sprite). A like is worth
//     being seen.

/** How far the heart swells: 1.12. From the press's 0.82 that is a
 *  swing of 0.30, where 1.25 made it 0.43. */
export const POP_PEAK = 1.12;
/** The swell: 110ms out, then a spring home that settles once (no
 *  bounce). */
const POP_UP_MS = 110;
/** The tally's slide: 320ms, eased at both ends so the figure leaving
 *  is seen to start and the one arriving is seen to land. */
const ROLL_MS = 320;
/** How far a figure travels: 14pt, most of the 15pt line it is set in —
 *  far enough to read as a figure passing, where 10 read as a flicker. */
const ROLL_DY = 14;
/** How long after a press a change is taken to be that press's. */
export const PRESS_WINDOW_MS = 1000;

/**
 * Where the heart stands, which decides its size and its two inks.
 *
 * `card`: on a card's ground — 18, a control's step, the secondary grey, `colors.like`
 * when liked (`collectionDetail/styles`, `ACT_GLYPH`, has the argument).
 * `photo`: over a photograph — 15, the step below, white, the accent as it is drawn on
 * photographs; a tile has no room for more and white on a picture needs
 * no help.
 */
export type HeartTone = 'card' | 'photo';
type Ink = NonNullable<React.ComponentProps<typeof Glyph>['color']>;
const TONE: Record<HeartTone, { size: IconSize; on: Ink; off: Ink }> = {
  card: { size: ICON.action, on: colors.like, off: colors.textSecondary },
  photo: { size: ICON.text, on: onPhoto.accent, off: onPhoto.text },
};

/**
 * Which way the tally slides: up (1) when it grew, down (-1) when it
 * fell. The figure leaving goes that way and the one arriving follows
 * it.
 */
export function rollWay(before: number, after: number): 1 | -1 {
  return after > before ? 1 : -1;
}

export default function LikeHeart({
  liked, count, onPress, tone = 'card', brief = false, countStyle, style, contentStyle, hitSlop, testID, countTestID,
}: {
  liked: boolean;
  /** Every like the list has; printed from one up (`likesWorthShowing`). */
  count: number;
  onPress: () => void;
  tone?: HeartTone;
  /** "Like" where the list is the page's subject; "Like this collection"
   *  where the heart is one of many on the screen. */
  brief?: boolean;
  countStyle: StyleProp<TextStyle>;
  /** The button in its parent, and its own row — as `PressableScale`. */
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  hitSlop?: Insets;
  testID?: string;
  countTestID?: string;
}) {
  const { t } = useI18n();
  const still = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const roll = useRef(new Animated.Value(1)).current;
  const pressedAt = useRef(0);
  const was = useRef({ liked, count });
  // The figure on its way out, and which way — while the tally slides.
  const [leaving, setLeaving] = useState<{ n: number; way: 1 | -1 } | null>(null);

  useEffect(() => {
    const before = was.current;
    was.current = { liked, count };
    // Somebody else's change, or the server's: drawn at once.
    if (still || Date.now() - pressedAt.current >= PRESS_WINDOW_MS) return;
    if (liked && !before.liked) {
      Animated.sequence([
        Animated.timing(pop, { toValue: POP_PEAK, duration: POP_UP_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, speed: 12, bounciness: 0, useNativeDriver: true }),
      ]).start();
    }
    if (count !== before.count) {
      setLeaving({ n: before.count, way: rollWay(before.count, count) });
      roll.setValue(0);
      Animated.timing(roll, { toValue: 1, duration: ROLL_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
        .start(() => setLeaving(null));
    }
  }, [liked, count, still, pop, roll]);

  const ink = TONE[tone];
  const shown = likesWorthShowing(count);
  const out = leaving && likesWorthShowing(leaving.n) ? leaving : null;
  const way = leaving?.way ?? 1;
  return (
    <PressableScale
      style={style}
      contentStyle={contentStyle}
      scaleTo={0.82}
      // The caller's press fires its own, once it knows the like is real.
      haptic="none"
      hitSlop={hitSlop}
      onPress={() => { pressedAt.current = Date.now(); onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked
        ? brief
          ? t('Unlike', 'Bỏ thích', 'いいねを取り消す', '取消点赞', '取消按讚')
          : t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す', '取消点赞这个合集', '取消按讚這個合集')
        : brief
          ? t('Like', 'Thích', 'いいね', '点赞', '按讚')
          : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね', '点赞这个合集', '按讚這個合集')}
      testID={testID}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Glyph name={liked ? 'heart' : 'heart-outline'} size={ink.size} color={liked ? ink.on : ink.off} />
      </Animated.View>
      {leaving ? (
        // Sliding: the figure leaving and the one arriving, clipped to
        // one line. The one arriving holds the line's width; with none
        // arriving (the last like taken back) the one leaving does.
        <View style={st.roll} testID="like-count-rolling">
          {out ? (
            <Animated.Text
              style={[countStyle, shown ? st.over : null, {
                opacity: roll.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [0, -way * ROLL_DY] }) }],
              }]}
            >
              {out.n}
            </Animated.Text>
          ) : null}
          {shown ? (
            <Animated.Text
              style={[countStyle, {
                opacity: roll,
                transform: [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [way * ROLL_DY, 0] }) }],
              }]}
              testID={countTestID}
            >
              {count}
            </Animated.Text>
          ) : null}
        </View>
      ) : shown ? <Text style={countStyle} testID={countTestID}>{count}</Text> : null}
    </PressableScale>
  );
}

const st = StyleSheet.create({
  roll: { overflow: 'hidden' },
  // The figure leaving, laid over the one arriving rather than beside it.
  over: { position: 'absolute', left: 0, top: 0 },
});
