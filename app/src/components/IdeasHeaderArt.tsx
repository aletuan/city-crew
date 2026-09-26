// Two cats setting out for the evening, beside the title of the screen
// where the reader does the same.
//
// Ideas is the one tab with no picture of its own: Explore opens on a
// hero, Collections and Trips on covers, Profile on a face. Its header
// was the emptiest stretch of the app, and this fills it — with the one
// illustration the app carries, drawn twice, because a night street and
// a pastel afternoon are two paintings and not one painting recoloured.
// The paper plane is the app's own mark (the logo, the welcome sheet);
// the neon on the dark street is the app's name.
//
// ── how it sits ──
//
// The painting is not a row in the layout. It is pinned to the header's
// right edge, bleeding past the page padding to the screen edge and up
// to the top of the screen; the title and the lede are drawn over its
// empty left third. What this component puts *in* the row is a spacer,
// `reserved` wide, so the title column ends before the cats begin. The
// title may still overlap the painting by `OVERLAP` points, which is
// less than the plain sky at its left in the rows the title occupies
// (measured on both files: 38% and 48% of the width), and the lede lines
// are shorter than that margin by half.
//
// Its height follows the band: safe-area inset plus the row's paddings
// plus the title-and-lede column at one line each. The frame reaches the
// screen top, but the *paint* does not: the files carry a third of
// transparent sky above the first brushstroke, so on a phone with a
// 59pt status bar the plane and the rooftops begin just under it rather
// than behind it — the first build had them at the very top, and the
// Dynamic Island sat on the plane. A title that wraps (Japanese does, at
// 375pt) makes the row taller, the painting keeps its height and its
// bottom, and the sky above it is transparent anyway.
//
// Transparent, because the first build was opaque on a ground shifted
// to the page colour, and on an OLED the ground was not invisible: the
// grain of the painting and the ringing of a lossy encoder, at two or
// three units above black, drew a faint rectangle around the night
// street. The files are now keyed with colour-to-alpha against the page
// colour (`scripts/ideas-art.py`): the flat ground is alpha 0, the
// painting's own fade is partial alpha, and what shows through is the
// page itself, glow and all. There is no edge left to see.
//
// ── when it is not there ──
//
// Two readers get the header without it. Under Display Zoom (#635) the
// window is 320pt and the column beside a 200pt painting would be 80pt;
// under large Dynamic Type (#636) the three lede lines are no longer
// short and the title is no longer one line, and a picture that makes
// the words wrap around it has stopped being decoration. Both hand the
// full width back to the text. The cap is the same 1.3 the tab-bar
// captions stop scaling at, for the same reason: past it, room is what
// the reader asked for.
//
// Decorative: hidden from the screen reader, inert to touch.

import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useScheme } from '../lib/theme';
import { labelScaleCap, space } from '../theme';
import { useNarrowWindow } from './ui';
import artDark from '../../assets/ideas-art-dark.webp';
import artLight from '../../assets/ideas-art-light.webp';

/** Width over height of both files (600×572). */
export const ART_ASPECT = 600 / 572;
/** Plain sky at the painting's left edge, in points at the rendered
 *  size: how far the title may run onto it. */
export const OVERLAP = 50;
/** The title-and-lede column at one line each: a 34pt title's line box
 *  and three 24pt lede lines with the gap between. The header row adds
 *  its own paddings (8 above, 14 below). */
export const BAND = 41 + 6 + 3 * 24;
const ROW_PADDING = 8 + 14;

/** Rendered height of the painting for a given top inset. Exported for
 *  the test, which cannot measure a layout and can check the arithmetic. */
export function artHeight(topInset: number): number {
  return topInset + ROW_PADDING + BAND;
}

/**
 * The header illustration, for the `right` slot of `Screen`.
 *
 * Renders the spacer the row lays out around and, inside it, the
 * painting pinned to the screen's top-right. Null under Display Zoom or
 * large Dynamic Type — see the note above.
 */
export default function IdeasHeaderArt() {
  const { scheme } = useScheme();
  const { fontScale } = useWindowDimensions();
  const narrow = useNarrowWindow();
  const { top } = useSafeAreaInsets();
  if (narrow || fontScale >= labelScaleCap) return null;

  const height = artHeight(top);
  const width = Math.round(height * ART_ASPECT);
  // The row's content box ends `space.page` before the screen edge the
  // painting bleeds to, so that padding is part of the painting's width
  // the spacer need not reserve.
  const reserved = width - OVERLAP - space.page;

  return (
    <View
      style={[s.spacer, { width: reserved }]}
      pointerEvents="none"
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      testID="ideas-art"
    >
      {/* The frame carries the geometry and the picture fills it — a
          View so the numbers are one style object that can be read
          back, where the image component processes its own. */}
      <View
        style={[s.frame, { width, height, right: -space.page, bottom: -(ROW_PADDING - 8) }]}
        testID="ideas-art-frame"
      >
        <Image
          source={scheme === 'light' ? artLight : artDark}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessible={false}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Stretched to the row's content box so `bottom` on the frame is
  // measured from the row, not from a spacer of zero height.
  spacer: { alignSelf: 'stretch' },
  frame: { position: 'absolute' },
});
