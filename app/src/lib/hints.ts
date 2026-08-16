// What to suggest to somebody whose search found nothing.
//
// Pure, and here rather than in the screen for the reason `place.ts` is: a
// Node process can reach it, and every rule below is one nobody notices
// being wrong by looking at a screen that happens to have data in it.
//
// The point of an example is that it *works*. A "no matches" screen that
// suggests trying a neighbourhood, and names one the catalog has never
// heard of, has taught the reader a second thing that fails — so the names
// come out of the catalog rather than out of the copy.

/** Just enough of a place to pick an example from. */
type Areaish = { neighborhood_en?: string | null };

/**
 * A neighbourhood worth naming as an example, or null.
 *
 * The busiest one, because an example is a promise that typing it returns
 * something, and the busiest area is the one most likely to keep that
 * promise for the widest range of what the reader types next.
 *
 * Ties break on name so the hint does not change between two renders of
 * the same catalog — a suggestion that rewrites itself while you read it
 * is a suggestion you stop trusting.
 *
 * Null rather than a fallback string when the catalog has no areas at all.
 * The caller drops that half of the sentence; inventing "try Hoàn Kiếm"
 * for a city with no Hoàn Kiếm is exactly the failure this exists to
 * avoid.
 */
export function hintArea(places: readonly Areaish[]): string | null {
  const n = new Map<string, number>();
  for (const p of places) {
    const d = p.neighborhood_en?.trim();
    if (!d) continue;
    n.set(d, (n.get(d) ?? 0) + 1);
  }
  if (n.size === 0) return null;
  return [...n.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}
