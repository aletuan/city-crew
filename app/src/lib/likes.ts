// The order of the public collections shelf, once readers get a say in it.
//
// Pure and here rather than in the screen for the reason the rest of `lib`
// is: a Node process can prove that a shelf with no likes at all comes
// back in exactly the order it comes back in today, which is the property
// that makes this safe to ship before anybody has tapped anything.
//
// ── what the old order was, and why it is the tie-break rather than the rule ──
//
// The shelf was `created_at desc, sort_order`. Neither was a judgement
// about worth: the seeded lists share one timestamp — the instant the
// column was added, not a date anybody chose — and `sort_order` is the
// order the seed script happened to write them in. So the front of the
// shelf was decided by an accident, and the point of this file is to let
// readers decide it instead.
//
// They stay underneath anyway, and not out of sentiment. Every count is
// zero right now and will be for a long while, and a sort whose keys are
// all equal is a sort Postgres — or Array.prototype.sort — may return
// differently each time. Rows shuffling between two openings of the same
// screen reads as a bug, so the old keys are kept for exactly the rows the
// new one cannot separate.

/** Just enough of a collection to put it in order. */
export type Rankable = {
  slug: string;
  created_at?: string | null;
  sort_order?: number | null;
};

/** Collection id or slug → how many people liked it. */
export type LikeCounts = Record<string, number>;

/**
 * The shelf, most liked first.
 *
 * Three keys, in this order:
 *
 *   1. likes, descending — what readers prefer
 *   2. created_at, descending — newest first, for everything they have not
 *      separated
 *   3. sort_order ascending, nulls last — the desk's sequence, which is the
 *      only answer for the seeded rows, since their timestamps are all the
 *      same instant
 *
 * A fourth exists and is not a hedge: `slug`. Two seeded rows can share a
 * timestamp *and* a null sort_order, and without a final total key the
 * comparator returns 0 for them — leaving their order to whatever the
 * engine's sort does with equal elements, which is not promised to be the
 * same twice. `slug` is unique, so the result is one order, always.
 *
 * Does not mutate: the catalog's array is shared with everything else that
 * reads it.
 */
export function rankByLikes<T extends Rankable>(items: readonly T[], likes: LikeCounts): T[] {
  return [...items].sort((a, b) => {
    const byLikes = (likes[b.slug] ?? 0) - (likes[a.slug] ?? 0);
    if (byLikes) return byLikes;
    const byTime = (b.created_at ?? '').localeCompare(a.created_at ?? '');
    if (byTime) return byTime;
    // Nulls last: a row the desk never sequenced should not outrank one it
    // did, and `??` with a finite sentinel would make the largest real
    // sort_order tie with an absent one.
    const sa = a.sort_order ?? Number.POSITIVE_INFINITY;
    const sb = b.sort_order ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    return a.slug.localeCompare(b.slug);
  });
}

/**
 * Whether a count is worth printing next to the heart.
 *
 * Below the threshold the heart draws bare. This is not coyness about a
 * small number, it is that a small number says the wrong thing: a list
 * showing `0` does not read as "nobody has voted yet", it reads as "nobody
 * liked this" — and it would say that about every list on the shelf,
 * including the ones the desk just wrote.
 *
 * Five, because that is the first count that cannot be one person and
 * their friends, and because a shelf where two lists show `1` and `2` has
 * turned a rounding error into a ranking.
 *
 * The heart is tappable either way. What is hidden is the tally, not the
 * gesture.
 */
export const LIKES_SHOWN_FROM = 5;

export function likesWorthShowing(n: number | undefined): boolean {
  return (n ?? 0) >= LIKES_SHOWN_FROM;
}
