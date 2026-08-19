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

  const report = useCallback((y: number, maxY?: number) => {
    const decision = tracker.report(y, maxY);
    if (decision) setTo(decision === 'hide');
  }, [tracker, setTo]);

  const show = useCallback(() => {
    tracker.reset();
    setTo(false);
  }, [tracker, setTo]);

  const value = useMemo(
    () => ({ anim, ducked, report, show }),
    [anim, ducked, report, show],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTabBarDuck(): Duck {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTabBarDuck outside TabBarDuckProvider');
  return v;
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
