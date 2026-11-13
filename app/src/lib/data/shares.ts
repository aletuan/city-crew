// The owner's side of a list shared with chosen friends (13 Nov 2026): who
// each of your lists is shared with, and the two statements that change
// it. The reader's side — the lists shared with you — is
// `fetchSharedWithMe` in `collections.ts`, beside the other reads that
// return lists; this file reads and writes the share rows themselves.
//
// See `20261112230000_collection_shares.sql` for what each policy allows.
// The rules about which of three words a list wears, who the picker
// lists and what a press writes are `lib/shares`, where Node can hold
// them to the gate.

import { supabase } from '../supabase';
import { refusedByPolicy } from '../quota';
import type { ShareRow } from '../shares';
import { everyPage } from './pages';

/**
 * The name `setShares` throws when the insert policy refused a friend —
 * a name, not a sentence, as `DAILY_LIMIT` is; the screen has the words.
 *
 * The app only offers the crew's accepted friends, less the ones blocked
 * (`shareRows`), so a refusal here is the crew having moved since it was
 * read: somebody unfriended you, or blocked you, on their phone. Neither
 * is a fault, and neither is something the reader can fix by trying
 * again — which is why it is told apart from a dropped connection.
 */
export const NOT_SHAREABLE = 'not_shareable';

/** True when a thrown error is `NOT_SHAREABLE`. */
export function isNotShareable(e: unknown): boolean {
  return e instanceof Error && e.message === NOT_SHAREABLE;
}

/**
 * Every share on every list this owner has, oldest first.
 *
 * One read for all of them, not one a list, because two screens want the
 * answer for different spans: the Collections tab marks each of your
 * shared lists on its tile, and a list's page needs its own guest list.
 * Read a list at a time, the tab would spend a request on every tile or
 * draw no marks at all; one read serves both screens, and
 * `lib/shares.sharesByList` files it by list.
 *
 * Scoped in the query as well as by RLS, the export's belt-and-braces
 * (`fetchMyShares`). The select policy lets the named friend see the row
 * that names them too, so without the filter this would hand an owner
 * every list shared *with* them as though they had shared it. `!inner`,
 * so a share whose list is not this owner's is not returned at all,
 * rather than returned with its list missing.
 *
 * Every page (`everyPage`), ordered by the share's whole key so no page
 * boundary can drop one or repeat it. The measured crew is small — a
 * median of two friends and a most of twelve — but the number of lists
 * an owner may share is bounded only by how many they make, and a read
 * that stopped at a thousand would leave the thousand-and-first list
 * drawn as Private.
 *
 * The embedded list is dropped before returning: it is there to scope
 * the read, and every row of it would say the same owner.
 */
export async function fetchMyListShares(ownerId: string): Promise<ShareRow[]> {
  type Row = ShareRow & { collections: unknown };
  const rows = await everyPage<Row>((from, to) => supabase
    .from('collection_shares')
    .select('collection_id, user_id, created_at, collections!inner(owner_id)')
    .eq('collections.owner_id', ownerId)
    .order('created_at', { ascending: true })
    .order('collection_id', { ascending: true })
    .order('user_id', { ascending: true })
    .range(from, to));
  return rows.map(({ collection_id, user_id, created_at }) => ({ collection_id, user_id, created_at }));
}

/**
 * Share a list with some friends and take it from others, in that order.
 *
 * One insert for everyone added, not a loop, for the reason `sendInvites`
 * gives: a failure halfway down a loop would leave some shared and no way
 * to say which. An upsert that ignores duplicates rather than a plain
 * insert, because a multi-row insert fails whole on one duplicate key —
 * and a friend already on the list (shared from another phone since this
 * one last read) is the state the owner asked for, not a reason to drop
 * the three names beside them. `ON CONFLICT DO NOTHING` needs no update
 * policy, and the table has none: a share is a fact or it is not.
 *
 * Adding before removing: if the second statement fails, the list is
 * shared with more people than the owner asked for, until they try again
 * — never with fewer than they had, which is the half a friend would
 * notice (a list they were reading, gone).
 *
 * `is_public` is not this function's business. Sharing a public list
 * makes it private, and the screen makes that second write itself, after
 * this one (see `CollectionDetailScreen`): the shares land first, so a
 * failure in between leaves a public list with shares waiting — which is
 * what the migration calls an ordinary state — rather than a list gone
 * private that nobody can see.
 */
export async function setShares(
  collectionId: string, add: readonly string[], remove: readonly string[],
): Promise<void> {
  if (add.length) {
    const { error } = await supabase
      .from('collection_shares')
      .upsert(
        add.map((id) => ({ collection_id: collectionId, user_id: id })),
        { onConflict: 'collection_id,user_id', ignoreDuplicates: true },
      );
    if (refusedByPolicy(error)) throw new Error(NOT_SHAREABLE);
    if (error) throw new Error(error.message);
  }
  if (remove.length) {
    // A delete has no refusal that is the rules working — RLS filters a
    // row that is not yours to nothing — so any error is a failure.
    const { error } = await supabase
      .from('collection_shares')
      .delete()
      .eq('collection_id', collectionId)
      .in('user_id', [...remove]);
    if (error) throw new Error(error.message);
  }
}
