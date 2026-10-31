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

/** How many arrivals the zero-state shows. Five, matching POPULAR_SHOWN:
 *  the zero-state is a foyer of sections, and any one of them running to
 *  ten turns the others into things you scroll past to reach. */
export const NEWEST_SHOWN = 5;

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

// ── the "New" mark on a collection (owner, 29 Oct 2026) ──
//
// A list made in the last week wears "New" wherever its card is drawn:
// the Collections grid and list, Explore's shelf, Search. Seven days, not
// fourteen, because a mark only works while it is rare: measured on 29 Oct
// 2026, 3 of the 32 public lists were under a week old and 9 under two —
// near a third of the grid, which is a pattern the eye stops reading.
//
// `created_at` carries the caveat above: the seeded lists share the
// instant the column was added, in August, so none of them can pass for
// new.
//
// ── yours too (owner, 31 Oct 2026) ──
//
// The mark is the same for whoever is reading, the author included: a
// list says what it is, not what it is to you, and an author looking at
// the shelf sees their new list the way everybody else does. So it
// depends on the list alone, on every tab — Yours as well as Community.
//
// Rejected, and what it was: from 29 to 31 Oct the reader's own list was
// never marked ("New" as news about somebody else's work), which needed
// the reader — and so a third answer while the session had not been read
// yet, marking nothing, because answering "a guest" then had the badge on
// the reader's own list come and go as the app opened. With no reader in
// the question, there is no moment at launch for it to be wrong in.

/** How long a collection is new for, in days. */
export const NEW_LIST_DAYS = 7;

/** Whether a collection gets the "New" mark: made in the last
 *  `NEW_LIST_DAYS`, by anyone. */
export function isNewList(c: { created_at?: string | null }, now: number): boolean {
  if (!c.created_at) return false;
  const age = now - Date.parse(c.created_at);
  return age >= 0 && age < NEW_LIST_DAYS * 86_400_000;
}
