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
import { kindOf } from '../photoKind';
import { SHOWN, type PhotoScore, type Reading, type ScorerKey } from '../photoScore';

/** The photo labels' scorer name (`supabase/functions/_shared/photoLabels.ts`). */
const LABELS = 'claude-labels';

/** The catalog's photo columns plus `source`, which the sheet prints. */
// `storage_path` rides along for one reason: a delete hands it to the
// bucket once the row is gone (`removePlacePhoto`).
// The score rides along embedded: the gallery is the one screen that
// shows it, so it costs no other read. Only the shown scorer's row — see
// the filter in `fetchGallery`. The photo labels ride along the same way,
// as a second embed of the same table, narrowed to their own scorer: the
// sheet names a photograph's kind from them (`photoKind`).
//
// Both embeds carry a name of their own (`score`, `labels`), and each
// filter names its embed by it. With the score left as bare
// `photo_scores`, PostgREST read `photo_scores.scorer` as a filter on
// every embed of that table — measured against the project on 18 Oct
// 2026: `labels` came back empty on every photograph, since no row is
// both scorers, and the score embed came back unfiltered, holding both
// rows in whatever order they arrived. So the sheet showed no kind, and
// the score was right only while Vision's row happened to come first.
const COLS = 'id, photo_uri, is_cover, is_hidden, sort_order, source, storage_path, '
  + 'score:photo_scores(scorer, scorer_version, aesthetic, is_utility, signals), '
  + 'labels:photo_scores(signals)';

/** One embedded row, whichever shape PostgREST gave it. */
type Embed<R> = R | R[] | null | undefined;
type Row = Omit<GalleryPhoto, 'score' | 'kind'> & { score?: Embed<PhotoScore>; labels?: Embed<{ signals: unknown }> };
const one = <R,>(e: Embed<R>): R | null => (Array.isArray(e) ? e[0] : e) ?? null;

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
    // A filter on the embedded rows, not on the photographs: a photograph
    // the shown scorer has not read still comes back, with no score. The
    // table keys a row on (photo, scorer) since 16 Oct 2026, so without it
    // a second scorer's row could be the one that arrived.
    .eq('score.scorer', SHOWN.id)
    .eq('labels.scorer', LABELS)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(({ score: sc, labels, ...photo }) => ({
    ...photo,
    // An object, as PostgREST embeds a one-to-one (it still is, while
    // `photo_scores_one_per_photo` stands); an array, as it embeds a
    // one-to-many, which it will be once that constraint goes. This
    // should not depend on which it decided.
    score: one(sc),
    kind: kindOf(one(labels)?.signals),
  }));
}

/**
 * Keep one reading, stamped with the scorer that made it — the one that
 * read, not a constant, so a row never claims a reader it did not have.
 * An upsert on (photo, scorer), so a rescore by a newer version of the
 * same scorer replaces its row and leaves any other scorer's alone;
 * `scored_by` and `scored_at` are written outright because an upsert
 * that hits an existing row is an update, which keeps the old values —
 * and the update policy asks that the row be in the writer's name
 * (`20261015120000_photo_scores.sql`).
 */
export async function savePhotoScore(photoId: string, scorer: ScorerKey, reading: Reading, uid: string): Promise<void> {
  const { error } = await supabase.from('photo_scores').upsert({
    photo_id: photoId,
    scorer: scorer.id,
    scorer_version: scorer.version,
    aesthetic: reading.aesthetic,
    is_utility: reading.isUtility,
    signals: reading.signals,
    scored_by: uid,
    scored_at: new Date().toISOString(),
  }, { onConflict: 'photo_id,scorer' });
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
