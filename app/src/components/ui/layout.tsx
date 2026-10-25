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

/**
 * How tall a control in a screen's header is.
 *
 * Smaller than `CONTROL_H` on purpose, and not a drift from it: a header
 * action sits beside a large title in a row that is read as one line, where
 * a full-size button reads as the screen's main action rather than as an
 * accessory to its title. The round buttons the other screens put in that
 * slot have always been this; naming it is what lets a pill join them
 * without inventing a third number.
 */
export const HEADER_CONTROL_H = 44;

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
