// The app's glyphs, drawn from one place: `Glyph` takes an Ionicons name
// and draws it — and for the five marks the tab bar is made of, draws the
// thin line set instead.
//
// ── why two sets (owner, 12 Nov 2026) ──
//
// The owner compared the tab bar with a reference whose five marks were
// one family of even, round-capped lines, and chose it: ours mixed a
// filled compass needle, a solid calendar on the selected tab and a
// many-lined map under the pin. The reference's marks are Lucide's
// (ISC), which has all five — compass, map-pinned, calendar-days,
// bookmark, user — and draws them through `react-native-svg`, already in
// the binary, so they reach phones by update.
//
// "Check and fix the matching icons on the other screens too": the same
// five marks appear across the app — the bookmark that saves, the
// calendar on a trip's date, the person on a profile row, the compass on
// an "explore" empty state. They are routed here by name, so a calendar on
// a trip card is the calendar on the tab. Every other glyph is Ionicons,
// unchanged, and this component is a passthrough for it.
//
// ── the star (owner, 14 Nov 2026) ──
//
// A sixth mark since: the star, outline and solid. Ionicons' star ends
// its five arms in points and its five notches in corners; the owner's
// reference was Lucide's, whose round joins soften both, the family the
// tab bar was chosen for. Routed by name like the five, so every star in
// the app changes at once — a place's rating, a stop's, a plan option's,
// the cover mark on a photo, the guide's role, the sort by rating, and
// Midnight's mark on the look sheet — and none is left pointed beside a
// round one. Solid, a rating's star is the outline filled with its own
// ink, as the saved bookmark is: the solid star here is a fact (a score,
// a cover chosen), not a dot of decoration, so it keeps its fill.
//
// ── the line ──
//
// `LINE_STROKE`, 1.5 on Lucide's 24 grid, is Ionicons' own weight: its
// outlines are 32 units on a 512 grid, a sixteenth of the glyph, and 1.5
// is a sixteenth of 24. So a Lucide bookmark sits beside an Ionicons
// chevron at the same weight. The tab bar asks for less (see there).
//
// Ionicons' solid variants have no Lucide twin. A solid bookmark is the
// outline filled with its own ink — the saved state, the one place a
// solid mark carries meaning. A solid compass, calendar or person is
// drawn as its outline: filled, the compass is a disc and the calendar a
// block, and where they were solid (the selected tab) the pill already
// says which.

import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { LucideIcon } from 'lucide-react-native';
// One file each rather than the package's index, which pulls in all of
// Lucide's 1,600 icons — 268 KB of module before a glyph is drawn.
import Bookmark from 'lucide-react-native/icons/bookmark';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Compass from 'lucide-react-native/icons/compass';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Star from 'lucide-react-native/icons/star';
import User from 'lucide-react-native/icons/user';

type IonName = keyof typeof Ionicons.glyphMap;

/** Any Ionicons name, and `places`: the pin on the ground, which the
 *  Places tab wears and Ionicons does not have. */
export type GlyphName = IonName | 'places';

/** Lucide's 24-grid stroke at Ionicons' weight: a sixteenth of the box. */
export const LINE_STROKE = 1.5;

/** The marks drawn from the line set, and whether the name asks for the
 *  filled form. */
const LINE: Partial<Record<GlyphName, [LucideIcon, boolean]>> = {
  places: [MapPinned, false],
  compass: [Compass, false],
  'compass-outline': [Compass, false],
  calendar: [CalendarDays, false],
  'calendar-outline': [CalendarDays, false],
  bookmark: [Bookmark, true],
  'bookmark-outline': [Bookmark, false],
  person: [User, false],
  'person-outline': [User, false],
  star: [Star, true],
  'star-outline': [Star, false],
};

/** True when `name` is drawn from the line set rather than Ionicons. */
export const isLineGlyph = (name: GlyphName): boolean => LINE[name] != null;

type IoniconsProps = React.ComponentProps<typeof Ionicons>;

/** Ionicons' own props, with a name the line set may answer for. */
export type GlyphProps = Omit<IoniconsProps, 'name' | 'style'> & {
  /** Optional, as Ionicons' is: a control whose glyph is chosen at run
   *  time may have none, and draws nothing. */
  name?: GlyphName;
  /** Ionicons' text style — margins carry over to a drawing; text-only
   *  keys such as a halo's shadow have nothing to act on there. */
  style?: StyleProp<TextStyle>;
  /** On Lucide's 24 grid; ignored by an Ionicons glyph. */
  strokeWidth?: number;
};

export function Glyph({ name, size = 12, color, style, strokeWidth = LINE_STROKE, ...rest }: GlyphProps) {
  const line = name ? LINE[name] : undefined;
  if (!line) {
    return <Ionicons {...rest} name={name as IonName | undefined} size={size} color={color} style={style} />;
  }
  const [Mark, filled] = line;
  const ink = color as string | undefined;
  return (
    <Mark
      {...(rest as object)}
      size={size}
      color={ink}
      strokeWidth={strokeWidth}
      fill={filled ? ink : 'none'}
      // An Svg takes a view's style; a text style's layout keys are the
      // ones that apply to it.
      style={style as never}
    />
  );
}
