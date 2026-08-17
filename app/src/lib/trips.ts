// Saved trips, as arithmetic rather than as a screen.
//
// Two things the Trips tab has to get right and a screenshot cannot check:
// which half of the list a trip belongs in, and what a trip costs. Both are
// here, and both take their inputs — today, the stops — rather than reading
// a clock or a provider, for the reason every other file in `lib` does: a
// Node process has to be able to run them.
//
// The split is not "sort by date". A list of trips is really two lists that
// happen to share a table: the ones you are still going on, soonest first
// because the next one is the one you care about, and the ones you already
// went on, most recent first because that is the order memory works in. A
// single sort gets one of those two backwards.

import { legsOf, type Located } from './travel';

/** What the split needs, and nothing more: the calendar day, `YYYY-MM-DD`,
 *  which is exactly what `trips.day` is and what `day.ts` produces. */
export type Dated = { day: string };

/**
 * Trips separated into the ones ahead and the ones behind.
 *
 * `today` counts as upcoming. A trip you are on right now is not a memory,
 * and dropping it into "past" at midnight — hours before the evening it
 * describes has even started — is the kind of bug nobody reports because
 * they assume they mis-tapped.
 *
 * Compared as strings, which works because `YYYY-MM-DD` sorts
 * lexicographically the same way it sorts chronologically. Parsing to
 * `Date` here would buy nothing and would reintroduce the timezone trap
 * `day.ts` exists to avoid.
 */
export function splitTrips<T extends Dated>(
  trips: readonly T[], today: string,
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const t of trips) (t.day >= today ? upcoming : past).push(t);
  upcoming.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  past.sort((a, b) => (a.day > b.day ? -1 : a.day < b.day ? 1 : 0));
  return { upcoming, past };
}

/** What a ride between two stops costs one person. Same figure the planner
 *  budgets with — a saved trip and a fresh plan of the same evening must
 *  not quote two different numbers. */
const RIDE_VND = 15000;

export type Priced = Located & { price_vnd?: number | null };

/**
 * Roughly what one person spends on a trip: the stops, plus a ride for
 * every leg too far to walk.
 *
 * **Per person.** Every price in this app is, and the screens say so out
 * loud, because the alternative is a couple reading a number that is half
 * of what their evening will cost.
 *
 * Stops that have gone missing from the catalog are skipped rather than
 * counted as free, and they also drop out of the routing: a null in the
 * middle of the list is a place that was unpublished after the trip was
 * saved, not a stop at the origin of the coordinate system.
 */
export function spendVnd(stops: readonly (Priced | null | undefined)[]): number {
  const live = stops.filter((s): s is Priced => !!s);
  const rides = legsOf(live).filter((l) => l?.mode === 'ride').length;
  return live.reduce((n, s) => n + (s.price_vnd ?? 0), 0) + rides * RIDE_VND;
}
