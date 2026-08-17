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

/**
 * What the split needs: the calendar day, and the stops as the table holds
 * them so the day can be told from the hour.
 *
 * Snake case because these are rows — the same trade `Priced` below makes
 * with `price_vnd`. The stops are optional: a trip whose times never came
 * back still has to land on one side or the other.
 */
export type Dated = {
  day: string;
  trip_stops?: readonly { arrive_min?: number | null; dwell_min?: number | null }[];
};

/**
 * When a trip is over, in minutes past midnight on its own day.
 *
 * The last stop's arrival plus however long you are staying there — taken
 * as a maximum over the stops rather than off the end of the array, because
 * the order the rows arrive in is `sort_order` and a reader who dragged
 * their dinner later has a trip whose last row is not its last hour.
 *
 * Null when no stop carries a time. That is not "ends at midnight" and must
 * not become zero either; the caller decides what to do with an unknown.
 */
export function endMinOf(t: Dated): number | null {
  let end: number | null = null;
  for (const s of t.trip_stops ?? []) {
    if (s.arrive_min == null) continue;
    const at = s.arrive_min + (s.dwell_min ?? 0);
    if (end == null || at > end) end = at;
  }
  return end;
}

/**
 * How long a trip stays "upcoming" after its last stop should have ended.
 *
 * Dwell times are the planner's estimate, not a booking, and the reader is
 * the one sitting there. Moving their evening into "past" while they are
 * still at the last table — because a guess said seventy-five minutes and
 * they took two hours — is worse than leaving it a while too long, so the
 * doubt goes to the reader.
 */
const OVER_GRACE_MIN = 60;

/**
 * Trips separated into the ones ahead and the ones behind.
 *
 * The split used to compare days alone, and the comment here used to
 * defend that: a trip you are on right now is not a memory, and dropping it
 * into "past" at midnight — hours before the evening it describes has even
 * started — is the kind of bug nobody reports because they assume they
 * mis-tapped. That is still true, and it was only half the rule. The other
 * half is the same argument pointing the other way: a Monday morning you
 * finished at noon is not something you are "upcoming" to at five in the
 * afternoon, and it sat above tomorrow's plans until midnight saying so.
 *
 * So a trip is behind you when its last stop ended, `OVER_GRACE_MIN` ago —
 * and a trip whose stops carry no times keeps the old day-granular
 * behaviour, because with no hour to read, the whole of today is still
 * ahead of you as far as anything here can tell.
 *
 * Days are compared as strings, which works because `YYYY-MM-DD` sorts
 * lexicographically the same way it sorts chronologically. Parsing to
 * `Date` here would buy nothing and would reintroduce the timezone trap
 * `day.ts` exists to avoid. `nowMin` is passed in rather than read off the
 * clock, for the reason everything in `lib` is: a Node process has to be
 * able to run it — and it must come from the same `Date` as `today`, or the
 * two disagree for one tick either side of midnight.
 */
export function splitTrips<T extends Dated>(
  trips: readonly T[], today: string, nowMin: number,
): { upcoming: T[]; past: T[] } {
  const behind = (t: T) => {
    if (t.day !== today) return t.day < today;
    const end = endMinOf(t);
    return end != null && nowMin >= end + OVER_GRACE_MIN;
  };
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const t of trips) (behind(t) ? past : upcoming).push(t);
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
