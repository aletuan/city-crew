// Choosing the categories you want more of, as rules rather than as a
// screen.
//
// Two places ask the same question — a step after signing up and the row
// in Edit profile — so the rules live here and both call them. The chips
// themselves are `components/TastePicker`.
//
// ── why there is a ceiling ──
//
// `taste.ts` scores a stated preference as "does this place carry any
// category you named", which means naming all nine scores every place at
// 1 and orders nothing. Picking everything is arithmetically identical to
// picking nothing, and a reader who taps all nine has every reason to
// expect the opposite. The cap is the honest way to say so: it is a
// property of what the signal can do, not a limit invented to make the
// screen tidy.
//
// Five of nine, so the answer always says as much about what was left out
// as about what was chosen.
//
// No imports, so it runs in a plain Node test.

/** The most categories a taste may name. See the note above. */
export const TASTE_MAX = 5;

/**
 * The list with `key` added or removed.
 *
 * A tap on a sixth chip does nothing rather than evicting the oldest: a
 * picker that silently drops a choice the reader made is a picker they
 * stop trusting, and the screen can say "five at most" where a silent
 * eviction cannot.
 *
 * Order is the order they were tapped in, which nothing downstream reads
 * — `taste.ts` takes it as a set — but it keeps the chips from shuffling
 * under the finger.
 */
export function toggleTaste(chosen: readonly string[], key: string): string[] {
  if (chosen.includes(key)) return chosen.filter((c) => c !== key);
  if (chosen.length >= TASTE_MAX) return [...chosen];
  return [...chosen, key];
}

/** Whether another chip would be refused. The screen reads this to say so
 *  before the reader finds out by tapping. */
export function tasteFull(chosen: readonly string[]): boolean {
  return chosen.length >= TASTE_MAX;
}

/**
 * The stored list, cleaned against the taxonomy the app actually has.
 *
 * `preferences.categories` is a bare `text[]` with no foreign key, and it
 * has been written by hand: the rows in it today include `classics`,
 * `street_food` and `Nitendo` alongside real keys. A key the app cannot
 * draw a chip for would render as a gap and score as nothing, so it is
 * dropped on the way in rather than carried around being ignored.
 *
 * Also caps, because a row written before the ceiling existed can be
 * longer than one written after it.
 */
export function cleanTaste(stored: readonly string[], known: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of stored) {
    if (!known.includes(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length === TASTE_MAX) break;
  }
  return out;
}
