// The floating tab bar's hide-on-scroll decision, as a pure state machine.
//
// Extracted from the React context that animates the bar, after the one
// bug this file exists to prevent: the bar strobing while the reader
// scrolls. The moving parts are exactly the ones that went wrong —
//
//   HYSTERESIS, not a threshold. Travel accumulates per direction and
//   resets when the direction flips. Hiding takes more committed descent
//   than returning takes ascent, so a wobbling thumb, a slow scroll, or
//   iOS's rubber band handing back alternating deltas cannot toggle the
//   bar mid-animation.
//
//   THE ANCHOR CAN BE FORGOTTEN. When something other than scrolling
//   surfaces the bar — a tab change — the next offset belongs to a
//   different scroll view at a different position. If the old anchor
//   survived, that first event would read as hundreds of points of
//   "descent" and hide the bar the moment the reader touched the new
//   screen. `reset()` marks the anchor unknown; the next report only
//   plants it.
//
//   OVERSCROLL IS NOT A DIRECTION. Offsets are clamped to [0, maxY], so
//   the bounce past either end of a list feeds the accumulator nothing.
//
//   DECISIONS ARE EDGES, NOT LEVELS. `report` answers only when the
//   desired state *changes* — one 'hide' per descent, however long it
//   runs — so a caller wiring decisions straight to an animation cannot
//   be made to restart it every frame.
//
// The caller owns what "hide" and "show" mean; this owns only when.

export type DuckDecision = 'hide' | 'show' | null;

export type DuckTracker = {
  /** Feed a scroll offset (and the scrollable's max offset, when known).
   *  Returns what the bar should do now — usually nothing. */
  report: (y: number, maxY?: number) => DuckDecision;
  /** The bar was surfaced by something other than scrolling. Forget the
   *  anchor and the accumulated travel. */
  reset: () => void;
};

export function createDuckTracker({
  hideTravel = 24,
  showTravel = 12,
  topSlack = 80,
}: { hideTravel?: number; showTravel?: number; topSlack?: number } = {}): DuckTracker {
  let lastY: number | null = 0;
  let travel = 0;
  let hidden = false;
  return {
    report(y, maxY) {
      const clamped = Math.min(Math.max(0, y), maxY != null && maxY >= 0 ? maxY : Infinity);
      if (lastY === null) {
        lastY = clamped;
        return null;
      }
      const dy = clamped - lastY;
      lastY = clamped;
      if (dy !== 0) {
        travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      }
      const wantHidden = clamped <= topSlack || travel < -showTravel
        ? false
        : travel > hideTravel ? true : hidden;
      if (wantHidden === hidden) return null;
      hidden = wantHidden;
      return hidden ? 'hide' : 'show';
    },
    reset() {
      lastY = null;
      travel = 0;
      hidden = false;
    },
  };
}
