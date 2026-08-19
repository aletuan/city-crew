// When the "Not finding it?" offer may borrow the tab bar's dock.
//
// The two share one slot at the bottom of Explore, and the sharing has
// rules — this file is the rules, pure and tested, with the React halves
// (the animation, the timers) kept out.
//
//   THE BAR ALWAYS WINS. Eligibility means "the bar is away and the
//   reader is deep in a long list". The moment either stops being true
//   the offer is gone — same frame, no argument. A reader pulling back
//   up is reaching for navigation, and navigation must be what they find.
//
//   THE OFFER WAITS. It appears only after eligibility has held for
//   `settleMs`. An instant swap reads as the bar morphing into an ad —
//   the dock should sit empty for a beat, then be quietly offered.
//
//   DECLINED MEANS DECLINED. If the offer was shown and the reader moved
//   on without taking it (the bar came back — they pulled up), it does
//   not return this visit. An offer that keeps reappearing every few
//   hundred points of scroll is not an offer; it is a banner. `reset()`
//   forgives on the next visit to the screen.

export const NUDGE_SETTLE_MS = 500;

export type NudgeGate = {
  /** Feed the current eligibility and clock; returns whether the offer
   *  should be visible right now. Call again after `settleMs` while
   *  eligibility holds — the gate keeps no timer of its own. */
  update: (eligible: boolean, t: number) => boolean;
  /** A fresh visit to the screen forgives an earlier decline. */
  reset: () => void;
};

export function createNudgeGate({ settleMs = NUDGE_SETTLE_MS }: { settleMs?: number } = {}): NudgeGate {
  let since: number | null = null;
  let shown = false;
  let declined = false;
  return {
    update(eligible, t) {
      if (!eligible) {
        // On screen, and the reader moved on without taking it.
        if (shown) declined = true;
        shown = false;
        since = null;
        return false;
      }
      if (declined) return false;
      if (since === null) since = t;
      if (t - since >= settleMs) shown = true;
      return shown;
    },
    reset() {
      since = null;
      shown = false;
      declined = false;
    },
  };
}
