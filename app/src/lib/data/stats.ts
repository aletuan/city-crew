import type { ListUse } from '../listRank';
import type { StatsRow } from '../listStats';
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

/**
 * A list's eight figures, as `collection_stats` answers them: one row
 * for the list's owner, none for anybody else — `lib/listStats.statsOf`
 * reads the difference. Rows rather than the row, because that is the
 * shape a set-returning function comes back in and the shape the kept
 * answer is stored in (`useCollectionStatsQuery`).
 */
export async function fetchCollectionStats(collectionId: string): Promise<StatsRow[]> {
  const { data, error } = await supabase.rpc('collection_stats', { cid: collectionId });
  if (error) throw new Error(error.message);
  return (data ?? []) as StatsRow[];
}

/** One public list's use, as `collection_use_counts` answers it. */
export type ListUseRow = { slug: string } & ListUse;

/**
 * What other people did with each public list: how many of them started
 * a trip from it or saved a copy, how often it was opened, and the likes
 * it has had since opens were counted. Totals and no names, for every
 * reader the same, a guest included — the order of a public shelf is not
 * a private fact (`20261114100000_collection_use_counts.sql`, and
 * `lib/listRank` for what it is ranked into).
 *
 * Throws on a failure, and that includes a server that does not have
 * the function yet. The hook's empty answer is the fallback
 * (`useListUseQuery`): with no row for any list, the two terms these
 * figures feed are nothing and the shelf is ranked on the rest.
 */
export async function fetchListUse(): Promise<ListUseRow[]> {
  const { data, error } = await supabase.rpc('collection_use_counts');
  if (error) throw new Error(error.message);
  return (data ?? []) as ListUseRow[];
}
