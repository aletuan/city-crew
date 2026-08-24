// Snow.
//
// The failure mode here is Christmas: big round white dots falling
// straight down at one speed. Real snow is sparse, varied and slow, and
// most of what tells you it is snow rather than dust is that individual
// flakes drift *sideways and back* as they fall rather than tracking a
// line.
//
// So: one clock for the fall, a second much slower one for the sway, and
// each flake takes a different amount of each. The sway is what costs
// nothing and does all the work.
//
// It is also the one effect in this folder that no city in the app will
// ever show. Hanoi, Saigon and Da Nang do not get snow, and code 71 will
// not arrive from any of them. It exists because the condition table has
// a member for it and a member that renders nothing is a hole — and
// because the debug panel is how anybody will ever see it.

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { opacityOf, phaseOf, useField } from './particles';

const COUNT = 34;
const FALL_MS = 9000;
const SWAY_MS = 3400;

export default function Snow({ width, height, density, wind, still }: {
  width: number;
  height: number;
  density: Animated.Value;
  wind: Animated.Value;
  still: boolean;
}) {
  const fall = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const field = useField(COUNT, 0xf10c, 0.5);

  useEffect(() => {
    if (still) { fall.stopAnimation(); sway.stopAnimation(); return; }
    const loops = [
      // Linear for the same reason rain is: read through a modulo, any
      // easing shows up as every flake stalling at once.
      Animated.loop(Animated.timing(fall, {
        toValue: 1, duration: FALL_MS, easing: (t) => t, useNativeDriver: true,
      })),
      // The sway is a sine, not a modulo, so it can and should ease —
      // that is what makes it a drift rather than a zigzag.
      Animated.loop(Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: SWAY_MS, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: SWAY_MS, useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());
    return () => { loops.forEach((l) => l.stop()); fall.setValue(0); sway.setValue(0); };
  }, [fall, sway, still]);

  const flakes = useMemo(() => field.map((p, i) => {
    const phase = phaseOf(fall, p.offset);
    const size = 1.6 + p.scale * 2.2;
    // Each flake sways a different distance and, crucially, in a
    // different direction — half of them lead where the other half lag,
    // which is what stops the field breathing in unison.
    const amplitude = (p.offset > 0.5 ? 1 : -1) * (3 + p.scale * 7);
    return (
      <Animated.View
        key={i}
        style={{
          position: 'absolute',
          left: p.x * width,
          top: -size,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFFFFF',
          opacity: opacityOf(density, p),
          transform: [
            {
              translateY: phase.interpolate({
                inputRange: [0, 1],
                // Bigger flakes are nearer, so they fall faster: the
                // range they cross is the same, the time is not, which
                // is depth for free.
                outputRange: [0, (height + size) / (0.7 + p.scale * 0.5)],
              }),
            },
            // One `translateX`, not two. Repeating a transform key
            // composes at the matrix level and works, but it also splits
            // one quantity across two nodes for the native driver to
            // reassemble every frame. Added here instead: the flake's
            // horizontal position is a single number with two terms.
            {
              translateX: Animated.add(
                Animated.multiply(phase, Animated.multiply(wind, p.scale * 0.5)),
                sway.interpolate({ inputRange: [0, 1], outputRange: [-amplitude, amplitude] }),
              ),
            },
          ],
        }}
      />
    );
  }), [field, fall, sway, density, wind, width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flakes}
    </View>
  );
}
