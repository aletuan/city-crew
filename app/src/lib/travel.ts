// How you get from one stop to the next, and how long it takes.
//
// Pure, and here rather than in the screen for the reason `place.ts` is: a
// Node process can reach it. What is worth getting right is not the
// drawing but the arithmetic — a plan that says "8 min walk" for seven
// kilometres has told the reader something that will make them late, and
// nothing on the screen looks wrong while it does.
//
// ── on the numbers being estimates ──
//
// There is no routing service here and there is not going to be one: the
// map deliberately carries no place pins (Google Places terms), and adding
// a directions API for a number the reader reads as "about" would be a
// vendor and a secret for very little. So these are straight-line
// distances with a speed applied, and everything below is chosen to fail
// in the direction of a plan that runs late rather than early.

import { distanceKm } from './geo';

/** Just enough of a place to route between. Structural, so a full `Place`
 *  satisfies it and a test fixture does not have to invent thirty
 *  fields. */
export type Located = { lat?: number | null; lng?: number | null };

export type Mode = 'walk' | 'ride';

export type Leg = {
  /** Straight-line distance. Not what the reader walks — see below. */
  km: number;
  mode: Mode;
  minutes: number;
};

/**
 * Where walking stops being the obvious answer.
 *
 * 1.2 km is about fifteen minutes on foot, which is the point most people
 * stop treating a walk as free and start thinking about a ride. Lower and
 * the plan calls a bike for two hundred metres; higher and it marches
 * somebody across a district in July.
 */
const WALK_MAX_KM = 1.2;

/**
 * Minutes per kilometre, by mode.
 *
 * Walking at 12 min/km is a shade under 5 km/h — slower than a fit person
 * on an empty pavement, which is the point: this is a pavement in Hanoi,
 * shared with parked bikes, and the reader is not in a hurry.
 *
 * Riding at 2.5 min/km is 24 km/h. That is slow for a motorbike and about
 * right for one in city traffic, and it also quietly absorbs the thing
 * this model has no way to see — waiting for the ride to arrive.
 */
const MIN_PER_KM: Record<Mode, number> = { walk: 12, ride: 2.5 };

/**
 * A straight line is shorter than any street.
 *
 * Haversine measures through buildings. Street networks in these three
 * cities run around 1.3× that, and using the raw number would make every
 * leg optimistic by a third — a five-stop day arriving half an hour late
 * with no single leg visibly wrong.
 */
const DETOUR = 1.3;

/** Nothing under this is worth printing. Two stops in the same building
 *  are not a one-minute journey, they are the same place twice. */
const MIN_MINUTES = 2;

/**
 * The journey between two places, or `null` when it cannot be measured.
 *
 * Null rather than a guess when either end lacks coordinates. The catalog
 * has places with no `lat`/`lng` — they are in a district and nowhere
 * more precise — and a leg invented for one of them would be printed with
 * the same confidence as a real one. The screen drops the row instead,
 * which is what `openState` does with hours it cannot read and what
 * `hintArea` does with a city that has no areas to name.
 */
export function legBetween(a: Located, b: Located): Leg | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;

  const km = distanceKm(a.lat, a.lng, b.lat, b.lng);
  const mode: Mode = km <= WALK_MAX_KM ? 'walk' : 'ride';
  const minutes = Math.max(MIN_MINUTES, Math.round(km * DETOUR * MIN_PER_KM[mode]));

  return { km, mode, minutes };
}

/**
 * Every leg of a route, in order — one shorter than the list of stops.
 *
 * Legs that cannot be measured stay in the array as `null` rather than
 * being dropped, so index `i` is always the journey out of stop `i`. A
 * compacted array would silently attach the wrong distance to the wrong
 * stop, which is the kind of off-by-one that looks plausible on screen.
 */
export function legsOf(stops: readonly Located[]): (Leg | null)[] {
  const out: (Leg | null)[] = [];
  for (let i = 0; i + 1 < stops.length; i++) out.push(legBetween(stops[i], stops[i + 1]));
  return out;
}

/**
 * How far the whole route runs, counting only the legs that could be
 * measured.
 *
 * Unmeasurable legs contribute nothing rather than making the total null.
 * A route where four legs out of five are known has a useful total, and
 * the caller that prints "14.2 km total" is already saying "about".
 */
export function totalKm(legs: readonly (Leg | null)[]): number {
  let km = 0;
  for (const l of legs) if (l) km += l.km;
  return km;
}
