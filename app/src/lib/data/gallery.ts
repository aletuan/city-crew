// The gallery's reads and writes, as questions put to Postgres.
//
// Every rule is on the server — `20260921120000_gallery_guide_rpcs.sql`
// — and stated again in `lib/gallery` for the screen. Nothing here
// decides anything; what is worth pinning is the shape of each call.
//
// The three writes are rpcs and not table updates, because there is no
// update policy for a guide and there is not meant to be one. Each
// function on the other end asks who is calling and what they are
// touching, and raises if the answer is wrong. So each of these throws:
// a refusal is a bug on one side or the other, and the screen should
// hear about it rather than draw a success it did not have.

import { supabase } from '../supabase';
import type { GalleryPhoto } from '../gallery';

/** The catalog's photo columns plus the three the boundary reads. */
const COLS = 'id, photo_uri, is_cover, is_hidden, sort_order, source, uploaded_by, hidden_by';

/**
 * Every photograph on the place, hidden ones included.
 *
 * Its own query rather than the catalog's `place_photos` embed, for two
 * reasons: the embed does not carry `source`, `uploaded_by` or
 * `hidden_by`, and adding them would widen every place in every list for
 * the sake of one screen; and the embed is read through `photosOf`, which
 * drops hidden rows before anything else sees them. The gallery is the
 * one place hidden rows are the point.
 *
 * No filter on hidden, because `submitters read their own place photos`
 * now returns them for the person keeping the gallery and nobody else.
 */
export async function fetchGallery(placeId: string): Promise<GalleryPhoto[]> {
  const { data, error } = await supabase
    .from('place_photos')
    .select(COLS)
    .eq('place_id', placeId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as GalleryPhoto[];
}

/** Make this the picture that stands for the place. One call, no moment
 *  with two covers — see `guide_set_cover`. */
export async function setCover(photoId: string): Promise<void> {
  const { error } = await supabase.rpc('guide_set_cover', { photo: photoId });
  if (error) throw new Error(error.message);
}

/** Hide, or show again. Showing again is refused for a photograph the
 *  desk hid; `lib/gallery`'s `canUnhide` is why the screen never asks. */
export async function setHidden(photoId: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.rpc('guide_set_hidden', { photo: photoId, hidden });
  if (error) throw new Error(error.message);
}

/** The whole gallery in its new order. Every id, exactly once — the
 *  function on the other end refuses anything less. */
export async function reorderGallery(placeId: string, ids: readonly string[]): Promise<void> {
  const { error } = await supabase.rpc('guide_reorder_photos', { target_place: placeId, ids: [...ids] });
  if (error) throw new Error(error.message);
}
