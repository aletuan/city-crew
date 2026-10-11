// Pulling a bottom sheet down to close it.
//
// Five sheets draw a handle — the theme, city and language sheets, About,
// and the Explore filter — and until 11 Oct 2026 none of them could be
// pulled: the handle promised a gesture that was not there, and the owner
// found it. This is that gesture, shared, so the five agree on when a pull
// is a pull and how far is far enough.
//
// The other sheets in the app (Save, Invite, the action sheets, sign-in,
// the legal and welcome sheets) draw no handle and so promise nothing;
// they still close on the dimmed screen above them, as all of these do.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, type PanResponderCallbacks, type PanResponderGestureState } from 'react-native';

/**
 * How far down a pull has to travel, in points, to close the sheet when it
 * is let go slowly. A third of the shortest of the five (the language
 * sheet, about 260pt) — the distance at which iOS's own sheets commit.
 */
export const DISMISS_DISTANCE = 80;
/** Or how fast it has to be travelling when let go, in points per ms: a
 *  flick closes from anywhere, as it does on iOS's own sheets. */
export const DISMISS_VELOCITY = 0.5;

/**
 * Whether a movement is a pull on the sheet rather than a tap on a row or
 * a sideways gesture: down, past a few points of finger jitter, and mostly
 * down. Upward movement is never one — the sheet has nowhere to go.
 */
export function wantsDrag(g: Pick<PanResponderGestureState, 'dx' | 'dy'>): boolean {
  return g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5;
}

/** Whether a pull that has been let go closes the sheet. */
export function dismisses(g: Pick<PanResponderGestureState, 'dy' | 'vy'>): boolean {
  return g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY;
}

/**
 * The responder's callbacks: the sheet follows the finger down (never up),
 * and on release either closes or springs home. Separate from the hook so
 * a test can play a gesture through them.
 */
export function dragCallbacks(drag: Animated.Value, close: () => void): PanResponderCallbacks {
  const home = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  return {
    // Capture, so a pull that starts on a row takes the gesture from the
    // row's press instead of ending in a tap.
    onMoveShouldSetPanResponderCapture: (_, g) => wantsDrag(g),
    onPanResponderMove: (_, g) => drag.setValue(Math.max(g.dy, 0)),
    onPanResponderRelease: (_, g) => (dismisses(g) ? close() : home()),
    onPanResponderTerminate: home,
  };
}

/**
 * The pull, for a sheet: `drag` to add to its translateY, and `handlers` to
 * spread on whatever part of it can be pulled. A sheet that scrolls puts
 * them on its handle and title only, so the list keeps its own gesture;
 * one that does not, on the whole sheet.
 */
export function useSheetDrag(visible: boolean, onClose: () => void) {
  const drag = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;
  // Closed by a pull, the sheet fades out where the finger left it; it is
  // put back before it opens again.
  useEffect(() => { if (visible) drag.setValue(0); }, [visible, drag]);
  const handlers = useMemo(
    () => PanResponder.create(dragCallbacks(drag, () => close.current())).panHandlers,
    [drag],
  );
  return { drag, handlers };
}
