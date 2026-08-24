import { supabase } from '../supabase';
import type { Place } from '../types';
import { PLACE_COLS } from './places';

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
export async function fetchMyTrips(ownerId: string): Promise<Trip[]> {
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
