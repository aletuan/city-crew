// The local guide's two writes, and the one read that says whether to
// offer them.
//
// The rules are all in Postgres — `20260919080000_local_guide_photos.sql`
// — so almost nothing here is a decision. What is worth pinning is the
// shape of each question: which of these is scoped by RLS rather than by
// a filter written here, which one fails loudly, and what the insert is
// obliged to say about itself.

import { supabase } from '../supabase';

/**
 * Which cities the desk has made this account a local guide of.
 *
 * A list of city ids in which `null` is a member meaning *every* city —
 * the shape `local_guides` itself uses since
 * `20260922100000_local_guides_per_city.sql`. Kept rather than flattened
 * to a boolean, because the question the app asks is not "is this person
 * a guide" but "is this person a guide *here*", and only the caller
 * holding a place knows where here is.
 *
 * Asked with no filter on purpose. `guides read their own grant` scopes
 * the table to the caller's own rows, so a filter here would be a second,
 * weaker copy of a rule Postgres already enforces — and the one that
 * could drift. An empty answer means "nowhere", which is also what a
 * guest gets and what a database that predates the table gives: three
 * different facts, one safe answer, and the safe answer is the one that
 * draws no control.
 */
export async function fetchGuideCities(): Promise<(string | null)[]> {
  const { data, error } = await supabase.from('local_guides').select('city_id');
  if (error) return [];
  return (data ?? []).map((r) => r.city_id ?? null);
}

/**
 * Whether this account is on the desk's `editors` list.
 *
 * Asked through `is_editor()`, the same function every policy asks, so the
 * app and the database cannot disagree about who the desk is. Like the
 * grant above, a failure reads as no: the answer that draws nothing is the
 * one that cannot draw a control the database would then refuse.
 */
export async function fetchIsEditor(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_editor');
  if (error) return false;
  return data === true;
}

/**
 * How many photographs this account has already put on this place, and
 * how many it has put anywhere today.
 *
 * Counted here rather than left to the policy because a refusal from the
 * policy arrives after the picker, the shrink and the upload — by which
 * time the person has already chosen the photograph. The policy still
 * counts; this is what lets the screen say which limit was reached
 * instead of "that did not work".
 *
 * `uploaded_by` is filtered explicitly, and that is not belt-and-braces.
 * Everywhere else in this file a filter would duplicate RLS, but
 * `place_photos` has no policy that scopes a read to the uploader: the
 * two it has scope by the *place* — public for a live one, the
 * submitter's for a pending one. Counting without this clause would
 * count every photograph on the place, the desk's included, and refuse a
 * person at five pictures none of which were theirs.
 *
 * Ids rather than a `head: true` count: the numbers here are bounded by
 * the caps themselves — five and ten — so the rows are cheaper than the
 * capability would be worth.
 */
export async function fetchMyPhotoCounts(placeId: string, uid: string): Promise<{
  mineHere: number;
  mineToday: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [here, today] = await Promise.all([
    supabase.from('place_photos').select('id')
      .eq('uploaded_by', uid).eq('place_id', placeId),
    supabase.from('place_photos').select('id')
      .eq('uploaded_by', uid).gte('created_at', since),
  ]);
  // A failed count answers zero rather than blocking the upload: the
  // policy is the limit, and this is only the message in front of it.
  return {
    mineHere: (here.data as unknown[] | null)?.length ?? 0,
    mineToday: (today.data as unknown[] | null)?.length ?? 0,
  };
}

/**
 * File a photograph against a place.
 *
 * Every column named here is one the insert policy checks, and naming
 * them explicitly is the point: a default that drifted — `source`
 * arriving as 'google', say — would be refused by Postgres rather than
 * written wrongly, but the refusal would be a mystery at this call site.
 * Written out, the row says what it is.
 *
 * `sort_order` puts it at the end of the gallery, and `is_cover` goes in
 * false because the insert policy refuses anything else — a guide has no
 * write on that column and no update policy to reach it with afterwards.
 *
 * It does not stay false. `guide_upload_becomes_cover`, a definer trigger
 * on the table, moves the cover onto the row once the insert has cleared
 * the policy; see `20260921093000_guide_upload_becomes_cover.sql` for why
 * that has to happen after the write rather than in it. So the row lands
 * last by `sort_order` and first by `photosOf`, which sorts the cover
 * ahead of the number — what the reader sees is the photograph they just
 * took, standing for the place.
 */
