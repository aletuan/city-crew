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

async function fetchCollections(cityId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('slug, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle, collection_places(sort_order, places(slug)), cover:place_photos!collections_cover_photo_id_fkey(photo_uri)')
    .eq('city_id', cityId)
    .eq('is_public', true)
    .order('sort_order');
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

/** Resolve a collection's member slugs against the published catalog. */
export function membersOf(c: Collection, places: Place[]): Place[] {
  const bySlug = new Map(places.map((p) => [p.slug, p]));
  return [...c.collection_places]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cp) => (cp.places ? bySlug.get(cp.places.slug) : undefined))
    .filter((p): p is Place => !!p);
}
