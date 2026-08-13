// Data layer: reads the published catalog straight from Supabase with the
// public client — the same access path (and RLS view) the mockup snapshot
// uses. No app server involved.

import { useCallback, useEffect, useState } from 'react';
import { useCity } from './city';
import { supabase } from './supabase';

export type PlacePhoto = {
  photo_uri: string;
  is_cover: boolean;
  is_hidden: boolean;
  sort_order: number;
  attribution_name: string | null;
};

export type Place = {
  slug: string;
  name_en: string;
  name_vi: string;
  name_ja: string | null;
  /** Legacy coarse axis, superseded by `categories`; still written by the
   *  import pipeline and used by the dashboard. */
  category: 'food' | 'out';
  /** Functional axis, many per place — see lib/categories. Optional because
   *  a database that predates the migration simply omits it; read it through
   *  categoriesOf(), never directly. */
  categories?: string[];
  is_featured: boolean;
  /** How a place feels — see lib/vibes. */
  vibe_tags: string[];
  neighborhood_en: string | null;
  neighborhood_vi: string | null;
  neighborhood_ja: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  rating_count: number | null;
  price_display: string | null;
  price_vnd: number | null;
  duration_min: number | null;
  duration_max: number | null;
  desc_en: string | null;
  desc_vi: string | null;
  desc_ja: string | null;
  emoji: string | null;
  opening_hours: string[] | null;
  website: string | null;
  phone: string | null;
  place_photos: PlacePhoto[];
};

export type Collection = {
  slug: string;
  title_en: string;
  title_vi: string;
  title_ja: string | null;
  desc_en: string | null;
  desc_vi: string | null;
  desc_ja: string | null;
  curator_handle: string | null;
  cover: { photo_uri: string } | null;
  collection_places: { sort_order: number; places: { slug: string } | null }[];
  /** Null on the editorial collections — those belong to the desk. Set to a
   *  user's id on the lists they made for themselves. */
  owner_id?: string | null;
};

/** Visible photos, cover first. */
export function photosOf(p: Place): PlacePhoto[] {
  return [...p.place_photos]
    .filter((ph) => !ph.is_hidden)
    .sort((a, b) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0) || a.sort_order - b.sort_order);
}

export function coverOf(p: Place): PlacePhoto | undefined {
  return photosOf(p)[0];
}

/** Explicitly free (0₫) — distinct from a missing price. */
export function isFree(p: Place): boolean {
  if (p.price_vnd === 0) return true;
  const d = (p.price_display ?? '').trim();
  return d === '0₫' || d === '0đ' || d === '0';
}

/** Display label for a paid place, or null when no price is known. */
export function priceLabel(p: Place): string | null {
  if (p.price_display) return p.price_display;
  if (p.price_vnd != null) return `${Math.round(p.price_vnd / 1000)}k₫`;
  return null;
}

export function fmtCount(n: number | null | undefined): string {
  if (!n) return '';
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
}

type Fetch<T> = { loading: boolean; error: string | null; data: T; reload: () => void };

function useFetch<T>(fetcher: () => Promise<T>, empty: T): Fetch<T> {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: T }>({
    loading: true, error: null, data: empty,
  });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err: Error) => setState((s) => ({ ...s, loading: false, error: err.message })));
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
  `slug, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle${withOwner ? ', owner_id' : ''}, collection_places(sort_order, places(slug)), cover:place_photos!collections_cover_photo_id_fkey(photo_uri)`;

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

async function fetchMyCollections(cityId: string, ownerId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select(COLLECTION_COLS(true))
    .eq('city_id', cityId)
    .eq('owner_id', ownerId)
    // Newest first: the one you just made is the one you came back for.
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Collection[];
}

// Both catalogs scope to the selected city TOGETHER: membersOf() resolves
// collection members against the in-memory places list, so a mismatched
// scope would silently render empty collections. A city switch changes the
// fetcher identity, which makes useFetch reload everywhere automatically.
const pending = new Promise<never>(() => {}); // keeps skeletons up during city bootstrap

export const usePlaces = () => {
  const { city } = useCity();
  const fetcher = useCallback(
    () => (city ? fetchPlaces(city.id) : (pending as Promise<Place[]>)),
    [city?.id],
  );
  return useFetch(fetcher, [] as Place[]);
};

export const useCollections = () => {
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
  const { city } = useCity();
  const fetcher = useCallback(
    () => (city && ownerId ? fetchMyCollections(city.id, ownerId) : Promise.resolve([] as Collection[])),
    [city?.id, ownerId],
  );
  return useFetch(fetcher, [] as Collection[]);
};

/**
 * A slug from a title the user typed. Diacritics are stripped so "Cà phê
 * sáng" and "Ca phe sang" land on the same stem; a title with no latin
 * letters at all (Japanese, say) keeps only the suffix, which is enough —
 * the slug is a key, not a label.
 */
function slugify(title: string): string {
  const stem = title
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return stem || 'list';
}

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

/** Does this list already hold this place? Read from what is in memory —
 *  the collection rows carry their members. */
export function holds(c: Collection, placeSlug: string): boolean {
  return c.collection_places.some((cp) => cp.places?.slug === placeSlug);
}

/** Resolve a collection's member slugs against the published catalog. */
export function membersOf(c: Collection, places: Place[]): Place[] {
  const bySlug = new Map(places.map((p) => [p.slug, p]));
  return [...c.collection_places]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cp) => (cp.places ? bySlug.get(cp.places.slug) : undefined))
    .filter((p): p is Place => !!p);
}
