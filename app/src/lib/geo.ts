// Distance on a sphere, and the nearest thing to a point.
//
// Here rather than in `city.tsx` so it can be tested in a plain Node
// process — see `place.ts` for why that boundary exists. This is the
// arithmetic that decides which city the app opens on, and getting it
// wrong is silent: nothing errors, you simply arrive in the wrong place.
//
// No imports, deliberately. `nearestTo` is generic over anything with a
// centre rather than typed to `City`, which is what keeps that true.

/** Mean Earth radius. Haversine on a sphere is off by up to about 0.3%
 *  against the real ellipsoid — irrelevant when the answer is which of
 *  three cities hundreds of kilometres apart you are standing in. */
const EARTH_KM = 6371;

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Anything with a centre. */
export type Centred = { center_lat: number; center_lng: number };

/**
 * The closest entry, or null for an empty list.
 *
 * Ties go to the earlier entry — the comparison is strictly less-than —
 * which makes the result depend on the list's order rather than on
 * whichever way the floating point fell.
 */
export function nearestTo<T extends Centred>(list: T[], lat: number, lng: number): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const c of list) {
    const d = distanceKm(lat, lng, c.center_lat, c.center_lng);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}