export async function addPlacePhoto(row: {
  placeId: string;
  uid: string;
  publicUrl: string;
  storagePath: string;
  sortOrder: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from('place_photos')
    .insert({
      place_id: row.placeId,
      uploaded_by: row.uid,
      photo_uri: row.publicUrl,
      storage_path: row.storagePath,
      sort_order: row.sortOrder,
      source: 'upload',
      is_cover: false,
      is_hidden: false,
    })
    .select('id')
    .single();
  // Loud, unlike the reads above. A failed upload that said nothing would
  // leave a file in the bucket and no row pointing at it, and the person
  // believing their photograph is on the place.
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/**
 * Put the file in the bucket, and say where a reader will find it.
 *
 * Here and not in the hook that picks the photograph, because this is
 * the storage half of the same write `addPlacePhoto` finishes, and every
 * other question this app puts to Supabase is asked from `lib/`. It was
 * the one call in `components/` that reached for the client itself — see
 * the layer rules in `docs/architecture.md`.
 *
 * Loud for the same reason the insert is: the caller must not go on to
 * write a row pointing at a file that is not there.
 */
export async function uploadPlacePhoto(path: string, bytes: ArrayBuffer): Promise<string> {
  const bucket = supabase.storage.from('place-photos');
  const up = await bucket.upload(path, bytes, { contentType: 'image/jpeg' });
  if (up.error) throw new Error(up.error.message);
  return bucket.getPublicUrl(path).data.publicUrl;
}

/**
 * Take one back: the row, and then the file behind it.
 *
 * `uploaders remove their own photos` is what makes the row half safe to
 * call with nothing but an id: a row that is not this account's is not
 * deleted, and RLS answers that with silence rather than an error. So
 * the caller cannot tell a refusal from a success, and does not need to
 * — either way the photograph the person wanted gone is gone or was
 * never theirs.
 *
 * The file after the row, never before. A row pointing at a missing
 * file is a broken picture on every screen that draws the place; a file
 * with no row is a few hundred kilobytes nobody sees. Until 6 Oct 2026
 * this was the row alone, and the sweep that day found fifty-six such
 * files, most of them left by this delete — see `prune-photos`. The
 * remove is best effort (`removePhotoFile`): the row is what the person
 * asked about, and the broom catches what the bucket will not give up.
 *
 * `storagePath` is null for a row that never had a file of ours — the
 * Google-sourced rows before `rehost-photos` — and then there is nothing
 * to take out.
 */
export async function removePlacePhoto(id: string, storagePath: string | null): Promise<void> {
  const { error } = await supabase.from('place_photos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (storagePath) await removePhotoFile(storagePath);
}

/**
 * One file out of the bucket, quietly.
 *
 * Called where the row is already gone (`removePlacePhoto`) or never
 * landed (`useAddPhoto`, when the insert after the upload is refused),
 * which is why it does not throw: nothing the caller could do with the
 * failure would help the reader, and a thrown remove would report a
 * delete as failed when the thing they asked for has happened. Storage
 * answers a path the policy will not let this account see with an empty
 * list rather than an error — the same silence as the row — so success
 * is not read either. What stays behind, `prune-photos` sweeps.
 *
 * The policy that lets an uploader's remove find their own object is
 * `local guides read their own place photos`: Storage removes only what
 * the caller can select, the lesson the 10 Sep migration learned for
 * editors.
 */
export async function removePhotoFile(path: string): Promise<void> {
  try {
    await supabase.storage.from('place-photos').remove([path]);
  } catch {
    // Housekeeping; see above.
  }
}

/**
 * The place's row id, from the slug the app carries.
 *
 * The catalog query does not select `id` — a place travels through this
 * app by slug, and every screen, route and saved list is keyed on it. One
 * column could be added to `PLACE_COLS` for this, but that query is the
 * hot one: it runs on every city switch, for every place, and carrying a
 * uuid nobody reads to serve one upload a day is the wrong trade.
 *
 * So it is looked up at the moment of writing instead — the one moment
 * the id is actually needed. RLS scopes the read the same way it scopes
 * everything else: a slug the caller cannot see answers null, and the
 * insert that would have followed was never going to be allowed.
 */
export async function fetchPlaceId(slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('places')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return null;
  return (data as { id: string } | null)?.id ?? null;
}
