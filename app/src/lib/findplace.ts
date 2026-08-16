// Asking the server to search OpenStreetMap for a place by name.
//
// The call only. Everything that turns a row into a list item is plain
// data in `lib/spots`, for the reason given at the top of that file, and
// why the results are OSM rather than the Google Places search this app
// already has is answered at the top of the Edge Function.

import { supabase } from './supabase';
import { toSpots, type Spot, type SpotRow } from './spots';

export type { Spot, SpotRow };

/**
 * Places matching a name, biased towards a point.
 *
 * Biased, not restricted: somebody typing a place in the next province
 * means that place, and a search box that refuses to leave the city is
 * wrong at the exact moment it matters. The old version pasted the city's
 * name onto the query, which restricted it in the worst possible way —
 * silently, and towards a city the reader might be eighty-five kilometres
 * from.
 *
 * Throws nothing. A search that failed and a search that found nothing
 * are the same sentence to the reader — "we could not put that on the
 * map" — so the caller gets one empty state to render rather than two.
 */
export async function findSpots(
  query: string,
  at: { lat: number; lng: number } | null,
): Promise<Spot[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const { data, error } = await supabase.functions.invoke('find-address', {
      body: { query: q, at },
    });
    if (error) return [];
    const rows = (data as { rows?: SpotRow[] })?.rows;
    return Array.isArray(rows) ? toSpots(rows) : [];
  } catch {
    return [];
  }
}
