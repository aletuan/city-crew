// The catalog's places, and the search vocabulary the desk maintains
// beside them.
//
// Reads only: a place is written by the desk or by the import, never from
// a phone. `fetchPlaces` carries the two column fallbacks that let a build
// reach a database older than itself.

import { supabase } from '../supabase';
import type { Place } from '../types';
import { ownPendingFirst } from '../live';

// `city_id` is selected, not just filtered on. A place that travels
// outside the city query — inside a collection that reaches more than one
// city — has to be able to say where it is, and a row that only ever
// matched a `where` clause cannot. See `touchesCity`.
export const PLACE_COLS = (withCategories: boolean) =>
  `slug, city_id, google_place_id, name_en, name_vi, name_ja, category${withCategories ? ', categories' : ''}, is_published, review_status, submitted_by, is_featured, vibe_tags, neighborhood_en, neighborhood_vi, neighborhood_ja, address, lat, lng, rating, rating_count, price_display, price_vnd, duration_min, duration_max, desc_en, desc_vi, desc_ja, emoji, opening_hours, website, phone, created_at, place_photos(photo_uri, is_cover, is_hidden, sort_order, attribution_name)`;

/**
 * The catalog for a city, plus whatever the reader suggested themselves.
 *
 * The second half is the whole of rule 4: a place you proposed is yours
 * from the moment you propose it — it shows here and goes into your own
 * lists — and it reaches nobody else until the desk says so. RLS enforces
 * that; this query has to stop excluding it, which is a separate change
 * in a separate place, and both are needed.
 *
 * Signed out, or on a database that predates the column, the filter is
 * the plain catalog it always was.
 */
export async function fetchPlaces(cityId: string, meId?: string | null): Promise<Place[]> {
  const run = (cols: string, withSubmissions: boolean) => {
    const q = supabase
      .from('places')
      .select(cols)
      .eq('city_id', cityId);
    // `or` across the two gates and the submitter. Written as one clause
    // rather than chained `eq`s because it is a disjunction: live, OR
    // mine. Chaining would ask for both.
    const scoped = withSubmissions && meId
      ? q.or(`and(is_published.eq.true,review_status.eq.approved),submitted_by.eq.${meId}`)
      : q.eq('is_published', true).eq('review_status', 'approved');
    return scoped.order('sort_order', { ascending: true, nullsFirst: false });
  };

  let { data, error } = await run(PLACE_COLS(true), true);
  // A build can reach a database that has not run the categories migration
  // yet. Drop the column and retry rather than showing an error screen —
  // categoriesOf() derives a usable value from vibes in the meantime.
  if (error && error.message.includes('categories')) {
    ({ data, error } = await run(PLACE_COLS(false), true));
  }
  // And one that has not run the submissions migration: `submitted_by` is
  // the newest column here, so a client that ships ahead of the database
  // asks for the catalog alone rather than showing an error screen. There
  // are no submissions to miss on a database that cannot hold one.
  if (error && error.message.includes('submitted_by')) {
    ({ data, error } = await run(PLACE_COLS_LEGACY, false));
  }
  if (error) throw new Error(error.message);
  // Your own suggestions first. See `ownPendingFirst` — sorted here rather
  // than in the query because `sort_order` cannot express "mine".
  return ownPendingFirst((data ?? []) as unknown as Place[], meId);
}

/** The column list without anything the submissions migration added. */
const PLACE_COLS_LEGACY = PLACE_COLS(true)
  .replace(', is_published, review_status, submitted_by', '');

/**
 * One place, by slug, whatever city it is in.
 *
 * The catalog is a city's worth of places, and the place page reads from
 * it — which was fine while nothing could show you a place from
 * elsewhere. Collections now can, in both directions: your own lists
 * have always been able to hold one, and a public list reaches every city
 * it has a place in. Tapping such a card found nothing in the catalog and
 * said "Place not found" over a place that exists.
 *
 * So the page asks. Only when the catalog missed, which is the uncommon
 * case, and RLS decides the answer exactly as it does for the catalog —
 * an unapproved place still comes back to nobody but the person who
 * suggested it.
 */
export async function fetchPlaceBySlug(slug: string): Promise<Place | null> {
  const { data, error } = await supabase
    .from('places')
    .select(PLACE_COLS(true))
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as Place | null;
}

/**
 * The desk's search synonyms, as `category → terms`.
 *
 * Not scoped to a city — what a reader types for "cinema" does not change
 * between Hanoi and Saigon — so it has no dependency and fetches once.
 *
 * Failure is an empty map, never a throw. The app ships its own defaults
 * and unions this onto them, so a table that is missing, empty, or
 * unreachable leaves search exactly as it shipped; see `mergeTerms`. That
 * is what lets this be nine rows of editable text rather than a risk.
 */
export async function fetchCategoryTerms(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.from('category_terms').select('category, terms');
  if (error || !data) return {};
  const out: Record<string, string[]> = {};
  for (const row of data as { category: string; terms: string[] | null }[]) {
    if (row.category) out[row.category] = row.terms ?? [];
  }
  return out;
}
