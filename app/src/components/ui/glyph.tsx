// The app's glyphs, drawn from one place and from one font: `Glyph` takes
// an Ionicons name and draws it, at a size on the scale below.
//
// ── one family (owner, 18 Nov 2026) ──
//
// For six days this component drew from two. On 12 Nov the owner chose
// Lucide's thin, round-capped lines for the tab bar's five marks over
// the Ionicons the bar wore, and asked for "the matching icons on the
// other screens too"; they were routed here by name, so the calendar on
// a trip card was the calendar on the tab. The star followed on 14 Nov
// (round joins for a rating) and a feather for the bio's row on 17 Nov,
// the third mark tried there after a quotation mark and a speech bubble.
// Seven drawings under twelve names, at Ionicons' weight: 1.5 on
// Lucide's 24 grid is the sixteenth that 32 is of 512.
//
// What that cost showed in an audit of every glyph on 18 Nov: a
// bookmark from one set beside a ⊕ from the other on every place card, a
// person from one beside a chevron from the other on a profile row —
// two hands in one row wherever one of the twelve names stood in
// content. That morning a paper plane had been routed to Lucide and sent
// back the same evening, "so the app is of one font". Three ways out
// were put to the owner:
//
//   keep it — one drawing a meaning across the app, two families in
//     some rows. The weights matched, so this was the cheap answer.
//   Lucide on the tab bar, the star and the feather only — no row of
//     two families, but the bookmark on the tab is no longer the
//     bookmark that saves, which is what 12 Nov had asked for.
//   Ionicons everywhere — taken. One font, and the tab bar wears again
//     what it wore before 12 Nov, which the owner was told: the
//     compass's needle is filled, and a tab mark's line is a sixteenth
//     of its 22pt, 1.4pt, where Lucide's was drawn at 1.1.
//
// Two of the twelve names were this component's own and are gone:
// `places`, the pin on the tab, is `location-outline`, the pin every
// place in the app already wears; `quill` is `reader-outline`, a page
// with a few lines on it, which is what the bio's row holds. Not
// `create-outline` or `pencil-outline`: a pen on a row reads as a button
// that edits, the reason `pen-line` was passed over on 17 Nov. Not a
// chat bubble: that is a message (`chatbubble-outline`).
//
// The selected tab still keeps its outline (see `FloatingTabBar`): the
// pill says "here", and that was decided apart from the family.
//
// `lucide-react-native` left the dependencies with it.

import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/** Any Ionicons name. */
export type GlyphName = keyof typeof Ionicons.glyphMap;

/*
 * ── one concept, one glyph (owner, 18 Nov 2026) ──
 *
 * The audit that set the scale below also found three concepts drawn two
 * ways, and each is one now:
 *
 *   to search — `search-outline`, never `search`. Ionicons draws the
 *     plain name with a 48-unit line and the outline with the 32 every
 *     other outline has; eight places wore the heavy one, three of them
 *     text fields beside four fields that wore the light one.
 *   an error — `alert-circle-outline`, never the solid disc, which stood
 *     on the sign-in banner and on a start point outside the catalog
 *     while the error page and a failed load drew the ring. A reason to
 *     report is `warning-outline` and a note is
 *     `information-circle-outline`; those are other things to say.
 *   again — `refresh`. Its `-outline` is the same drawing under a second
 *     name (rendered side by side at 150pt: identical), so this one is
 *     the name thirteen places already used.
 *
 * Left as they are, having looked: `image-outline`, `images-outline` and
 * `albums-outline` are a photograph, a library and a way of laying out;
 * `navigate` is a direction and `location-outline` a place; and a solid
 * glyph on a filled button (`location`, `people`, `person-add`) is the
 * app's convention there.
 */

/**
 * The sizes a glyph is drawn at: seven, each a step of about 1.2 from the
 * one before, and each named for the job the glyph is doing rather than
 * for its number.
 *
 * ── why a scale (owner, 18 Nov 2026) ──
 *
 * An audit that day counted 239 `<Glyph>` tags at twenty sizes — every
 * whole number from 9 to 22 and six more above — and 213 of the 230 with
 * a fixed size wrote the number where they stood. Nothing was wrong with
 * any one of them; each had been chosen against the text or the box
 * beside it. Together they made the app's line uneven, because a glyph's
 * stroke is a sixteenth of its size (32 units of Ionicons' 512): a 17pt chevron
 * beside a 19pt bookmark is two weights of line in one row, and 13 to 20
 * held 194 of the tags, a point apart from each other.
 *
 * The steps are where the tags already stood thickest, so the fewest
 * moved: 103 of 230 kept their size, 106 moved a point, 21 moved two or
 * three (sixteen of those are 20 → 22). The heart and the plane on a
 * collection (18), the heart on a photograph (15) and the tab bar (22),
 * each settled with the owner that week, are steps as they were.
 *
 * Weighed against it, on the same 230 tags:
 *
 *   11·13·15·17·20·24·28·40 — moved fewest (112), but is eight steps and
 *     keeps neither 18 nor 22, the two sizes just settled.
 *   12·14·16·18·20·24·28·40 — the even numbers every kit ships. Moved 149,
 *     and 18 → 20 is a step of 1.11, which is the unevenness again.
 *   11·13·16·19·22·27·40 — fewest large moves (5), but makes 16 and 19 the
 *     standard and so resizes the hearts.
 *
 * A size between two steps went to the larger, so no glyph got thinner
 * than it was by more than a point.
 *
 * `Glyph` takes nothing else: a number off the scale does not compile,
 * and `ui.ui.test.tsx` holds a line that must not, so typecheck is red
 * the day one does.
 */
export const ICON = {
  /** A badge's mark, a dot of state inside a pill. */
  tiny: 11,
  /** Beside caption type: a date's line, a count, a mark of who can see. */
  meta: 13,
  /** In a line of 15–16pt type: a row's chevron, a choice's tick. */
  text: 15,
  /** A control: the heart, the plane, a row's leading glyph, a toolbar. */
  action: 18,
  /** Getting about: the tab bar, a screen's back and close. */
  nav: 22,
  /** A picture more than a control: an empty state, a large tile. */
  feature: 27,
  /** Alone on the page. */
  hero: 40,
} as const;

export type IconSize = (typeof ICON)[keyof typeof ICON];

type IoniconsProps = React.ComponentProps<typeof Ionicons>;

/** Ionicons' own props, at a size on the scale. */
export type GlyphProps = Omit<IoniconsProps, 'name' | 'style' | 'size'> & {
  /** A step of `ICON`, and nothing between two of them. */
  size?: IconSize;
  /** A size taken from the frame the glyph fills instead of from the
   *  scale, and it wins over `size`: the person in a blank face, which is
   *  two fifths of a circle that is itself anything from 16 to 96 across.
   *  That is a proportion of a picture, not a glyph beside type, and
   *  snapping it to a step would draw one person in a 44 and a 52. */
  fit?: number;
  /** Optional, as Ionicons' is: a control whose glyph is chosen at run
   *  time may have none, and draws nothing. */
  name?: GlyphName;
  style?: StyleProp<TextStyle>;
};

export function Glyph({ name, size = ICON.meta, fit, color, style, ...rest }: GlyphProps) {
  return <Ionicons {...rest} name={name} size={fit ?? size} color={color} style={style} />;
}
