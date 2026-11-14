// Which public collection a reader sees first.
//
// The argument is `docs/collection-ranking.md`: the owner's eight
// criteria (14 Nov 2026), which of them are filters and which are
// weights, the measurements behind each number, and a trial on two real
// accounts. This file is that document's arithmetic and nothing more.
// Read the document before changing a number here, and change it there in
// the same commit.
//
// Pure and here rather than in a screen for the reason the rest of `lib`
// is: a Node process can prove what an order is, and four screens that
// each sorted their own shelf would be four orders.
//
// ── what this replaced ──
//
// `rankByLikes` (`lib/likes.ts`, gone with this): likes, then newest.
// Measured on the 54 public lists of 14 Nov 2026, 51 had a like and the
// 223 likes came from at most 17 people, so the one key every shelf was
// sorted by was a small circle liking nearly everything. Its tie-breaks
// are kept, at the bottom, for the reason they were written: a sort whose
// keys are all equal is a sort the engine may return differently each
// time, and rows shuffling between two openings of a screen read as a
// bug.
//
// ── what is not in here ──
//
// Where the reader is. That is a filter, applied before this is called
// (`touchesCity`, `mosaicGroups`): a fine list in another city should not
// beat a fair one where the reader stands, so place cannot be a term in a
// sum. Every signal below is normalised *within the lists handed in*,
// which the callers make one city's.

import type { LikeCounts } from './likes';
import { NEW_LIST_DAYS } from './newest';
import { bayesRating } from './popular';

/**
 * What each signal is worth. The five that describe the list sum to 1;
 * taste is a lift on top, for a reader who has one.
 *
 * The owner's judgement from the measurements, not a fit to behaviour:
 * there is no behaviour yet to fit to. See the document's "Các trọng số
 * là phán đoán".
 */
export const LIST_WEIGHTS = {
  likes: 0.3, used: 0.25, content: 0.2, fresh: 0.15, views: 0.1, taste: 0.1,
} as const;

/** A list with no description, or fewer than `THIN_BELOW` places, keeps
 *  this much of its score. A penalty rather than a weight: 49 of the 54
 *  lists had a description, and a term nearly every list maxes out ranks
 *  nothing. */
export const THIN_PENALTY = 0.85;
/** Under this many places a list is unfinished: 4 of the 54 were. */
export const THIN_BELOW = 3;
/** The count at which more places stop making a list better. The median
 *  list held 7.5 and the ninetieth percentile 21. */
export const FULL_AT = 8;
/**
 * The least the most-used list is taken to have been used.
 *
 * The most-used list had 2 uses in Hanoi and 4 in Saigon, and against
 * those one use was worth 0.16 and 0.11 of a point, where first and
 * fourth place in Saigon stood 0.13 apart: one person starting one trip
 * re-ordered the top of the shelf. With the floor one use is worth 0.10
 * everywhere until some list passes five.
 */
export const USED_FLOOR = 5;
/** The day a list stops being new at all. Full for `NEW_LIST_DAYS`, the
 *  week the "New" badge shows, then a straight line down to here. Not
 *  thirty: 29 of the 54 lists were under thirty days old. */
export const FRESH_GONE_DAYS = 21;
/**
 * How far apart lists' mean ratings stand: the standard deviation over
 * the 54 public lists, measured at 0.199.
 *
 * The rating half of `content` is read on this scale, two of these
 * either side of the catalog's mean, and not min–max over the lists
 * being ranked, which is what the first draft did and what
 * `lib/popular.ts` does for places. Min–max has no sense of how big a
 * difference is: two lists of identical places came out a full half of
 * content apart, on the last bit of a floating-point mean, and the test
 * that found it was the first one written. A city with three lists
 * would have ranked them on their third decimal place.
 */
export const LIST_RATING_SD = 0.2;
/** Opens a list needs before its likes-per-open is believed. */
export const VIEWS_FROM = 20;
/** How many lists by one author may stand in a row. Fourteen authors
 *  held the 54 lists, and one of them 22. */
export const AUTHOR_RUN = 2;

/** Enough of a collection to put it in order. */
export type RankedList = {
  slug: string;
  owner_id?: string | null;
  created_at?: string | null;
  sort_order?: number | null;
};

