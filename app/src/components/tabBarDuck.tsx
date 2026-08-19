// The floating tab bar's scroll etiquette, as a context.
//
// Scrolling down is "I'm reading"; the bar slips below the edge and gives
// the content the whole screen. The first pull back up is "I'm going
// somewhere"; the bar returns. The same grammar as the desk's web bar, and
// the same guard rails: a few-pixel threshold so a wobbling thumb cannot
// flicker it, and the top of a screen always shows it — chrome hiding
// before you have scrolled anywhere reads as a glitch, not a courtesy.
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

type Duck = {
  /** 0 = shown, 1 = ducked. Drive transforms off this, native-driven. */
  anim: Animated.Value;
  /** Mirror of the animated state, for pointerEvents and the like. */
  ducked: boolean;
  /** Feed a scroll offset in (and the scrollable's max offset, so the
   *  bottom bounce can be clamped out); the direction logic lives here. */
  report: (y: number, maxY?: number) => void;
  /** Surface the bar regardless — navigation, sheets, anything modal. */
  show: () => void;
};

const Ctx = createContext<Duck | null>(null);

// Hysteresis, not a single threshold: travel accumulates per direction
// and resets when the direction flips, so a slow scroll or a bounce's
// alternating deltas cannot strobe the bar mid-animation. Hiding takes
// more conviction than returning — going away is a judgement, coming
// back is a reach.
/** Committed descent, in px, before the bar hides. */
const HIDE_TRAVEL = 24;
/** Committed ascent, in px, before it returns. */
const SHOW_TRAVEL = 12;
/** Within this many px of the top the bar never hides. */
const TOP_SLACK = 80;

export function TabBarDuckProvider({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [ducked, setDucked] = useState(false);
  const lastY = useRef(0);
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

  const travel = useRef(0);
  const report = useCallback((y: number, maxY?: number) => {
    // Overscroll is not a direction: clamp both ends so iOS's rubber band
    // hands the accumulator nothing.
    const clamped = Math.min(Math.max(0, y), maxY != null && maxY >= 0 ? maxY : Number.MAX_SAFE_INTEGER);
    const dy = clamped - lastY.current;
    lastY.current = clamped;
    if (dy === 0) return;
    travel.current = Math.sign(dy) === Math.sign(travel.current) ? travel.current + dy : dy;
    if (clamped <= TOP_SLACK || travel.current < -SHOW_TRAVEL) setTo(false);
    else if (travel.current > HIDE_TRAVEL) setTo(true);
  }, [setTo]);

  const show = useCallback(() => {
    lastY.current = 0;
    travel.current = 0;
    setTo(false);
  }, [setTo]);

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
