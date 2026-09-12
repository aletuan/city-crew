// Reading a Geocoding API reply, which is the pure half of `reverse`.
//
// In a file of its own for the reason `lib/batch.ts` is: no `fetch`, no
// `Deno`, nothing to stub. The half of this feature most likely to be
// wrong is the half that guesses at somebody else's field names, and it
// is the half a test can hold still — see `app/src/lib/geocode.test.ts`,
// which reaches across for exactly that. `index.ts` next door does the
// network and nothing else.

/**
 * Which of Google's names for a point is the one to print under a map.
 *
 * Most specific first, and none of them below the ward: a caption says
 * which part of town the pin is in, not which doorway. The list is also
 * the `result_type` filter `index.ts` sends to Google, so the reply holds
 * only rows of these kinds and the first is the one wanted.
 */
export const REVERSE_TYPES = [
  "sublocality_level_1",
  "sublocality",
  "administrative_area_level_2",
  "locality",
  "administrative_area_level_1",
];
/**
 * The most specific area name in a Geocoding reply.
 *
 * Google answers with one result per type asked for, most specific first,
 * and each result's `address_components` carries the component of that
 * type among its parents. The name wanted is the component whose type
 * matches the result's own — the ward in the ward result — not the
 * result's `formatted_address`, which spells out every parent after it.
 * Walked in `REVERSE_TYPES` order rather than trusting the reply's, so a
 * reordering upstream cannot promote a province over its ward.
 */
export function reverseName(data: unknown): string {
  const results = (data as { results?: unknown })?.results;
  if (!Array.isArray(results)) return "";
  for (const want of REVERSE_TYPES) {
    for (const r of results as { types?: string[]; address_components?: { long_name?: string; types?: string[] }[] }[]) {
      if (!r.types?.includes(want)) continue;
      const c = r.address_components?.find((x) => x.types?.includes(want));
      const name = c?.long_name?.trim();
      if (name) return name;
    }
  }
  return "";
}
