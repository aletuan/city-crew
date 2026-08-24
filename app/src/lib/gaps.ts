// What to say to somebody whose plan could not be built, or could only be
// built one way.
//
// The twin of `hints.ts`, and for the same reason: the point of a
// suggestion is that it *works*. A "we could not plan that" screen naming
// a category this city has nothing in has taught the reader a second
// thing that fails, so the names come out of the catalog rather than out
// of the copy.
//
// Pure, and here rather than in the screen because every rule below is one
// nobody notices being wrong by looking at a screen that happens to have
// data in it. The catalog this app ships with makes that concrete: Da Nang
// holds two places to eat, and neither Hanoi nor Da Nang holds a single
// shopping place — so "Shopping" is a chip that leads nowhere in two cities
// out of three. A planner tested only against Hanoi's thirty-nine
// restaurants passes everything and then meets Da Nang.

/** Just enough of a place to count by category. Structural, so a full
 *  `Place` satisfies it. */
import { categoriesOf } from './categories';

type Countable = { categories?: string[] | null; vibe_tags?: string[] | null; category?: string };

export type Gap = {
  /** Categories the reader asked for that this catalog has nothing in,
   *  in the order they asked. */
  empty: string[];
  /** A category worth offering instead, or null when there is nothing to
   *  offer. Never one of `empty`. */
  suggestion: string | null;
};

/**
 * How many places each category actually has here.
 *
 * Exported because the planner needs the same count to decide how many
 * plans it can honestly build, and two implementations of "how much is
 * there" would drift apart — the screen saying one thing while the
 * planner did another.
 */
export function countByCategory(places: readonly Countable[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const p of places) {
    for (const c of categoriesOf(p)) n.set(c, (n.get(c) ?? 0) + 1);
  }
  return n;
}

/**
 * What was missing, and what would have worked.
 *
 * `places` is the pool the plan would have been built from — already
 * narrowed to the city and to what is live. Passing the whole catalog
 * here would name a category that exists in Hanoi to somebody planning a
 * day in Da Nang, which is the failure this file exists to avoid.
 *
 * The suggestion is the busiest category, because an example is a promise
 * that choosing it returns something and the busiest one is most likely to
 * keep that promise. Ties break on name so the sentence does not rewrite
 * itself between two renders of the same catalog — a suggestion that moves
 * while you read it is a suggestion you stop trusting.
 *
 * Null rather than a fallback string when the pool is empty or holds only
 * what the reader already asked for. The caller drops that half of the
 * sentence; inventing "try Cafés" for a city whose cafés are exactly what
 * just failed is worse than saying nothing.
 */
export function planGap(wanted: readonly string[], places: readonly Countable[]): Gap {
  const counts = countByCategory(places);
  const empty = wanted.filter((c) => !counts.get(c));

  const asked = new Set(wanted);
  const suggestion = [...counts.entries()]
    .filter(([key, n]) => n > 0 && !asked.has(key))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

  return { empty, suggestion };
}

/**
 * How many distinct plans this pool can honestly carry.
 *
 * Three cards that differ by one stop out of three are worse than one
 * card, because they claim a choice the catalog cannot back. So the
 * screen asks first and builds second.
 *
 * The arithmetic is deliberately crude — the scarcest category the reader
 * asked for, capped at three — and it is a ceiling rather than a promise.
 * The planner may still return fewer once opening hours have had their
 * say, and the screen renders what it is given rather than what this
 * predicted. Getting a number here that is too high costs nothing; the
 * expensive direction is claiming a category has nothing when it has one.
 */
export function plansAvailable(wanted: readonly string[], places: readonly Countable[]): number {
  if (!places.length) return 0;
  const counts = countByCategory(places);
  // No categories asked for is not a reason to refuse: the planner falls
  // back to the whole pool, and a pool with anything in it can carry at
  // least one plan.
  // The counts themselves rather than the category names: asking the map
  // twice — once with `has`, once with `get` — needs a fallback for a miss
  // the first call already ruled out, which is a line no test can reach and
  // every reader has to work out is dead.
  const asked = wanted.map((c) => counts.get(c)).filter((n): n is number => n != null);
  if (!asked.length) return wanted.length ? 0 : Math.min(3, places.length);

  return Math.max(1, Math.min(3, Math.min(...asked)));
}
