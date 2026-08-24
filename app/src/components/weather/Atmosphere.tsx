// The layers that do not have particles in them: fog, the warm bloom of
// a clear day, the motes a windy one carries, and lightning.
//
// All four are gradients on the move, which is the whole reason they can
// exist at all here. There is no shader and no noise function, so the
// texture has to come from *overlapping things at different rates*: three
// wide bands drifting at 26, 41 and 58 seconds never repeat inside any
// time a reader spends on this screen, and the beat between them reads as
// unevenness. It is a cheap trick and it is the same one a theatre uses.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { seeded } from './particles';

/** One drifting band. Three of these are a fog bank. */
type Band = { ms: number; top: number; height: number; alpha: number; travel: number };

const BANDS: Band[] = [
  { ms: 26000, top: 0.04, height: 0.42, alpha: 0.55, travel: 0.34 },
  { ms: 41000, top: 0.22, height: 0.55, alpha: 0.85, travel: -0.26 },
  { ms: 58000, top: 0.00, height: 0.80, alpha: 0.40, travel: 0.18 },
];

/**
 * Fog, and the haze a heavy sky carries.
 *
 * `strength` is 0–1 and is animated by the caller, so a sky clearing
 * fades the bank out over seconds rather than switching it off. The
 * ceiling is the brief's: 0.18 at the very top, which on a photograph is
 * a great deal more than it sounds.
 *
 * The bands ease back and forth rather than wrapping, and that is a
 * correction to how this was first written. Wrapping never stalls, which
 * was the argument for it — but a wrap is a *discontinuity*: the band
 * teleports back to its start once a cycle, and on a soft gradient at
 * 18% that lands as a visible twitch. A reversal has a moment of
 * stillness at each end, which at three different periods (26s, 41s,
 * 58s) never happens to all three at once and is not perceptible in any
 * one of them.
 *
 * A stall you cannot see beats a jump you can.
 */
