// Best first, with a thumb on the scale for what this reader likes.
//
// Lifted out of `opennow.ts` when Explore wanted the same ordering. It
// was never really about opening hours: that module filters to the doors
// that are open and then ranks what is left, and only the filter is about
// the hour. Two surfaces asking for "the good ones, leaning your way"
// should not be two comparators — that is how two lists meant to agree
// stop agreeing.
//
// What stayed behind in `opennow.ts` is the part that is genuinely its
// own: `openState`, the cap of five, and the argument for why a place
// whose hours cannot be read is simply absent.

/** Enough of a place to put in order. Structural, so Node can run it and
 *  so a test does not have to build a catalog row to say "4.5, and lots
 *  of reviews". */
export type Rated = {
  slug: string;
  rating?: number | null;
  rating_count?: number | null;
};

/** Just enough of a taste to rank with — `Taste` from `planner.ts`, minus
 *  its dependency on `Place`, so this module stays importable from Node. */
export type Affinity<T> = { affinity: (p: T) => number };

/**
 * How far taste may move a place, in stars.
 *
 * Measured rather than chosen. The catalog's 374 rated places run 3.60 to
 * 5.00 with a **standard deviation of 0.23** — three quarters of them sit
 * between 4.50 and 4.90. That is why the open-now list in the reference
 * capture reads 4.9, 4.9, 4.9: ranking this catalog by rating alone is
 * close to ranking it by nothing, and the three cards a reader sees are
 * decided by the fourth decimal place.
 *
 * So one standard deviation is the whole budget. Inside the 4.5–4.9 pack
 * it is decisive — it reorders the band that rating cannot separate — and
 * outside it, it can do nothing that matters: a 3.6 lifted to 3.85 is
 * still below every 4.5 in the city. A guide that let a mediocre place
 * outrank a good one because you like cafés would have stopped being a
 * guide.
 *
 * `affinity` is bounded to [−1, 1] by `taste.ts`, which is what makes
 * this a budget rather than a hope.
 */
export const TASTE_LIFT = 0.23;

/**
 * The places, best first.
 *
 * Rating down the column, 4.6 above 4.5 above 4.3. Rated above unrated,
 * more-reviewed first among equals, slug as the final tie so the list
 * holds still between renders. All of that decides the order; `taste`
 * only adds `TASTE_LIFT` worth of thumb to the scale, and passing nothing
 * gives exactly the rating order.
 *
 * The final `slug` tie is not a hedge. Two places can share a rating
 * *and* a review count — the catalog has plenty of 4.5s with no reviews
 * at all — and without a total key the comparator returns 0 for them,
 * leaving their order to whatever the engine does with equal elements,
 * which is not promised to be the same twice. A list that reshuffles
 * between two renders of the same screen reads as a bug.
 *
 * Scores are computed once per place rather than inside the comparator,
 * which calls `affinity` n times instead of n log n. On Explore's 179
 * places that is the difference between about two hundred category walks
 * and about fifteen hundred.
 *
 * Does not mutate: the catalog's array is shared with everything else
 * that reads it.
 */
export function bestFirst<T extends Rated>(
  places: readonly T[], taste?: Affinity<T> | null,
): T[] {
  // Unrated stays at −1 rather than 0, which is what keeps a rated place
  // above an unrated one; the lift is added after, so taste can lift an
  // unrated place among its own kind without ever reaching a rated one.
  return places
    .map((p) => ({
      p,
      score: (p.rating ?? -1) + (taste ? TASTE_LIFT * taste.affinity(p) : 0),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const ca = a.p.rating_count ?? 0;
      const cb = b.p.rating_count ?? 0;
      if (ca !== cb) return cb - ca;
      return a.p.slug < b.p.slug ? -1 : 1;
    })
    .map((x) => x.p);
}
