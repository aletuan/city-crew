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
 * Has the desk granted this account the local-guide role?
 *
 * Asked with no filter on purpose. `guides read their own grant` scopes
 * the table to the caller's own row, so a filter here would be a second,
 * weaker copy of a rule Postgres already enforces — and the one that
 * could drift. An empty answer means "no", which is also what a guest
 * gets and what a database that predates the table gives: three
 * different facts, one safe answer, and the safe answer is the one that
 * draws no control.
 */
export async function fetchIsLocalGuide(): Promise<boolean> {
  const { data, error } = await supabase.from('local_guides').select('user_id').limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
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
 * `sort_order` puts it at the end of the gallery. `photosOf` sorts the
 * cover first and then by this number, so a new photograph has to come
 * after the ones already there; passed in by the caller, which is what
 * counted them.
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
 * Take one back.
 *
 * `uploaders remove their own photos` is what makes this safe to call
 * with nothing but an id: a row that is not this account's is not
 * deleted, and RLS answers that with silence rather than an error. So
 * the caller cannot tell a refusal from a success, and does not need to
 * — either way the photograph the person wanted gone is gone or was
 * never theirs.
 */
export async function removePlacePhoto(id: string): Promise<void> {
  const { error } = await supabase.from('place_photos').delete().eq('id', id);
  if (error) throw new Error(error.message);
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
