// The spinner at the top of the sketching screen.
//
// The design was written as CSS — a conic-gradient ring on `spin`, a core
// on `pulse` — and neither of those exists here. What follows is the
// translation, and the two places it is not a literal one are called out.
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
// and `opacity` only, so both run on the native driver: the JS thread is
// about to be busy, and a progress indicator that stutters exactly when
// work starts is worse than none.
//
// ── reduced motion ──
//
// The CSS asked for `prefers-reduced-motion`. The platform equivalent is
// `AccessibilityInfo`, read once and then watched, because it can be
// switched while the screen is open. With it on, the ring is still drawn
// and still says "working" — it simply holds still. Nothing is removed,
// which is the point: the reader loses the motion, not the information.

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { arcSweep, sampleSweep, type Stop } from '../lib/ring';
import { colors, gradAI } from '../theme';

/**
 * The ramp, ending where it began so the seam does not show.
 *
 * The design named coral → amber → lime → coral. The first and last stops
 * are the same colour on purpose: a rotating ring whose ends differ has a
 * visible join going round it, which reads as a rendering fault rather
 * than as a design.
 */
const SWEEP: Stop[] = [
  { at: 0, hex: gradAI.colors[0] },
  { at: 0.33, hex: '#FFC94A' },
  { at: 0.66, hex: '#C6F24E' },
  { at: 1, hex: gradAI.colors[0] },
];

const BOX = 92;
const STROKE = 5;

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

export default function SketchOrb({ still }: {
  /** Held still — reduced motion, or the run has ended. */
  still?: boolean;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = React.useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => { if (live) setReduced(on); });
    // Watched, not only read: the setting can be turned on while this
    // screen is up, which is exactly when somebody would reach for it.
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; sub.remove(); };
  }, []);

  const frozen = still || reduced;

  useEffect(() => {
    if (frozen) return;
    const turn = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1600,
        // Linear, and this is the one easing that must not be eased: a
        // spinner that speeds up and slows down reads as struggling.
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    turn.start();
    pulse.start();
    return () => { turn.stop(); pulse.stop(); spin.setValue(0); breath.setValue(0); };
  }, [frozen, spin, breath]);

  const c = BOX / 2;
  const r = c - STROKE / 2;
  const segments = arcSweep(1, 6);

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
              stroke={sampleSweep(SWEEP, g.t)}
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
      <Animated.View
        pointerEvents="none"
        style={[
          s.core,
          {
            transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
            opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }),
          },
        ]}
      >
        <Ionicons name="sparkles" size={26} color={colors.accent} />
      </Animated.View>
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
