// The floating tab bar's scroll etiquette, as a context.
//
// Scrolling down is "I'm reading"; the bar slips below the edge and gives
// the content the whole screen. The first pull back up is "I'm going
// somewhere"; the bar returns.
//
// The *decision* lives in lib/duck.ts as a pure state machine, with the
// tests that pin down every way this once went wrong — the strobe, the
// bounce, the stale anchor after a tab change. This file owns only the
// React half: turning 'hide'/'show' edges into one native-driven
// animation, and honouring Reduce Motion by jumping instead of sliding.
//
// A context rather than per-screen state because the two halves live in
// different trees: the screens own the scroll views, the navigator owns
// the bar. Screens feed `useDuckOnScroll` to their onScroll; the bar
// animates from `anim` and stops taking taps while it is away.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { createDuckTracker } from '../lib/duck';

type Duck = {
  /** 0 = shown, 1 = ducked. Drive transforms off this, native-driven. */
  anim: Animated.Value;
  /** Mirror of the animated state, for pointerEvents and the like. */
  ducked: boolean;
  /** Feed a scroll offset in (and the scrollable's max offset, so the
   *  bottom bounce can be clamped out); the decision lives in lib/duck. */
  report: (y: number, maxY?: number) => void;
  /** Surface the bar regardless — navigation, sheets, anything modal.
   *  Stable identity: effects may depend on this without re-firing every
   *  time the bar moves. */
  show: () => void;
  /**
   * Keep the bar away until the returned release is called — for a
   * screen that puts something of its own at the foot of the page, where
   * the bar floats: the comments thread's field (18 Nov 2026), as
   * Threads hides its bar on a post's page. While anything holds, a
   * scroll does not bring the bar back and neither does `show`; the last
   * release does. Stable identity.
   */
  hold: () => () => void;
};

const Ctx = createContext<Duck | null>(null);

export function TabBarDuckProvider({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  const tracker = useRef(createDuckTracker()).current;
  const [ducked, setDucked] = useState(false);
  // Reduce Motion swaps the slide for an instant jump — the behaviour
  // stays, the animation goes, which is what the setting asks for.
  const reduceMotion = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { reduceMotion.current = v; })
      .catch(() => {});
  }, []);

  const setTo = useCallback((d: boolean) => {
    setDucked((prev) => {
      if (prev === d) return prev;
      if (reduceMotion.current) {
        anim.setValue(d ? 1 : 0);
      } else {
        Animated.timing(anim, {
          toValue: d ? 1 : 0,
          duration: 240,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }).start();
      }
      return d;
    });
  }, [anim]);

  // How many screens are holding the bar away — see `Duck.hold`. A
  // count, not a flag: a held screen pushed over another held screen
  // releases once, and the bar must stay away for the one beneath.
  const holds = useRef(0);

  const report = useCallback((y: number, maxY?: number) => {
    const decision = tracker.report(y, maxY);
    if (decision && holds.current === 0) setTo(decision === 'hide');
  }, [tracker, setTo]);

  const show = useCallback(() => {
    tracker.reset();
    if (holds.current === 0) setTo(false);
  }, [tracker, setTo]);

  const hold = useCallback(() => {
    holds.current += 1;
    setTo(true);
    let released = false;
    return () => {
      // Once: a blur and an unmount can both come for the same hold.
      if (released) return;
      released = true;
      holds.current -= 1;
      if (holds.current === 0) { tracker.reset(); setTo(false); }
    };
  }, [tracker, setTo]);

  const value = useMemo(
    () => ({ anim, ducked, report, show, hold }),
    [anim, ducked, report, show, hold],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTabBarDuck(): Duck {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTabBarDuck outside TabBarDuckProvider');
  return v;
}

/**
 * Whether the bar is away right now — for a screen that lends its dock
 * (`DockSlot`). False outside the provider rather than a throw: a pushed
 * screen read on its own, as in its tests, simply never gets the dock.
 */
export function useTabBarDucked(): boolean {
  return useContext(Ctx)?.ducked ?? false;
}

/**
 * The screen half: an onScroll handler for the tab-root scroll views.
 * Stable identity, so it is safe inside listeners created once. Returns
 * undefined outside the provider (a screen reused in a modal), where a
 * scroll should simply mean nothing to a bar that is not there.
 */
export function useDuckOnScroll():
  ((e: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined {
  const duck = useContext(Ctx);
  const report = duck?.report;
  return useMemo(
    () => (report
      ? (e) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        report(
          contentOffset.y,
          contentSize && layoutMeasurement
            ? contentSize.height - layoutMeasurement.height
            : undefined,
        );
      }
      : undefined),
    [report],
  );
}

/**
 * Hold the bar away while this screen is the one in front.
 *
 * From mount to unmount, less the time something is pushed over it: a
 * person's page opened from a comment has the bar, and coming back takes
 * it away again. Outside the provider (a screen rendered alone, as in
 * its tests) there is no bar to hold and this does nothing.
 */
export function useTabBarAway(navigation: {
  addListener: (event: 'focus' | 'blur', cb: () => void) => () => void;
}): void {
  const hold = useContext(Ctx)?.hold;
  useEffect(() => {
    if (!hold) return undefined;
    let release: (() => void) | null = hold();
    const offFocus = navigation.addListener('focus', () => { release ??= hold(); });
    const offBlur = navigation.addListener('blur', () => { release?.(); release = null; });
    return () => { offFocus(); offBlur(); release?.(); };
  }, [hold, navigation]);
}
