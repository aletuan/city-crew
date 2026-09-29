// Putting a list in a different order, as arithmetic.
//
// Small enough to look unnecessary, and it is here for the same reason
// `itinerary.ts` is: the interesting part of reordering is not the gesture,
// it is what happens to the indices, and an off-by-one in a `splice` pair
// produces a list that looks plausible and is wrong. A screen cannot test
// that; this can.
//
// Generic over the item because two callers want it for different things —
// the plan editor moves stops, the collection screen moves slugs — and a
// version that knew about either would be copied rather than shared.

/**
 * One item moved from `from` to `to`, everything else closing up behind it.
 *
 * Out-of-range indices return a copy unchanged rather than throwing. Both
 * callers reach this from a button that may be at the end of the list, and
 * "the last item cannot move down" is better expressed by nothing happening
 * than by every caller guarding first.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/**
 * Whether two orderings are the same run of the same things.
 *
 * The point is to know there is nothing to save. Writing an unchanged order
 * back is a loop of update round-trips that changes no row, and a Save
 * button that lights up when you have moved something and back is a button
 * lying about having work to do.
 */
export function sameOrder<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Where a row being dragged would land, from how far it has moved.
 *
 * `pitches` is each row's height plus the gap under it, in list order —
 * the rows are not one height (a place with no neighbourhood is a line
 * shorter), so a single row height would put the drop a row off once a
 * short one is crossed. A row is passed once the dragged row's centre is
 * past the middle of it, which is where the eye says it has swapped.
 *
 * `dy` is the finger's travel since the lift, positive downward.
 */
export function dropSlot(pitches: readonly number[], from: number, dy: number): number {
  let to = from;
  if (dy > 0) {
    let travelled = 0;
    for (let i = from + 1; i < pitches.length; i++) {
      travelled += pitches[i];
      if (dy < travelled - pitches[i] / 2) break;
      to = i;
    }
  } else {
    let travelled = 0;
    for (let i = from - 1; i >= 0; i--) {
      travelled += pitches[i];
      if (-dy < travelled - pitches[i] / 2) break;
      to = i;
    }
  }
  return to;
}

/**
 * How far row `i` steps aside while the row at `from` hovers over `to`:
 * the rows it has passed move one lifted row's pitch the other way, into
 * the room it left. Everything else stays put.
 */
export function stepAside(i: number, from: number, to: number, lifted: number): number {
  if (from < to && i > from && i <= to) return -lifted;
  if (to < from && i >= to && i < from) return lifted;
  return 0;
}
