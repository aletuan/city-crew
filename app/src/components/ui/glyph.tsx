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
// ── the bio's mark: a quote, a speech bubble, a feather (owner, 16–17 Nov 2026) ──
//
// A seventh, for the bio's row in About me. On 16 Nov the owner chose
// Lucide's `quote` from four: `user-round` says what the Profile tab
// already says, `message-square-text` and `notebook-pen` say a message
// and a diary, and a bio is neither — it is something the person said
// about themselves, which is what quotation marks are for.
//
// A day later it was `message-circle`, the owner's choice from six more.
// Two things had changed. A person's page had come to draw the bio as a
// speech bubble from their picture (`PersonScreen`'s `Bio`), so the
// row's mark now says what that page draws: these are words this person
// is saying. And on the card the pair of marks had read as a quotation,
// which is somebody else's words set down, where a bio is one's own.
//
// What it cost, and the owner was told before choosing: "Message" on a
// person's page wears a chat bubble too (Ionicons' `chatbubble-outline`),
// so one shape stood for a bio here and for sending a message there.
//
// The same afternoon, with the bubble on the phone, the owner asked for
// `feather` in its place — one of the six, passed over that morning as
// saying "writing" rather than "about me". Seen on the card that is the
// reading that fits: the row holds a few lines the person wrote, and
// empty it says "Write a few words about you". And the bubble goes back
// to meaning one thing, a message. What it gives up is the echo of the
// person's page, where the bio is still drawn as a bubble from the face;
// the row and that page are a tab apart and never side by side.
//
// A name of the component's own, `quill`: Ionicons has no feather to
// route, and the name says what it is for where `feather` would say
// what it is.
//
// Still not taken from the six: `pen-line` (an edit button to look at,
// on a row that is not pressed once it holds a bio), `sparkles` (the
// mark of what the app drafts or picks by itself), and `user-round` and
// `message-square-text` again.
//
// ── the paper plane, for a day (owner, 18 Nov 2026) ──
//
// An eighth mark was routed here that morning: Lucide's `send` for the
// plane on a list's Share button, because Ionicons' was called "three
// sharp points". Drawn side by side at 160pt the two are one shape —
// Lucide's a little larger and a little thinner — so the move bought no
// softness, and put a mark from this set beside a heart from the other.
// An audit of every glyph in the app that evening found it was the only
// one of its kind: the one line-set mark in a row of Ionicons. The owner
// sent it back, "so the app is of one font", and the rule is:
//
//   **the line set is for getting about and for marks of identity** —
//   the tab bar, the star of a role, the feather of a bio. Everything
//   else is Ionicons, so two marks in one row are of one family.
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
import Feather from 'lucide-react-native/icons/feather';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Star from 'lucide-react-native/icons/star';
import User from 'lucide-react-native/icons/user';

type IonName = keyof typeof Ionicons.glyphMap;

/** Any Ionicons name, and two of this component's own: `places`, the
 *  pin on the ground the Places tab wears, and `quill`, the feather
 *  that leads the bio on Profile. */
export type GlyphName = IonName | 'places' | 'quill';

/** Lucide's 24-grid stroke at Ionicons' weight: a sixteenth of the box. */
export const LINE_STROKE = 1.5;

/** The marks drawn from the line set, and whether the name asks for the
 *  filled form. */
const LINE: Partial<Record<GlyphName, [LucideIcon, boolean]>> = {
  places: [MapPinned, false],
  quill: [Feather, false],
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
 * stroke is a sixteenth of its size (see `LINE_STROKE`): a 17pt chevron
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

/** Ionicons' own props, with a name the line set may answer for. */
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
  /** Ionicons' text style — margins carry over to a drawing; text-only
   *  keys such as a halo's shadow have nothing to act on there. */
  style?: StyleProp<TextStyle>;
  /** On Lucide's 24 grid; ignored by an Ionicons glyph. */
  strokeWidth?: number;
};

export function Glyph({ name, size = ICON.meta, fit, color, style, strokeWidth = LINE_STROKE, ...rest }: GlyphProps) {
  const line = name ? LINE[name] : undefined;
  const px = fit ?? size;
  if (!line) {
    return <Ionicons {...rest} name={name as IonName | undefined} size={px} color={color} style={style} />;
  }
  const [Mark, filled] = line;
  const ink = color as string | undefined;
  return (
    <Mark
      {...(rest as object)}
      size={px}
      color={ink}
      strokeWidth={strokeWidth}
      fill={filled ? ink : 'none'}
      // An Svg takes a view's style; a text style's layout keys are the
      // ones that apply to it.
      style={style as never}
    />
  );
}
