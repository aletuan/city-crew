// The ring around the profile avatar, and the level badge on its corner.
//
// It is a progress track: the coloured arc is how far into the current
// level you are, and the grey remainder is the headroom left. That is the
// whole reason it earns a place on a screen whose avatar was already
// doing a job — a ring that is merely decorative would be one more thing
// to look at, where this one answers "how am I doing".
//
// What feeds it is deliberately small. See `levelFromSaves`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font } from '../theme';

// The arithmetic lives in `lib/level.ts`, which imports nothing, so the
// test runner can reach it without loading React Native.
export { levelFromSaves, PER_LEVEL } from '../lib/level';

/**
 * The arc's colours, warm through to cool as the level fills.
 *
 * SVG has no conic gradient, so this is a linear one laid across the
 * circle's box. Along a stroked arc that reads much like a sweep: the
 * path crosses the gradient's axis as it travels, so the colour turns
 * with the angle. Close enough at 96pt, and it costs one `<Defs>` rather
 * than a ring assembled from a dozen segments.
 */
const ARC = ['#FF6F5B', '#FF9A5C', '#F2B441', '#A9C46A'] as const;

export default function EngagementRing({ size, level, progress, children }: {
  /** The avatar's diameter. The ring is drawn outside it. */
  size: number;
  level: number;
  /** 0–1 through the current level. */
  progress: number;
  children: React.ReactNode;
}) {
  // A gap of page between avatar and track, so the ring reads as a
  // separate object rather than a border the picture grew.
  const GAP = 4;
  const STROKE = 3.5;
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
          <SvgGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            {ARC.map((c, i) => (
              <Stop key={c} offset={`${(i / (ARC.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </SvgGradient>
        </Defs>
        {/* The headroom, drawn whole and then covered by the arc. */}
        <Circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          stroke={colors.surfaceGlassStrong}
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
      <LinearGradient
        colors={[ARC[0], ARC[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.badge}
      >
        <Text style={s.badgeText}>{`Lv ${level}`}</Text>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute', right: -2, bottom: 2,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    // A ring of page, not a border: `borderColor` resolves to a CGColor
    // once and can come back stale after a theme change. Same reason the
    // camera badge stopped using one.
    borderWidth: 0,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  badgeText: {
    color: colors.accentInk, fontSize: 11.5, lineHeight: 15, fontWeight: font.bold,
    letterSpacing: 0.2,
  },
});
