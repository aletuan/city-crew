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
 * Is there enough here to plan anything?
 *
 * Company and at least one category. Not the district — "near me" is a
 * legitimate answer and the default one — and not the collections, which
 * are a way to start rather than a requirement to.
 */
export function canPlan(d: TripDraft): boolean {
  return d.company !== null && d.categories.length > 0;
}
