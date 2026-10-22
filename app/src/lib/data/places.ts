// The catalog's places, and the search vocabulary the desk maintains
// beside them.
//
// Reads only: a place is written by the desk or by the import, never from
// a phone. `fetchPlaces` carries the two column fallbacks that let a build
// reach a database older than itself.

import { supabase } from '../supabase';
import type { Place } from '../types';
import { ownPendingFirst } from '../live';
import { everyPage } from './pages';

// `city_id` is selected, not just filtered on. A place that travels
// outside the city query — inside a collection that reaches more than one
// city — has to be able to say where it is, and a row that only ever
// matched a `where` clause cannot. See `touchesCity`.
export const PLACE_COLS = (withCategories: boolean) =>
  `slug, city_id, google_place_id, name_en, name_vi, i18n, category${withCategories ? ', categories' : ''}, is_published, review_status, submitted_by, is_featured, vibe_tags, neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count, price_display, price_vnd, duration_min, duration_max, desc_en, desc_vi, emoji, opening_hours, website, phone, instagram_handle, threads_handle, reviewer_source, reviewer_name, reviewer_url, created_at, place_photos(id, photo_uri, is_cover, is_hidden, sort_order, attribution_name)`;

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
    // `sort_order` first — but in production every row's is NULL, and a
    // sort on nothing is no sort: Postgres is free to answer the same
    // query in a different order per execution. The slug makes the order
    // total, so the cached answer and the fresh one are the same list in
    // the same order — the hero, picked by "first match", was flipping
    // covers between the two on any city with no pinned hero to hold it
    // still (Đà Lạt, switching cities).
    return scoped
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('slug', { ascending: true });
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
 * How many live places each city holds, as `city_id → count`.
 *
 * The city switcher's rows wear this, so a brand-new city sets
 * expectations before it is entered: fifteen places is a different
 * promise from a hundred and seventy-nine, and the morning this was
 * written the owner read an honestly empty community shelf in Huế as
 * data loss. One column over the live catalog, counted here — no view,
 * no RPC, nothing for a migration to carry.
 *
 * A failure throws; `CitySwitcher` catches it and its rows simply keep
 * their quiet, which is the sheet the app always had.
 */
export async function fetchPlaceCountByCity(): Promise<Record<string, number>> {
  // Every page (`lib/data/pages`): read in one, the switcher counted the first
  // thousand places and missed the rest, by city in whatever order the
  // server happened to read them.
  const rows = await everyPage<{ city_id: string | null }>((from, to) => supabase
    .from('places')
    .select('city_id')
    .eq('is_published', true)
    .eq('review_status', 'approved')
    .order('slug', { ascending: true })
    .range(from, to));
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.city_id) out[r.city_id] = (out[r.city_id] ?? 0) + 1;
  }
  return out;
}

/**
 * The one row-per-place index the map counts cities with.
 *
 * Explore fetches one city at a time, which is right for a screen that
 * reads one city. But the map, zoomed out, draws every city the app has,
 * and a marker that says only a name asks the reader to guess. Worse, a
 * *total* beside a filtered count is two units in one picture: "Cafés"
 * narrowing Hanoi to 89 while Saigon still claims 280 invites exactly
 * the wrong comparison.
 *
 * So: the columns the three Explore filters read, for every published
 * place in every city, and the counting runs the same rule the list runs
 * — see `matchesExplore`. Measured 2026-09-19: 635 rows, 219 kB before
 * transfer encoding, asked once when the map opens. 1,109 rows by 22 Oct,
 * which is two pages (`lib/data/pages`).
 *
 * A failure throws; Explore catches it, and the markers keep their names
 * and lose their numbers, which is the map this replaced.
 */
export type PlaceIndexRow = {
  slug: string;
  city_id: string | null;
  categories: string[] | null;
  vibe_tags: string[] | null;
  // `undefined` rather than `null` where a row has none: `categoriesOf`
  // reads this as an optional string, the shape the catalog's own rows
  // have, and the counting must see exactly what the list sees.
  category?: string;
  opening_hours: Place['opening_hours'];
};

export async function fetchPlaceIndex(): Promise<PlaceIndexRow[]> {
  const rows = await everyPage<Omit<PlaceIndexRow, 'category'> & { category: string | null }>((from, to) => supabase
    .from('places')
    .select('slug, city_id, categories, vibe_tags, category, opening_hours')
    .eq('is_published', true)
    .eq('review_status', 'approved')
    .order('slug', { ascending: true })
    .range(from, to));
  // `category` is nullable in the column and optional in the type the
  // filters read; one is the other with the nulls dropped.
  return rows.map(({ category, ...rest }) => (category ? { ...rest, category } : rest));
}

