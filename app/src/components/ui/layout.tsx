// The tab bar's geometry and the window's width: the numbers every
// screen clears or measures against.

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../../theme';

// ── tab bar geometry ──
// A floating glass island (see FloatingTabBar), inset from the screen
// edges and sitting above the home indicator; position:absolute so
// content scrolls beneath it, which means screens must clear it
// themselves.
//
// 64, up from the 58 the first icon-only island used, when the captions
// came in. They went again on 11 Oct 2026 and the 64 stayed, at the
// owner's choice: every screen's bottom clearance is measured off this
// number, and the selected pill now sits in it 4pt from the rim. See
// FloatingTabBar.
export const TAB_BAR_HEIGHT = 64;

/** The air between the island and the safe area's bottom edge. */
export const TAB_BAR_GAP = 10;

/**
 * How tall a full-size button is, everywhere.
 *
 * Shared because buttons of this class sit next to each other and the eye
 * reads a few points of difference as a mistake — which it was: the primary
 * CTA came out 50pt inline and 52pt when `wide`, the pill beside it 44pt,
 * and the auth form's button ~52pt, all from paddings tuned separately
 * around glyphs and labels of different sizes. Setting the height directly
 * takes the guesswork out: a button is this tall whatever is inside it.
 *
 * `minHeight` rather than `height`, so a label that wraps — a translation
 * longer than its English — grows the button instead of being clipped by it.
 *
 * This is the size class for buttons that carry an action on their own.
 * Chips, badges, ghost pills and icon wells are deliberately smaller and
 * are not this.
 */
export const CONTROL_H = 52;

// ── the button scale: 52, 44, 32, and nothing between (owner, 28 Oct 2026) ──
//
// Measured that day from the padding and the font's own line height, the
// app's buttons stood at more than a dozen heights between 32 and 54 —
// the sign-in sheet's 54, the invitation's 47, Sign out's 46, the invite
// card's 42, Accept's 40, Search's fork chips at 37, a suggestion's Add
// at 35 —
// each a padding tuned around its own label. Only the 52 and the
// header's 44 were set as numbers; Explore's hero button landed on 44 by
// way of 12 + Space Grotesk's 20.4pt line + 12, and would have left it the
// first time its word changed. Three sizes, each by role, each a
// `minHeight` so a long translation still grows the control:
//
//   `CONTROL_H`            the one action a sheet or a card is for
//   `SECONDARY_CONTROL_H`  every other action that stands on its own
//   `CHIP_H`               a choice, or an action inside a row
//
// Badges and pills that only label something (a kind, a price, a score)
// are not buttons and are not on the scale. `scripts/controlHeights.test.ts`
// holds every style that is.

/**
 * How tall a button that is not the screen's main action is: a header
 * action, a dock's pill, a round button, the hero's Explore, a segment.
 *
 * Smaller than `CONTROL_H` on purpose. A header action sits beside a large
 * title in a row that is read as one line, where a full-size button reads
 * as the screen's main action rather than as an accessory to its title.
 * The round buttons have always been this. It was `HEADER_CONTROL_H` until
 * the scale above gave it the rest of the app's secondary actions too.
 */
export const SECONDARY_CONTROL_H = 44;

/**
 * How tall a chip is, and an action that lives inside a row — a friend
 * request's Cancel, a suggestion's Add, a candidate's View, a Retry.
 *
 * 32 because the row actions stood at 32–35 and a display-only chip at
 * 32.7, so this is where they already were, minus the drift. A tappable
 * chip used to draw itself 44 tall to be a 44pt target; it draws 32 now
 * and reaches the rest with `CHIP_SLOP`. The box is what the eye reads,
 * the target is what the thumb finds, and they no longer have to be one.
 */
export const CHIP_H = 32;

/**
 * What a `CHIP_H` control adds above and below itself to make Apple's 44pt
 * target: `hitSlop={CHIP_SLOP}`. Vertical only — beside it in a row is the
 * next chip, 8pt away, and a sideways slop would take taps meant for that.
 * A wrapped row below is 8pt away too, so there the two slops overlap by
 * 4pt: a tap in that strip is a tap between two chips either way.
 */
export const CHIP_SLOP = {
  top: (SECONDARY_CONTROL_H - CHIP_H) / 2,
  bottom: (SECONDARY_CONTROL_H - CHIP_H) / 2,
};

/** Bottom padding that clears the floating tab bar plus breathing room. */
export function useTabBarClearance(extra = 18): number {
  return useTabBarLift() + TAB_BAR_HEIGHT + extra;
}

/**
 * How high the island's lower edge rides above the screen edge.
 *
 * Shared because three things need the same number and they used to
 * compute it separately: the bar positions itself by it, the duck
 * animation slides by it plus the bar's height, and every screen pads its
 * list by it. When the bar came down to sit closer to the edge, a
 * clearance still adding the whole safe-area inset left 46pt of dead air
 * under every list — the kind of drift that only shows up as "the spacing
 * looks off" months later.
 *
 * It clears the home indicator (about 13pt) rather than the whole inset,
 * which is generous by design, and floors at `TAB_BAR_GAP` for a device
 * with no inset at all.
 */
export function useTabBarLift(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom - 18, TAB_BAR_GAP);
}

/**
 * The island's clearance from each side of the screen: the page's own
 * margin, so its edges line up with the cards above it. Threads does the
 * same.
 *
 * It was 12, and then for a few hours 24 with a 340pt cap (11 Oct 2026).
 * On a Pro Max the cap left the bar about 45pt in from each edge, visibly
 * narrower than the content over it. The owner measured it against the
 * card above, and the cards are what the bar has to agree with.
 */
export const TAB_BAR_SIDE = space.page;

/**
 * Where the island sits across the screen: `TAB_BAR_SIDE` in from each
 * edge. Shared, because the Explore offer that takes the island's place in
 * the same slot has to be the same width, or the two read as different
 * objects.
 */
export function useTabBarFrame(): { left: number; width: number } {
  const { width: win } = useWindowDimensions();
  return { left: TAB_BAR_SIDE, width: win - TAB_BAR_SIDE * 2 };
}

/**
 * A window narrower than this is a small phone.
 *
 * Every layout in this app was drawn against a 393pt phone, and most of
 * it is fluid enough to fold down without being told. This is for the
 * rest: the few rows whose furniture is fixed — a switch, a pill button,
 * a tab strip's gaps — and whose width budget was reasoned out in a
 * comment against 393 and simply does not hold at 320.
 *
 * 320 is not only the iPhone SE. Any iPhone with Display Zoom on
 * ("Larger Text" under Display & Brightness) reports 320pt of width, so
 * an iPhone 15 can be a small phone by a setting — which is how the
 * Profile card's switch was first seen clipped off the right edge on
 * one. 360 as the line, not 321: the zoomed Max models report 375, and a
 * threshold between the two real widths is one no device will ever sit
 * on the wrong side of by a rounding.
 */
export const NARROW_WINDOW = 360;

/** True on a 320pt window — an SE, or any iPhone zoomed. See NARROW_WINDOW.
 *
 *  A width of 0 is a window that has not reported, not a small one: under
 *  jsdom `react-native-web` measures the document at 0, and without this
 *  guard every UI test would have run the small-phone layout without
 *  saying so. */
export function useNarrowWindow(): boolean {
  const { width } = useWindowDimensions();
  return width > 0 && width < NARROW_WINDOW;
}
