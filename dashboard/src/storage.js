// Removing a place's files from Storage, and saying what was left behind.
//
// Every delete in the desk takes the database rows first and the files
// after, because a row without its file is a broken picture while a file
// without its row is only a cost. That order makes the second step the one
// that can quietly fail — and it did, twice over:
//
// - The result of `remove` was never read. Storage answers a refused
//   delete with *no error and an empty list*, which is exactly how 63 files
//   outlived their places while editors could not delete from the bucket.
// - `deletePlace` only collected the desk's own uploads, but a Google
//   photo copied onto the bucket has a `storage_path` too. Every place
//   deleted left its copied photos behind.
//
// So this counts what Storage says it removed against what was asked, and
// hands back the difference for the desk to be told about.

/** @param {{ remove: (paths: string[]) => Promise<{ data: { name: string }[] | null, error: { message: string } | null }> }} bucket */
export async function removeObjects(bucket, paths) {
  const want = [...new Set(paths.filter(Boolean))];
  if (!want.length) return { removed: 0, left: [] };
  let res;
  try {
    res = await bucket.remove(want);
  } catch (e) {
    return { removed: 0, left: want, error: e?.message ?? String(e) };
  }
  if (res.error) return { removed: 0, left: want, error: res.error.message };
  const gone = new Set((res.data ?? []).map((o) => o.name));
  const left = want.filter((p) => !gone.has(p));
  return { removed: want.length - left.length, left };
}

/** The sentence the desk sees when files outlived their rows, or null. */
export function leftBehindNote(left) {
  if (!left?.length) return null;
  const n = left.length;
  return `${n} photo file${n === 1 ? '' : 's'} could not be removed from Storage and ${n === 1 ? 'is' : 'are'} now orphaned`;
}
