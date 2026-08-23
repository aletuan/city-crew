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

/** Somewhere on the earth, or a row the catalog could not place. A stop
 *  may also carry its Google identity — see `pinned`. */
export type Point = {
  lat?: number | null;
  lng?: number | null;
  google_place_id?: string | null;
  name_en?: string | null;
};

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
 * Whether a stop can travel under its own name.
 *
 * Both halves, because they do different work in the link: the place id
 * is what Google *resolves* — the exact business, never a same-named
 * branch across town — and the name is what the reader sees in the
 * directions sheet instead of "Dropped pin". A name without an id must
 * never be sent: that is the ambiguous case the coordinate policy below
 * exists to prevent. An id without a name would resolve, but the import
 * writes both or neither, so the simpler rule costs nothing.
 */
const pinned = (p: Point): boolean => !!p.google_place_id && !!p.name_en;

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
 * ── names when they are safe, coordinates when they are not ──
 *
 * This used to send coordinates for everything, on the argument that a
 * name is ambiguous — this catalog holds three Hadu Sushi and two
 * Artemis Pastry, and Google resolving "Artemis Pastry" to the wrong
 * branch would send somebody across Hanoi with the app's confidence
 * behind it. The argument was right and the medicine was too strong:
 * Google shows a raw coordinate as "Dropped pin", so every stop in the
 * directions sheet lost its name.
 *
 * The Maps URLs API has the parameter this actually wanted: a place id
 * beside each name (`origin_place_id`, `destination_place_id`,
 * `waypoint_place_ids`) resolves the exact business — no branch
 * roulette — while the name is what the sheet displays. So a stop that
 * carries both travels by name, and a stop that does not falls back to
 * its coordinate, which cannot mislead anyone.
 *
 * The ends decide independently; the waypoints decide together, because
 * Google requires `waypoint_place_ids` to match `waypoints` one for one
 * — a middle list where one stop has no id sends coordinates for all of
 * them rather than names for none of the readers to trust.
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
  const namedWaypoints = waypoints.length > 0 && waypoints.every(pinned);

  const q = [
    'api=1',
    `origin=${encodeURIComponent(pinned(origin) ? origin.name_en! : at(origin))}`,
    pinned(origin) ? `origin_place_id=${encodeURIComponent(origin.google_place_id!)}` : null,
    `destination=${encodeURIComponent(pinned(destination) ? destination.name_en! : at(destination))}`,
    pinned(destination)
      ? `destination_place_id=${encodeURIComponent(destination.google_place_id!)}` : null,
    waypoints.length
      ? `waypoints=${encodeURIComponent(waypoints.map((w) => (namedWaypoints ? w.name_en! : at(w))).join('|'))}`
      : null,
    namedWaypoints
      ? `waypoint_place_ids=${encodeURIComponent(waypoints.map((w) => w.google_place_id!).join('|'))}`
      : null,
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
  // The same bargain the route makes: the id resolves the exact place,
  // the name is what the sheet shows, and a stop without its identity
  // opens on its coordinate rather than on a guess.
  if (pinned(p)) {
    return 'https://www.google.com/maps/search/?api=1'
      + `&query=${encodeURIComponent(p.name_en!)}`
      + `&query_place_id=${encodeURIComponent(p.google_place_id!)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(at(p))}`;
}
