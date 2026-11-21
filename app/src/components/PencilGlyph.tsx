// The gold pencil beside an invitation to write: the empty bio on your
// own page (`BioInvite`) and the empty description on your own list's
// page. The two places one is drawn, and the only two (owner, 21 Nov
// 2026).
//
// Ionicons' `pencil` was the glyph, and at the 15pt beside the
// invitation's words its shaft is under 2pt across: the owner read it
// as thin, a stroke rather than a pencil. Drawn here instead, option C
// of five shown that day: a thick shaft, an eraser cut off by a gap,
// and the point, on a 24 grid turned 45°, at the same 15 so that it
// stands no taller than the words beside it. The gap is a gap, not a
// band painted in the ground's colour, so the glyph reads the same on
// the bio's bubble and on the list's card.
//
// Rejected the same day: the same Ionicons pencil a step up at 18 (as
// thin, only longer, and taller than the words); the thick pencil at
// 18 (heavier than the faint line it serves); and a pencil in a pale
// gold disc (one more block of colour on a card meant to be light).

import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Color } from '../theme';
import { ICON } from './ui/glyph';

export function PencilGlyph({ color }: { color: Color }) {
  return (
    <Svg width={ICON.text} height={ICON.text} viewBox="0 0 24 24" fill={color} testID="pencil-glyph">
      <Rect x={9} y={1.5} width={6} height={2.6} rx={1.2} transform="rotate(45 12 12)" testID="pencil-glyph-eraser" />
      <Rect x={9} y={5.2} width={6} height={10.8} rx={0.6} transform="rotate(45 12 12)" />
      <Path d="M9 16h6l-3 6z" transform="rotate(45 12 12)" />
    </Svg>
  );
}
