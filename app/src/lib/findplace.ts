// Asking the server where a typed name is, and what to call a point.
//
// The calls only. Everything that turns a reply into a list item is plain
// data in `lib/spots`, for the reason given at the top of that file. Both
// go to `fetch-place`, the Edge Function that already holds the Google
// key; why the answers are Google's rather than OpenStreetMap's, which
// they were until the map became Google's, is answered at the top of
// `MiniMap`.

import { invokeFetchPlace } from './data/functions';
import type { Lang } from './i18n';
import { fromCandidates, type Spot } from './spots';
import { bodyOf, limitOf, SearchLimitError, SignedOutError, type Candidate } from './suggest';

export type { Spot };
export { SearchLimitError, SignedOutError };

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
 * A search that failed and a search that found nothing are the same
 * sentence to the reader — "we could not put that on the map" — so both
 * come back as an empty list. One failure is not that sentence: the
 * function answering 401, which it does for a reader with no session.
 * That is "sign in to search", a thing the reader can do, and until 14
 * Oct 2026 it was folded into "nothing found": the owner, whose session
 * had lapsed on a global sign-out an hour earlier, typed a street in
 * Hanoi and was told to try fewer words. It throws `SignedOutError` for
 * that case alone, as `searchPlaces` does for Add a place.
 */
export async function findSpots(
  query: string,
  at: { lat: number; lng: number } | null,
  city: string | null,
  lang: Lang,
): Promise<Spot[]> {
  const q = query.trim();
  if (!q) return [];
  let res: { data: unknown; error: unknown };
  try {
    res = await invokeFetchPlace({ action: 'search', query: q, at, city: city ?? undefined, lang });
  } catch {
    return [];
  }
  if (res.error) {
    const status = (res.error as { context?: { status?: number } }).context?.status;
    const body = await bodyOf(res.error);
    if (status === 401 || body?.error === 'not signed in') throw new SignedOutError();
    // A spent allowance is not "nothing found" either: searching again,
    // with fewer words or more, is the one thing that will not help.
    const limit = limitOf(body);
    if (limit) throw limit;
    return [];
  }
  const rows = (res.data as { candidates?: Candidate[] })?.candidates;
  return Array.isArray(rows) ? fromCandidates(rows) : [];
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
    const { data, error } = await invokeFetchPlace({ action: 'reverse', at, lang });
    if (error) return '';
    const name = (data as { name?: unknown })?.name;
    return typeof name === 'string' ? name.trim() : '';
  } catch {
    return '';
  }
}