/** What a list holds, as the caller read it off the catalog. */
export type ListFacts = {
  /** Its published places. Only the two figures a rating is made of. */
  places: readonly { rating?: number | null; rating_count?: number | null }[];
  /** Whether it says anything about itself, in any language. */
  described: boolean;
  /** How far this reader leans its way: the mean over its places of
   *  `affinity`, what is below zero taken as zero. 0 for a reader with
   *  no taste, which leaves the order to the list's own signals. */
  taste: number;
};

/** What other people did with a list, by slug. A list missing from it
 *  was never used and never opened. */
export type ListUse = {
  /** People other than its owner who started a trip from it, plus
   *  people other than its owner who saved a copy. */
  uses: number;
  /** Opens, everybody's, the owner's own included. */
  views: number;
  /** Likes from anyone but the owner, since opens were first counted:
   *  the likes those opens could have led to. */
  liked: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 1 for the week the badge shows, falling straight to 0 at
 *  `FRESH_GONE_DAYS`. A list with no date is not new. A date ahead of
 *  the clock is a clock that disagrees, and is new. */
function freshness(created: string | null | undefined, now: number): number {
  const at = created ? Date.parse(created) : NaN;
  if (Number.isNaN(at)) return 0;
  const days = (now - at) / DAY_MS;
  if (days <= NEW_LIST_DAYS) return 1;
  if (days >= FRESH_GONE_DAYS) return 0;
  return (FRESH_GONE_DAYS - days) / (FRESH_GONE_DAYS - NEW_LIST_DAYS);
}

/** What `rankLists` is told about the shelf it is ranking. */
export type RankInputs<T> = {
  factsOf: (c: T) => ListFacts;
  likes: LikeCounts;
  /** Absent before the server has answered, or on one that cannot: the
   *  two terms it feeds are then nothing for every list. */
  use?: Readonly<Record<string, ListUse>>;
  /** The catalog's mean rating, which an unrated place is taken at. */
  mean: number;
  now: number;
};

/**
 * Each list's score, in the order the lists came in.
 *
 *     score = penalty × (0.30·likes + 0.25·used + 0.20·content
 *                        + 0.15·fresh + 0.10·views + 0.10·taste)
 *
 *   likes    ln(1+L) / ln(1+Lmax), L leaving the owner's own like out.
 *            Log, so the twelfth like is not worth the first.
 *   used     ln(1+U) / ln(1+max(Umax, USED_FLOOR)).
 *   content  half how full it is, min(n, FULL_AT) / FULL_AT; half the
 *            mean rating of its places, each shrunk toward `mean`
 *            (`bayesRating`), read two `LIST_RATING_SD` either side of
 *            `mean`: at the mean a half, two above it all, two below it
 *            nothing. A list with no place has no rating and gets none.
 *   fresh    see `freshness`; nothing for a list under `THIN_BELOW`
 *            places. A one-place list made the day before reached fifth
 *            of fourteen on this term alone, through the penalty.
 *   views    likes per open, over the best rate among the lists with
 *            `VIEWS_FROM` opens; nothing under that. The rate and never
 *            the count: opens count the owner's own and repeats, so the
 *            count is the author's to raise, and the rate only falls
 *            when they do. Accepted with it: anyone can lower a rival's
 *            rate by opening their list, for at most this term's 0.10.
 *   taste    as the caller measured it.
 *
 * Its own function so a test, and the table a change to a weight is
 * argued from, can read the numbers and not only the order they make.
 */
export function listScores<T extends RankedList>(items: readonly T[], o: RankInputs<T>): number[] {
  const rows = items.map((c) => {
    const facts = o.factsOf(c);
    const n = facts.places.length;
    const used = o.use?.[c.slug];
    return {
      c,
      n,
      facts,
      likes: o.likes[c.slug] ?? 0,
      uses: used?.uses ?? 0,
      rate: used && used.views >= VIEWS_FROM ? used.liked / used.views : 0,
      rating: n
        ? facts.places.reduce((sum, p) => sum + bayesRating(p.rating ?? null, p.rating_count ?? null, o.mean), 0) / n
        : null,
    };
  });

  const top = (pick: (r: (typeof rows)[number]) => number) => Math.max(0, ...rows.map(pick));
  const likesTop = top((r) => r.likes);
  const usesTop = Math.max(USED_FLOOR, top((r) => r.uses));
  const rateTop = top((r) => r.rate);

  return rows.map((r) => {
    const thin = r.n < THIN_BELOW;
    const content = 0.5 * (Math.min(r.n, FULL_AT) / FULL_AT)
      + 0.5 * (r.rating == null ? 0 : Math.min(1, Math.max(0, 0.5 + (r.rating - o.mean) / (4 * LIST_RATING_SD))));
    const sum = LIST_WEIGHTS.likes * (likesTop ? Math.log1p(r.likes) / Math.log1p(likesTop) : 0)
      + LIST_WEIGHTS.used * (Math.log1p(r.uses) / Math.log1p(usesTop))
      + LIST_WEIGHTS.content * content
      + LIST_WEIGHTS.fresh * (thin ? 0 : freshness(r.c.created_at, o.now))
      + LIST_WEIGHTS.views * (rateTop ? r.rate / rateTop : 0)
      + LIST_WEIGHTS.taste * r.facts.taste;
    return (thin || !r.facts.described ? THIN_PENALTY : 1) * sum;
  });
}

/**
 * The lists handed in, the one to show first first.
 *
 * By `listScores`, and then no more than `AUTHOR_RUN` lists by one
 * author in a row: the next one waits behind the next list by somebody
 * else. A reader's own list is ranked like any other (owner, 14 Nov
 * 2026).
 *
 * Ties keep the old keys: newest, the desk's sequence with nulls last,
 * then slug, which is unique, so the result is one order always.
 *
 * Does not mutate: the catalog's array is shared with everything else
 * that reads it.
 */
export function rankLists<T extends RankedList>(items: readonly T[], o: RankInputs<T>): T[] {
  // To the sixth decimal place, and compared as whole numbers. A mean
  // over eight places and the same mean over twenty-four differ in the
  // sixteenth, and unrounded that bit decided the order of two lists
  // nothing else separated, ahead of every key below.
  const scores = listScores(items, o).map((x) => Math.round(x * 1e6));
  const scored = items.map((c, i) => ({ c, score: scores[i] }));
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const byTime = (b.c.created_at ?? '').localeCompare(a.c.created_at ?? '');
    if (byTime) return byTime;
    // Nulls last: a row the desk never sequenced should not outrank one it
    // did, and `??` with a finite sentinel would make the largest real
    // sort_order tie with an absent one.
    const sa = a.c.sort_order ?? Number.POSITIVE_INFINITY;
    const sb = b.c.sort_order ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    return a.c.slug.localeCompare(b.c.slug);
  });

  // The author spread. A list with no owner is the desk's, and the desk
  // is not an author whose lists crowd a shelf: it never makes a run.
  const rest = scored.map((s) => s.c);
  const out: T[] = [];
  while (rest.length) {
    const last = out[out.length - 1]?.owner_id;
    const run = out.length >= AUTHOR_RUN && last != null
      && out.slice(-AUTHOR_RUN).every((c) => c.owner_id === last);
    const next = run ? rest.findIndex((c) => c.owner_id !== last) : 0;
    // Nobody else left: the run goes on, since the lists still have to be
    // shown.
    out.push(...rest.splice(Math.max(0, next), 1));
  }
  return out;
}

