// The check-ins table, read and written. Rules are in `lib/checkin.ts`;
// this file knows the columns.

import { supabase } from '../supabase';
import type { Checkin } from '../checkin';
import { DAILY_LIMIT, refusedByPolicy } from '../quota';
import { fetchPlaceId } from './guide';

type PhotoRow = { photo_uri: string; is_cover: boolean; is_hidden: boolean; sort_order: number };
type CheckinRow = {
  id: string; city_id: string | null; at: string;
  places: {
    slug: string; name_en: string; name_vi: string; name_ja: string | null;
    /** Absent on a row the launch cache kept before the embed joined. */
    place_photos?: PhotoRow[];
  } | null;
};

/** The place's cover, by the catalog's own rule (`photosOf`): a flagged
 *  cover first, else the first by sort order, hidden ones never. Written
 *  out here rather than borrowed because that rule takes a whole
 *  `Place`, and a check-in carries four columns of one. */
function coverUri(photos: PhotoRow[] | undefined): string | null {
  const shown = (photos ?? []).filter((ph) => !ph.is_hidden)
    .sort((a, b) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0) || a.sort_order - b.sort_order);
  return shown[0]?.photo_uri ?? null;
}

/** Every visit this account has recorded, newest first, with the
 *  place's slug, names and cover flattened in — those because the
 *  Visited screen lists places from every city, and the catalog holds
 *  one. The photos are embedded whole and reduced to one URL here: a
 *  place has six or so, and thirty visits make a payload a list can
 *  carry, where a second query per row could not. A row
 *  whose place is gone keeps its date and an empty slug: the visit
 *  happened, whatever became of the row. */
export async function fetchMyCheckins(ownerId: string): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, city_id, at, places(slug, name_en, name_vi, name_ja, place_photos(photo_uri, is_cover, is_hidden, sort_order))')
    .eq('user_id', ownerId)
    .order('at', { ascending: false });
  if (error) throw new Error(error.message);
  // Through `unknown`, like every embed in this directory: PostgREST
  // types a to-one embed as an array and the runtime does not.
  return ((data ?? []) as unknown as CheckinRow[]).map((r) => ({
    id: r.id, place_slug: r.places?.slug ?? '', city_id: r.city_id, at: r.at,
    place: r.places
      ? { name_en: r.places.name_en, name_vi: r.places.name_vi, name_ja: r.places.name_ja, cover: coverUri(r.places.place_photos) }
      : null,
  }));
}

/**
 * One visit, now. The place is found by slug the way `logPlaceEvent`
 * finds it — the screens hold slugs, the table holds ids — and the
 * instant is the database's clock, not the phone's.
 *
 * A policy refusal is thrown as `daily_limit`, which is what the one
 * screen that calls this tells the reader about. The insert policy also
 * refuses a second visit inside ten minutes; the pill never offers one
 * (`canRepeat`), so reaching that refusal takes two phones, and the cap
 * sentence is a fair thing for the second to hear.
 */
export async function addCheckin(input: { ownerId: string; placeSlug: string; cityId: string | null }): Promise<void> {
  const placeId = await fetchPlaceId(input.placeSlug);
  if (!placeId) throw new Error('place_not_found');
  const { error } = await supabase
    .from('checkins')
    .insert({ user_id: input.ownerId, place_id: placeId, city_id: input.cityId });
  if (error) throw new Error(refusedByPolicy(error) ? DAILY_LIMIT : error.message);
}

/** Undo one visit. RLS keeps this to the caller's own rows. */
export async function removeCheckin(id: string): Promise<void> {
  const { error } = await supabase.from('checkins').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
