// The gallery's reads and writes, as questions put to Postgres.
//
// Every rule is on the server — `20260921140000_gallery_same_rights.sql`
// — and stated again in `lib/gallery` for the screen. Nothing here
// decides anything; what is worth pinning is the shape of each call.
//
// The two writes are rpcs and not table updates, because there is no
// update policy for a guide and there is not meant to be one. Each
// function on the other end asks who is calling and what they are
// touching, and raises if the answer is wrong. So each of these throws:
// a refusal is a bug on one side or the other, and the screen should
// hear about it rather than draw a success it did not have.

import { supabase } from '../supabase';
import type { GalleryPhoto } from '../gallery';
import { SCORER_VERSION, type PhotoScore, type Reading } from '../photoScore';

/** The catalog's photo columns plus `source`, which the sheet prints. */
// `storage_path` rides along for one reason: a delete hands it to the
// bucket once the row is gone (`removePlacePhoto`).
// The score rides along embedded, one-to-one on its primary key: the
// gallery is the one screen that shows it, so it costs no other read.
const COLS = 'id, photo_uri, is_cover, is_hidden, sort_order, source, storage_path, '
  + 'photo_scores(scorer_version, aesthetic, is_utility, signals)';

type Row = Omit<GalleryPhoto, 'score'> & { photo_scores?: PhotoScore | PhotoScore[] | null };

/**
 * Every photograph on the place, hidden ones included.
 *
 * Its own query rather than the catalog's `place_photos` embed, for two
 * reasons: the embed does not carry `source`, and adding it would widen
 * every place in every list for the sake of one screen; and the embed is
 * read through `photosOf`, which drops hidden rows before anything else
 * sees them. The gallery is the one place hidden rows are the point.
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
  return ((data ?? []) as unknown as Row[]).map(({ photo_scores: sc, ...photo }) => ({
    ...photo,
    // An object, as PostgREST embeds a one-to-one; an array of one is
    // what it sends when it cannot prove the relation is one-to-one, and
    // this should not depend on which it decided.
    score: (Array.isArray(sc) ? sc[0] : sc) ?? null,
  }));
}

/**
 * Keep one reading. An upsert, so a rescore by a newer scorer replaces
 * the old row; `scored_by` and `scored_at` are written outright because
 * an upsert that hits an existing row is an update, which keeps the old
 * values — and the update policy asks that the row be in the writer's
 * name (`20261015120000_photo_scores.sql`).
 */
export async function savePhotoScore(photoId: string, reading: Reading, uid: string): Promise<void> {
  const { error } = await supabase.from('photo_scores').upsert({
    photo_id: photoId,
    scorer_version: SCORER_VERSION,
    aesthetic: reading.aesthetic,
    is_utility: reading.isUtility,
    signals: reading.signals,
    scored_by: uid,
    scored_at: new Date().toISOString(),
  }, { onConflict: 'photo_id' });
  if (error) throw new Error(error.message);
}

/** Make this the picture that stands for the place. One call, no moment
 *  with two covers — see `guide_set_cover`. */
export async function setCover(photoId: string): Promise<void> {
  const { error } = await supabase.rpc('guide_set_cover', { photo: photoId });
  if (error) throw new Error(error.message);
}

/** Hide, or show again — whoever hid it. Last hand wins. */
export async function setHidden(photoId: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.rpc('guide_set_hidden', { photo: photoId, hidden });
  if (error) throw new Error(error.message);
}
