// The catalog's newest arrivals, for the search zero-state.
//
// "Most popular" answers *what is good here*; this answers *what just
// landed* — the section that rewards coming back to a city you already
// know. It is the simplest ranking in the app and stays that way on
// purpose: newest first, full stop. Blending in rating or likes would
// make it a second popularity list wearing a different label.
//
// ── why the timestamp cannot be trusted alone, and why that is fine ──
//
// `created_at` on the seeded rows is the instant the catalog was loaded,
// not when anywhere opened — the same caveat `Collection.created_at`
// documents. That poisons it as a *general* ranking key, but not for
// this list: everything imported since the seeding is genuinely newer
// than all of it, so the top of a newest-first sort is exactly the
// recent imports the section exists to show. The seeds only surface in a
// city with fewer real imports than the cap, where "the catalog itself"
// is an honest answer to "what is new here".
//
// Rows with no timestamp at all are dropped rather than sorted to
// either end: a place that cannot say when it arrived has no claim to a
// list ordered by exactly that.

/** The slice of a place this module reads. Structural, so Node can run it. */
export type Dated = { slug: string; created_at?: string | null };

/** How many arrivals the zero-state shows. */
export const NEWEST_SHOWN = 10;

/**
 * The newest places, newest first, at most `n`.
 *
 * Ties — the seeded rows share one timestamp to the second — break on
 * slug, so the same catalog renders the same list on every visit. A
 * section that reshuffles between two openings of the same screen reads
 * as random, and random reads as broken.
 *
 * ISO-8601 timestamps in one timezone sort correctly as strings, which
 * is what Supabase returns; nothing here parses a date, so nothing here
 * can disagree with the database about one.
 */
export function newestPlaces<T extends Dated>(places: readonly T[], n: number = NEWEST_SHOWN): T[] {
  return places
    .filter((p) => !!p.created_at)
    .sort((a, b) => {
      if (a.created_at !== b.created_at) return a.created_at! < b.created_at! ? 1 : -1;
      return a.slug < b.slug ? -1 : 1;
    })
    .slice(0, n);
}
