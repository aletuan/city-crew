// The doors that are open at this minute, for the search zero-state.
//
// The reference design's third question, after "what is good here" and
// "what just landed": *where can I walk into right now*. It is the only
// zero-state section whose answer changes by the hour, which is exactly
// its value — the screen stops being a brochure and starts knowing what
// time it is.
//
// The open/closed judgement itself is not made here. `openState` in
// `format.ts` already reads Google's weekday lines, carries the timezone
// shift and the past-midnight bars, and is tested on both of the CI's
// clocks; this module only asks it the question per place and ranks the
// yeses. Re-deciding any of that here would be a second opinion waiting
// to disagree with the first.

import { openState } from './format';

/** The slice of a place this module reads. Structural, so Node can run it. */
export type OpenablePlace = {
  slug: string;
  rating?: number | null;
  rating_count?: number | null;
  opening_hours?: string[] | null;
};

/** How many open doors the zero-state shows — five, like its neighbours. */
export const OPEN_SHOWN = 5;

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

/** Just enough of a taste to rank with — `Taste` from `planner.ts`, minus
 *  its dependency on `Place`, so this module stays importable from Node. */
export type Affinity<T> = { affinity: (p: T) => number };

/**
 * The places open at `now`, best first, at most `n`.
 *
 * "Best" was the plain reading of the reference capture: rating down the
 * column, 4.6 above 4.5 above 4.3. Rated above unrated, more-reviewed
 * first among equals, slug as the final tie so the list holds still
 * between renders of the same minute. All of that still decides the
 * order; `taste` only adds `TASTE_LIFT` worth of thumb to the scale, and
 * passing nothing gives exactly the list this returned before it existed.
 *
 * A place whose hours cannot be read is simply not in this list —
 * `openState` returns null for "cannot answer", and a section titled
 * "open right now" is no place for a guess. That is also why there is no
 * fallback content: five great closed places would make the title a lie.
 */
export function openNowPlaces<T extends OpenablePlace>(
  places: readonly T[], now: Date, n: number = OPEN_SHOWN, taste?: Affinity<T> | null,
): T[] {
  // Unrated stays at −1 rather than 0, which is what keeps a rated place
  // above an unrated one; the lift is added after, so taste can lift an
  // unrated place among its own kind without ever reaching a rated one.
  const score = (p: T) => (p.rating ?? -1) + (taste ? TASTE_LIFT * taste.affinity(p) : 0);
  return places
    .filter((p) => openState(p.opening_hours, now)?.open === true)
    .sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sb - sa;
      const ca = a.rating_count ?? 0;
      const cb = b.rating_count ?? 0;
      if (ca !== cb) return cb - ca;
      return a.slug < b.slug ? -1 : 1;
    })
    .slice(0, n);
}
