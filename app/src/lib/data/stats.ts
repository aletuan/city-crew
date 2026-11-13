import { supabase } from '../supabase';

// ── a list's statistics ──
//
// What a list's owner is told about it, and the one fact the app sends
// to make it: an open of the list's page. The counting is Postgres's
// (`20261113160000_collection_stats.sql`); these are the calls.

/**
 * Count one open of a list's page — anybody's, the owner's own, a
 * guest's. The server keeps a number per list per day and nothing about
 * who, and is silent for a list the caller cannot read, so a private
 * list's id cannot be probed through it.
 *
 * Throws on a refusal, as every call here does: what to do about one is
 * the caller's (`useCountView` drops it, since a reader should never
 * hear about a count they did not ask for).
 */
export async function recordCollectionView(collectionId: string): Promise<void> {
  const { error } = await supabase.rpc('record_collection_view', { cid: collectionId });
  if (error) throw new Error(error.message);
}
