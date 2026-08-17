// What this reader tends to like, as a number between −1 and 1.
//
// Pure, and built from what is already in memory — `SaveProvider` holds the
// collections, `usePlaces` holds the catalog, the preferences row is one
// read. No materialized view, no nightly job: the same derive-don't-store
// rule that has `fetch-place` counting its daily cap off the `places` rows
// instead of keeping a counter.
//
// ── the one number, and why it is bounded ──
//
// `planner.ts` multiplies this by `TASTE_WEIGHT = 2` and adds it to a score
// where a wizard category match is worth 3. That comparison only means
// anything if affinity has a known range, so it has one: **[−1, 1], always**.
// A preferred place can gain at most 2 points and a rejected one lose at
// most 2, and neither can outrank the answer the reader gave thirty seconds
// ago. Returning an unbounded sum of signals would make the weight in
// `planner.ts` a decoration and the promise in the design doc false.
//
// ── two kinds of evidence, not one scale ──
//
// The design doc weighted every signal on one axis: preferences 4, saved
// collections 3, self-suggested places 2, opened-and-not-saved −1. Three of
// those are evidence about a *category* — weak, general, and true of many
// places. The fourth is evidence about *this exact place*, and it is not
// weak at all: somebody who opened a café and did not save it has told you
// something specific.
//
// Averaging them on one scale makes the strong signal the quietest, because
// it carries the smallest number. So they are kept apart: the category lean
// fills [0, 1], and a place the reader passed over takes a full point off
// whatever that lean was. The relative order of the three category signals
// is the doc's, and the reason it is theirs is sound — a stated preference
// beats an inferred one.

import { categoriesOf } from './categories';
import type { Place } from './types';
import type { Taste } from './planner';

/** Enough of a place to have an opinion about. Structural rather than
 *  `Place` where it can be, so a test does not have to build a whole
 *  catalog row to say "they saved two cafés". */
export type Categorised = { categories?: string[] | null; vibe_tags?: string[] | null };

export type TasteSignals = {
  /** Category keys the reader chose in their profile. The strongest of the
   *  three category signals, because they were said out loud rather than
   *  inferred from behaviour. */
  preferred?: readonly string[];
  /** Places in the reader's own collections. */
  saved?: readonly Categorised[];
  /** Places the reader suggested to the catalog themselves. */
  suggested?: readonly Categorised[];
  /** Slugs the reader opened and did not save. The caller limits this to
   *  recent events — a place passed over last March says nothing about this
   *  Saturday, and `place_events` grows forever until somebody trims it. */
  passedOver?: readonly string[];
};

/** The doc's ordering, kept: stated beats saved beats suggested. The
 *  numbers only matter relative to each other — the sum is normalised by
 *  their total, so changing all three by the same factor changes nothing. */
const W_PREFERRED = 4;
const W_SAVED = 3;
const W_SUGGESTED = 2;
const W_TOTAL = W_PREFERRED + W_SAVED + W_SUGGESTED;

/**
 * How much of a place's own vocabulary a set of counts speaks.
 *
 * Normalised against the commonest category rather than the total, so the
 * answer means "how close is this to the thing they do most" rather than
 * "what share of everything they have done is this". The second reads
 * badly for anyone with broad taste: somebody with seven categories in
 * their collections would score every place at a seventh, and a taste
 * profile that flattens as it learns more is worse than none.
 *
 * The max over the place's categories, not the mean. A café that is also a
 * viewpoint is a café to somebody who likes cafés; averaging in the
 * viewpoint would punish it for being two things.
 */
function lean(counts: Map<string, number>, cats: readonly string[]): number {
  if (!counts.size || !cats.length) return 0;
  // No guard on `top` being zero: `tally` is the only thing that fills this
  // map and it only ever counts upwards, so a non-empty map has a maximum
  // of at least one. A divide-by-zero check here would be a branch no test
  // could honestly reach.
  const top = Math.max(...counts.values());
  return Math.max(0, ...cats.map((c) => (counts.get(c) ?? 0) / top));
}

function tally(places: readonly Categorised[] | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of places ?? []) {
    for (const c of categoriesOf(p as Place)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return counts;
}

/**
 * A `Taste` the planner can use, or null when there is nothing to say.
 *
 * Null rather than an affinity of zero for every place, and the difference
 * is not cosmetic: `planner.ts` skips the term entirely when there is no
 * taste, so a reader with no history gets exactly the plans they got before
 * this file existed. An all-zero `Taste` would produce the same numbers but
 * would say the profile had been consulted, and the day somebody debugs a
 * plan they think was personalised, that distinction is the answer.
 */
export function tasteFrom(signals: TasteSignals): Taste | null {
  const preferred = new Set(signals.preferred ?? []);
  const saved = tally(signals.saved);
  const suggested = tally(signals.suggested);
  const passedOver = new Set(signals.passedOver ?? []);

  if (!preferred.size && !saved.size && !suggested.size && !passedOver.size) return null;

  return {
    affinity: (p: Place) => {
      const cats = categoriesOf(p);
      // A place with no categories at all is not evidence for or against
      // anything — a plan should neither reach for it nor avoid it because
      // the desk has not tagged it yet.
      const positive = cats.length
        ? (W_PREFERRED * (preferred.size ? Math.max(0, ...cats.map((c) => (preferred.has(c) ? 1 : 0))) : 0)
          + W_SAVED * lean(saved, cats)
          + W_SUGGESTED * lean(suggested, cats)) / W_TOTAL
        : 0;
      // A whole point off, which is the largest move any single fact makes
      // here. It is also the only per-place signal: everything above is a
      // statement about a category that happens to include this place.
      return passedOver.has(p.slug) ? positive - 1 : positive;
    },
  };
}
