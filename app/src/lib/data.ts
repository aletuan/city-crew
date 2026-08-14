// Data layer: reads the published catalog straight from Supabase with the
// public client — the same access path (and RLS view) the mockup snapshot
// uses. No app server involved.

import { useCallback, useEffect, useState } from 'react';
import { useCity } from './city';
import { supabase } from './supabase';
import type { Collection, Place } from './types';
import { slugify } from './place';

// Shapes and pure helpers live next door, where a Node process can reach
// them without pulling in Supabase and React Native. Re-exported here so
// that `from '../lib/data'` keeps meaning what it always did.
export * from './types';
export * from './place';

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
  reload: () => void;
};

function useFetch<T>(fetcher: () => Promise<T>, empty: T): Fetch<T> {
  const [state, setState] = useState<{ loading: boolean; loaded: boolean; error: string | null; data: T }>({
    loading: true, loaded: false, error: null, data: empty,
  });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => setState({ loading: false, loaded: true, error: null, data }))
      .catch((err: Error) => setState((s) => ({ ...s, loading: false, loaded: true, error: err.message })));
  }, [fetcher]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

const PLACE_COLS = (withCategories: boolean) =>
  `slug, name_en, name_vi, name_ja, category${withCategories ? ', categories' : ''}, is_featured, vibe_tags, neighborhood_en, neighborhood_vi, neighborhood_ja, address, lat, lng, rating, rating_count, price_display, price_vnd, duration_min, duration_max, desc_en, desc_vi, desc_ja, emoji, opening_hours, website, phone, place_photos(photo_uri, is_cover, is_hidden, sort_order, attribution_name)`;

async function fetchPlaces(cityId: string): Promise<Place[]> {
  const run = (cols: string) => supabase
    .from('places')
    .select(cols)
    .eq('city_id', cityId)
    .eq('is_published', true)
    .eq('review_status', 'approved')
    .order('sort_order', { ascending: true, nullsFirst: false });

  let { data, error } = await run(PLACE_COLS(true));
  // A build can reach a database that has not run the categories migration
  // yet. Drop the column and retry rather than showing an error screen —
  // categoriesOf() derives a usable value from vibes in the meantime.
  if (error && error.message.includes('categories')) {
    ({ data, error } = await run(PLACE_COLS(false)));
  }
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Place[];
}

const COLLECTION_COLS = (withOwner: boolean) =>
  `slug, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle${withOwner ? ', owner_id, city_id' : ''}, collection_places(sort_order, places(slug)), cover:place_photos!collections_cover_photo_id_fkey(photo_uri)`;

async function fetchCollections(cityId: string): Promise<Collection[]> {
  const run = (withOwner: boolean) => {
    const q = supabase
      .from('collections')
      .select(COLLECTION_COLS(withOwner))
      .eq('city_id', cityId)
      .eq('is_public', true);
    // Editorial rows only. A user's own lists are private and come back
    // through fetchMyCollections, so nothing appears in both sections.
    return (withOwner ? q.is('owner_id', null) : q).order('sort_order');
  };

  let { data, error } = await run(true);
  // A build can reach a database that has not run the user-collections
  // migration yet. Drop the column and retry rather than breaking the tab —
  // every row there is editorial until the migration lands anyway.
  if (error && error.message.includes('owner_id')) ({ data, error } = await run(false));
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Collection[];
}

/**
 * Every list this user owns, with its places inside it.
 *
 * Two differences from the public query, both for the same reason. It is
 * not filtered by city, and it embeds whole place rows rather than slugs —
 * so a list made in Hanoi still counts, still shows a cover and still
 * opens, while the app is looking at Saigon.
 *
 * It costs more per row than the public query. It is also one person's own
 * lists rather than a city's catalog, so there are a handful of them.
 */
const MY_COLLECTION_COLS =
  `slug, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle, owner_id, city_id, cover:place_photos!collections_cover_photo_id_fkey(photo_uri), collection_places(sort_order, places(${PLACE_COLS(true)}))`;

async function fetchMyCollections(ownerId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select(MY_COLLECTION_COLS)
    // Newest first: the one you just made is the one you came back for.
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  type Row = Omit<Collection, 'collection_places' | 'members'> & {
    collection_places: { sort_order: number; places: Place | null }[];
  };
  return ((data ?? []) as unknown as Row[]).map((row) => {
    const cps = [...(row.collection_places ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return {
      ...row,
      members: cps.map((cp) => cp.places).filter((p): p is Place => !!p),
      // Kept in the shape the rest of the app reads, so `holds()` and the
      // counts do not have to know which query produced the row.
      collection_places: cps.map((cp) => ({
        sort_order: cp.sort_order,
        places: cp.places ? { slug: cp.places.slug } : null,
      })),
    };
  });
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

export const usePlacesQuery = () => {
  const { city } = useCity();
  const fetcher = useCallback(
    () => (city ? fetchPlaces(city.id) : (pending as Promise<Place[]>)),
    [city?.id],
  );
  return useFetch(fetcher, [] as Place[]);
};

export const useCollectionsQuery = () => {
  const { city } = useCity();
  const fetcher = useCallback(
    () => (city ? fetchCollections(city.id) : (pending as Promise<Collection[]>)),
    [city?.id],
  );
  return useFetch(fetcher, [] as Collection[]);
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
