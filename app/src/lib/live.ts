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
// and the same rule is enforced in SQL, on who may read a public list's
// members (`*_lists_stay_public_around_unlive_places.sql`).

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
 * The members of a list that only its owner can see, counted.
 *
 * A public list stays public around them since 23 Oct 2026 (owner: a
 * list of thirty disappeared for everyone over one new place). They are
 * what goes unseen instead — the database keeps them out of everybody
 * else's read — and the owner is told how many, on the Public row, so a
 * friend shown the list with a place missing is not a surprise.
 *
 * Both numbers, because they end differently: a place not public yet
 * will be, and one not accepted never will, so it stays unseen until its
 * owner takes it out — which they can only do if they are told it is
 * there.
 */
export function unseenMembers(members: Reviewable[]): { pending: number; flagged: number } {
  let pending = 0;
  let flagged = 0;
  for (const m of members) {
    if (isLive(m)) continue;
    if (isFlagged(m)) flagged++;
    else pending++;
  }
  return { pending, flagged };
}

/**
 * What a public list shows everyone else, said on the Public row: the
 * row's own sentence, less the members `unseenMembers` counted.
 *
 * "Not public yet" rather than "awaiting review", for the reason
 * `PlaceCard`'s marker gives: it says what is true of the place, not the
 * procedure it is in.
 */
export function unseenSentence(
  { pending, flagged }: { pending: number; flagged: number },
  t: (en: string, vi: string, ja: string, zh?: string, hant?: string) => string,
): string {
  const parts: string[] = [];
  if (pending) {
    parts.push(t(
      `${pending} ${pending === 1 ? 'place' : 'places'} not public yet`,
      `${pending} địa điểm chưa công khai`,
      `まだ公開されていない${pending}件`,
      `尚未公开的 ${pending} 个地点`, `尚未公開的 ${pending} 個地點`,
    ));
  }
  if (flagged) {
    parts.push(t(
      `${flagged} not accepted`,
      `${flagged} địa điểm không được duyệt`,
      `不採用の${flagged}件`,
      `未通过的 ${flagged} 个`, `未通過的 ${flagged} 個`,
    ));
  }
  return t(
    `Shown in Explore and in search, except ${parts.join(' and ')}`,
    `Hiện trên Khám phá và trong tìm kiếm, trừ ${parts.join(' và ')}`,
    `「探索する」と検索に表示されます（${parts.join('と')}を除く）`,
    `会显示在探索和搜索中，${parts.join('和')}除外`, `會顯示在探索和搜尋中，${parts.join('和')}除外`,
  );
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
