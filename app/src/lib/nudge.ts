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
//   THE DOCK ALWAYS ANSWERS. Every time the bar leaves it, the offer
//   takes the slot — including the third and the tenth time. An earlier
//   version made a decline stick for the visit; on a device that read as
//   the feature working once and then dying, because the dock's whole
//   contract is that hiding the bar reveals the offer.
//
//   ONE BEAT OF SETTLE, NOT A WAIT. The offer follows the bar out by a
//   barely-visible beat — just enough that the bar's exit and the
//   offer's entrance never cross in the middle of the dock and read as
//   one thing morphing into another. It must still *feel* immediate.
//
// The caller owns what "hide" and "show" mean; this owns only when.

export const NUDGE_SETTLE_MS = 120;

export type NudgeGate = {
  /** Feed the current eligibility and clock; returns whether the offer
   *  should be visible right now. Call again after `settleMs` while
   *  eligibility holds — the gate keeps no timer of its own. */
  update: (eligible: boolean, t: number) => boolean;
  /** Something else took the dock (a navigation) — start the beat over. */
  reset: () => void;
};

export function createNudgeGate({ settleMs = NUDGE_SETTLE_MS }: { settleMs?: number } = {}): NudgeGate {
  let since: number | null = null;
  return {
    update(eligible, t) {
      if (!eligible) {
        since = null;
        return false;
      }
      if (since === null) since = t;
      return t - since >= settleMs;
    },
    reset() {
      since = null;
    },
  };
}
