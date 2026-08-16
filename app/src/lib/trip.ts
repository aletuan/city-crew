// What the plan wizard collects, before anything is planned.
//
// Pure, and here rather than in the screen for the reason `place.ts` is:
// a Node process can reach it, and the parts worth getting right — which
// districts to offer, and in what order — are the parts a screen makes
// hard to see.
//
// Nothing here plans a trip. The wizard's job is to end up holding a
// `TripDraft` that a planner can read; the planner is a separate problem
// and a later one.

import { distanceKm } from './geo';
import type { Place } from './types';

/** Who the day is for. The one answer that changes the *shape* of a plan
 *  rather than its contents — a couple's evening and four friends' evening
 *  want different rooms, not different categories. */
export type Company = 'solo' | 'couple' | 'friends' | 'family' | 'other';

export const COMPANY: { key: Company; icon: string; en: string; vi: string; ja: string }[] = [
  { key: 'solo', icon: 'person-outline', en: 'Just me', vi: 'Một mình', ja: 'ひとり' },
  { key: 'couple', icon: 'heart-outline', en: 'Couple', vi: 'Hai người', ja: 'ふたり' },
  { key: 'friends', icon: 'people-outline', en: 'Friends', vi: 'Bạn bè', ja: '友だち' },
  { key: 'family', icon: 'home-outline', en: 'Family', vi: 'Gia đình', ja: '家族' },
  { key: 'other', icon: 'ellipsis-horizontal', en: 'Other', vi: 'Khác', ja: 'その他' },
];

/** Day or evening. Not a clock time: the wizard's own promise is that
 *  roughly is fine, and `opening_hours` is what will decide whether a
 *  place is actually open when the plan is built. */
export type TimeOfDay = 'day' | 'evening';

export type TripDraft = {
  company: Company | null;
  /** Category keys from the taxonomy in `categories.ts` — the same ones
   *  Explore filters by, so a plan cannot want something the catalog has
   *  no word for. */
  categories: string[];
  /** A district name as it appears on places, or null for "near me". */
  district: string | null;
  /** Where the day starts, when the reader dropped a pin instead of
   *  picking a district. */
  at: { lat: number; lng: number } | null;
  when: TimeOfDay;
  /** Collection slugs to seed the plan from. */
  from: string[];
};

export const EMPTY_DRAFT: TripDraft = {
  company: null, categories: [], district: null, at: null, when: 'evening', from: [],
};

/** Toggle a value in a list, order preserved. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * The districts worth offering, busiest first.
 *
 * Derived from the catalog rather than kept in a table, and that is the
 * whole point: a chip here promises places behind it, so the only list
 * that cannot lie is the one counted off the places themselves. A district
 * the desk has not filled yet simply is not offered.
 *
 * Busiest first because the order is a recommendation. Alphabetical would
 * put a district with one café above the one with eleven, and the reader
 * has no way to tell them apart before tapping.
 *
 * Ties break on name so the list is stable between renders — two districts
 * with four places each must not swap places when the catalog reloads.
 */
export function districtsOf(places: Place[], limit = 6): string[] {
  const tally = new Map<string, number>();
  for (const p of places) {
    const d = p.neighborhood_en?.trim();
    if (d) tally.set(d, (tally.get(d) ?? 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * The same districts, ordered by how far they are from a point.
 *
 * The list is the answer to "or pick a nearby area", and until now it
 * answered a different question: the city's busiest districts, in the same
 * order however far the reader had moved the pin. Somebody standing in
 * Thảo Điền was offered District 1 first because District 1 has the most
 * places in it, which is true and not what they asked.
 *
 * A district's position is the mean of its places' coordinates. Not a
 * boundary — we have none, and the desk has no reason to draw any — but
 * near enough to sort by, because the question is which of six is closest
 * rather than which polygon the point falls inside.
 *
 * Reordered, never filtered. A radius would be more honest about the word
 * "nearby" and would sometimes leave the reader with no chips at all,
 * which is a worse answer than a far one they can see is far.
 *
 * With no point to measure from — permission never granted, nothing
 * picked — this is `districtsOf` exactly, because busiest-first is the
 * best order available when "near" has no meaning yet.
 */
export function areasNear(
  places: Place[],
  at: { lat: number; lng: number } | null | undefined,
  limit = 6,
): string[] {
  if (!at) return districtsOf(places, limit);
  return ranked(places, at).slice(0, limit).map((d) => d.name);
}

/** The areas with their distances, in the order `areasNear` returns them.
 *  Split out so the caller can ask how far the nearest one is without
 *  computing every district centre a second time. */
function ranked(places: Place[], at: { lat: number; lng: number }): { name: string; km: number }[] {
  const sum = new Map<string, { lat: number; lng: number; n: number; total: number }>();
  for (const p of places) {
    const d = p.neighborhood_en?.trim();
    if (!d) continue;
    const seen = sum.get(d) ?? { lat: 0, lng: 0, n: 0, total: 0 };
    seen.total += 1;
    // A place with no coordinates still counts towards the district's
    // size — it is in it — but cannot move the district's centre.
    if (p.lat != null && p.lng != null) {
      seen.lat += p.lat;
      seen.lng += p.lng;
      seen.n += 1;
    }
    sum.set(d, seen);
  }

  return [...sum.entries()]
    .map(([name, v]) => ({
      name,
      total: v.total,
      // Districts whose every place lacks a coordinate cannot be placed.
      // They keep their turn at the back rather than being dropped: the
      // reader may well want one, and Infinity sorts them last without a
      // special case anywhere else.
      km: v.n > 0 ? distanceKm(at.lat, at.lng, v.lat / v.n, v.lng / v.n) : Infinity,
    }))
    // Distance, then size, then name — each tie-break exists so the list
    // cannot reshuffle under the reader between two renders of the same
    // data.
    .sort((a, b) => a.km - b.km || b.total - a.total || a.name.localeCompare(b.name))
    .map(({ name, km }) => ({ name, km }));
}

/**
 * How far the closest of those areas actually is, in km — or null when
 * that question has no answer yet.
 *
 * Exists because "nearby" was a claim the list could not back up. The
 * catalog holds one city, so the nearest area is a Hanoi district whether
 * the reader is in Hoàn Kiếm or eighty-five kilometres away in Thanh Hóa
 * — and it was captioned "or pick a nearby area" in both cases. Sorting by
 * distance never made the first one *near*; it only made it the least far.
 *
 * Null rather than Infinity for "cannot say": no point to measure from,
 * no areas at all, or every area unplaceable. The caller's honest move in
 * that case is to drop the claim, not to make a different one.
 */
export function nearestAreaKm(
  places: Place[],
  at: { lat: number; lng: number } | null | undefined,
): number | null {
  if (!at) return null;
  const km = ranked(places, at)[0]?.km;
  return km == null || !Number.isFinite(km) ? null : km;
}

/**
 * Is there enough here to plan anything?
 *
 * Company and at least one category. Not the district — "near me" is a
 * legitimate answer and the default one — and not the collections, which
 * are a way to start rather than a requirement to.
 */
export function canPlan(d: TripDraft): boolean {
  return d.company !== null && d.categories.length > 0;
}
