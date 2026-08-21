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
 * The rule is about zero, and now only about zero. A list showing `0` does
 * not read as "nobody has voted yet", it reads as "nobody liked this" —
 * and it would say that about every list on the shelf, including the ones
 * the desk wrote this morning. Below the threshold the heart draws bare.
 *
 * ── why this was five, and why it is one ──
 *
 * The first version put the floor at five: five is the first count that
 * cannot be one person and their friends, and a shelf where two lists show
 * `1` and `2` has turned a rounding error into a ranking. That was written
 * before anybody had tapped anything, and the data since says it was the
 * wrong trade. There are five likes in the entire database, one each on
 * five different lists — so every count is `1`, and a floor of five does
 * not soften the tally, it deletes it. A curator asking "does anyone like
 * my list?" would get the same blank answer whether one person did or
 * nobody had, which is the question the tally exists to answer.
 *
 * One is a real answer to it. The rounding-error worry was not wrong, and
 * it is paid for where it belongs: `rankByLikes` still sorts on the count,
 * so a single like already moves a list up the shelf. All that changes
 * here is whether the reader can see the number that moved it.
 *
 * The heart is tappable either way. What is hidden is the tally, not the
 * gesture.
 */
export const LIKES_SHOWN_FROM = 1;

export function likesWorthShowing(n: number | undefined): boolean {
  return (n ?? 0) >= LIKES_SHOWN_FROM;
}

// ── the tap, before the server has heard about it ──
//
// The first version of the heart had no local state at all: a tap awaited
// the insert, then refetched two queries, and nothing on screen moved
// until both came back. So every like cost a full round trip of looking
// broken — the reader taps, the glyph sits there, and the honest reading
// of that is that the tap missed.
//
// What follows is the layer that fills the heart immediately. It is here
// rather than in either screen for two reasons. The shelf and a
// collection's own screen must agree — liking from the shelf and opening
// the list has to show a filled heart, and per-screen state cannot do
// that. And this is the part with a rule in it, which means it is the
// part worth proving in a Node process rather than by tapping.
//
// The rule is: **a pending tap is a claim about the answer, not a delta
// applied to it.** Every function below compares what the reader asked
// for against what the server currently says and does nothing when they
// agree. That is what makes the layer self-cancelling — once the refetch
// lands, each entry becomes a no-op on its own, with no window in which a
// stale delta double-counts. Clearing them afterwards, which `settled`
// does, is hygiene rather than correctness.

/** One tap: which list, and what the reader just asked it to be. The slug
 *  rides along because the count is keyed by slug while a like is keyed by
 *  id, and only the caller holds both. */
export type PendingLike = { slug: string; liked: boolean };

/** Collection id → the tap not yet confirmed by the server. */
export type Pending = Readonly<Record<string, PendingLike>>;

/** A stable empty map, so clearing twice does not re-render. */
export const NO_PENDING: Pending = {};

/**
 * Which lists to draw filled: what the server said, with anything tapped
 * since laid over the top.
 *
 * A tap wins until the server agrees with it, which covers the failure
 * case for free. If a write is refused — the row was already there, the
 * policy said no — the caller drops the entry and this falls straight
 * back to the server's answer, so a refused like leaves the heart in the
 * state the database is actually in rather than the one the tap wanted.
 */
export function likedNow(server: readonly string[], pending: Pending): string[] {
  const out = new Set(server);
  for (const [id, p] of Object.entries(pending)) {
    if (p.liked) out.add(id);
    else out.delete(id);
  }
  return [...out];
}

/**
 * The counts with the same taps applied, so a tally never contradicts the
 * heart beside it.
 *
 * The delta is `wanted − current`, per list: +1 for a like the server has
 * not recorded, −1 for an unlike it has not yet dropped, and zero the
 * moment it catches up. A count is never allowed below zero — the counts
 * come from a public function and a reader's own likes from a private
 * one, and nothing promises the two were read in the same instant.
 */
export function countsNow(
  counts: LikeCounts,
  server: readonly string[],
  pending: Pending,
): LikeCounts {
  const has = new Set(server);
  let out: LikeCounts | null = null;
  for (const [id, p] of Object.entries(pending)) {
    const delta = (p.liked ? 1 : 0) - (has.has(id) ? 1 : 0);
    if (!delta) continue;
    out = out ?? { ...counts };
    out[p.slug] = Math.max(0, (out[p.slug] ?? 0) + delta);
  }
  // Unchanged means unchanged, reference and all: this feeds a sort that
  // runs on every render of the shelf.
  return out ?? counts;
}

/**
 * Forget the taps the server has caught up with.
 *
 * Returns the map it was given when there is nothing to forget, because
 * the caller runs this on every refetch and a fresh object each time
 * would be a render each time.
 */
export function settled(pending: Pending, server: readonly string[]): Pending {
  const has = new Set(server);
  const live = Object.entries(pending).filter(([id, p]) => p.liked !== has.has(id));
  if (live.length === Object.keys(pending).length) return pending;
  return Object.fromEntries(live);
}