export function Fog({ width, height, strength, still }: {
  width: number;
  height: number;
  strength: Animated.Value;
  still: boolean;
}) {
  const clocks = useRef(BANDS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (still) { clocks.forEach((c) => c.stopAnimation()); return; }
    const loops = clocks.map((c, i) => Animated.loop(
      Animated.sequence([
        Animated.timing(c, { toValue: 1, duration: BANDS[i].ms, useNativeDriver: true }),
        Animated.timing(c, { toValue: 0, duration: BANDS[i].ms, useNativeDriver: true }),
      ]),
    ));
    loops.forEach((l) => l.start());
    return () => { loops.forEach((l) => l.stop()); clocks.forEach((c) => c.setValue(0)); };
  }, [clocks, still]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BANDS.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: b.top * height,
            height: b.height * height,
            // Wider than the frame so a band can drift across it without
            // either edge ever entering the picture.
            left: -width * 0.5,
            width: width * 2,
            opacity: strength.interpolate({
              inputRange: [0, 1], outputRange: [0, 0.18 * b.alpha],
            }),
            transform: [{
              translateX: clocks[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0, b.travel * width],
              }),
            }],
          }}
        >
          <LinearGradient
            // Horizontal, and soft at both ends: a band with a hard edge
            // is a band you can see the shape of, and fog has no shape.
            colors={['rgba(232,234,238,0)', 'rgba(232,234,238,1)', 'rgba(232,234,238,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * The warm light of a clear day.
 *
 * From a corner, never the centre, and never as a disc: the brief was
 * right that a sun sprite or a lens flare is the single fastest way to
 * make a photograph look like a screensaver. What this draws is the
 * light *falling into* the frame from somewhere off it, which is what a
 * bright day looks like through a lens.
 *
 * Top-right rather than top-left, for no better reason than that the
 * hero's own controls sit top-left and a bloom under them would fight
 * the glass.
 */
export function SunGlow({ height, strength }: {
  height: number;
  strength: Animated.Value;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { opacity: strength.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,214,158,1)', 'rgba(255,206,150,0.35)', 'rgba(255,200,140,0)']}
        locations={[0, 0.4, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.15, y: 0.85 }}
        style={{ position: 'absolute', top: 0, right: 0, left: 0, height: height * 0.9 }}
      />
    </Animated.View>
  );
}

/**
 * Wind, when there is nothing falling in it.
 *
 * The brief's rule, and it is the best rule in the brief: *if there is
 * wind but no rain, do not draw wind lines.* Wind is not visible. What is
 * visible is the things it moves, so this moves a handful of nearly
 * invisible motes and one very slow band of haze, and the reader
 * registers movement without ever locating it.
 *
 * Twelve motes. Any more and they resolve into a swarm, which is an
 * insect, which is a different feeling entirely.
 */
export function Drift({ width, height, strength, wind, still }: {
  width: number;
  height: number;
  strength: Animated.Value;
  wind: Animated.Value;
  still: boolean;
}) {
  const clock = useRef(new Animated.Value(0)).current;
  const haze = useRef(new Animated.Value(0)).current;
  const motes = useRef(
    Array.from({ length: 12 }, (_, i) => {
      const rnd = seeded(0xd21f + i * 977);
      return { x: rnd(), y: rnd(), size: 1 + rnd() * 1.8, offset: rnd(), lift: rnd() };
    }),
  ).current;

  useEffect(() => {
    if (still) { clock.stopAnimation(); haze.stopAnimation(); return; }
    const loops = [
      // The motes' clock wraps, and must: they are read through a
      // modulo, and a mote that reversed would fly backwards.
      Animated.loop(Animated.timing(clock, {
        toValue: 1, duration: 17000, easing: (t) => t, useNativeDriver: true,
      })),
      Animated.loop(Animated.sequence([
        Animated.timing(haze, { toValue: 1, duration: 31000, useNativeDriver: true }),
        Animated.timing(haze, { toValue: 0, duration: 31000, useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());
    return () => { loops.forEach((l) => l.stop()); clock.setValue(0); haze.setValue(0); };
  }, [clock, haze, still]);

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {motes.map((m, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: -width * 0.2,
            top: m.y * height * 0.8,
            width: m.size,
            height: m.size,
            borderRadius: m.size,
            backgroundColor: '#FFFFFF',
            opacity: strength.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }),
            transform: [
              {
                translateX: Animated.modulo(Animated.add(clock, m.offset), 1)
                  .interpolate({ inputRange: [0, 1], outputRange: [0, width * 1.4] }),
              },
              // A mote that only travels sideways reads as a scrolling
              // texture. The lift is small and it is what makes it air.
              {
                translateY: Animated.modulo(Animated.add(clock, m.offset), 1)
                  .interpolate({ inputRange: [0, 1], outputRange: [0, -14 - m.lift * 22] }),
              },
            ],
          }}
        />
      ))}
      {/* The haze the motes move through. Its drift is a slow reversal
          like the fog bands', not a multiple of `clock` — `clock` wraps,
          and a band whose position is `clock × wind` teleports back to
          its start every seventeen seconds. The wind still sets which
          way it leans; it no longer sets whether it jumps. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: -width * 0.5,
          width: width * 2,
          top: height * 0.1,
          height: height * 0.5,
          opacity: strength.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] }),
          transform: [{
            translateX: Animated.multiply(
              haze.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
              wind,
            ),
          }],
        }}
      >
        <LinearGradient
          colors={['rgba(236,238,242,0)', 'rgba(236,238,242,1)', 'rgba(236,238,242,0)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

/** How long a flash lasts, and how far apart they are. Both from the
 *  brief, which had this exactly right: rare and brief is what makes it
 *  read as weather rather than as an effect on a timer. */
const FLASH_MS = 110;
const GAP_MIN = 15000;
const GAP_MAX = 45000;

/**
 * Lightning.
 *
 * Not a white screen. A storm seen from inside a city is mostly the sky
 * going momentarily paler behind everything — you rarely see the bolt,
 * you see the room change colour. So this brightens the upper half by a
 * few percent, twice in quick succession the way real strikes flicker,
 * and is drawn *under* the hero's readability scrim so it lifts the sky
 * and leaves the headline alone.
 *
 * The timer is the one piece of JavaScript in this folder that runs while
 * the screen is idle. It fires at most four times a minute and it is
 * cleared on `still`, so a backgrounded app costs nothing.
 */
export function Lightning({ height, active }: { height: number; active: boolean }) {
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { flash.setValue(0); return; }
    let timer: ReturnType<typeof setTimeout>;
    const strike = () => {
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: FLASH_MS * 0.3, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.15, duration: FLASH_MS * 0.3, useNativeDriver: true }),
        // The second, weaker pulse. A single clean flash reads as a
        // camera; the stutter is what reads as a storm.
        Animated.timing(flash, { toValue: 0.7, duration: FLASH_MS * 0.2, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: FLASH_MS * 1.6, useNativeDriver: true }),
      ]).start();
      timer = setTimeout(strike, GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN));
    };
    timer = setTimeout(strike, GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN));
    return () => clearTimeout(timer);
  }, [flash, active]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0, right: 0, top: 0,
        height: height * 0.7,
        opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] }),
      }}
    >
      <LinearGradient
        colors={['rgba(226,236,255,1)', 'rgba(210,224,255,0)']}
        locations={[0, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
