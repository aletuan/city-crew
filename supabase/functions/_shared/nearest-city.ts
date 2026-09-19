// Which city a place is actually in, from where it actually is.
//
// The import takes the city from the request: the phone sends the city it
// is showing, the desk sends the one the editor has open. That is a
// statement about the reader, not about the place — and the two part
// company the moment someone in Saigon searches for a café in Đà Lạt.
//
// The audit of 13–18 September 2026 found eleven rows filed that way in
// one week: seven in Đà Lạt, three in Đà Nẵng, all tagged `hcmc`, plus a
// Starbucks in Metro Manila that belongs to no city this app has. One
// more arrived the day the audit's fix landed, which is what decided
// this: `fix/city-follows-location` keeps the app pointed at the right
// city, and cannot help when the place is somewhere the reader is not.
//
// Google answers the details call with the place's coordinates. Those
// are a fact about the place, so they are what decides.
//
// ── the cutoff ──
//
// `MAX_CITY_KM` is read off the catalog rather than picked. Measured over
// all 627 places with coordinates:
//
//     ≤ 25 km from the nearest city centre   624
//     25–50 km                                 0
//     50–100 km                                3
//     > 100 km                                 0
//
// The three are real and were reviewed: Delab Coffee Roastery at 81.6 km
// from Đà Lạt, and two on the coast — Phước Hải and Long Hải — which have
// been part of Hồ Chí Minh City since the 2025 merger and sit 72–76 km
// out. The one row that should never have been imported was 1,388 km from
// anywhere. So there is an empty band between 82 and 1,388, and 100 sits
// in it with room on both sides.
//
// It is a cutoff for "no city at all", not a radius. A place 76 km from
// Saigon and nowhere near anything else is still in Saigon; the city's
// own `radius_km` of 25 is a search bias, and reusing it here would
// refuse three places the desk has already approved.
//
// Plain TypeScript, no imports, no Deno APIs, for the same reason
// `ward.ts` and `place-name.ts` are: this runs in an Edge Function and is
// tested from `app/src/lib/nearestCity.test.ts`.

/** Past this, from every city centre, the place is in none of them. */
export const MAX_CITY_KM = 100;

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in kilometres.
 *
 * The haversine form rather than the spherical law of cosines: at these
 * distances both are accurate, and haversine does not lose precision on
 * the short ones — two shops on the same street are a few metres apart,
 * and `acos` of a number that close to 1 is where the other formula goes
 * soft.
 */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type CityPoint = { id: string; center_lat: number; center_lng: number };

/**
 * The closest city to a point, and how far.
 *
 * Null when there are no cities to choose from — never a guess. The
 * caller decides what `km` past `MAX_CITY_KM` means; this only measures.
 *
 * Ties break on the first city in the list, which is stable because the
 * caller orders the query. Two city centres equidistant to the metre is
 * not a case that occurs, and if it did, either answer is as good.
 */
export function nearestCity(
  cities: CityPoint[],
  at: { lat: number; lng: number },
): { id: string; km: number } | null {
  let best: { id: string; km: number } | null = null;
  for (const c of cities) {
    if (!Number.isFinite(c.center_lat) || !Number.isFinite(c.center_lng)) continue;
    const km = distanceKm(at, { lat: c.center_lat, lng: c.center_lng });
    if (!best || km < best.km) best = { id: c.id, km };
  }
  return best;
}
