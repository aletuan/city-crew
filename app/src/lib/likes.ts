// The likes on a public list: what a count is, when it is worth printing,
// and the tap before the server has heard about it.
//
// How likes order a shelf was here too, as `rankByLikes`: most liked
// first, then newest. Since 14 Nov 2026 that is one term of five in
// `lib/listRank`, and its tie-breaks went with it.

/** Collection id or slug → how many people liked it. */
export type LikeCounts = Record<string, number>;

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
 * it is paid for where it belongs: `lib/listRank` still ranks on the
 * count, so a single like already moves a list up the shelf. All that changes
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
// The rule is: **a pending tap is a claim about the answer, and it holds
// until the answer that includes it arrives.** The subtlety is that there
// are two answers, from two queries at two speeds. The heart reads the
// reader's own likes — a tiny select, back in a blink. The tally reads
// the public counts — an RPC over every list, back later. The first
// version cancelled a tap the moment *either* answer confirmed it, and
// the fast one always confirmed first: your own row existed, so the +1
// was dropped, while the count that contained it was still on the wire —
// and the reader watched their own like flick 3 → 2 → 3 on the way back
// to the shelf (or stick at 2, if that slower response died).
//
// So each claim is stamped with when it was made, and each function
// cancels against its own witness. The heart cancels against your likes,
// which is the list that decides it. The tally applies a claim only while
// the counts snapshot predates the tap — a snapshot fetched after the
// write already contains it, and one fetched before cannot be allowed to
// shout it down. `settled` clears an entry only once both witnesses have
// caught up, and stays hygiene rather than correctness.

/** One tap: which list, what the reader just asked it to be, and when.
 *  The slug rides along because the count is keyed by slug while a like
 *  is keyed by id, and only the caller holds both. `at` is what the
 *  tally cancels against — see the note above. */
export type PendingLike = { slug: string; liked: boolean; at: number };

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
 * A tap moves the count — +1 for a like, −1 for an unlike — for exactly
 * as long as the counts snapshot predates it. `countsAt` is when the
 * snapshot landed (null when none ever has): a snapshot fetched after
 * the write already contains the tap, so applying it again would count
 * it twice; one fetched before must not be allowed to shout it down —
 * that stale snapshot outliving the claim is precisely the 3 → 2 → 3
 * flicker this replaces. A count is never allowed below zero, because
 * nothing promises the snapshot and the tap describe the same instant.
 */
export function countsNow(
  counts: LikeCounts,
  countsAt: number | null,
  pending: Pending,
): LikeCounts {
  const seen = countsAt ?? 0;
  let out: LikeCounts | null = null;
  for (const p of Object.values(pending)) {
    if (p.at <= seen) continue;
    out = out ?? { ...counts };
    out[p.slug] = Math.max(0, (out[p.slug] ?? 0) + (p.liked ? 1 : -1));
  }
  // Unchanged means unchanged, reference and all: this feeds a sort that
  // runs on every render of the shelf.
  return out ?? counts;
}

/**
 * Forget the taps every witness has caught up with: the reader's own
 * likes agree with what was asked, and the counts snapshot postdates the
 * tap. Dropping on the first alone is how the flicker happened — the
 * entry died while the count that carried it was still on the wire.
 *
 * Returns the map it was given when there is nothing to forget, because
 * the caller runs this on every refetch and a fresh object each time
 * would be a render each time.
 */
export function settled(
  pending: Pending,
  server: readonly string[],
  countsAt: number | null,
): Pending {
  const has = new Set(server);
  const seen = countsAt ?? 0;
  const live = Object.entries(pending)
    .filter(([id, p]) => p.liked !== has.has(id) || p.at > seen);
  if (live.length === Object.keys(pending).length) return pending;
  return Object.fromEntries(live);
}