/**
 * What a list holds, read off its row and its places.
 *
 * Described in any language: a list written up in Vietnamese alone has
 * said what it is, to the reader this app mostly has. Taste is the mean
 * of what the reader leans towards each place, a lean against one taken
 * as none: a list is not worse for holding one place the reader passed
 * over, and `affinity` reaches −1 only for such a place (`lib/taste`).
 */
export function listFacts<P extends { rating?: number | null; rating_count?: number | null }>(
  c: { desc_en?: string | null; desc_vi?: string | null; desc_ja?: string | null },
  members: readonly P[],
  taste: { affinity: (p: P) => number } | null,
): ListFacts {
  return {
    places: members,
    described: [c.desc_en, c.desc_vi, c.desc_ja].some((d) => !!d?.trim()),
    taste: taste && members.length
      ? members.reduce((sum, p) => sum + Math.max(0, taste.affinity(p)), 0) / members.length
      : 0,
  };
}

/** The catalog's mean rating, over the places that have one; `fallback`
 *  for a catalog with none, which is the one still loading. */
export function meanRating(places: readonly { rating?: number | null }[], fallback: number): number {
  const rated = places.flatMap((p) => (p.rating == null ? [] : [p.rating]));
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : fallback;
}

/** `ListUse` by slug, from the rows the server answers with. */
export function listUseBySlug(rows: readonly ({ slug: string } & ListUse)[]): Record<string, ListUse> {
  const out: Record<string, ListUse> = {};
  for (const r of rows) out[r.slug] = { uses: r.uses, views: r.views, liked: r.liked };
  return out;
}
