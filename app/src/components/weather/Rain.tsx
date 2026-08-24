// Rain, in three depths.
//
// Not white diagonal lines, which is what a rain effect looks like when
// somebody has drawn what they know rain looks like rather than what a
// photograph of rain looks like. In a photograph rain is mostly *absence*
// of contrast: a slightly milky vertical smear, darker than the sky
// behind it as often as lighter, and almost never a clean bright stroke.
//
// So the drops here are pale, translucent, and thin. The brief's range —
// 0.10 to 0.28 — is the ceiling, and the near layer only reaches the top
// of it because a handful of drops are allowed to be the ones you notice.
//
// ── the three layers ──
//
//   far     many, 1pt wide, slowest, faintest    — the wall of rain
//   mid     fewer, 1.2pt, moderate               — the body of it
//   near    a handful, 1.6pt and longer, fastest — the drops you see
//
// Depth is carried by speed and opacity rather than by blur, because a
// View cannot be blurred cheaply here. The far layer buys its softness by
// being thin and faint enough that no single drop resolves; the near one
// buys its motion blur by being long and transparent. Both are
// approximations of the real cue and both are cheaper than the real cue.

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { opacityOf, phaseOf, useField } from './particles';
import { MAX_ANGLE, MAX_DRIFT } from '../../lib/weatherfx';

type LayerSpec = {
  count: number;
  /** Milliseconds for one full fall. Nearer is faster. */
  ms: number;
  width: number;
  /** Multiplies the base streak length. */
  length: number;
  alpha: number;
  /** How much of the wind this depth takes. Nearer drops cross more of
   *  the frame for the same wind, which is the parallax that sells it. */
  wind: number;
  seed: number;
};

const LAYERS: LayerSpec[] = [
  { count: 46, ms: 2100, width: 1, length: 0.75, alpha: 0.13, wind: 0.6, seed: 0x51ee },
  { count: 30, ms: 1500, width: 1.2, length: 1, alpha: 0.19, wind: 1, seed: 0x9a3c },
  { count: 12, ms: 1000, width: 1.6, length: 1.7, alpha: 0.26, wind: 1.5, seed: 0x2b77 },
];

/** How many drops the whole thing can ever draw. Named so the number is
 *  arguable: the brief said 50–200 for a hero and this is 88. */
export const RAIN_PARTICLES = LAYERS.reduce((n, l) => n + l.count, 0);

function RainLayer({ spec, width, height, length, density, wind, still }: {
  spec: LayerSpec;
  width: number;
  height: number;
  length: number;
  density: Animated.Value;
  wind: Animated.Value;
  still: boolean;
}) {
  const clock = useRef(new Animated.Value(0)).current;
  const field = useField(spec.count, spec.seed, spec.alpha);

  useEffect(() => {
    if (still) { clock.stopAnimation(); return; }
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: spec.ms,
        // Linear, and it must be: this value is read through a modulo, so
        // any easing would make the drops surge and stall once per cycle
        // — and worse, the discontinuity at the wrap would be visible as
        // every drop in the layer jerking at the same instant.
        easing: (t) => t,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => { loop.stop(); clock.setValue(0); };
  }, [clock, spec.ms, still]);

  // The drops themselves never re-render: `field` is memoised and every
  // animated value below is a node, not state. A wind reading arriving
  // animates `wind`; it does not touch this tree.
  const drops = useMemo(() => field.map((p, i) => {
    const phase = phaseOf(clock, p.offset);
    const len = length * spec.length * p.scale;
    return (
      <Animated.View
        key={i}
        style={{
          position: 'absolute',
          left: p.x * width,
          top: -len,
          width: spec.width,
          height: len,
          borderRadius: spec.width / 2,
          backgroundColor: '#FFFFFF',
          opacity: opacityOf(density, p),
          transform: [
            { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, height + len] }) },
            { translateX: Animated.multiply(phase, Animated.multiply(wind, spec.wind * p.scale)) },
            // The streak points along its own travel. Without this the
            // drops slide sideways while staying upright, which reads as
            // a scrolling texture rather than as rain.
            //
            // The endpoints are `windVector`'s own cap rather than a
            // number picked to look right: at maximum drift a drop
            // crosses `MAX_DRIFT` of the height, and `MAX_ANGLE` is the
            // angle that describes. Pick the rotation independently and
            // the streaks point somewhere the drops are not going —
            // which nobody names and everybody feels.
            {
              rotate: wind.interpolate({
                inputRange: [-height * MAX_DRIFT, 0, height * MAX_DRIFT],
                outputRange: [`-${MAX_ANGLE}deg`, '0deg', `${MAX_ANGLE}deg`],
                extrapolate: 'clamp',
              }),
            },
          ],
        }}
      />
    );
  }), [field, clock, density, wind, width, height, length, spec]);

  return <>{drops}</>;
}

/**
 * The whole rain system.
 *
 * `density` and `wind` are `Animated.Value`s owned by the caller and
 * eased towards their targets there, so a change in the weather moves a
 * number rather than remounting a field of drops. Nothing in here is
 * created or destroyed when the forecast changes.
 */
export default function Rain({ width, height, length, density, wind, still }: {
  width: number;
  height: number;
  length: number;
  density: Animated.Value;
  wind: Animated.Value;
  still: boolean;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {LAYERS.map((spec) => (
        <RainLayer
          key={spec.seed}
          spec={spec}
          width={width}
          height={height}
          length={length}
          density={density}
          wind={wind}
          still={still}
        />
      ))}
    </View>
  );
}
