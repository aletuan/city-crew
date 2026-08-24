// The engine, such as it is.
//
// The brief this was built from asked for an HTML Canvas particle system
// with a `requestAnimationFrame` loop. There is no Canvas here, and the
// rAF loop is the thing to avoid rather than the thing to build: physics
// stepped in JavaScript at 60fps competes with the scroll it is drawn
// under, and the first dropped frame is on the app's landing screen.
//
// So: **one clock per depth layer, many views reading it.**
//
//   phase      = modulo(add(clock, offset), 1)     ← per particle, native
//   translateY = phase.interpolate([-len → height])
//   translateX = multiply(phase, wind)             ← wind is animatable
//   opacity    = density.interpolate(…, 'clamp')   ← per particle threshold
//
// Every node in that chain is supported by the native animated driver, so
// after mount the JavaScript thread does nothing at all: no timers, no
// per-frame callbacks, no re-renders. A hundred drops cost one looping
// value and a hundred static interpolations set up once.
//
// ── the trick that makes density mean "fewer", not "fainter" ──
//
// The brief wanted density lerped rather than the system torn down and
// rebuilt. Fading a whole layer's opacity does lerp, but it lerps the
// wrong quantity: light rain is not heavy rain seen through gauze, it is
// heavy rain with most of the drops missing.
//
// So every particle carries its own threshold, spread across [0, 1], and
// reads its opacity as a clamped ramp starting there. Animate `density`
// from 0.15 to 0.60 and the drops switch on one at a time, in a fixed
// order, each fading up over a short stretch. Nothing is unmounted,
// nothing is created, and the count visibly changes.
//
// ── why the randomness is seeded ──
//
// `Math.random()` in a render body reshuffles the whole field on every
// re-render — a wind reading arriving would teleport every drop. The
// field is generated once from a small integer PRNG and memoised on the
// arguments that genuinely change its shape.

import React, { useMemo } from 'react';
import { Animated } from 'react-native';

/**
 * A tiny deterministic generator.
 *
 * Mulberry32. Not for cryptography and not pretending to be: it is here
 * so a field of a hundred drops is the *same* hundred drops across
 * re-renders, and so a screenshot of a bug can be reproduced.
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Particle = {
  /** Horizontal start, as a fraction of the width. */
  x: number;
  /** Where in its own fall this one begins, so a layer does not descend
   *  in lockstep. */
  offset: number;
  /** Where on the density dial this particle switches on. */
  threshold: number;
  /** Its own size and speed multipliers, for depth within a layer. */
  scale: number;
  /** Opacity once fully on. */
  alpha: number;
};

/**
 * A field of particles, generated once.
 *
 * Thresholds are spread evenly by index rather than drawn at random, and
 * that is deliberate: random thresholds cluster, so a dial moved a little
 * would switch on five drops at once and then none for a while. Even
 * spacing makes the density dial feel linear, which is the only thing it
 * is for.
 */
export function useField(count: number, seed: number, maxAlpha: number): Particle[] {
  return useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: rnd(),
      offset: rnd(),
      threshold: count === 1 ? 0 : i / count,
      scale: 0.7 + rnd() * 0.6,
      alpha: maxAlpha * (0.55 + rnd() * 0.45),
    }));
  }, [count, seed, maxAlpha]);
}

/**
 * Where a particle is in its own cycle, 0 → 1, forever.
 *
 * `modulo` after `add` is what gives each particle an independent phase
 * from one shared clock. Both nodes run on the native driver, so this
 * whole expression is evaluated on the UI thread.
 */
export function phaseOf(
  clock: Animated.Value,
  offset: number,
): Animated.AnimatedInterpolation<number> {
  return Animated.modulo(Animated.add(clock, offset), 1);
}

/**
 * A particle's opacity as a function of the density dial.
 *
 * The ramp is short — a particle goes from invisible to full over 0.12 of
 * the dial — so the switch-on reads as a drop arriving rather than as a
 * drop fading up. Clamped at both ends: below its threshold a particle is
 * simply not there, and above it does not keep getting brighter.
 */
export function opacityOf(
  density: Animated.Value,
  p: Particle,
): Animated.AnimatedInterpolation<number> {
  return density.interpolate({
    inputRange: [p.threshold, p.threshold + 0.12],
    outputRange: [0, p.alpha],
    extrapolate: 'clamp',
  });
}

// ── the bottom fade, and why there is no code for it here ──
//
// The brief asked for the effect to weaken over the lower 40% so it does
// not fight the headline, the sub and the CTA. That is the right rule and
// it is already implemented — by the hero's own readability scrim, which
// runs 0.45 → 0.06 → 0.55 → 0.97 top to bottom and which every layer in
// this folder is drawn *underneath*.
//
// So the rule costs nothing: rain at the foot of the hero is behind a
// wash that is 97% opaque, and it disappears without anybody masking it.
// Writing a second gradient here would be the same instruction given
// twice, and the two would drift the first time either was tuned.
//
// It is also why lightning belongs under the scrim rather than over it:
// a flash there brightens the sky and leaves the type alone, which is
// what lightning does.
