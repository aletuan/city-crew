// What "most popular" means when the search box has not been asked
// anything yet.
//
// The zero-state needs an answer with no query to answer to, and "the
// places people actually go to" is the honest one. Four signals, each
// covering a blind spot of the others:
//
//   quality   — the Google rating, Bayesian-shrunk toward the city mean
//               so a 5.0★ with three reviews cannot outrank a 4.7★ with
//               two thousand. Raw averages reward tiny samples; the
//               shrinkage is the standard cure.
//   volume    — log10 of the review count. Log-scaled because the third
//               thousand reviews says almost nothing the first fifty did
//               not; linear volume would let one megaspot drown the town.
//   curation  — how many collections hold the place. This is the app's
//               own community signal: every save was a person deciding
//               the place belonged on a list.
//   love      — the likes of those collections, summed. Likes in this
//               app attach to collections, not places (see lib/likes),
//               so a place inherits the applause of the lists it is on.
//
// Each signal is normalised 0–1 *within the set being ranked* before the
// weights apply — a city where the busiest café has 40 reviews and one
// where it has 4,000 should both produce a full-strength volume signal
// for their own busiest. The weights lean on quality (0.45) because a
// wrong answer here is a bad recommendation, and the community signals
// (0.25 + 0.10) together outweigh raw crowd size (0.20) on purpose: this
// catalog's whole point is curation, not foot traffic.

import type { LikeCounts } from './likes';

/** Prior weight of the Bayesian shrink: the rating behaves as if it
 *  arrived with this many phantom reviews at the city mean. Ten is low
 *  enough that fifty real reviews dominate it, high enough that three
 *  cannot. */
export const BAYES_PRIOR = 10;

/** How many rows the zero-state shows. */
export const POPULAR_SHOWN = 5;

export const POPULAR_WEIGHTS = {
  quality: 0.45, volume: 0.2, curation: 0.25, love: 0.1,
} as const;

/** The slice of a place this ranking reads. Structural rather than
 *  `Place` for the reason the rest of lib is: Node has to run it. */
export type PopularSource = {
  slug: string;
  rating: number | null;
  rating_count: number | null;
};

/** The slice of a collection: identity plus who it holds. Matches the
 *  shape `Collection` already has, so screens pass their rows straight
 *  through. */
export type HoldingList = {
  slug: string;
  collection_places: { places: { slug: string } | null }[];
};

/**
 * The rating as if seen through the crowd that produced it.
 *
 * `(n·r + m·C) / (n + m)` — the score a place would have if `m` phantom
 * reviewers at the city mean `C` had voted alongside its `n` real ones.
 * A place with no rating at all sits exactly at the mean: unknown is
 * average, not zero, because "we have not asked" is not "it is bad".
 */
export function bayesRating(
  rating: number | null, count: number | null, mean: number, prior: number = BAYES_PRIOR,
): number {
  const n = rating == null ? 0 : (count ?? 0);
  const r = rating ?? mean;
  return (n * r + prior * mean) / (n + prior);
}

/**
 * The places worth showing before anyone types, best first.
 *
 * Ties break by raw rating then slug, so the order is stable across
 * renders and devices — a zero-state that reshuffles between visits
 * reads as random, which is the opposite of "most popular".
 */
export function rankPopular<T extends PopularSource>(
  places: readonly T[],
  collections: readonly HoldingList[],
  likes: LikeCounts,
  limit: number = POPULAR_SHOWN,
): T[] {
  if (places.length === 0) return [];

  // Which lists hold each place — built once, a Set per place so a list
  // that names the same slug twice counts once.
  const held = new Map<string, Set<string>>();
  for (const c of collections) {
    for (const cp of c.collection_places) {
      const slug = cp.places?.slug;
      if (!slug) continue;
      const set = held.get(slug);
      if (set) set.add(c.slug);
      else held.set(slug, new Set([c.slug]));
    }
  }

  // The city mean the shrinkage pulls toward. Only rated places vote on
  // it; a catalog with no ratings at all gets a mean of zero, which
  // collapses the quality signal to zero everywhere — correct, since
  // there is no quality information to rank on.
  const rated = places.filter((p) => p.rating != null);
  const mean = rated.length
    ? rated.reduce((sum, p) => sum + (p.rating as number), 0) / rated.length
    : 0;

  // Raw signals first, normalisation after: the divisor is the max of
  // the set, which does not exist until the set does.
  const raw = places.map((p) => {
    const lists = held.get(p.slug);
    return {
      p,
      quality: bayesRating(p.rating, p.rating_count, mean),
      // The count only counts when a rating exists to be counted — same
      // rule bayesRating applies to `n`.
      volume: Math.log10(1 + (p.rating == null ? 0 : (p.rating_count ?? 0))),
      curation: lists ? lists.size : 0,
      love: lists ? [...lists].reduce((sum, slug) => sum + (likes[slug] ?? 0), 0) : 0,
    };
  });

  const keys = ['quality', 'volume', 'curation', 'love'] as const;
  const max: Record<(typeof keys)[number], number> = { quality: 0, volume: 0, curation: 0, love: 0 };
  for (const r of raw) for (const k of keys) { if (r[k] > max[k]) max[k] = r[k]; }
  // A signal nobody has — no likes anywhere, say — divides by nothing
  // and contributes nothing, rather than NaN-ing the whole score.
  const norm = (v: number, m: number) => (m > 0 ? v / m : 0);

  const scored = raw.map((r) => ({
    p: r.p,
    score: keys.reduce((sum, k) => sum + POPULAR_WEIGHTS[k] * norm(r[k], max[k]), 0),
  }));

  scored.sort((a, b) => (
    b.score - a.score
    || (b.p.rating ?? 0) - (a.p.rating ?? 0)
    || a.p.slug.localeCompare(b.p.slug)
  ));
  return scored.slice(0, limit).map((s) => s.p);
}
