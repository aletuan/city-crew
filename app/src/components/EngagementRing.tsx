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
// that is ΔE 4.3, near enough to nothing, and a track nobody can see
// turns a partial arc into a scratch on the corner of the picture rather
// than a reading. See `ringTrack` for what replaced it, and for the
// correction that overshot on the way.
//
// The arc is a run of short segments rather than one stroked circle,
// because SVG has no conic gradient and a linear one only sweeps for an
// arc long enough to cross it. See `lib/ring.ts`.
//
// What feeds it is deliberately small. See `levelFromSaves`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, gradAI, ringSweep, ringTrack } from '../theme';
import { sampleSweep, visibleSweep } from '../lib/ring';
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
  // Read rather than resolved: see `ringTrack` for why this cannot be a
  // dynamic pair.
  const track = ringTrack[useScheme().scheme];

  // A gap of page between avatar and track, so the ring reads as a
  // separate object rather than a border the picture grew.
  const GAP = 3.5;
  const STROKE = 4;
  const box = size + (GAP + STROKE) * 2;
  const c = box / 2;
  const r = (box - STROKE) / 2;
  // Clamped, not trusted: a progress of 1 would close the ring and say
  // "level complete" on an account that has just levelled up.
  const pct = Math.max(0, Math.min(progress, 0.999));

  // Twelve o'clock, clockwise. A track that starts at the top is read as
  // a dial, one that starts at the right as an accident.
  const at = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return [c + r * Math.sin(rad), c - r * Math.cos(rad)] as const;
  };

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        {/* The headroom, drawn whole and then covered by the arc. */}
        <Circle cx={c} cy={c} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
        {/* Floored, so a new account gets a ring rather than a bare
            track — see `MIN_ARC`. */}
        {visibleSweep(pct).map((seg) => {
          const [x0, y0] = at(seg.a0);
          const [x1, y1] = at(seg.a1);
          return (
            <Path
              key={seg.a0}
              d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`}
              stroke={sampleSweep(ringSweep, seg.t)}
              strokeWidth={STROKE}
              // Round caps on every segment, not just the two ends. Butt
              // caps leave a hairline of track showing at each join where
              // the antialiasing of two abutting strokes does not quite
              // meet, and a sweep with sixty pinholes in it is worse than
              // no sweep. The caps overlap their neighbours instead, and
              // since neighbours are a degree or two apart in colour the
              // overlap is invisible — while the first and last segments
              // still get the rounded ends the arc wants anyway.
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
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
