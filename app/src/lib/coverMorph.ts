// How a collection's tile becomes the cover of its page, and how the places
// under it arrive. Pure: the numbers and the two decisions, so the
// components that draw them hold no arithmetic of their own.
//
// The numbers come from the motion prototype the owner reviewed on
// 22 Nov 2026 (a diagonal wave of 38ms a step, 420ms a cell, 440ms for the
// cover). They are NOT measured on a device yet: `docs/tracing.md` is the
// way to do it, and a number changed after that is changed here, in the
// one place, with the measurement beside it.

/** A rectangle in window coordinates, as `measureInWindow` reports it. */
export type Rect = { x: number; y: number; w: number; h: number };

/** Where a tile stood when it was pressed, and the picture it showed. */
export type CoverFrom = { rect: Rect; uri: string };

/** The cover growing from the tile to the page's own. */
export const MORPH_MS = 440;

/** One row arriving. */
export const ARRIVE_MS = 420;
/** The row after it starts this much later: the prototype's 38ms a
 *  diagonal step, two to a row. A row, not a cell: a grid's row is the
 *  list's cell, and the tile inside it is drawn, lifted and dragged by
 *  code that must not gain a wrapper. */
export const ARRIVE_ROW_MS = 76;
/** Before the first row, so the cover is on its way before the places
 *  begin. */
export const ARRIVE_BASE_MS = 160;
/** Only the first four rows. A list is virtualised, so a row that mounts
 *  later because the reader scrolled must not announce itself. */
export const ARRIVE_ROWS = 4;

/**
 * Whether a measurement can be drawn from. `measureInWindow` reports zeros
 * for a view that is not laid out (and NaN off-screen on some versions),
 * and a cover grown from nothing is worse than none.
 */
export function usableRect(r: Rect): boolean {
  return [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0;
}

/** The delay of the row at `row`. */
export function arriveDelay(row: number): number {
  return ARRIVE_BASE_MS + row * ARRIVE_ROW_MS;
}

/** Whether the row at `row` arrives. */
export function arrives(row: number): boolean {
  return row < ARRIVE_ROWS;
}

/** What a native view offers of itself: where it stands in the window. */
export type Measurable = {
  measureInWindow: (done: (x: number, y: number, w: number, h: number) => void) => void;
};

/** Where `node` stands in the window now, or null when there is no node. */
export function measureWindow(node: Measurable | null | undefined): Promise<Rect | null> {
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => node.measureInWindow((x, y, w, h) => resolve({ x, y, w, h })));
}

/**
 * How a collection's page comes in. From a tile it fades, because the cover
 * is crossing the screen over it and a page sliding in beneath would be two
 * motions fighting for one thing; from anywhere else it slides, as every
 * page does.
 */
export function detailAnimation(from: CoverFrom | undefined): 'fade' | 'default' {
  return from ? 'fade' : 'default';
}
