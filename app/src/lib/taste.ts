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
 *  catalog row to say "they saved two cafés".
 *
 *  `slug` is optional and is only an identity: `tally` counts a place once
 *  however many lists it arrives in. Without one it counts every arrival,
 *  which is the honest answer for a caller that has not said which places
 *  these are. */
export type Categorised = {
  slug?: string;
  categories?: string[] | null;
  vibe_tags?: string[] | null;
};

export type TasteSignals = {
  /** Category keys the reader said out loud. The strongest of the three
   *  category signals, because saying beats inferring.
   *
   *  Nothing passes it today: the profile stopped asking, on the argument
   *  that the wizard asks the same question harder — see `usePlanProfile`,
   *  which is the seam. The term stays weighted and tested for whatever
   *  asks next. */
  preferred?: readonly string[];
  /** Places in the reader's own collections. */
  saved?: readonly Categorised[];
  /** Places the reader suggested to the catalog themselves. */
  suggested?: readonly Categorised[];
  /**
   * Places inside collections this reader has liked.
   *
   * The weakest of the four, and the reason is what a like is: one tap on
   * somebody *else's* curation. It is real evidence — nobody likes a list
   * of places they have no time for — but it is indirect, the categories
   * arrive through another person's judgement about what belongs together,
   * and it costs a fraction of what saving costs.
   *
   * It is also the cheapest thing a new reader can do. Somebody who has
   * not found the bookmark has very likely found the heart, which is the
   * half of the picture the other three signals miss entirely.
   */
  liked?: readonly Categorised[];
  /** Slugs the reader opened and did not save. The caller limits this to
   *  recent events — a place passed over last March says nothing about this
   *  Saturday, and `place_events` grows forever until somebody trims it.
   *
   *  **Ignored entirely unless `saved` has something in it.** See the note
   *  in `tasteFrom`: this is the one signal that reads a silence, and a
   *  silence only means "no" from somebody who has been heard saying
   *  "yes". */
  passedOver?: readonly string[];
};

/** The doc's ordering, kept, with liking added at the bottom of it:
 *  **stated beats saved beats suggested beats liked**. The numbers only
 *  matter relative to each other — the sum is normalised by their total,
 *  so scaling all four changes nothing, and adding the fourth dilutes the
 *  other three (3/9 became 3/10) without reordering any of them. */
const W_PREFERRED = 4;
const W_SAVED = 3;
const W_SUGGESTED = 2;
const W_LIKED = 1;
const W_TOTAL = W_PREFERRED + W_SAVED + W_SUGGESTED + W_LIKED;

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

/**
 * How many of these places carry each category, counting a place once.
 *
 * The dedupe is here rather than at the call sites because it is a
 * property of the arithmetic, not a discipline for whoever calls it: a
 * reader's saved places arrive as the flattened membership of their
 * collections, and one café filed under both "Weekend" and "Near work" is
 * one café that was saved, not two. Counting it twice quietly gave the
 * readers who organise most the loudest taste.
 *
 * Only when there is a slug to identify it by. A caller that hands over
 * bare shapes — every test in this file, and the design that made
 * `Categorised` structural in the first place — has not said which places
 * these are, and counting each arrival is the honest answer to that.
 */
function tally(places: readonly Categorised[] | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const p of places ?? []) {
    if (p.slug) {
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
    }
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
  const liked = tally(signals.liked);

  /**
   * The one signal built from a silence, and the one that has to earn the
   * right to be read.
   *
   * "Opened and did not save" is only a refusal if saving is a thing this
   * reader does. Somebody who has saved thirty places and not this one has
   * chosen; somebody who has saved nothing has not refused two hundred
   * places, they have not found the button. The data cannot tell those two
   * apart — both are an `open` with nothing after it — so the difference
   * has to be asserted here, and it is the difference between a taste
   * profile and a punishment for not knowing the app yet.
   *
   * Put plainly: **a silence only means "no" from somebody who has been
   * heard saying "yes".**
   *
   * The test is places saved, not categories saved: `tally` counts the
   * categories a save carried, and a place the desk has not tagged yet
   * would come back as an empty tally from a reader who did use the
   * button. The claim being made is about the button.
   *
   * One save is enough. This is not a measure of how much somebody saves —
   * it is proof they know the gesture exists, and one proves that.
   */
  const savesAtAll = (signals.saved?.length ?? 0) > 0;
  const passedOver = new Set(savesAtAll ? signals.passedOver ?? [] : []);

  // `passedOver` is gated above, so a reader whose only signal was a list
  // of places they opened now correctly has no taste at all rather than an
  // all-zero one — which is the distinction the note below turns on.
  if (!preferred.size && !saved.size && !suggested.size && !liked.size && !passedOver.size) return null;

  return {
    affinity: (p: Place) => {
      const cats = categoriesOf(p);
      // A place with no categories at all is not evidence for or against
      // anything — a plan should neither reach for it nor avoid it because
      // the desk has not tagged it yet.
      const positive = cats.length
        ? (W_PREFERRED * (preferred.size ? Math.max(0, ...cats.map((c) => (preferred.has(c) ? 1 : 0))) : 0)
          + W_SAVED * lean(saved, cats)
          + W_SUGGESTED * lean(suggested, cats)
          + W_LIKED * lean(liked, cats)) / W_TOTAL
        : 0;
      // A whole point off, which is the largest move any single fact makes
      // here. It is also the only per-place signal: everything above is a
      // statement about a category that happens to include this place.
      return passedOver.has(p.slug) ? positive - 1 : positive;
    },
  };
}
