// The ring around the profile avatar, and the level badge on its corner.
//
// It is a progress track: the coloured arc is how far into the current
// level you are, and the grey remainder is the headroom left. That is the
// whole reason it earns a place on a screen whose avatar was already
// doing a job — a ring that is merely decorative would be one more thing
// to look at, where this one answers "how am I doing".
//
// Which means both halves have to be visible. The first version drew the
// headroom in `surfaceGlassStrong`, a token made for surfaces: over paper
// it composites to #E1DDD6, 1.20:1, and a track nobody can see turns a
// partial arc into a scratch on the corner of the picture rather than a
// reading. The colours now come from `ringInk`, measured against both
// grounds.
//
// What feeds it is deliberately small. See `levelFromSaves`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, gradAI, ringInk } from '../theme';
import { useScheme } from '../lib/theme';

// The arithmetic lives in `lib/level.ts`, which imports nothing, so the
// test runner can reach it without loading React Native.
export { levelFromSaves, PER_LEVEL } from '../lib/level';

export default function EngagementRing({ size, level, progress, children }: {
  /** The avatar's diameter. The ring is drawn outside it. */
  size: number;
  level: number;
  /** 0–1 through the current level. */
  progress: number;
  children: React.ReactNode;
}) {
  // Read rather than resolved: see `ringInk` for why these cannot be
  // dynamic pairs.
  const ink = ringInk[useScheme().scheme];

  // A gap of page between avatar and track, so the ring reads as a
  // separate object rather than a border the picture grew.
  const GAP = 3.5;
  // Thicker than it was. Contrast and width are the two ways a thin line
  // becomes visible, and the track has little room left on the first —
  // any darker and it starts competing with the arc drawn on top of it.
  const STROKE = 4.5;
  const box = size + (GAP + STROKE) * 2;
  const r = (box - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  // Clamped, not trusted: a progress of 1 would close the ring and say
  // "level complete" on an account that has just levelled up.
  const pct = Math.max(0, Math.min(progress, 0.999));

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Two stops, where there were four. SVG has no conic gradient,
              so this is a linear one laid across the circle's box, and the
              arc samples only the slice of it that it crosses: at a fifth
              of a turn it was reading as one flat colour, and the coral
              and lime ends only ever met near a full ring. A four-colour
              sweep that shows up at 100% and nowhere else is not a sweep.
              Two warm stops turn with the angle at every length. */}
          <SvgGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={ink.from} />
            <Stop offset="100%" stopColor={ink.to} />
          </SvgGradient>
        </Defs>
        {/* The headroom, drawn whole and then covered by the arc. */}
        <Circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          stroke={ink.track}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          stroke="url(#arc)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * pct} ${circumference}`}
          // Twelve o'clock, not three: a track that starts at the top is
          // read as a dial, one that starts at the right as an accident.
          transform={`rotate(-90 ${box / 2} ${box / 2})`}
        />
      </Svg>
      {children}
      {/* A ring of page around the badge. The arc reaches this corner at
          roughly two fifths of a turn and would otherwise run into the
          pill and stop there, which reads as the track being broken. With
          the gap the badge is plainly a thing lying on top, and the arc
          plainly continues underneath it.

          Background rather than `borderColor`: a border resolves to a
          CGColor once and can come back stale after a theme change, which
          is what put a black ring on the camera badge. */}
      <View style={s.halo}>
        <LinearGradient
          colors={gradAI.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.badge}
        >
          <Text style={s.badgeText}>{`Lv ${level}`}</Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  halo: {
    position: 'absolute', right: -4, bottom: 0,
    backgroundColor: colors.bg,
    borderRadius: 999,
    padding: 2.5,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  badgeText: {
    color: colors.accentInk, fontSize: 11.5, lineHeight: 15, fontWeight: font.bold,
    letterSpacing: 0.2,
  },
});
