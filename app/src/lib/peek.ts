// A scrolling row that says it scrolls: the screen's edge cuts an item.
//
// ── the problem (owner, 24 Oct 2026) ──
//
// Explore's kinds became a row of words with no boxes (`UnderlineChoice`),
// and on the owner's phone the edge of the screen fell in the gap after
// "Ngắm cảnh": every item on screen was whole, the fade at the right end
// lay over empty paper, and the row read as finished. The rest of the
// kinds were there to be scrolled to and nothing said so.
//
// A fixed gap cannot fix that. Where the edge falls depends on the phone's
// width, the reader's text size and the language — "Ngắm cảnh", "Views"
// and "眺望" are three different widths — so any number that works on one
// phone leaves the edge in a gap on another.
//
// ── the answer ──
//
// Measure, and choose the gap. The row knows each item's width and its
// own; of the gaps between `min` and `max`, it takes the one nearest the
// row's own that makes the edge cut an item through its middle, so a
// piece of the next kind — its glyph and a letter or two — always shows.
// The cut item is the sign; nobody has to be told the row scrolls.
//
// Far enough in, and far enough short: an edge that clips the last few
// points of a word reads as a rendering slip, and one that shows a sliver
// of the next glyph is a sliver nobody notices. In points, not as a share
// of the item, because what has to show is the glyph and a letter — the
// same size whatever word follows them.
//
// ── what a gap cannot do, measured ──
//
// The edge moves by the number of gaps before it times the change, so with
// three or four items on screen a gap from 14 to 34 moves it 40–80pt — not
// always enough to clear a whole word. Over every width from 300 to 440pt,
// with the kinds' widths in Vietnamese, English, Japanese and at a large
// text size, the gap reaches both targets on most widths and on the rest
// still cuts an item: the worst found shows 18pt of it and hides 9 (on a
// 317pt row in Vietnamese). That is a cut a reader sees; it is the floor.
//
// Plain functions, no React; tested from `peek.test.ts`.

export type PeekRow = {
  /** The row's padding before the first item. */
  padLeft: number;
  /** The gap the row uses when nothing needs cutting. */
  base: number;
  /** The narrowest and widest gap the row may take. */
  min: number;
  max: number;
};

/** What the cut should leave in sight — a glyph and a letter — and what it
 *  should hide, so the word is plainly unfinished. */
export const PEEK_SHOWN = 32;
export const PEEK_HIDDEN = 16;

/** Where the edge cuts an item: how much of it shows, how much does not;
 *  null when the edge falls in a gap, or before or past every item. */
export function cutAt(
  widths: readonly number[], gap: number, edge: number, padLeft: number,
): { shown: number; hidden: number } | null {
  let start = padLeft;
  for (const w of widths) {
    if (edge > start && edge < start + w) return { shown: edge - start, hidden: start + w - edge };
    start += w + gap;
  }
  return null;
}

/** How well a gap cuts: 1 when both targets are met, less as either falls
 *  short, 0 when nothing is cut at all. */
export function cutScore(widths: readonly number[], gap: number, edge: number, padLeft: number): number {
  const c = cutAt(widths, gap, edge, padLeft);
  if (!c) return 0;
  return Math.min(1, c.shown / PEEK_SHOWN, c.hidden / PEEK_HIDDEN);
}

/** The row's whole width at a gap, paddings included. */
export function rowWidth(widths: readonly number[], gap: number, padLeft: number, padRight: number): number {
  const items = widths.reduce((a, w) => a + w, 0);
  return padLeft + items + gap * Math.max(0, widths.length - 1) + padRight;
}

/**
 * The gap that makes `edge` cut an item well.
 *
 * `base` when everything fits — there is nothing to scroll to, so nothing
 * to signal. Otherwise the whole gaps from `min` to `max`, nearest `base`
 * first, and the first that meets both targets; when none does, the one
 * that comes nearest. (Which of a pair goes first makes no difference
 * that could be found: a narrower gap pulls the next item in, a wider one
 * pushes the last one out, and no row tried had both work at one step.)
 */
export function peekGap(widths: readonly number[], edge: number, row: PeekRow): number {
  if (rowWidth(widths, row.base, row.padLeft, 0) <= edge) return row.base;
  let best = row.base;
  let bestScore = -1;
  for (let d = 0; row.base - d >= row.min || row.base + d <= row.max; d++) {
    for (const g of d === 0 ? [row.base] : [row.base - d, row.base + d]) {
      if (g < row.min || g > row.max) continue;
      const score = cutScore(widths, g, edge, row.padLeft);
      if (score >= 1) return g;
      if (score > bestScore) { best = g; bestScore = score; }
    }
  }
  return best;
}

/**
 * Whether anything of the row lies past the right edge: the fade's cue.
 * A point of slack, because a scroll that ends on a fraction of a pixel
 * must not leave the fade standing over a row that is at its end.
 */
export function moreToTheRight(contentWidth: number, edge: number, scrollX: number): boolean {
  return scrollX + edge < contentWidth - 1;
}
