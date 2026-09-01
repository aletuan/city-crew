// The two pieces of art on the sign-up flow's last screen. A file of its
// own because `SignUpScreen` is a form asking questions, and nothing here
// asks anything.
//
// Both live inside that screen's budget: no new art files. The plane is
// the PNG the screen already ships, moved rather than redrawn; the heart
// is a handful of strokes. A skyline drawn in this same line shipped
// here once and was taken back out — the reference's lower half is
// empty on purpose, and against the phone it turned out the reference
// was right.

import React from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useLoop, useReducedMotion } from './ui';
import { useScheme } from '../lib/theme';

/**
 * The welcome plane, drifting.
 *
 * One slow breath — up nine points and two and a half degrees of tilt
 * across it, 3.6 seconds each way — because "you have arrived" reads
 * better on something that moves like paper than on a decal. `useLoop`
 * on the native driver, exactly as the sketching orb does it; with
 * Reduce Motion on the loop never starts, and the plane simply hangs,
 * which loses the drift and keeps the arrival.
 *
 * The transform rides an `Animated.View` around the image rather than on
 * it: `expo-image` is not an Animated component, and wrapping is the
 * supported way to move one.
 */
export function FloatingPlane({ source, style }: {
  source: ImageProps['source'];
  style?: StyleProp<ViewStyle>;
}) {
  const still = useReducedMotion();
  const drift = useLoop(7200, still, 'inOut');
  return (
    <Animated.View
      style={[style, {
        transform: [
          { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) },
          { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-1.2deg', '1.4deg'] }) },
        ],
      }]}
    >
      <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="contain" />
    </Animated.View>
  );
}

/**
 * The heart beside the greeting — a doodle, not a glyph.
 *
 * It was an Ionicons heart first: upright, solid, stamped flat against
 * the name like a bullet point. The reference's heart is a drawing —
 * tilted a few degrees, with three little motion strokes flying off its
 * shoulder — and that difference is most of the difference between
 * "decorated" and "drawn on". Strokes need SVG, which cannot ride
 * inside a `Text`, so the title lays the two out as a row instead.
 *
 * Its ink leans brighter than the accent token on paper — the token is
 * brick, the reference heart is coral — because at this size the darker
 * red read as a mark of punctuation rather than of affection. Art ink,
 * chosen against the drawing, the way the skyline's windows were.
 */
const HEART_INK = { light: '#E8542F', dark: '#FF6F5B' } as const;

export function HeartDoodle({ size = 24, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const { scheme } = useScheme();
  const ink = HEART_INK[scheme];
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" style={style}>
      <Path
        d="M11 21 C6 16.5 3.4 13.2 4.8 10 C5.9 7.6 9.2 7.4 11 9.8 C12.8 7.4 16.1 7.6 17.2 10 C18.6 13.2 16 16.5 11 21 Z"
        fill={ink}
        transform="rotate(-8 11 14)"
      />
      <Path d="M19 7l2-3M21.5 10l3-1.5M22 13.5h3" stroke={ink} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
