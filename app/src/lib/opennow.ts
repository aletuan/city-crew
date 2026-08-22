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
 * The places open at `now`, best first, at most `n`.
 *
 * "Best" is the plain reading of the reference capture: rating down the
 * column, 4.6 above 4.5 above 4.3. Rated above unrated, more-reviewed
 * first among equals, slug as the final tie so the list holds still
 * between renders of the same minute.
 *
 * A place whose hours cannot be read is simply not in this list —
 * `openState` returns null for "cannot answer", and a section titled
 * "open right now" is no place for a guess. That is also why there is no
 * fallback content: five great closed places would make the title a lie.
 */
export function openNowPlaces<T extends OpenablePlace>(
  places: readonly T[], now: Date, n: number = OPEN_SHOWN,
): T[] {
  return places
    .filter((p) => openState(p.opening_hours, now)?.open === true)
    .sort((a, b) => {
      const ra = a.rating ?? -1;
      const rb = b.rating ?? -1;
      if (ra !== rb) return rb - ra;
      const ca = a.rating_count ?? 0;
      const cb = b.rating_count ?? 0;
      if (ca !== cb) return cb - ca;
      return a.slug < b.slug ? -1 : 1;
    })
    .slice(0, n);
}
