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
//
// ── the pill under the picture (owner, 19 Nov 2026) ──
//
// It lay on the ring's bottom-right corner while the ring stood on the
// Account page. It moved with the ring to your own person page
// (docs/profile-home-plan.md, P3), where the owner asked for it right
// under the picture: the name and the bubble stand to the picture's
// right, and a pill on that corner pointed into them. Centred under the
// picture it is read with the face, and the arc runs on behind it, as
// it did behind the corner.
//
// ── the gap, filled (owner, 19 Nov 2026) ──
//
// The gap between the picture and the track was left open, which on
// the Account page is the page. On your own person page the ring lies
// half over the cover photograph, which would show through it, so the
// page drew its own 4 of page round the picture inside the ring — and
// the owner, on a photograph with a black ground, read 7.5 of white
// round it as too much. The gap is filled with the page now, one band
// of 3.5 on every page that draws the ring, and your own page hands in
// the bare picture: the 4 it dropped went to the picture, 80 to 88.
//
// The pill is a press that says what the level is (owner, 16 Nov 2026) —
// as the role's disc on the opposite corner says what the role is. What
// it says is the caller's (`onExplain`): the ring is handed a level, not
// the count it came from.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './ui';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { bgHex, colors, font, gradAI, ringSweep, ringTrack } from '../theme';
import { useI18n } from '../lib/i18n';
import { sampleSweep, visibleSweep } from '../lib/ring';
import { useScheme } from '../lib/theme';

// The arithmetic lives in `lib/level.ts`, which imports nothing, so the
// test runner can reach it without loading React Native.
export { levelFromSaves, PER_LEVEL } from '../lib/level';

/** A gap of page between avatar and track, then the track. Filled with
 *  the page (`ground`), not left open: see the head of the file. */
const GAP = 3.5;
const STROKE = 4;
/** How far the ring stands outside the picture it is handed — for a
 *  caller that keeps the picture where it was and lets the ring spread
 *  (a negative margin of this much). */
export const RING_OUT = GAP + STROKE;

export default function EngagementRing({ size, level, progress, fresh = false, onExplain, children }: {
  /** The avatar's diameter. The ring is drawn outside it. */
  size: number;
  level: number;
  /** 0–1 through the current level. */
  progress: number;
  /** Something behind the pill is new — a badge earned since its sheet
   *  was last closed (`lib/rewards`): the pill wears the tab bar's dot. */
  fresh?: boolean;
  /** The pill, pressed: say what the level is. */
  onExplain: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  // Read rather than resolved: see `ringTrack` for why this cannot be a
  // dynamic pair.
  const { scheme } = useScheme();
  const track = ringTrack[scheme];

  // A gap of page between avatar and track, so the ring reads as a
  // separate object rather than a border the picture grew.
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
        {/* The gap, in the page's own colour: what lies under it is not
            always the page (see the head). Plain hex, as the track is. */}
        <Circle cx={c} cy={c} r={size / 2 + GAP} fill={bgHex[scheme]} testID="ring-ground" />
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
      <View style={s.pillRow} pointerEvents="box-none">
      <View style={s.halo}>
        <PressableScale
          // The role disc's press, on the other corner (0.9 there).
          scaleTo={0.9}
          onPress={onExplain}
          // The pill is 21 tall (15 of line, 3 above and below) and 44
          // wide at two digits: 12 more above and below is the 44 a thumb
          // is owed. The picture under it is a press too (it opens the
          // picker); the reach takes the strip of it around the pill's
          // own corner, and the pill, drawn later, is the one that
          // answers there.
          hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
          haptic="selection"
          accessibilityRole="button"
          // "Level", spelled: VoiceOver reads "Lv" as two letters.
          accessibilityLabel={t(`Level ${level}`, `Level ${level}`, `レベル${level}`, `${level} 级`, `${level} 級`)}
          accessibilityHint={t('Explains how levels work', 'Giải thích cách tính level', 'レベルの仕組みを説明します', '说明等级如何计算', '說明等級如何計算')}
          testID="level-badge"
        >
          <LinearGradient
            colors={gradAI.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.badge}
          >
            <Text style={s.badgeText}>{`Lv ${level}`}</Text>
          </LinearGradient>
          {fresh ? <View style={s.freshHalo} testID="level-fresh"><View style={s.fresh} /></View> : null}
        </PressableScale>
      </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Centred under the picture, over the ring's lowest point: the pill's
  // middle on the track, so half of it hangs below the ring.
  pillRow: { position: 'absolute', left: 0, right: 0, bottom: -10, alignItems: 'center' },
  halo: {
    backgroundColor: colors.bg,
    borderRadius: 999,
    padding: 2.5,
    // Lighter since 19 Nov 2026 (owner, after an outside review that
    // found the pill heavy under the face): 0.18 at 4 and 2 down read as
    // a second object standing off the page. Enough is left to part it
    // from the arc it lies on.
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  badgeText: {
    color: colors.accentInk, fontSize: 12, lineHeight: 15, fontWeight: font.bold,
    letterSpacing: 0.2,
  },
  // The dot for something new behind the pill, on its top-right corner:
  // the accent, in a ring of page so it parts from the pill, which is
  // the accent's own gradient. Background, not a border, for the reason
  // the halo above gives. 8 in 11: the tab bar's dot is 9, and this one
  // sits on a 21pt pill, not over a 22pt glyph.
  freshHalo: {
    position: 'absolute', top: -4, right: -4,
    padding: 1.5, borderRadius: 999, backgroundColor: colors.bg,
  },
  fresh: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
