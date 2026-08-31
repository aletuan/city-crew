// The two reads an account export needs and nothing else in the app does.
//
// Everything else it takes — profile, collections, likes, trips,
// preferences, friendships, blocks — already has a function somewhere in
// this directory, because the app itself displays all of it. These two it
// never displays: a list of every place you contributed is not a screen,
// and history is only ever read as a verdict (`fetchPassedOver` collapses
// it to "slugs this person turned down", over a 90-day window).
//
// An export cannot use that verdict. It owes the rows themselves — every
// event, every kind, with no window — because what it answers is "what do
// you hold about me", and a summary is not an answer to that. So these
// two are deliberately dumber than their neighbours: no shaping, no
// windowing, no interpretation.
//
// Both filter on the owner explicitly even though RLS already does. That
// is `fetchMyLikes`'s belt-and-braces and its reasoning: a query that
// states its own scope cannot be quietly widened by a policy change.

import { supabase } from '../supabase';

/** One place this account put into the catalog. Survives the account —
 *  see the delete screen — so it is exported as a contribution rather
 *  than as a possession. */
export type SubmittedPlaceRow = {
  slug: string;
  name_en: string;
  name_vi: string;
  created_at: string | null;
};

export async function fetchMySubmittedPlaces(ownerId: string): Promise<SubmittedPlaceRow[]> {
  const { data, error } = await supabase
    .from('places')
    .select('slug, name_en, name_vi, created_at')
    .eq('submitted_by', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SubmittedPlaceRow[];
}

/** One row of `place_events`, as written.
 *
 *  `kind` is the database's own closed set — open, save, unsave,
 *  plan_keep, plan_drop — and is passed through untranslated. An export
 *  is data, and renaming the verbs would make it prettier and less true. */
export type HistoryEventRow = {
  kind: string;
  city_id: string | null;
  created_at: string;
  places: { slug: string } | null;
};

/** A like this account gave, with enough of the list attached to mean
 *  something. `fetchMyLikes` answers with collection *ids*, which is the
 *  right answer for a screen deciding whether a heart is filled and the
 *  wrong one for a file somebody opens: an export of UUIDs is
 *  machine-readable and not, in any useful sense, information. */
export type LikedCollectionRow = {
  created_at: string;
  collections: { slug: string; curator_handle: string | null } | null;
};

export async function fetchMyLikedCollections(ownerId: string): Promise<LikedCollectionRow[]> {
  const { data, error } = await supabase
    .from('collection_likes')
    .select('created_at, collections(slug, curator_handle)')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LikedCollectionRow[];
}

export async function fetchMyHistory(ownerId: string): Promise<HistoryEventRow[]> {
  const { data, error } = await supabase
    .from('place_events')
    .select('kind, city_id, created_at, places(slug)')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  // Through `unknown`, like every other embed in this directory:
  // PostgREST types a to-one embed as an array and the runtime does not.
  return (data ?? []) as unknown as HistoryEventRow[];
}
