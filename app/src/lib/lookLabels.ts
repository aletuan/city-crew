// The two words the Theme sheet may put on a look's card — "Popular" and
// "New" — and the rules for which cards get them (12 Oct 2026).
//
// ── why labels and not an order ──
//
// The owner asked whether the looks could be ordered by how often they
// are chosen. The grid stays in its one order: a picker of fourteen cards
// lives on spatial memory ("Cosmic is page two, top right"), and a grid
// that reshuffles under the finger is the personalised menu Office 2000
// shipped and withdrew (Findlater & McGrenere, 2004: a static menu beats
// an adaptive one, and a split menu — a short "recent" row over a fixed
// list — beats both). So the sheet opens on the worn look's page, which
// is the split menu's "recent" in one card, and two or three cards carry
// a word. A word informs; a position persuades.
//
// ── Popular ──
//
// What people wear, not what they tap: the server counts
// `preferences.theme` (`theme_counts`, see the migration for why a tap
// counter measures the wrong thing) and says a figure only for a theme
// past twenty wearers, so a small user base shows no badge at all rather
// than "2 people". The three most worn of what it says get the word, no
// number: a number on fourteen cards invites comparing fourteen numbers
// in a choice that is about colour, and VS Code — which the owner had in
// mind — keeps its install counts in the Marketplace and shows none in
// its theme picker.
//
// ── New ──
//
// New *to this reader*: a look that was not on the sheet the last time
// they opened it. Not "added in the last 30 days" — the whole catalogue
// is three days old as this is written, and a word on every card is
// noise. The first opening ever labels nothing, since everything is new
// and nothing is. The sheet writes the ids it showed on each opening,
// so the word lasts one opening, the way a store badges an update once.
//
// Everything here is pure and takes its inputs; the AsyncStorage read and
// write, and the fetch, live in the sheet — the split every lib module
// makes, since the coverage gate can see this file and not a component.

import type { Pinned } from './look';

/** How many looks get "Popular": the two or three the header of the
 *  Theme sheet promised, and the fewest that still read as a set rather
 *  than as a winner. */
export const POPULAR_SHOWN = 3;

/** The AsyncStorage key the last-shown look ids are kept under. */
export const SEEN_LOOKS_KEY = 'citycrew.seenLooks';

/**
 * The looks that get "Popular": the most worn first, up to
 * `POPULAR_SHOWN`, among those the server said a figure for. A theme the
 * server did not name — under its threshold, or not a look at all — gets
 * nothing. Ties keep the sheet's order, so two looks level on the server
 * do not swap places between openings.
 */
export function popularLooks(counts: Record<string, number>, looks: readonly Pinned[]): Pinned[] {
  return looks
    .filter((id) => (counts[id] ?? 0) > 0)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, POPULAR_SHOWN);
}

/**
 * Whatever storage handed back, as the ids last shown, or null for a
 * sheet never opened — the one case `unseenLooks` must tell apart from
 * "shown nothing". Anything that is not an array of strings is read as
 * never opened: an unreadable memory must not label every card.
 */
export function parseSeen(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

/** The looks that get "New": on the sheet now and not the last time. None
 *  on the first opening, when every look would qualify and the word would
 *  say nothing. */
export function unseenLooks(seen: string[] | null, looks: readonly Pinned[]): Pinned[] {
  if (seen === null) return [];
  const had = new Set(seen);
  return looks.filter((id) => !had.has(id));
}

/** What to keep after an opening: the ids it showed. */
export function serializeSeen(looks: readonly Pinned[]): string {
  return JSON.stringify(looks);
}
