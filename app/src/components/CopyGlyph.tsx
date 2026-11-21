// The copy button's glyph, in its two states (owner, 21 Nov 2026).
//
// Not yet yours: Ionicons' `copy-outline`, two sheets. Yours: the same
// two sheets with a tick drawn in the front one, in the same grey and
// the same stroke — the shape says it, as Threads' repost says it with
// a tick inside its loop, and neither the colour nor the weight moves.
// Nobody else sees the tick: the owner and every other reader have the
// plain sheets and the count.
//
// What came before, and why each went, the same day:
//  - Filled in the accent, as the heart is. Two red marks side by side
//    read as two hearts, and two filled squares are more ink than the
//    heart beside them.
//  - The outline in the ink, grey when not yours (#1526). Lighter, but
//    still a heavier mark for a state, which the owner did not want.
//  - A plus in the front sheet when not yours, the tick when yours. The
//    plus would sit on nearly every card, since nearly every card is
//    not yours, and reads as "new".
//  - One sheet with a tick when yours. The shape changed so far that
//    it stopped reading as the same button.
//
// Ionicons has no copy-with-a-tick, so the yours state is drawn here, on
// Ionicons' own 512 grid: the sheets are `copy-outline`'s rect and path
// as Ionicons ships them, stroke 32, so the two states are the same
// drawing until the tick. The tick sits in the front sheet's middle
// (128–464 across, centre 296), its arms 32 wide like the sheets'.

import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Color } from '../theme';
import { Glyph, type IconSize } from './ui/glyph';

export function CopyGlyph({ have, size, color }: { have: boolean; size: IconSize; color: Color }) {
  if (!have) return <Glyph name="copy-outline" size={size} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" testID="copy-glyph-yours">
      <Rect x={128} y={128} width={336} height={336} rx={57} ry={57} />
      <Path d="M383.5 128l.5-24a56.16 56.16 0 00-56-56H112a64.19 64.19 0 00-64 64v216a56.16 56.16 0 0056 56h24" />
      <Path d="M230 300l44 44 92-100" testID="copy-glyph-tick" />
    </Svg>
  );
}
