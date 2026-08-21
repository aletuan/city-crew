// Links out to Google Maps.
//
// ── why a link and not a map ──
//
// The obvious version of this feature is a route drawn on a map inside
// the app, and it is the one thing this codebase may not do. Every place
// in the catalog came out of the Google Places API — `importPlace` writes
// the name, the address, the coordinates, the rating, the hours and the
// photographs from it — and the Places API terms are explicit: §5.3, *"No
// use with a non-Google map"*. On iOS in Expo Go the only map that
// renders is Apple's. `MiniMap` carries the long version of this and is
// built so that no place can be passed into it at all.
//
// A link is the way round that is not a workaround: it opens Google's own
// map, on Google's own app, so there is no non-Google map involved. It
// also happens to be the thing a reader standing on the pavement actually
// wants, which a 120pt thumbnail never was — turn-by-turn, live traffic,
// and the transit options this app has no data for.
//
// No key, no Edge Function, no billing. `Static Maps` would satisfy the
// same clause and cost all three.

import type { Leg } from './travel';

/** Somewhere on the earth, or a row the catalog could not place. */
export type Point = { lat?: number | null; lng?: number | null };

/**
 * Google's own limit on `waypoints`, which is the stops between the first
 * and the last. Eleven stops therefore fit in one link.
 *
 * Reachable only from the editor: the planner builds at most five stops,
 * and a reader has to add six more by hand to find this edge. It is
 * handled rather than assumed away, and handled *loudly* — see the
 * `dropped` count, which the screen prints. A link that quietly visits
 * the wrong eleven of your twelve stops is worse than no link.
 */
export const WAYPOINT_MAX = 9;

/** What `mapsRouteUrl` gives back: somewhere to go, and how much of the
 *  day did not fit. */
export type Route = {
  url: string;
  /** Stops left out of the link because Google would not take them. Zero
   *  on every trip anybody has made so far. */
  dropped: number;
};

const at = (p: Point) => `${p.lat},${p.lng}`;

const placed = (p: Point): boolean =>
  p.lat != null && p.lng != null && isFinite(p.lat) && isFinite(p.lng);

/**
 * One journey through every stop, for Google Maps to draw and navigate.
 *
 * Null when there is no journey to describe: an empty trip, a single
 * stop, or a day whose places the catalog could never place. A single
 * stop is deliberately null rather than a link to that one place — the
 * row this feeds says "open the route", and a route through one point is
 * a promise the link would not keep. The place's own screen already
 * offers exactly that link for exactly that case.
 *
 * Rows with no coordinates drop out rather than collapsing the route.
 * They are already drawn as "no longer listed" on the screen, and a
 * detour through a null island is not a better answer than a route
 * between the stops that do exist.
 *
 * Coordinates rather than names, everywhere. A name is ambiguous — this
 * catalog holds three Hadu Sushi and two Artemis Pastry — and Google
 * resolving "Artemis Pastry" to the wrong branch would send somebody to
 * the wrong side of Hanoi with the app's confidence behind it.
 */
export function mapsRouteUrl(
  stops: readonly Point[],
  mode: 'walking' | 'driving' = 'driving',
): Route | null {
  const pts = stops.filter(placed);
  if (pts.length < 2) return null;

  const origin = pts[0];
  const destination = pts[pts.length - 1];
  const middle = pts.slice(1, -1);
  // The end of the day is kept, not the ninth waypoint: whatever else a
  // route is for, it has to arrive where the reader is going.
  const waypoints = middle.slice(0, WAYPOINT_MAX);

  const q = [
    'api=1',
    `origin=${encodeURIComponent(at(origin))}`,
    `destination=${encodeURIComponent(at(destination))}`,
    waypoints.length ? `waypoints=${encodeURIComponent(waypoints.map(at).join('|'))}` : null,
    `travelmode=${mode}`,
  ].filter(Boolean).join('&');

  return {
    url: `https://www.google.com/maps/dir/?${q}`,
    dropped: middle.length - waypoints.length,
  };
}

/**
 * Which travel mode to hand Google for the whole day.
 *
 * The app measures each leg separately and will happily call one a walk
 * and the next a ride — see `WALK_MAX_KM`. Google takes one mode for the
 * entire route, so this collapses the day into the answer that cannot
 * strand anybody: **walking only when every leg is a walk.**
 *
 * The asymmetry is the point. Offering driving directions for a walk
 * costs the reader a glance; offering walking directions for a six
 * kilometre leg costs them an hour and a half, and does it while looking
 * completely sure of itself. Google lets them switch either way once the
 * route is open, so the mode is a starting point rather than a verdict.
 *
 * A trip whose legs are all unmeasurable falls to driving for the same
 * reason: with nothing known, the mode that is merely inconvenient wins
 * over the one that is a trap.
 */
export function routeMode(legs: readonly (Leg | null)[]): 'walking' | 'driving' {
  const known = legs.filter((l): l is Leg => l != null);
  return known.length > 0 && known.every((l) => l.mode === 'walk') ? 'walking' : 'driving';
}

/**
 * One place, on Google's map.
 *
 * Here rather than spelled out at the call site because there was one
 * call site and now there are two, and the last time this app let a
 * formatting rule live in two places it ended up living in five — see
 * `fmtMinutes`. Null when the catalog cannot place the row, so the caller
 * drops the control rather than opening a search for "null,null".
 */
export function mapsSearchUrl(p: Point): string | null {
  if (!placed(p)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(at(p))}`;
}
