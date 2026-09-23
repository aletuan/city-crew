// The spinner at the top of the sketching screen.
//
// The design was written as CSS — a conic-gradient ring on `spin`, a core
// on `pulse` — and neither of those exists here. What follows is the
// translation, and the places it is not a literal one are called out.
//
// ── the core does not pulse ──
//
// The one departure from the design rather than from the platform. A
// breathing core is what every spinner in every app does, and it says
// only "busy". The core carries this app's own mark, so it walks instead:
// two footfalls to one turn of the ring. Same two animated properties,
// same native driver, and the reader is told which app they are in while
// they wait.
//
// ── the conic gradient ──
//
// SVG has none, and a linear gradient laid across the box only sweeps
// where the arc crosses it. This app already solved that for the profile
// ring: draw the arc as a run of short solid segments and sample the ramp
// per segment. See `lib/ring.ts`, which is tested and reused here rather
// than copied — the whole reason it lives in `lib` and not beside that
// component.
//
// ── the animation ──
//
// `Animated`, not Reanimated, because the app does not carry Reanimated
// and a spinner is not the reason to add it. Both loops drive `transform`
// only, so both run on the native driver: the JS thread is about to be
// busy, and a progress indicator that stutters exactly when work starts
// is worse than none.
//
// ── reduced motion ──
//
// Not read here. The screen owns that question — see `useReducedMotion` —
// and passes the answer down, because the step rows beside this need it
// too and a screen where half the motion obeys the setting looks broken
// rather than considerate.
//
// With it on, the ring is still drawn and still says "working": it simply
// holds still. The reader loses the motion, not the information.

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLoop } from './ui';
import { arcSweep, sampleSweep, type Stop } from '../lib/ring';
import { colors, gradAI } from '../theme';

/**
 * The ramp, read across the whole circle rather than across the drawn arc.
 *
 * It used to end where it began — coral → amber → lime → coral — because
 * a full ring whose ends differ has a visible join going round it. The
 * ring is an arc with a gap now, so there are no ends to meet, and the
 * ramp can go somewhere: coral at the tail, lime at the head. Which makes
 * the colour say what the length says. A quarter done is a short warm
 * stub; nearly done is a long arc whose leading edge has gone green.
 *
 * This only works because the sample is taken at the segment's angle
 * round the *circle*, not at its position along the arc. Sampled along
 * the arc, every length would show the whole ramp and the colour would
 * mean nothing.
 */
const SWEEP: Stop[] = [
  { at: 0, hex: gradAI.colors[0] },
  { at: 0.45, hex: '#FFC94A' },
  { at: 1, hex: '#C6F24E' },
];

const BOX = 92;
const STROKE = 5;

/**
 * The shortest and longest arc drawn, whatever the caller reports.
 *
 * A floor because a ring of nothing is not a spinner: the first stage
 * waits on the catalog, which is the one part of this that is genuinely
 * slow, and a reader watching a bare disc through it has been told the
 * screen is broken.
 *
 * A cap because the two ends must never meet. At a full turn the lime
 * head would butt against the coral tail and the ramp would read as a
 * join. The gap left at the top is also what keeps the rotation legible
 * — a closed ring turning looks like a ring standing still.
 */
const ARC_FLOOR = 0.08;
const ARC_CAP = 0.96;

/** A segment of the ring, as an SVG arc path. */
function seg(a0: number, a1: number, r: number, c: number): string {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [c + r * Math.cos(rad), c + r * Math.sin(rad)];
  };
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}

export default function SketchOrb({ still, pct = 1 }: {
  /** Held still — the run has ended, or the reader asked for less motion. */
  still?: boolean;
  /**
   * How much of the work is behind us, 0 to 1 — the fraction of the
   * screen's stages that have finished.
   *
   * The ring used to be a closed circle that only turned, which says
   * "busy" and nothing else, while the list underneath it was already
   * counting the stages off one by one. Two indicators, one of them
   * carrying no information. The arc's length is that count now.
   *
   * It advances in steps rather than sliding, and lands on the same
   * frame as the row below it ticks — the two say one thing together.
   * Sliding would mean animating a run of SVG paths from JS, on the one
   * screen whose header explains why its motion stays off that thread.
   */
  pct?: number;
}) {
  const spin = useLoop(1600, !!still);
  // The same 1600ms the ring turns by, and deliberately so: two footfalls
  // to one turn of the ring puts the walk in step with it rather than
  // beside it. Linear, because the shape of the gait is in the
  // interpolations below, not in an easing curve.
  const walk = useLoop(1600, !!still);

  const c = BOX / 2;
  const r = c - STROKE / 2;
  const shown = Math.min(ARC_CAP, Math.max(ARC_FLOOR, pct));
  const segments = arcSweep(shown, 6);

  return (
    <View style={s.box}>
      <Animated.View
        style={{
          transform: [{
            rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
          }],
        }}
      >
        <Svg width={BOX} height={BOX}>
          {segments.map((g) => (
            <Path
              key={g.a0}
              d={seg(g.a0, g.a1, r, c)}
              // Each segment overlaps its neighbour by a hair via the round
              // cap, so the ring reads as one stroke rather than as a
              // dotted line at small sizes.
              // `g.t` runs 0 → 1 along the arc; scaling it by the arc's
              // own length turns it back into an angle round the circle,
              // which is what the ramp is written against.
              stroke={sampleSweep(SWEEP, g.t * shown)}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </Svg>
      </Animated.View>

      {/* The gap that turns a disc into a track, then the core. Both are
          centred over the ring rather than nested inside the rotating
          view — a child of that would turn with it. */}
      <View style={[s.inset, { backgroundColor: colors.bg }]} pointerEvents="none" />
      <View style={s.core} pointerEvents="none">
        {/* A step rather than a pulse.
            A breathing core says "busy" the way every spinner does. A paw
            that walks says which app you are in, and it costs the same
            two interpolations.
            One cycle is two footfalls — left, then right — built from the
            three things a step actually is: the print lifts, swings across
            and sets down, tipping the way it travels. `still` parks the
            loop at 0, which is why every track starts and ends at its
            neutral value: held still, the paw stands square and upright
            rather than frozen mid-stride. It is also why the snap back
            from 1 to 0 that `useLoop` does on a linear loop is invisible
            here — 0 and 1 are the same pose. */}
        <Animated.View
          style={{
            transform: [
              { translateX: walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -4, 0, 4, 0] }) },
              { translateY: walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -3, 0, -3, 0] }) },
              {
                rotate: walk.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: ['0deg', '-9deg', '0deg', '9deg', '0deg'],
                }),
              },
            ],
          }}
        >
          <Ionicons name="paw" size={26} color={colors.accent} />
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' },
  // 4pt of ground between the ring and the core, as the design asked.
  inset: {
    position: 'absolute',
    width: BOX - STROKE * 2 - 8, height: BOX - STROKE * 2 - 8,
    borderRadius: BOX,
  },
  core: {
    position: 'absolute',
    width: BOX * 0.62, height: BOX * 0.62,
    borderRadius: BOX,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    // The soft drop shadow the design asked for. iOS reads the shadow*
    // props; Android needs elevation, and gets a plainer version.
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
