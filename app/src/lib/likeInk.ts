// The red of a heart that has been liked — one red, whatever look the
// app is wearing (owner, 28 Nov 2026).
//
// ── why not the accent ──
//
// `colors.like` was the look's accent under its own name (18 Nov 2026),
// decided when every look's accent was the coral: "this app's accent is
// already a red". There are 21 palettes now, and the accent is a teal in
// one, a gold in three, and in five so near the grey of a heart not yet
// liked that only the fill told them apart — the colour difference (CIE
// ΔE*ab) between the two inks on a card was 2 on Chocolate, 3 on Maroon,
// 4 on Slate, 10 on Sand, 13 on Plum; on Amber a liked heart was the
// type's own near-black. Liked is a state, as "open" and "shut" are, and
// a state keeps its colour when the look changes; red is what it is in
// every app a reader has liked something in.
//
// ── two reds, by the ground's lightness ──
//
// One hue cannot clear every ground: a red light enough for a navy card
// is pink on white paper. So there are two, chosen by the luminance of
// the look's page. Each was tried against the page and the flattened
// card of every palette (`likeInk.test.ts` holds them there); the
// weakest ground is Amber's page at 3.19:1 and no ground is under the 3:1
// a graphic mark is owed. The first pair tried, #D7263D and #FF5C6C, came
// to 2.78 on that page and 2.8 on Royal's card.
//
// Computed, not seen on a phone.

/** On a light ground: paper, and the pastel looks. */
export const LIKE_ON_LIGHT = '#C81E36';
/** On a dark ground — and on a photograph, which wears a dark scrim
 *  wherever a heart stands. */
export const LIKE_ON_DARK = '#FF6E7C';

/** Below this the page counts as dark. The palettes' pages fall well to
 *  either side of it: the darkest light one is Amber's (0.54), the
 *  lightest dark one Plum's (0.07). */
const DARK_UNDER = 0.25;

/** WCAG relative luminance of `#RRGGBB`. */
export function luminanceOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast of two `#RRGGBB`. */
export function contrastOf(a: string, b: string): number {
  const [hi, lo] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The liked heart's red for a look whose page is `bg` (`#RRGGBB`). */
export function likeInk(bg: string): string {
  return luminanceOf(bg) < DARK_UNDER ? LIKE_ON_DARK : LIKE_ON_LIGHT;
}
