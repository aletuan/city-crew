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
