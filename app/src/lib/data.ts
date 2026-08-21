// Data layer: reads the published catalog straight from Supabase with the
// public client — the same access path (and RLS view) the mockup snapshot
// uses. No app server involved.

import { useCallback, useEffect, useState } from 'react';
import { useCity } from './city';
import { supabase } from './supabase';
import type { Collection, Place } from './types';
import { slugify } from './place';
import { ownPendingFirst } from './live';

// Shapes and pure helpers live next door, where a Node process can reach
// them without pulling in Supabase and React Native. Re-exported here so
// that `from '../lib/data'` keeps meaning what it always did.
export * from './types';
export * from './place';
export * from './live';

export type Fetch<T> = {
  loading: boolean;
  /**
   * True once this has settled at least once, and never false again.
   *
   * `loading` answers "is a request in flight", which flips back on for
   * every refresh. A screen that hides a section while `loading` therefore
   * tears it down on every refresh — and inferring "we have been here
   * before" from a non-empty `data` fails for anyone whose answer is
   * legitimately empty. This is the flag that actually means it.
   */
  loaded: boolean;
  error: string | null;
  data: T;
  /**
   * When the last *successful* load landed, or null if none has.
   *
   * Not `loaded`, which stays true after a failure: this is the one that
   * can say how old what we are showing actually is, which is what
   * deciding whether to ask again needs. See `lib/stale`.
   */
  loadedAt: number | null;
  reload: () => void;
};

function useFetch<T>(fetcher: () => Promise<T>, empty: T): Fetch<T> {
  const [state, setState] = useState<{
    loading: boolean; loaded: boolean; error: string | null; data: T; loadedAt: number | null;
  }>({
    loading: true, loaded: false, error: null, data: empty, loadedAt: null,
  });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => setState({ loading: false, loaded: true, error: null, data, loadedAt: Date.now() }))
      // `loadedAt` is deliberately left where it was: a refresh that failed
      // has not made what we are showing any newer, and pretending
      // otherwise would push the next attempt out by another interval.
      .catch((err: Error) => setState((s) => ({ ...s, loading: false, loaded: true, error: err.message })));
  }, [fetcher]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

