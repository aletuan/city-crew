// Whether a place is in the catalog, and what that means for a list
// holding it.
//
// Here rather than beside a screen so it can be tested in a plain Node
// process — see `place.ts` for why that boundary exists. No imports,
// deliberately: the shapes are structural.
//
// The rule this file exists to keep in one place is that a place is
// live when **two** flags say so. They are independent in practice, not
// only in theory — the desk approves and publishes as separate actions,
// and there are rows in production that are approved and unpublished.
// Any check written against one flag is wrong half the time it matters,
// and the same rule is enforced in SQL by the publish gate.

/** The part of a place this file needs. Structural, so a full `Place`
 *  satisfies it and a test fixture does not have to invent thirty
 *  fields. */
export type Reviewable = {
  is_published?: boolean;
  review_status?: string;
  submitted_by?: string | null;
};

/** In the catalog, visible to everyone. */
export function isLive(p: Reviewable): boolean {
  return p.is_published === true && p.review_status === 'approved';
}

/**
 * Waiting on the desk, as opposed to turned down.
 *
 * The two are not the same thing to the person waiting — one is *wait*,
 * the other is *no* — and a screen that showed them alike would be the
 * same mistake as showing a pending place as though it were live.
 *
 * A row with no `review_status` at all reads as pending rather than
 * flagged: an older client that never selected the column should not
 * accuse anybody's suggestion of having been rejected.
 */
export function isPending(p: Reviewable): boolean {
  return !isLive(p) && p.review_status !== 'flagged';
}

/** Turned down, and never going to become live on its own. */
export function isFlagged(p: Reviewable): boolean {
  return p.review_status === 'flagged';
}

/** Yours, and not yet in the catalog — the only places you can see that
 *  nobody else can. */
export function isMineAndUnlive(p: Reviewable, meId: string | null | undefined): boolean {
  return !!meId && p.submitted_by === meId && !isLive(p);
}

/**
 * Why a collection cannot be published, counted.
 *
 * Both numbers, not a boolean, because the sentence the owner reads has
 * to name what is holding it: *"2 places are still being reviewed, and 1
 * was not accepted"*. A generic "some places are pending" leaves them
 * pressing Publish and watching nothing happen, which is the failure
 * this is here to prevent.
 *
 * `flagged` is the half that matters most. It never resolves on its own,
 * so a collection holding one is blocked forever until its owner takes
 * it out — and they can only do that if they are told which one it is.
 */
export function publishBlockers(members: Reviewable[]): { pending: number; flagged: number } {
  let pending = 0;
  let flagged = 0;
  for (const m of members) {
    if (isLive(m)) continue;
    if (isFlagged(m)) flagged++;
    else pending++;
  }
  return { pending, flagged };
}

/** Whether anything at all stands in the way. */
export function canPublish(members: Reviewable[]): boolean {
  const { pending, flagged } = publishBlockers(members);
  return pending === 0 && flagged === 0;
}

/**
 * Your own unreviewed places first, then everything else untouched.
 *
 * Without this a suggestion lands wherever `sort_order` puts it, and
 * `sort_order` is null on anything the desk has not sequenced — which is
 * the bottom of the list. In Hanoi that is position fifty-nine: the one
 * person allowed to see it would have to scroll past the entire catalog
 * to find the thing they just added.
 *
 * Stable within each group, so the catalog's own order survives
 * completely. And self-cancelling: the moment a place goes live it stops
 * matching and falls back into normal position, which is a truer signal
 * that it was approved than any message would be.
 */
export function ownPendingFirst<T extends Reviewable>(list: T[], meId: string | null | undefined): T[] {
  if (!meId) return list;
  const mine: T[] = [];
  const rest: T[] = [];
  for (const p of list) (isMineAndUnlive(p, meId) ? mine : rest).push(p);
  return mine.length ? [...mine, ...rest] : list;
}
