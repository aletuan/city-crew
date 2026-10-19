// Motion that honours Reduce Motion: the loop, the arrival, and the
// setting itself.

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * Whether the reader has asked the system to calm things down.
 *
 * The web equivalent is `prefers-reduced-motion`, which is a media query
 * and updates itself. This does not, so it is read once and then watched:
 * the setting can be turned on *while* a screen is animating, which is
 * precisely when somebody reaches for it.
 *
 * Shared rather than read per component, because the first version of the
 * sketching screen had the orb honouring it and the step rows beside it
 * carrying on — half a screen obeying the reader is worse than none of it,
 * since it looks like the setting is broken rather than unsupported.
 */
export function useReducedMotion(): boolean {
  const [on, setOn] = React.useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setOn(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => { live = false; sub.remove(); };
  }, []);
  return on;
}

/**
 * A value looping 0 → 1 forever, or held at rest.
 *
 * The two animations this screen needs — a rotation and a breath — differ
 * only in what they map the number onto, so the loop itself is written
 * once. `useNativeDriver` throughout: every consumer drives `transform` or
 * `opacity`, and the JS thread is about to be busy.
 */
export function useLoop(ms: number, still: boolean, mode: 'linear' | 'inOut' = 'linear') {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { v.setValue(0); return; }
    const step = (toValue: number) => Animated.timing(v, {
      toValue,
      duration: mode === 'linear' ? ms : ms / 2,
      easing: mode === 'linear' ? Easing.linear : Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    // Linear runs 0 → 1 and snaps back, which is invisible on a rotation.
    // Eased has to come back down, or the breath would jerk at the top.
    const loop = Animated.loop(mode === 'linear' ? step(1) : Animated.sequence([step(1), step(0)]));
    loop.start();
    return () => { loop.stop(); v.setValue(0); };
  }, [ms, still, mode, v]);
  return v;
}

/**
 * A value that runs 0 → 1 once, when the thing it animates first appears.
 *
 * The counterpart to `useLoop`: that one is for motion that says "still
 * working", this one for motion that says "here". Four of these had been
 * written by hand — two in the sketch screen's feed, two more in the plan
 * list — as the same `Animated.Value`, the same `useEffect`, the same
 * `useNativeDriver`, differing only in the numbers and in which property
 * they drove. The timing is what they shared, so the timing is what this
 * holds; the caller still says what moves, by interpolating.
 *
 * `still` parks it at 1 rather than at 0. An arrival held still has to be
 * the arrived state — a reader who asked for less motion wants the
 * content, not the absence of it, which is the way this is easy to get
 * backwards.
 *
 * It does not re-run. A component that should arrive again is one that
 * remounted, and a `key` says that more honestly than a dependency does.
 */
export function useArrival(ms: number, delay: number, still: boolean) {
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) { v.setValue(1); return; }
    const run = Animated.timing(v, {
      toValue: 1,
      duration: ms,
      delay,
      // Out, not inOut: a thing arriving decelerates into its place. An
      // ease-in start makes the same move look like it is being pushed.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
    // Mount only — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}
