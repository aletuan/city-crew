// What counts as "the same place again" when a chain has branches.
//
// The catalog stores branches as separate rows — "OKKIO Caffe - Lê Lợi"
// and "OKKIO Caffe - Tự Do" are two places with two slugs — and roughly a
// fifth of the Hanoi catalog is branch rows (#188 measured 15 brands
// holding 38 of 203). A planner that only refuses to repeat a *slug* will
// happily put two branches of one sushi chain into a day, and the distance
// penalty makes it likelier, not less likely: branches of a brand tend to
// sit near each other.

/**
 * The brand behind a venue name, for telling branches apart from
 * strangers. Never shown to a reader — it exists to be compared.
 *
 * The catalog writes branches two ways, and this strips both: a suffix
 * after ` - ` ("OKKIO Caffe - Lê Lợi") and a parenthetical after ` (`
 * ("Blank Lounge (Landmark 81)"). Same formula the #188 measurement used,
 * so what it groups is exactly what was counted.
 *
 * A name is a heuristic, and this one fails in the safe direction: two
 * unrelated venues that happen to share a first phrase are treated as one
 * brand, which can only make a plan *more* varied than it strictly had to
 * be. The empty string means "no name to judge by" and callers must treat
 * it as no brand at all, or every unnamed place becomes one giant chain.
 */
export function brandKey(name: string | null | undefined): string {
  return (name ?? '').split(' - ')[0].split(' (')[0].trim().toLowerCase();
}
