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

/**
 * Who the chips are for, and what colour each one's glyph wears.
 *
 * Coloured for the same reason the category row below it is: a row of grey
 * glyphs beside a row of coloured ones reads as the unfinished half of a
 * screen. The hues are chosen, not decorative — blue for the one person,
 * rose for the two, amber for a group, green for a household.
 *
 * They are not a code. Category colour means something beyond its row —
 * it is the hue that concept wears on a place card too — and nothing here
 * appears anywhere else. So these only have to belong to the same family,
 * stay apart from each other, and avoid reading as one of the seven.
 *
 * Which is why they were measured rather than picked. Each sits at least
 * 15° of hue from every category colour, and each was solved for the same
 * contrast on the light background — 2.14:1, inside the seven's own
 * 1.87–2.51 range — because equal HSL lightness across hues does not mean
 * equal contrast, and a naive amber came out at 1.52:1, visibly fainter
 * than everything beside it.
 *
 * `other` carries no glyph. An ellipsis is a promise of more to tap, and
 * this chip is an answer like the rest.
 */
export const COMPANY: {
  key: Company; icon?: string; color?: string; en: string; vi: string; ja: string;
}[] = [
  { key: 'solo', icon: 'person-outline', color: '#8CA9D0', en: 'Just me', vi: 'Một mình', ja: 'ひとり' },
  { key: 'couple', icon: 'heart-outline', color: '#D496A5', en: 'Couple', vi: 'Hai người', ja: 'ふたり' },
  { key: 'friends', icon: 'people-outline', color: '#B9A654', en: 'Friends', vi: 'Bạn bè', ja: '友だち' },
  { key: 'family', icon: 'home-outline', color: '#65B690', en: 'Family', vi: 'Gia đình', ja: '家族' },
  { key: 'other', en: 'Other', vi: 'Khác', ja: 'その他' },
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
  /** The calendar day, `YYYY-MM-DD`, in the reader's own timezone — or ''
   *  before one has been resolved.
   *
   *  A string rather than a `Date` because it is a day and not an instant:
   *  a Date carries a clock nobody set, and two of them for the same day
   *  are never equal. See `lib/day`, which also explains why building one
   *  of these with `toISOString()` is wrong everywhere east of Greenwich. */
  date: string;
  when: TimeOfDay;
  /** Collection slugs to seed the plan from. */
  from: string[];
};

export const EMPTY_DRAFT: TripDraft = {
  company: null, categories: [], district: null, at: null,
  // Empty, not today. This is a module-level constant, so `todayISO()`
  // here would be evaluated once at import and an app left open past
  // midnight would default to yesterday. The screen resolves it, and
  // `clampDay` refuses the past anyway.
  date: '', when: 'evening', from: [],
};

/** Toggle a value in a list, order preserved. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * The wizard's answers as they travel between screens.
 *
 * Declared structurally rather than imported from `nav.ts`, which is what
 * actually holds them: that module pulls in React Navigation, and
 * everything in `lib` has to stay reachable from a plain Node process.
 * `PlanAsk` satisfies this shape, so the screens pass their route params
 * straight in.
 *
 * The coordinate arrives as two numbers rather than a nested point for the
 * same reason `startMin` is a number: these are navigation params, and the
 * `trips` table stores them the same way, in `at_lat` and `at_lng`.
 */
export type PlanAnswers = {
  categories: string[];
  district: string | null;
  atLat?: number;
  atLng?: number;
  when: TimeOfDay;
  from?: string[];
};

/**
 * One draft, built in one place.
 *
 * This exists because of a bug rather than for tidiness. Three screens —
 * Sketching, PlanOptions and PlanEdit — each rebuilt this object from the
 * route params, and all three wrote `at: null` into it because there was
 * nothing in the params to put there. So a reader could drop a pin, watch
 * the header say "A pin you dropped", and get a plan built as though they
 * had said nothing about where they were: the *label* survived navigation
 * and the *coordinate* did not.
 *
 * The planner reading `draft.at` is only half of that fix. The other half
 * is that there is now one place where a draft is made, so the next field
 * added to the answers cannot be silently dropped by two screens out of
 * three.
 *
 * `day` is passed in already resolved. The screens each need it for their
 * own reasons — a header, a save — and resolving it twice against a clock
 * that moves is how one card opens as a different evening.
 *
 * Both halves of the coordinate or neither. A lone latitude is not a place
 * and must not become one; `at` goes null and the first stop is chosen on
 * merit, which is what happens for a reader who said nothing at all.
 */
export function draftFrom(a: PlanAnswers, day: string): TripDraft {
  return {
    // Not carried, and not an oversight: nothing in the planner reads it.
    // It rides in the params for the model that names the plan.
    company: null,
    categories: a.categories,
    district: a.district,
    at: a.atLat != null && a.atLng != null ? { lat: a.atLat, lng: a.atLng } : null,
    date: day,
    when: a.when,
    from: a.from ?? [],
  };
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

/**
 * Each area, summed: where its places are and how many there are.
 *
 * There are no district boundaries anywhere in this app and getting them
 * would mean sourcing and maintaining a whole administrative-polygon
 * dataset. What there is, is the coordinates of the places themselves —
 * so an area's position is the mean of its places. That is not a centre in
 * any official sense and it is not trying to be: the question it answers
 * is "which of these six is closest", never "which polygon is this point
 * inside", and a representative point is enough for the first.
 */
function groupAreas(places: Place[]) {
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
  return sum;
}

/**
 * Where an area sits, or null when it cannot be placed.
 *
 * Exists because choosing an area is also a way of putting the pin
 * somewhere, and the sheet did not treat it as one. Picking "Hà Đông" set
 * a district and cleared the point, so the map — which draws from the
 * point — stayed wherever the reader was standing. Somebody in Thanh Hóa
 * planning a day in Hà Đông chose it, watched the chip light up, and saw
 * the map go on showing Thanh Hóa.
 */
export function areaCentre(
  places: Place[],
  name: string | null | undefined,
): { lat: number; lng: number } | null {
  const key = name?.trim();
  if (!key) return null;
  const v = groupAreas(places).get(key);
  // An area every one of whose places lacks coordinates has a size but no
  // position. Null says so, rather than handing back (0, 0).
  if (!v || v.n === 0) return null;
  return { lat: v.lat / v.n, lng: v.lng / v.n };
}

/** The areas with their distances, in the order `areasNear` returns them.
 *  Split out so the caller can ask how far the nearest one is without
 *  computing every district centre a second time. */
function ranked(places: Place[], at: { lat: number; lng: number }): { name: string; km: number }[] {
  return [...groupAreas(places).entries()]
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