/**
 * Every city's places, as much of each as Search needs: to match what is
 * typed, and to draw the result's card (owner, 22 Oct 2026: Search
 * answers from every city, the reader's own first).
 *
 * The match runs on the same words the city's own catalog is matched on
 * — names, areas and descriptions in every language, the address, the
 * kinds (`placeHaystack`) — so a city's count on its chip is the count
 * its own catalog would give. A server-side search was the smaller
 * download and was ruled out for that: a second matcher, in SQL, is a
 * second opinion waiting to disagree with the first about what "ca phe"
 * finds. And the card's fields: the cover alone of the photographs, the
 * hours, the rating.
 *
 * Measured 22 Oct 2026, 1,109 live places: 380 kB on the wire per 1,000
 * rows, gzipped, against 890 kB for the catalog's full columns
 * (`PLACE_COLS`), which carry every photograph and the place page's
 * fields. About 420 kB in all, in two pages. A place opened from a
 * result is read whole by its own page (`fetchPlaceBySlug`).
 *
 * Live places, and the reader's own suggestions, as the catalog is
 * (`fetchPlaces`), and theirs first.
 */
export const SEARCH_INDEX_COLS = 'slug, city_id, name_en, name_vi, i18n, category, categories, vibe_tags, neighborhood_en, neighborhood_vi, address, rating, rating_count, desc_en, desc_vi, emoji, opening_hours, is_published, review_status, submitted_by, place_photos(id, photo_uri, is_cover, attribution_name)';

export async function fetchSearchIndex(meId?: string | null): Promise<Place[]> {
  const rows = await everyPage<Place>((from, to) => {
    const q = supabase
      .from('places')
      .select(SEARCH_INDEX_COLS)
      // Every live place has exactly one cover (22 Oct 2026), and a card
      // shows nothing else.
      .eq('place_photos.is_cover', true);
    const scoped = meId
      ? q.or(`and(is_published.eq.true,review_status.eq.approved),submitted_by.eq.${meId}`)
      : q.eq('is_published', true).eq('review_status', 'approved');
    return scoped.order('slug', { ascending: true }).range(from, to);
  });
  return ownPendingFirst(rows, meId);
}

/**
 * The places just suggested, as the index has its rows: a few, by slug,
 * rather than the 420 kB again, so a city's chip counts the place the
 * moment it exists (`addToSearchIndex`). The reader's own suggestions are
 * theirs to read from the moment they are made, as in `fetchSearchIndex`.
 */
export async function fetchSearchPlaces(slugs: readonly string[]): Promise<Place[]> {
  if (!slugs.length) return [];
  const { data, error } = await supabase
    .from('places')
    .select(SEARCH_INDEX_COLS)
    .eq('place_photos.is_cover', true)
    .in('slug', [...slugs]);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Place[];
}

/**
 * The desk's search synonyms, as `category → terms`.
 *
 * Not scoped to a city — what a reader types for "cinema" does not change
 * between Hanoi and Saigon — so it has no dependency and fetches once.
 *
 * The app ships its own defaults and unions this onto them, so a table
 * that is missing, empty, or unreachable leaves search exactly as it
 * shipped; see `mergeTerms`. That is what lets this be nine rows of
 * editable text rather than a risk. A failure throws all the same: the
 * hook's empty map is the fallback (`useCategoryTermsQuery`).
 */
export async function fetchCategoryTerms(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.from('category_terms').select('category, terms');
  if (error) throw new Error(error.message);
  const out: Record<string, string[]> = {};
  for (const row of (data ?? []) as { category: string; terms: string[] | null }[]) {
    if (row.category) out[row.category] = row.terms ?? [];
  }
  return out;
}

/**
 * The rows behind these Google ids that the reader can see — the read
 * `suggest.ts › knownByPlaceId` makes to mark each search result as live,
 * yours, or new.
 *
 * Returned as supabase-js gave it, unlike the reads above, which throw: a
 * failed lookup there means "every row looks new", not an error, and that
 * reading is the caller's. It lived in `suggest.ts` until 20 Oct 2026,
 * when lint began holding `lib/*.ts` to not importing the client.
 */
export async function fetchPlacesByGoogleId(ids: string[]) {
  return supabase
    .from('places')
    .select('google_place_id, slug, is_published, review_status, submitted_by')
    .in('google_place_id', ids);
}
