// A city's short name, in the reader's language.
//
// Four screens spelled this out, five times, as `t(c.short_en,
// c.short_vi, c.short_ja ?? c.short_en)`, and the `?? short_en` is the
// part worth keeping in one place: `short_ja` is nullable in the schema, because a city the desk has
// added may not have its Japanese name yet, and `t` given `null` would
// print nothing where the city should be. English is the fallback because
// it is the one a Japanese reader can still read on a map.
//
// Structural, and no imports: `City` lives in `city.tsx`, which is a React
// context, and a Node process has no renderer.

/** The three names this file reads. A full `City` satisfies it. */
export type ShortNamed = { short_en: string; short_vi: string; short_ja?: string | null };

type T = (en: string, vi: string, ja: string, zh?: string, hant?: string) => string;

export function cityShort(c: ShortNamed, t: T): string {
  return t(c.short_en, c.short_vi, c.short_ja ?? c.short_en);
}

/**
 * The short name of the city with this id, or null when the list does not
 * hold it.
 *
 * Null rather than a fallback, because the callers disagree on what to show
 * instead: the visits list prints the raw id (a city the app no longer
 * lists is still a city the reader was in), a visit's meta line prints
 * nothing at all.
 */
export function cityShortById(
  cities: readonly (ShortNamed & { id: string })[], id: string | null | undefined, t: T,
): string | null {
  const c = id ? cities.find((x) => x.id === id) : undefined;
  return c ? cityShort(c, t) : null;
}
