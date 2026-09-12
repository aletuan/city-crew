// Asking the server where a typed name is, and what to call a point.
//
// The calls only. Everything that turns a reply into a list item is plain
// data in `lib/spots`, for the reason given at the top of that file. Both
// go to `fetch-place`, the Edge Function that already holds the Google
// key; why the answers are Google's rather than OpenStreetMap's, which
// they were until the map became Google's, is answered at the top of
// `MiniMap`.

import { supabase } from './supabase';
import type { Lang } from './i18n';
import { fromCandidates, type Spot } from './spots';
import type { Candidate } from './suggest';

export type { Spot };

/**
 * Places matching a name, biased towards a point.
 *
 * Biased, not restricted: somebody typing a place in the next province
 * means that place, and a search box that refuses to leave the city is
 * wrong at the exact moment it matters. The point is where the pin is, or
 * where the reader is, or the city's centre — the caller decides; without
 * one the function biases to the city it was given.
 *
 * `city` is which catalog city the sheet is open on, which the function
 * needs for its fallback bias and nothing else. `lang` asks Google for
 * names and addresses in the reader's language rather than its guess.
 *
 * Throws nothing. A search that failed and a search that found nothing
 * are the same sentence to the reader — "we could not put that on the
 * map" — so the caller gets one empty state to render rather than two.
 */
export async function findSpots(
  query: string,
  at: { lat: number; lng: number } | null,
  city: string | null,
  lang: Lang,
): Promise<Spot[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const { data, error } = await supabase.functions.invoke('fetch-place', {
      body: { action: 'search', query: q, at, city: city ?? undefined, lang },
    });
    if (error) return [];
    const rows = (data as { candidates?: Candidate[] })?.candidates;
    return Array.isArray(rows) ? fromCandidates(rows) : [];
  } catch {
    return [];
  }
}

/**
 * What to call a point, in the reader's language — "Hoàn Kiếm", "Ba Đình".
 *
 * Google's reverse geocoder rather than the phone's. On iOS the phone's is
 * Apple's, and Apple's terms for it mirror Google's for Places: its
 * answers may not be shown with a non-Apple map. The map is Google's now,
 * so the words under it come from Google too, and the one key on the
 * server pays for both.
 *
 * Empty when the function has no name for the point, or cannot be
 * reached. The caption is a courtesy, and a sheet with no caption is the
 * sheet working; a sheet showing "error" under the map is not.
 */
export async function nameOf(
  at: { lat: number; lng: number },
  lang: Lang,
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-place', {
      body: { action: 'reverse', at, lang },
    });
    if (error) return '';
    const name = (data as { name?: unknown })?.name;
    return typeof name === 'string' ? name.trim() : '';
  } catch {
    return '';
  }
}
