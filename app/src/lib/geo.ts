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

/**
 * A distance, at the precision the reader can use.
 *
 * This exists to answer one question — *which of these three shops called
 * "So Coffee" is the one I mean* — and the answer is carried entirely by
 * how far apart the numbers are. So the precision follows the scale:
 * metres while you could walk it, one decimal while you would ride, whole
 * kilometres once the decimal has stopped meaning anything.
 *
 * Metres are rounded to the nearest fifty. A search result's coordinate is
 * a pin on a building, not a doorway, and "847 m" claims a precision that
 * neither the data nor the reader has.
 *
 * The decimal separator is a full stop in every language, which is wrong
 * for Vietnamese and deliberate anyway: the same card already prints a
 * rating as "4.9", and one row carrying "4.9" beside "1,2 km" reads as a
 * mistake rather than as two conventions. When ratings move, this moves.
 */
export function fmtDistance(km: number): string {
  if (!isFinite(km) || km < 0) return '';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${Math.round(km * 10) / 10} km`;
  return `${Math.round(km)} km`;
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
