// The reads an account export needs and nothing else in the app does.
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

import type { I18nDoc } from '../localized';
import { supabase } from '../supabase';
import { everyPage } from './pages';

/** One place this account put into the catalog. Survives the account —
 *  see the delete screen — so it is exported as a contribution rather
 *  than as a possession. */
export type SubmittedPlaceRow = {
  slug: string;
  name_en: string;
  name_vi: string;
  /** Every name after the two columns — Japanese and on (`localized`). */
  i18n?: I18nDoc | null;
  created_at: string | null;
};

export async function fetchMySubmittedPlaces(ownerId: string): Promise<SubmittedPlaceRow[]> {
  const { data, error } = await supabase
    .from('places')
    .select('slug, name_en, name_vi, i18n, created_at')
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

/** A share this account is on, either end (12 Nov 2026): a private list
 *  of yours shared with a friend, or a friend's list shared with you.
 *  The other person is an id here; the export reduces it to a handle. */
export type ShareRow = {
  created_at: string;
  user_id: string;
  collections: { slug: string; owner_id: string | null } | null;
};

/**
 * Both sides of `collection_shares` this account is on: the shares on its
 * own lists, and the shares naming it.
 *
 * Two reads, each scoped in the query as well as by RLS — the same
 * belt-and-braces as the reads above. The policy lets both ends see a
 * share; a query that says which end it means cannot be quietly widened.
 * The first scopes through the list (`!inner`, so a share whose list is
 * not this account's is not returned at all, rather than returned with
 * its list missing).
 */
export async function fetchMyShares(ownerId: string): Promise<{ mine: ShareRow[]; withMe: ShareRow[] }> {
  const [mine, withMe] = await Promise.all([
    supabase
      .from('collection_shares')
      .select('created_at, user_id, collections!inner(slug, owner_id)')
      .eq('collections.owner_id', ownerId)
      .order('created_at', { ascending: true }),
    supabase
      .from('collection_shares')
      .select('created_at, user_id, collections(slug, owner_id)')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: true }),
  ]);
  if (mine.error) throw new Error(mine.error.message);
  if (withMe.error) throw new Error(withMe.error.message);
  return {
    mine: (mine.data ?? []) as unknown as ShareRow[],
    withMe: (withMe.data ?? []) as unknown as ShareRow[],
  };
}

/** A list one of this account's trips was started from (13 Nov 2026,
 *  `trip_collections`). The app never reads these back — they exist to be
 *  counted on the list's Statistics page — so, like the two reads above,
 *  this one is the export's alone. The policy (`legal.ts`) says a trip
 *  remembers the lists it started from; an export that left them out
 *  would be the one place that promise was not kept. */
export type TripSourceRow = {
  trip_id: string;
  collections: { slug: string } | null;
};

/**
 * The source lists of this account's own trips.
 *
 * Scoped through the trip (`!inner`, filtered on its owner) as well as by
 * RLS, which already lets only a trip's owner read its sources: a joined
 * trip's sources are the planner's record, not this reader's. A list
 * that is gone, or has since gone private to somebody else, comes back
 * with `collections` null, and the export drops it rather than print an id.
 */
export async function fetchMyTripSources(ownerId: string): Promise<TripSourceRow[]> {
  const { data, error } = await supabase
    .from('trip_collections')
    .select('trip_id, collections(slug), trips!inner(owner_id)')
    .eq('trips.owner_id', ownerId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (TripSourceRow & { trips: unknown })[])
    .map(({ trip_id, collections }) => ({ trip_id, collections }));
}

export async function fetchMyHistory(ownerId: string): Promise<HistoryEventRow[]> {
  // Every page (`lib/data/pages`): one reader had 1,991 events by 22 Oct
  // 2026, and a single read handed the export the first thousand. `id`
  // breaks the tie between two events in the same instant, so no page
  // boundary can drop one or repeat it.
  // Through `unknown`, like every other embed in this directory:
  // PostgREST types a to-one embed as an array and the runtime does not.
  return everyPage<HistoryEventRow>((from, to) => supabase
    .from('place_events')
    .select('kind, city_id, created_at, places(slug)')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to));
}

/** A comment this account wrote, as `my_comment_takeout` answers it:
 *  other people already reduced to their handle on the server, the list
 *  to its slug, and the tags to who and where they point. */
export type WrittenCommentRow = {
  collection_slug: string;
  /** Whose comment it answers; null for one that answers nobody, and
   *  for an answer to somebody whose profile is gone (`is_reply` tells
   *  the two apart). */
  in_reply_to: string | null;
  is_reply: boolean;
  text: string;
  at: string;
  people: string[];
  places: string[];
};

/** A heart this account set on a comment. */
export type GivenHeartRow = { collection_slug: string; author: string | null; at: string };

export type CommentTakeout = { comments: WrittenCommentRow[]; hearts: GivenHeartRow[] };

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const rows = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object') : []);

/**
 * Everything this account wrote in comments, and every heart it set on
 * one (19 Nov 2026).
 *
 * Through a function, where its neighbours read a table: the comment
 * tables are closed to clients, so there is no row of its own for an
 * account to read (`20261119110000_comment_takeout`). The function is
 * scoped to the caller on the server, which is why this one read takes
 * no owner id — there is nothing here to state the scope with.
 *
 * Read as untrusted, like every jsonb answer: a row without the list it
 * was on, its words or its time is not a row the file can state, and is
 * left out rather than written half-empty.
 */
export async function fetchMyCommentTakeout(): Promise<CommentTakeout> {
  const { data, error } = await supabase.rpc('my_comment_takeout');
  if (error) throw new Error(error.message);
  const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const comments: WrittenCommentRow[] = [];
  for (const r of rows(raw.comments)) {
    const slug = str(r.collection_slug);
    const text = str(r.text);
    const at = str(r.at);
    if (!slug || !text || !at) continue;
    comments.push({
      collection_slug: slug, in_reply_to: str(r.in_reply_to), is_reply: r.is_reply === true,
      text, at, people: strs(r.people), places: strs(r.places),
    });
  }
  const hearts: GivenHeartRow[] = [];
  for (const r of rows(raw.hearts)) {
    const slug = str(r.collection_slug);
    const at = str(r.at);
    if (!slug || !at) continue;
    hearts.push({ collection_slug: slug, author: str(r.author), at });
  }
  return { comments, hearts };
}

/** The hearts this account set on visits: the place and the instant —
 *  not whose visit, which is theirs. Through a function for the reason
 *  the comments are: `checkin_likes` is closed to clients
 *  (`20261124150000_checkin_friends`). */
export async function fetchMyCheckinHearts(): Promise<{ place_slug: string; liked_at: string }[]> {
  const { data, error } = await supabase.rpc('checkin_hearts_takeout');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ place_slug: r.place_slug, liked_at: r.liked_at }));
}
