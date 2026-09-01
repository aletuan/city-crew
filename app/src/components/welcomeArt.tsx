// The two drawings on the sign-up flow's last screen, and the motion on
// one of them. A file of its own because `SignUpScreen` is a form asking
// questions, and nothing here asks anything.
//
// Both pieces live inside that screen's budget: no new art files. The
// plane is the PNG the screen already ships, moved rather than redrawn;
// the skyline is strokes, so its dark theme is the same drawing in
// different ink instead of a second asset — the whole reason this
// direction was chosen over the illustrated one, which would have needed
// every picture twice.

import React from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useLoop, useReducedMotion } from './ui';
import { useScheme } from '../lib/theme';
import { space } from '../theme';

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
 * The skyline's two hands of ink.
 *
 * `line` is the theme's accent hex and draws what should be read first —
 * the flag tower, the lamp, the buildings. `soft` and `road` recede, so
 * the bridge sits behind the tower the way it would across the river.
 * `window` and `glow` are the pair that flips meaning with the ground:
 * pale washes on paper, lit amber at night — the one place the dark
 * drawing says something the light one does not.
 *
 * Resolved in JS from `useScheme`, the way the blur tints and the status
 * bar do it, rather than as dynamic pairs: these are art inks with no
 * token to borrow, and half a drawing resolving natively while the other
 * half is picked here would split one decision across two systems.
 */
const INKS = {
  light: { line: '#C4402C', soft: '#DE8F6C', road: '#EBB39A', window: '#F6D8A8', glow: 'rgba(242,180,65,0.28)' },
  dark: { line: '#FF6F5B', soft: '#7A4A40', road: '#5E3A33', window: '#F2B441', glow: 'rgba(242,180,65,0.45)' },
} as const;

/** Every lit window, `[x, y, w, h]` per building left to right. Data
 *  rather than twenty `Rect` lines, because the windows are the one part
 *  of the drawing with nothing individual to say. */
const WINDOWS: [number, number, number, number][] = [
  [70, 80, 8, 10], [88, 80, 8, 10], [70, 98, 8, 10], [88, 98, 8, 10], [70, 116, 8, 10], [88, 116, 8, 10],
  [119, 99, 7, 8], [131, 99, 7, 8], [119, 115, 7, 8], [131, 115, 7, 8],
  [216, 72, 9, 11], [235, 72, 9, 11], [216, 92, 9, 11], [235, 92, 9, 11], [216, 112, 9, 11], [235, 112, 9, 11],
  [337, 94, 8, 9], [351, 94, 8, 9], [337, 112, 8, 9], [351, 112, 8, 9],
];

/**
 * Hanoi along the bottom of the welcome screen, drawn in the app's line.
 *
 * Left to right: a street lamp with its pool of light, a tree, three
 * blocks of the old quarter, the Cột Cờ flag tower, Long Biên's arcs, and
 * a last tree by the road. It exists because the current screen's known
 * weakness is an empty lower half above the tab bar, and every reference
 * for this redesign filled that space with the city.
 *
 * `preserveAspectRatio="none"`: the drawing is composed for a 390-point
 * screen and stretches a few percent either way on other widths. That
 * flexes the circles into very slight ellipses, which at a 1.6-point
 * hand-drawn stroke is invisible — where letterboxing would visibly part
 * the road from the screen edges it must run into.
 */
export function WelcomeSkyline() {
  const { scheme } = useScheme();
  const ink = INKS[scheme];
  return (
    // Bled to the screen edges out of the scroll column's page padding; a
    // skyline with margins is a picture of a city, not a city.
    <View style={{ marginHorizontal: -space.page }} pointerEvents="none">
      <Svg width="100%" height={150} viewBox="0 0 390 150" preserveAspectRatio="none">
        <Circle cx={26} cy={88} r={9} fill={ink.glow} />
        <G stroke={ink.line} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Circle cx={26} cy={88} r={4.5} />
          <Path d="M26 93v45M20 138h12" />
          <Path d="M48 121v17" />
          <Circle cx={48} cy={111} r={11} />
          <Rect x={62} y={70} width={42} height={68} />
          <Path d="M58 70h50" />
          <Path d="M160 138 L167 92 H191 L198 138" />
          <Rect x={170} y={78} width={18} height={14} />
          <Path d="M179 78V58" />
          <Rect x={208} y={60} width={44} height={78} />
          <Path d="M216 60V52M244 60V50" />
          <Rect x={330} y={84} width={36} height={54} />
          <Path d="M378 122v16" />
          <Circle cx={378} cy={114} r={9} />
          <Path d="M0 138h390" />
        </G>
        {/* The flag flies filled — the one solid in a drawing of outlines,
            which is what makes the tower the landmark. */}
        <Path d="M179 58l17 5-17 5z" fill={ink.line} />
        <G stroke={ink.soft} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Rect x={112} y={90} width={32} height={48} />
          <Path d="M258 138Q274 98 290 138" />
          <Path d="M290 138Q306 98 322 138" />
          <Path d="M258 126h64M258 126v12M322 126v12" />
        </G>
        {WINDOWS.map(([x, y, w, h]) => (
          <Rect key={`${x}:${y}`} x={x} y={y} width={w} height={h} fill={ink.window} />
        ))}
        <Path d="M8 146h374" stroke={ink.road} strokeWidth={1.6} strokeLinecap="round" strokeDasharray={[2, 7]} />
      </Svg>
    </View>
  );
}
