import { supabase } from '../supabase';
import { normalizeHandle } from '../handle';
import { cleanNote } from '../report';

// ── friends ──
//
// The edges live in `friendships` (see that migration): one row per
// pair, pending until the addressee accepts, declined rows deleted.
// RLS scopes every read to edges the caller is on, so these fetchers
// take no filters beyond the session itself; the sorting-into-piles is
// pure and lives in lib/friends where the gate can see it.

export type FriendProfile = {
  id: string; handle: string; full_name: string; avatar_url: string;
};

export async function fetchFriendships(): Promise<import('../friends').FriendshipRow[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('requester, addressee, status, created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as import('../friends').FriendshipRow[];
}

/** The public identities behind a set of account ids — profiles are
 *  world-readable, so this is the same data a curator byline shows. */
export async function fetchProfilesById(ids: string[]): Promise<Record<string, FriendProfile>> {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, full_name, avatar_url')
    .in('id', ids);
  if (error) throw new Error(error.message);
  const out: Record<string, FriendProfile> = {};
  for (const p of (data ?? []) as FriendProfile[]) out[p.id] = p;
  return out;
}

/** One profile by its bare handle, or null — the add flow's lookup.
 *  `ilike` for the same reason auth's own availability check uses it:
 *  the stored value is lowercase and the typed one may not be. */
export async function profileByHandle(handle: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, full_name, avatar_url')
    .ilike('handle', handle)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FriendProfile | null) ?? null;
}

/**
 * Avatars for a shelf's worth of curators, by folded handle.
 *
 * One query for all of them rather than one screen asking for one face
 * the moment it opens — which is what made a byline lay itself out and
 * then shove sideways a round trip later. Fetched with the catalog, so
 * by the time a list is opened the face is already in memory and the
 * first paint is the finished one.
 *
 * Normalised on both sides: the editorial rows were seeded with the `@`
 * written into `curator_handle`, and `profiles.handle` never has one.
 * `lib/handle` states the rule — never trust the stored form.
 *
 * Failure is an empty map, never a throw. A missing face is the normal
 * case here (every editorial handle lives in `reserved_handles` with no
 * profile behind it), so it cannot be allowed to be an error.
 */
export async function fetchCuratorAvatars(handles: string[]): Promise<Record<string, string>> {
  const bare = [...new Set(handles.map(normalizeHandle).filter(Boolean))];
  if (!bare.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('handle, avatar_url')
    .in('handle', bare);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { handle: string; avatar_url: string }[]) {
    if (r.avatar_url) out[normalizeHandle(r.handle)] = r.avatar_url;
  }
  return out;
}

/** Ask. The insert policy holds the rest: as yourself, as pending, under
 *  the daily cap — a refusal surfaces as this throwing. */
export async function sendFriendRequest(meId: string, otherId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester: meId, addressee: otherId });
  if (error) throw new Error(error.message);
}

export async function acceptFriendRequest(requesterId: string, meId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('requester', requesterId)
    .eq('addressee', meId);
  if (error) throw new Error(error.message);
}

/** Decline, cancel and unfriend are all the same delete — see the
 *  migration for why none of them needs its own state. */
export async function removeFriendship(a: string, b: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(requester.eq.${a},addressee.eq.${b}),and(requester.eq.${b},addressee.eq.${a})`);
  if (error) throw new Error(error.message);
}

/** Accounts whose public shelves overlap yours, strongest first — the
 *  crew screen's introductions. Excludes everyone already tied to you
 *  and anyone either side of a block; see `suggested_friends`. */
export async function fetchSuggestedFriends(): Promise<import('../friends').Suggestion[]> {
  const { data, error } = await supabase.rpc('suggested_friends');
  if (error) return [];
  return (data ?? []) as import('../friends').Suggestion[];
}

/** places you have both put in public collections, by friend id. */
export async function fetchMutualSaves(others: string[]): Promise<Record<string, number>> {
  if (!others.length) return {};
  const { data, error } = await supabase.rpc('mutual_saves_counts', { others });
  if (error) return {};
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { other: string; mutual: number }[]) out[row.other] = row.mutual;
  return out;
}

// ── reports ──
//
// Filed by anyone signed in, read by nobody but the desk — see the
// reports migration for why not even the filer can read the queue back.
// The insert policy holds the rules (as yourself, never about yourself,
// under the day's cap); this only carries the words.

export async function submitReport(input: {
  reporter: string;
  kind: 'collection' | 'profile';
  targetId: string;
  reason: import('../report').ReportReason;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter: input.reporter,
    kind: input.kind,
    target_id: input.targetId,
    reason: input.reason,
    note: cleanNote(input.note),
  });
  if (error) throw new Error(error.message);
}

// ── blocks ──
//
// A block is contact policy, not content policy: it cuts the friendship
// edge, refuses future requests across the pair (the insert policy asks
// `is_blocked_pair`), and keeps the blocked person's likes out of your
// applause feed. Their public collections stay public. Only the blocker
// can see the list, and lifting a block is a plain delete of your own row.

export async function fetchMyBlocks(): Promise<string[]> {
  const { data, error } = await supabase.from('blocks').select('blocked');
  if (error) return [];
  return ((data ?? []) as { blocked: string }[]).map((r) => r.blocked);
}

/** One act on the server — the row in, any edge out — see `block_user`. */
export async function blockUser(targetId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { target: targetId });
  if (error) throw new Error(error.message);
}

export async function unblockUser(meId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks').delete().eq('blocker', meId).eq('blocked', targetId);
  if (error) throw new Error(error.message);
}

/** Handles that begin with what was typed — the add flow's suggestions.
 *  Prefix only, never substring: "an" finds @anh and @anna and does not
 *  drag in every handle with those letters somewhere inside. Profiles
 *  are world-readable, so this reveals nothing the table did not. The
 *  pattern is built from the normalised form, which strips anything a
 *  LIKE could read as a wildcard. */
export async function searchHandles(prefix: string): Promise<FriendProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, full_name, avatar_url')
    .ilike('handle', `${prefix}%`)
    .order('handle')
    .limit(8);
  if (error) return [];
  return (data ?? []) as FriendProfile[];
}

/** Recent likes on your public lists, each with its liker's name — see
 *  `likes_on_mine` (second cut: the owner always sees who). */
export async function fetchApplause(sinceISO: string): Promise<import('../friends').Applause[]> {
  const { data, error } = await supabase.rpc('likes_on_mine', { since: sinceISO });
  if (error) return [];
  return (data ?? []) as import('../friends').Applause[];
}