// `city_id` is selected, not just filtered on. A place that travels
// outside the city query — inside a collection that reaches more than one
// city — has to be able to say where it is, and a row that only ever
// matched a `where` clause cannot. See `touchesCity`.
const PLACE_COLS = (withCategories: boolean) =>
  `slug, city_id, name_en, name_vi, name_ja, category${withCategories ? ', categories' : ''}, is_published, review_status, submitted_by, is_featured, vibe_tags, neighborhood_en, neighborhood_vi, neighborhood_ja, address, lat, lng, rating, rating_count, price_display, price_vnd, duration_min, duration_max, desc_en, desc_vi, desc_ja, emoji, opening_hours, website, phone, place_photos(photo_uri, is_cover, is_hidden, sort_order, attribution_name)`;

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
async function fetchPlaces(cityId: string, meId?: string | null): Promise<Place[]> {
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
async function fetchPlaceBySlug(slug: string): Promise<Place | null> {
  const { data, error } = await supabase
    .from('places')
    .select(PLACE_COLS(true))
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as Place | null;
}

/**
 * A public list and everything in it.
 *
 * Whole place rows rather than slugs, and no city in the query — the two
 * halves of the same decision. A collection is stamped with the city it
 * was made in, but its contents are not bound by that stamp: a list made
 * in Hanoi can hold a place in Saigon, and until now that place was
 * silently dropped for everyone. `our-culture-uerras` is the live case:
 * two members, one in each city. Its owner saw both, a Hanoi reader saw
 * one and was told nothing, a Saigon reader saw no list at all.
 *
 * So the city stops deciding what a list contains and only decides
 * whether it appears — which it does in every city it has a place in.
 * That question is asked in `touchesCity`, over these embedded rows.
 *
 * It costs more than the slug embed did: every public list arrives with
 * its places and their photos, rather than one city's worth of ids. At
 * this catalog's size that is a handful of lists. If it stops being one,
 * the lever is a narrower column set for embedded members — the shelf
 * needs a name, a photo and a vibe, not opening hours — not a return to
 * truncating by city.
 */
// `id`, `created_at` and `sort_order` ride along for the shelf's ordering
// and for liking — see `lib/likes.ts`. None of them reach a screen as
// something to show; `slug` is still the key everything user-facing uses.
//
// `is_public` is selected rather than inferred, and that is a bug fixed
// rather than a preference. The public query filters on it and used not
// to fetch it, so every row it returned came back with the field
// `undefined` — true of the rows, absent from the objects. Nothing read
// it until the like button did, and then the control that only appears
// on a public list never appeared at all.
const COLLECTION_COLS = (withOwner: boolean) =>
  `id, slug, is_public, created_at, sort_order, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle${withOwner ? ', owner_id, city_id' : ''}, collection_places(sort_order, places(${withOwner ? PLACE_COLS(true) : 'slug'})), cover:place_photos!collections_cover_photo_id_fkey(photo_uri)`;

async function fetchCollections(cityId: string, meId?: string | null): Promise<Collection[]> {
  const run = (withOwner: boolean) => {
    const q = supabase
      .from('collections')
      .select(COLLECTION_COLS(withOwner))
      .eq('is_public', true);
    // Editorial rows and other people's published ones. Your own are
    // excluded whether they are published or not, because they come back
    // through fetchMyCollections and a list in both sections reads as two
    // lists — publishing should change who else can see it, not make a
    // second copy appear under your own.
    //
    // Signed out there is nobody to exclude, and `owner_id.neq.null` is
    // not the same question as `is not null` in PostgREST's grammar, so
    // that branch drops the clause rather than writing one that quietly
    // matches nothing.
    // `owner_id` and `created_at` arrived in the same migration, so the
    // fallback below cannot mention either — it exists precisely for a
    // database that has neither. It keeps the city filter too: a database
    // that old has no owned lists, so every row in it is editorial and
    // stamped with the city it belongs to.
    if (!withOwner) return q.eq('city_id', cityId).order('sort_order');
    const scoped = meId ? q.or(`owner_id.is.null,owner_id.neq.${meId}`) : q;
    // Newest first, with the desk's sequence as the tie-break.
    //
    // Time leads because a list published this morning is the reason to
    // open the tab, and it used to arrive last: `sort_order` came first
    // and owned rows have none, so every published list sank beneath
    // fifteen editorial ones.
    //
    // `sort_order` second is not a hedge. Every editorial row shares one
    // timestamp — the instant `created_at` was added with a default, not
    // a date anybody chose — so ordering them by time is ordering them by
    // nothing, and Postgres is free to return that nothing differently
    // each call. The tie-break decides exactly the rows where the clock
    // has no answer, and the desk's order is the answer it has.
    return scoped.order('created_at', { ascending: false }).order('sort_order', { nullsFirst: false });
  };

  const { data, error } = await run(true);
  // A build can reach a database that has not run the user-collections
  // migration yet. Drop the column and retry rather than breaking the tab —
  // every row there is editorial until the migration lands anyway.
  if (error && error.message.includes('owner_id')) {
    const legacy = await run(false);
    if (legacy.error) throw new Error(legacy.error.message);
    // Slug embeds on that path, so these rows carry no members and
    // `membersOf` resolves them against the catalog, as it always did.
    return (legacy.data ?? []) as unknown as Collection[];
  }
  if (error) throw new Error(error.message);
  return withMembers(data);
}

/**
 * A row whose places arrived embedded, put into the shape the app reads.
 *
 * `members` is what the screens render — in order, with the rows the
 * database refused to hand over already gone. `collection_places` is kept
 * beside it in the slug-only shape, so `holds()` and the counts never
 * have to know which query produced the row.
 */
type EmbeddedRow = Omit<Collection, 'collection_places' | 'members'> & {
  collection_places: { sort_order: number; places: Place | null }[];
};

function withMembers(data: unknown): Collection[] {
  return ((data ?? []) as EmbeddedRow[]).map((row) => {
    const cps = [...(row.collection_places ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return {
      ...row,
      members: cps.map((cp) => cp.places).filter((p): p is Place => !!p),
      collection_places: cps.map((cp) => ({
        sort_order: cp.sort_order,
        places: cp.places ? { slug: cp.places.slug } : null,
      })),
    };
  });
}

/**
 * Every list this user owns, with its places inside it.
 *
 * Not filtered by city and embedding whole place rows — so a list made in
 * Hanoi still counts, still shows a cover and still opens while the app
 * is looking at Saigon. The public query now does both of those too; the
 * only difference left is which rows it asks for, and that your own show
 * whether they are published or not.
 */
const MY_COLLECTION_COLS =
  `slug, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle, owner_id, city_id, is_public, cover:place_photos!collections_cover_photo_id_fkey(photo_uri), collection_places(sort_order, places(${PLACE_COLS(true)}))`;

async function fetchMyCollections(ownerId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select(MY_COLLECTION_COLS)
    // Newest first: the one you just made is the one you came back for.
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return withMembers(data);
}

// Both catalogs scope to the selected city TOGETHER: membersOf() resolves
// collection members against the in-memory places list, so a mismatched
// scope would silently render empty collections. A city switch changes the
// fetcher identity, which makes useFetch reload everywhere automatically.
//
// The two query hooks below are for CatalogProvider and nothing else —
// screens read the catalog from `lib/catalog`, which holds one copy. Call
// them directly and you get a private copy that no one will keep in step.
const pending = new Promise<never>(() => {}); // keeps skeletons up during city bootstrap

export const usePlacesQuery = (meId?: string | null) => {
  const { city } = useCity();
  const fetcher = useCallback(
    () => (city ? fetchPlaces(city.id, meId) : (pending as Promise<Place[]>)),
    [city?.id, meId],
  );
  return useFetch(fetcher, [] as Place[]);
};

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
async function fetchCategoryTerms(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.from('category_terms').select('category, terms');
  if (error || !data) return {};
  const out: Record<string, string[]> = {};
  for (const row of data as { category: string; terms: string[] | null }[]) {
    if (row.category) out[row.category] = row.terms ?? [];
  }
  return out;
}

export const useCategoryTermsQuery = () => {
  const fetcher = useCallback(() => fetchCategoryTerms(), []);
  return useFetch(fetcher, {} as Record<string, string[]>);
};

/**
 * How many people liked each public collection, keyed by slug.
 *
 * Through `collection_like_counts()` rather than a select on the likes
 * table, and that is the privacy boundary rather than a convenience: the
 * table is readable only by the author of each row, so a count can only
 * come out of a function that returns totals and no user ids. Anyone may
 * learn a list has forty likes; nobody may learn who the forty are. See
 * the migration.
 *
 * Returned by slug because that is what every screen and `rankByLikes`
 * key on; the function speaks in ids, so this is where the two meet.
 *
 * Failure is an empty map, never a throw. Every count then reads as zero,
 * `rankByLikes` falls back to the order the shelf had before likes
 * existed, and no heart shows a tally — which is exactly the state the
 * feature ships in anyway.
 */
async function fetchLikeCounts(): Promise<Record<string, number>> {
  const [counts, ids] = await Promise.all([
    supabase.rpc('collection_like_counts'),
    supabase.from('collections').select('id, slug').eq('is_public', true),
  ]);
  if (counts.error || ids.error || !counts.data || !ids.data) return {};
  const slugOf = new Map<string, string>();
  for (const row of ids.data as { id: string; slug: string }[]) slugOf.set(row.id, row.slug);
  const out: Record<string, number> = {};
  for (const row of counts.data as { collection_id: string; likes: number }[]) {
    const slug = slugOf.get(row.collection_id);
    if (slug) out[slug] = row.likes;
  }
  return out;
}

export const useLikeCountsQuery = () => {
  const fetcher = useCallback(() => fetchLikeCounts(), []);
  return useFetch(fetcher, {} as Record<string, number>);
};

/**
 * Which public collections *you* have liked.
 *
 * Its own query rather than a flag on the count above, because the two
 * answer different questions and only one of them is public. This one
 * reads the likes table directly and RLS keeps it to your own rows —
 * signed out it comes back empty, which is the right answer for a set
 * that is defined as yours.
 */
async function fetchMyLikes(meId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('collection_likes')
    .select('collection_id')
    .eq('user_id', meId);
  if (error || !data) return [];
  return (data as { collection_id: string }[]).map((r) => r.collection_id);
}

export const useMyLikesQuery = (meId?: string | null) => {
  const fetcher = useCallback(
    () => (meId ? fetchMyLikes(meId) : Promise.resolve([] as string[])),
    [meId],
  );
  return useFetch(fetcher, [] as string[]);
};

/**
 * Like, or take a like back.
 *
 * The insert can legitimately fail and the caller should not treat that
 * as breakage: the policy refuses a like on your own list, and the
 * primary key refuses a second one from the same person. Both are the
 * rules working. What the caller needs back is whether the state changed,
 * so it knows whether to refetch.
 */
export async function likeCollection(collectionId: string, meId: string): Promise<boolean> {
  const { error } = await supabase
    .from('collection_likes')
    .insert({ collection_id: collectionId, user_id: meId });
  return !error;
}

export async function unlikeCollection(collectionId: string, meId: string): Promise<boolean> {
  const { error } = await supabase
    .from('collection_likes')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', meId);
  return !error;
}

export const useCollectionsQuery = (meId?: string | null) => {
  const { city } = useCity();
  const fetcher = useCallback(
    () => (city ? fetchCollections(city.id, meId) : (pending as Promise<Collection[]>)),
    [city?.id, meId],
  );
  return useFetch(fetcher, [] as Collection[]);
};

/**
 * A single place the catalog does not hold. Pass null when it does — the
 * hook then resolves empty without a request, so the caller can ask for
 * the fallback unconditionally the way hooks require.
 */
export const usePlaceBySlug = (slug: string | null) => {
  const fetcher = useCallback(
    () => (slug ? fetchPlaceBySlug(slug) : Promise.resolve(null)),
    [slug],
  );
  return useFetch(fetcher, null as Place | null);
};

/**
 * The signed-in user's own lists, for the city on screen. Signed out this
 * resolves empty rather than not existing, so callers need no branch.
 */
export const useMyCollections = (ownerId: string | null | undefined) => {
  // No city in the dependencies, and none in the query: a person's lists
  // do not belong to a city, so they neither wait for one nor reload when
  // it changes.
  const fetcher = useCallback(
    () => (ownerId ? fetchMyCollections(ownerId) : Promise.resolve([] as Collection[])),
    [ownerId],
  );
  return useFetch(fetcher, [] as Collection[]);
};

const suffix = () => Math.random().toString(36).slice(2, 8);

/**
 * Create one of the user's own lists. Private by design — the RLS policy
 * refuses an owned row with is_public true, and the app never asks for one.
 *
 * The title is written into all three language columns: this is the user's
 * own words, and we do not have a translation of them. Showing their list
 * under an empty title because the app is in Japanese would be worse than
 * showing it under the words they chose.
 */
export async function createCollection(input: {
  ownerId: string;
  cityId: string;
  title: string;
  desc?: string;
}): Promise<string> {
  const title = input.title.trim();
  const desc = input.desc?.trim() || null;

  // Two attempts: slugs carry a random suffix, so a collision means bad luck
  // rather than a name already taken, and retrying costs one round trip.
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = `${slugify(title)}-${suffix()}`;
    const { error } = await supabase.from('collections').insert({
      slug,
      city_id: input.cityId,
      owner_id: input.ownerId,
      title_en: title, title_vi: title, title_ja: title,
      desc_en: desc, desc_vi: desc, desc_ja: desc,
      is_public: false,
    });
    if (!error) return slug;
    // 23505 = unique_violation.
    if (error.code !== '23505' || attempt === 1) throw new Error(error.message);
  }
  throw new Error('Could not create the collection');
}

/** Rename one of the user's own lists. RLS scopes this to rows they own. */
export async function updateCollection(slug: string, input: { title: string; desc?: string }): Promise<void> {
  const title = input.title.trim();
  const desc = input.desc?.trim() || null;
  // All three language columns again, for the same reason as on create.
  const { error } = await supabase
    .from('collections')
    .update({
      title_en: title, title_vi: title, title_ja: title,
      desc_en: desc, desc_vi: desc, desc_ja: desc,
    })
    .eq('slug', slug);
  if (error) throw new Error(error.message);
}

/**
 * Publish one of the user's own lists, or take it back.
 *
 * The whole of publishing, as far as the client is concerned: one boolean.
 * Everything that follows from it happens in the database — the editorial
 * read policies already select on `is_public` alone, so the list and its
 * places become visible to everyone the moment this lands, and a trigger
 * stamps the byline from the owner's profile rather than trusting a
 * handle sent from here.
 *
 * Which is why `curator_handle` is not in this update and must not be.
 * See `20260815120000_publish_collections.sql`.
 */
export async function setCollectionPublic(slug: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .update({ is_public: isPublic })
    .eq('slug', slug);
  if (error) throw new Error(error.message);
}

/** Remove one of the user's own lists. RLS scopes this to rows they own. */
export async function deleteCollection(slug: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('slug', slug);
  if (error) throw new Error(error.message);
}

/** The row ids behind two slugs. Both tables key on slug for the app and on
 *  id for the join table, so one hop is unavoidable. */
async function idsFor(collectionSlug: string, placeSlug: string) {
  const [col, place] = await Promise.all([
    supabase.from('collections').select('id').eq('slug', collectionSlug).single(),
    supabase.from('places').select('id').eq('slug', placeSlug).single(),
  ]);
  if (col.error) throw new Error(col.error.message);
  if (place.error) throw new Error(place.error.message);
  return { collectionId: (col.data as { id: string }).id, placeId: (place.data as { id: string }).id };
}

/**
 * Put a place in one of the user's lists. RLS checks the list's owner, so
 * a request naming someone else's list is refused at the database.
 *
 * `sortOrder` is where it lands in the list — the caller knows how many
 * members there already are, so new saves go on the end.
 */
export async function addPlaceToCollection(collectionSlug: string, placeSlug: string, sortOrder = 0): Promise<void> {
  const { collectionId, placeId } = await idsFor(collectionSlug, placeSlug);
  const { error } = await supabase
    .from('collection_places')
    .insert({ collection_id: collectionId, place_id: placeId, sort_order: sortOrder });
  // 23505 = unique_violation: the place is already in the list, which is
  // the state the caller wanted. Racing two taps is not an error.
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function removePlaceFromCollection(collectionSlug: string, placeSlug: string): Promise<void> {
  const { collectionId, placeId } = await idsFor(collectionSlug, placeSlug);
  const { error } = await supabase
    .from('collection_places')
    .delete()
    .eq('collection_id', collectionId)
    .eq('place_id', placeId);
  if (error) throw new Error(error.message);
}

// ── trips ────────────────────────────────────────────────────────────
//
// The one thing in this file that reads a table the app cannot derive.
// Everything above is catalog — rows the desk wrote — and a stale copy is
// only ever a refresh away from being right. A trip is a decision, so
// these queries read it back exactly as it was saved, including stops
// whose places have since left the catalog.

/** A stop as it comes back from the database. The place is embedded whole
 *  so a saved trip renders without needing the catalog to still hold it —
 *  which it may not: a place can be unpublished after a plan was made. */
export type TripStopRow = {
  sort_order: number;
  arrive_min: number | null;
  dwell_min: number | null;
  why: string | null;
  why_lang: string | null;
  places: Place | null;
};

export type Trip = {
  id: string;
  city_id: string;
  title: string;
  company: string | null;
  categories: string[];
  district: string | null;
  day: string;
  when_part: 'day' | 'evening';
  generated_by: string;
  created_at: string;
  trip_stops: TripStopRow[];
};

const TRIP_COLS =
  `id, city_id, title, company, categories, district, day, when_part, generated_by, created_at, `
  + `trip_stops(sort_order, arrive_min, dwell_min, why, why_lang, places(${PLACE_COLS(true)}))`;

/**
 * Every trip this user has saved, soonest first within each half.
 *
 * Not scoped to a city, for the reason a user's own collections are not:
 * a Saturday planned in Hanoi is still theirs while the app is looking at
 * Saigon, and hiding it would read as having lost it.
 *
 * Stops come back in `sort_order`, sorted here rather than in the query —
 * PostgREST cannot order an embedded table, and the same hand-sort is what
 * `withMembers` does for collection members.
 */
async function fetchMyTrips(ownerId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_COLS)
    .eq('owner_id', ownerId)
    .order('day', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Trip[]).map((t) => ({
    ...t,
    trip_stops: [...(t.trip_stops ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export const useMyTrips = (ownerId: string | null | undefined) => {
  const fetcher = useCallback(
    () => (ownerId ? fetchMyTrips(ownerId) : Promise.resolve([] as Trip[])),
    [ownerId],
  );
  return useFetch(fetcher, [] as Trip[]);
};

export type SaveTripInput = {
  ownerId: string;
  cityId: string;
  title: string;
  company: string | null;
  categories: string[];
  district: string | null;
  /** Where the day started, when the reader dropped a pin rather than
   *  picking an area. Stored for the same reason `district` is: these are
   *  the answers a plan was built from, and a trip that cannot say where
   *  it started cannot be rebuilt into the plan that was saved. The
   *  columns have been on `trips` since it was created and went unwritten
   *  while the coordinate was being dropped in navigation. */
  atLat?: number | null;
  atLng?: number | null;
  day: string;
  when: 'day' | 'evening';
  /** Set when a model named the trip and wrote its lines. Defaults to
   *  'rules', which is what a plan saved with no network is. */
  generatedBy?: 'rules' | 'rules+llm';
  /** In order. `placeSlug` rather than an id: the app keys on slug
   *  everywhere and the join is one hop, the same trade `idsFor` makes. */
  stops: { placeSlug: string; arriveMin: number; dwellMin: number; why?: string | null; whyLang?: string | null }[];
};

/**
 * Write a trip and its stops, and hand back the new id.
 *
 * Two round trips rather than one, because there is no RPC here and the
 * stops need the trip's id. If the second fails the first is rolled back
 * by hand — a half-saved trip in the list is worse than a failed save the
 * reader can retry, and without a transaction this is the only way to say
 * so. RLS makes the cleanup safe: the delete can only reach a row this
 * user owns anyway.
 */
export async function saveTrip(input: SaveTripInput): Promise<string> {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      owner_id: input.ownerId,
      city_id: input.cityId,
      title: input.title.trim(),
      company: input.company,
      categories: input.categories,
      district: input.district,
      at_lat: input.atLat ?? null,
      at_lng: input.atLng ?? null,
      day: input.day,
      when_part: input.when,
      // Which half wrote this trip's words. The places and times are always
      // the planner's; 'rules+llm' says a model named the evening and wrote
      // the lines under the stops, and a reader opening a year-old trip can
      // tell where its prose came from.
      generated_by: input.generatedBy ?? 'rules',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const tripId = (data as { id: string }).id;

  if (!input.stops.length) return tripId;

  const slugs = input.stops.map((s) => s.placeSlug);
  const { data: rows, error: lookupError } = await supabase
    .from('places')
    .select('id, slug')
    .in('slug', slugs);
  if (lookupError) {
    await supabase.from('trips').delete().eq('id', tripId);
    throw new Error(lookupError.message);
  }

  const idBySlug = new Map((rows as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));
  const stops = input.stops
    .map((s, i) => ({
      trip_id: tripId,
      place_id: idBySlug.get(s.placeSlug),
      sort_order: i,
      arrive_min: s.arriveMin,
      dwell_min: s.dwellMin,
      why: s.why ?? null,
      why_lang: s.whyLang ?? null,
    }))
    // A place the catalog no longer holds is dropped rather than failing
    // the save. The reader is looking at a plan they can see; refusing it
    // over a row that has gone quiet since would be the wrong half to
    // protect.
    .filter((s) => !!s.place_id);

  const { error: stopsError } = await supabase.from('trip_stops').insert(stops);
  if (stopsError) {
    await supabase.from('trips').delete().eq('id', tripId);
    throw new Error(stopsError.message);
  }
  return tripId;
}

/** Remove one of the user's own trips. Its stops go with it — the foreign
 *  key cascades — and RLS scopes this to rows they own. */
export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Put the members of a collection in a new order.
 *
 * `collection_places.sort_order` has been read everywhere since the table
 * existed and written in exactly one place — `addPlaceToCollection`, with
 * the current length, which only ever appends. This is the writer that was
 * missing.
 *
 * A loop of updates rather than an upsert, following
 * `dashboard/src/api.js:reorderPhotos`. The key is (collection_id,
 * place_id), so positions may collide mid-loop without anything failing —
 * which is exactly why the position is not in the key.
 */
export async function reorderCollection(collectionSlug: string, placeSlugs: string[]): Promise<void> {
  const { data: col, error: colError } = await supabase
    .from('collections').select('id').eq('slug', collectionSlug).single();
  if (colError) throw new Error(colError.message);
  const collectionId = (col as { id: string }).id;

  const { data: rows, error: placesError } = await supabase
    .from('places').select('id, slug').in('slug', placeSlugs);
  if (placesError) throw new Error(placesError.message);
  const idBySlug = new Map((rows as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));

  for (let i = 0; i < placeSlugs.length; i++) {
    const placeId = idBySlug.get(placeSlugs[i]);
    if (!placeId) continue;
    const { error } = await supabase
      .from('collection_places')
      .update({ sort_order: i })
      .eq('collection_id', collectionId)
      .eq('place_id', placeId);
    if (error) throw new Error(error.message);
  }
}

// ── preferences, and the history nobody has to keep ──────────────────
//
// Two tables the catalog knows nothing about. `preferences` is what a
// person told us; `place_events` is what they did, and it does not exist
// until they say it may. The opt-in is enforced in Postgres — see the
// migration — so nothing here has to be trusted to check it, and the worst
// a bug in this file can do is fail to record.

export type Preferences = {
  categories: string[];
  /** Per person, per outing, in đồng. Null is "not said", which is not the
   *  same as no budget and must not be stored as zero. */
  budget_vnd: number | null;
  /** Whether `place_events` may be written at all. */
  history_on: boolean;
};

export const NO_PREFERENCES: Preferences = {
  categories: [], budget_vnd: null, history_on: false,
};

/**
 * What this person has told us, or the empty answer.
 *
 * A missing row and a row of defaults are the same thing to every reader of
 * this — nobody has an opinion until they say so — so a 404 comes back as
 * `NO_PREFERENCES` rather than as null. That keeps the "have they opted in"
 * question a plain boolean everywhere instead of a three-way one.
 */
async function fetchPreferences(ownerId: string): Promise<Preferences> {
  const { data, error } = await supabase
    .from('preferences')
    .select('categories, budget_vnd, history_on')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return NO_PREFERENCES;
  const row = data as Partial<Preferences>;
  return {
    categories: row.categories ?? [],
    budget_vnd: row.budget_vnd ?? null,
    history_on: !!row.history_on,
  };
}

export const useMyPreferences = (ownerId: string | null | undefined) => {
  const fetcher = useCallback(
    () => (ownerId ? fetchPreferences(ownerId) : Promise.resolve(NO_PREFERENCES)),
    [ownerId],
  );
  return useFetch(fetcher, NO_PREFERENCES);
};

/** Write them, creating the row the first time. An upsert rather than an
 *  insert-then-update because there is exactly one row per person and the
 *  primary key says so — there is no state where two writers could disagree
 *  about which of two rows is current. */
export async function savePreferences(ownerId: string, p: Preferences): Promise<void> {
  const { error } = await supabase.from('preferences').upsert({
    owner_id: ownerId,
    categories: p.categories,
    budget_vnd: p.budget_vnd,
    history_on: p.history_on,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export type EventKind = 'open' | 'save' | 'unsave' | 'plan_keep' | 'plan_drop';

/**
 * Note that something happened, if the reader has allowed it.
 *
 * Never throws, and that is the whole shape of it. Recording is a side
 * effect of looking at a place; a screen that had to handle its failure
 * would be a screen where opening a café can show an error, and the failure
 * that matters most — "you have not opted in" — is not an error at all,
 * it is the database keeping the promise the toggle made.
 *
 * So a refusal is swallowed on purpose. The client checks `history_on`
 * first to save a round trip; the insert policy checks it again because a
 * client-side check is a promise and a policy is a guarantee.
 */
export async function logPlaceEvent(
  ownerId: string | null | undefined,
  placeSlug: string,
  kind: EventKind,
  cityId: string | null,
  allowed: boolean,
): Promise<void> {
  if (!ownerId || !allowed) return;
  try {
    const { data } = await supabase
      .from('places').select('id').eq('slug', placeSlug).maybeSingle();
    const placeId = (data as { id: string } | null)?.id;
    if (!placeId) return;
    await supabase.from('place_events')
      .insert({ user_id: ownerId, place_id: placeId, kind, city_id: cityId });
  } catch {
    // Nothing to do and nobody to tell. A lost event costs a slightly worse
    // ordering in a future plan; a thrown one costs the screen.
  }
}

/** Slugs this person opened and did not save — the strongest single signal
 *  `taste.ts` takes, and the only one that is about a place rather than a
 *  category.
 *
 *  Read over a window rather than over everything: a café passed over last
 *  March says nothing about this Saturday, and nothing trims the table yet.
 *  `since` is a parameter for the same reason `now` is everywhere else. */
export async function fetchPassedOver(ownerId: string, since: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('place_events')
    .select('kind, created_at, places(slug)')
    .eq('user_id', ownerId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  // Opened, and not saved *since*. Read in reverse order so the newest verb
  // about a place wins: somebody who opened a café, walked away, and saved
  // it a week later has not passed it over.
  const verdict = new Map<string, boolean>();
  // Through `unknown`, like every other embed in this file: PostgREST
  // returns the joined row as an object where the generated types expect an
  // array, and the shape the query actually produces is the one below.
  const rows = (data ?? []) as unknown as { kind: EventKind; places: { slug: string } | null }[];
  for (const row of rows) {
    const slug = row.places?.slug;
    if (!slug || verdict.has(slug)) continue;
    if (row.kind === 'save' || row.kind === 'plan_keep') verdict.set(slug, false);
    else if (row.kind === 'open' || row.kind === 'plan_drop') verdict.set(slug, true);
  }
  return [...verdict.entries()].filter(([, passed]) => passed).map(([slug]) => slug);
}

/** Erase everything recorded about this person. The button the opt-in is
 *  not allowed to ship without: switching recording off and being unable to
 *  remove what was already recorded is the trap the whole table has to
 *  avoid, which is why the delete policy does not consult `history_on`. */
export async function clearMyHistory(ownerId: string): Promise<void> {
  const { error } = await supabase.from('place_events').delete().eq('user_id', ownerId);
  if (error) throw new Error(error.message);
}
