// The app's one way of saying "look here": a ring round a control, and a
// second ring that grows out of it and fades, three times, then stops.
//
// Drawn first for the guide's steps (owner, 22 Oct 2026, `SignupTour`),
// and lifted out here when the collection's ⋯ button needed the same
// mark for the grid notice the same day — the owner asked for the same
// highlight, and two copies of a pulse drift into two pulses.
//
// ── the pulse ──
//
// Three, and stopping, because motion that carries on is motion a reader
// has to look away from: WCAG 2.2.2 asks that anything moving for more
// than five seconds can be paused, and three of these come to 4.8. A
// pulse is 1.2 seconds out and 0.4 at rest, slow enough to read as a
// breath rather than an alarm. It grows by a quarter, which on the tab's
// 75×56 pill is about 9pt either side and 7 above and below, and on the
// 44pt ⋯ button about 6. These are the starting figures, to be judged on
// a phone. With Reduce Motion on there is no pulse at all: the ring
// already says where.
//
// Not a shake, which the reference for the ⋯ button drew: on iOS a
// sideways shake is a refused password, or an icon waiting to be moved.

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { useReducedMotion } from './ui';

const PULSES = 3;
const PULSE_MS = 1200;
const PULSE_REST_MS = 400;
const PULSE_GROWTH = 1.25;
/** How long the three pulses take, and how long a transient ring then
 *  takes to go. */
const PULSES_MS = PULSES * (PULSE_MS + PULSE_REST_MS);
const FADE_MS = 300;

/** Where a ring goes, in its parent's points. */
export type Frame = { left: number; top: number; width: number; height: number };

/** The ring itself: the accent's 2pt line, the pill's round ends. For an
 *  absolutely placed view, with a `Frame` beside it. */
export const attentionRing = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.accent, borderRadius: radius.pill },
}).ring;

/**
 * The pulse under a ring at `frame`: three times from when it mounts, and
 * again whenever `runKey` changes — a new guide step in the same place.
 * Nothing at all for a reader who asked for less motion.
 */
export function AttentionPulse({ frame, runKey, testID }: { frame: Frame; runKey?: unknown; testID?: string }) {
  const still = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(0);
    if (still) return;
    // Asked again before the first pulse: `useReducedMotion` answers
    // "no" until its own read lands, and a ring that appears with the
    // screen would otherwise start its pulse for a reader who asked for
    // none, and stop it a moment later.
    let live = true;
    let run: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      run = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(PULSE_REST_MS),
      ]), { iterations: PULSES });
      run.start();
    });
    return () => { live = false; run?.stop(); };
  }, [runKey, still, pulse]);
  if (still) return null;
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[attentionRing, frame, {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, PULSE_GROWTH] }) }],
      }]}
    />
  );
}

/**
 * A ring and its pulse round a control, at `frame`. Touches pass through
 * to the control underneath. The pulse runs again whenever `runKey`
 * changes: the screen coming back into view, for the ⋯ button.
 *
 * `transient`: the ring fades once its pulses are done, and comes back
 * with them when `runKey` changes (owner, 22 Oct 2026). For a ring beside
 * something that already says what it points to — the ⋯ button's, under
 * the grid notice — where a still ring after the pulse only weighs on the
 * corner. Not for the guide's: there the ring is the control to press and
 * the whole of the step. The fade is not motion, so it runs under Reduce
 * Motion too, after the same few seconds of still ring.
 */
export function AttentionRing({ frame, runKey, transient = false, testID }: {
  frame: Frame; runKey?: unknown; transient?: boolean; testID?: string;
}) {
  const shown = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    shown.setValue(1);
    if (!transient) return;
    const fade = Animated.timing(shown, { toValue: 0, delay: PULSES_MS, duration: FADE_MS, useNativeDriver: true });
    fade.start();
    return () => fade.stop();
  }, [runKey, transient, shown]);
  return (
    <>
      <AttentionPulse frame={frame} runKey={runKey} testID={testID && `${testID}-pulse`} />
      <Animated.View testID={testID} pointerEvents="none" style={[attentionRing, frame, { opacity: shown }]} />
    </>
  );
}
