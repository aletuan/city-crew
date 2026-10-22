// What the phone remembers for one reader rather than for the phone.
//
// ── why (owner, 22 Oct 2026) ──
//
// The collection's view (grid or cards) and whether the grid notice has
// been closed were kept on the phone, under one key each. The owner
// signed into a second account on the same phone and was told nothing:
// the first account had chosen the cards there, so the second opened on
// cards too, and a notice about the grid never came. How a person likes
// to look at a list, and whether they have been told something, are
// theirs, not the phone's. So each is kept under the reader's id, the
// way the guide's highlights already were (`highlight.v1:<id>`).
//
// Signed out, there is no reader to keep them for, and the phone's own
// key stands in, as before. The cost the owner accepted: a reader who
// chose the cards signed out sees the grid once after signing in, and
// chooses again.

/** Grid or cards on a collection — see `CollectionDetailScreen`. */
export const COLLECTION_VIEW_KEY = 'citycrew.collection.view';
/** Whether the grid notice has been closed — see `CollectionDetailScreen`. */
export const GRID_NOTICE_KEY = 'citycrew.collection.gridNotice.v2';

/** Every value kept per reader, for clearing when the account is deleted. */
export const READER_PREFS = [COLLECTION_VIEW_KEY, GRID_NOTICE_KEY] as const;

/**
 * The key `base` is kept under for `reader`: theirs when somebody is
 * signed in, the phone's when nobody is, and null while it is not yet
 * known which — a read made then would be the wrong person's.
 */
export function readerKey(base: string, reader: string | null | undefined): string | null {
  if (reader === undefined) return null;
  return reader === null ? base : `${base}:${reader}`;
}
