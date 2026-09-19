// How many places each city is promising, under the filters in force.
//
// The map draws every city the app has, and each marker carries a number.
// Those numbers must all be in one unit or the picture lies: "Cafés"
// narrowing this city to 89 while another still claims its total of 280
// invites exactly the comparison the reader should not make.
//
// So the rule here is not a second rule. It is `matchesExplore`, the same
// predicate the list itself is filtered by — one function, two callers,
// no way for them to drift.

import { matchesExplore, type ExploreStatus, type Filterable } from './exploreFilters';

/** What this needs of an indexed row: enough to be filtered, plus which
 *  city to count it under. */
export type Countable = Filterable & { city_id: string | null };

/**
 * A count per city id, for the rows that survive the filters.
 *
 * A city with nothing surviving is absent rather than zero: the caller
 * draws a marker for every city it knows, and "no number yet" and "none"
 * are different things to say — the first is silence, the second is a
 * zero the reader can act on. Callers that want the difference read
 * `counts[id]` and check for `undefined` themselves.
 */
export function countsByCity(
  rows: readonly Countable[],
  options: {
    category: string;
    allCategory: string;
    status: ExploreStatus;
    savedOnly: boolean;
    isSaved: (slug: string) => boolean;
    now: Date;
  },
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (!row.city_id) continue;
    if (!matchesExplore(row, options)) continue;
    out[row.city_id] = (out[row.city_id] ?? 0) + 1;
  }
  return out;
}
