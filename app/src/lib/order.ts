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
 * The members in the order a reader has drafted but not yet saved, or as
 * they are when there is no draft.
 *
 * The draft is slugs, and the members can change under it — a reload
 * lands while a write is waiting. A slug whose place has left is dropped:
 * there is nothing to draw. Members that have arrived since the draft
 * began are appended rather than dropped: saving would otherwise leave
 * them wherever they were, which is not a decision the reader made.
 */
export function applyDraft<T extends { slug: string }>(members: T[], draft: readonly string[] | null): T[] {
  if (!draft) return members;
  const bySlug = new Map(members.map((p) => [p.slug, p]));
  return [
    ...draft.map((slug) => bySlug.get(slug)).filter((p): p is T => !!p),
    ...members.filter((p) => !draft.includes(p.slug)),
  ];
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

/**
 * The same two questions on a grid: where a tile being dragged would land,
 * and how far the others step aside while it hovers.
 *
 * A grid's cells are all one size — a tile is a square of the window's
 * width over the columns — so one `pitch` (a tile and the gap after it)
 * serves both ways, where the list needs a height per row. The order is
 * still the list's, read left to right and row by row, so a tile dropped
 * on a cell takes that cell's place in the list and everything between
 * shuffles one cell along, wrapping at a row's end the way text does.
 *
 * A cell is reached once the tile's centre is past the middle of the gap
 * to it — half a pitch, either way, as `dropSlot` rounds a row. Off the
 * grid's edges is the nearest cell on it; below the last tile is the last
 * tile, since a list has no empty places to drop into.
 */
export function gridSlot(count: number, cols: number, pitch: number, from: number, dx: number, dy: number): number {
  // Half a cell rounds away from where the tile started, both ways: Math.round
  // takes -0.5 to 0 and 0.5 to 1, which made a drag left need further than a
  // drag right.
  const cells = (d: number) => Math.sign(d) * Math.round(Math.abs(d) / pitch);
  const col = Math.min(cols - 1, Math.max(0, (from % cols) + cells(dx)));
  const row = Math.max(0, Math.floor(from / cols) + cells(dy));
  return Math.min(count - 1, row * cols + col);
}

/**
 * How far tile `i` moves while the tile at `from` hovers over `to`: the
 * tiles it has passed each take the cell before or after their own, which
 * across a row's end is the far side of the next row.
 */
export function gridStepAside(i: number, from: number, to: number, cols: number, pitch: number): { dx: number; dy: number } {
  const goes = from < to && i > from && i <= to ? i - 1 : to < from && i >= to && i < from ? i + 1 : i;
  return {
    dx: ((goes % cols) - (i % cols)) * pitch,
    dy: (Math.floor(goes / cols) - Math.floor(i / cols)) * pitch,
  };
}
