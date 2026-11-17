// When a feed should draw its next cards: before the reader gets there.
//
// A person's page drew five cards and a "Show more" (17 Nov 2026, the
// morning the feed shipped). The owner, the same afternoon: a feed loads
// as you go — that is what every one a reader has used does. They do not
// wait for the end either: Instagram, Threads and Facebook ask for the
// next page while there is still a screen or three of the last one left,
// so the end is never seen arriving.
//
// This is that test, and only that: given where a scroll view is, is the
// reader within `AHEAD` screens of the end of what is drawn?

/** What a scroll event says about where the view is — the three figures
 *  of React Native's `NativeScrollEvent` this needs. */
export type ScrollAt = {
  contentOffset: { y: number };
  contentSize: { height: number };
  layoutMeasurement: { height: number };
};

/**
 * How many screens from the end the next cards are drawn.
 *
 * One and a half. A card on a person's page is some 380pt (36 + 28 of
 * head, 168 of photograph, about 100 of words, 44 of heart), so a
 * 852pt screen and a half is three cards and a bit: the reader has three
 * still to read when five more are added under them. Under one screen,
 * a fast flick outruns the drawing and shows the end; past three, a
 * reader who stops after two cards has paid for ten. Drawn to scale,
 * not measured on a phone.
 */
export const AHEAD = 1.5;

/** Whether what is left under the screen is less than `ahead` screens. */
export function nearEnd(at: ScrollAt, ahead: number = AHEAD): boolean {
  const left = at.contentSize.height - (at.contentOffset.y + at.layoutMeasurement.height);
  return left < at.layoutMeasurement.height * ahead;
}
