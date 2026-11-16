// Which categories a collection wears as chips — and narrows by.
//
// Worked out from the list's own places and nothing else: chips come
// from the category vocabulary (no free words, nothing read out of the
// title, which owners already use for their own conventions), and they
// are derived rather than typed.
//
// ── every kind the places carry, most places first ──
//
// The first cut showed a category only on a third of the list or more,
// three at most, so the chips said what the list *is*: "Nightlife" off a
// list of 72 cafés because nine of them also count as nightlife. Then the
// chips became the list's filter, the same day, and a threshold there
// hides exactly the way in a reader wants most — the nine bars among the
// seventy-two cafés. So the threshold went (the owner's call), and what
// the list *is* is said by the order instead: most places first, so the
// leading chip is the list's own kind. Counts beside the words were
// offered and turned down as clutter.
//
// Measured on the 38 live lists with places: 12 carry one kind, 11 two,
// 10 three, 4 four and 1 six (the Đà Lạt café list). No cap, then: the
// most a card has to wrap is two lines.
//
// ── nothing is stored, and the owner has no say (owner, 16 Nov 2026) ──
//
// From 15 Oct an owner could take a chip off in the list's form: "From
// the places in it. Tap one to hide it." The kinds taken off were kept in
// `kinds_hidden`, and stuck however many more such places arrived. The
// owner of the app asked what the control was for, and then for it to go.
//
// Measured on the live lists that day: 1 of 94 had anything hidden —
// "Về đêm" off a lunch list of 27 places, two of which carry it. On the
// other 93 the control changed nothing, and on a list of one kind it
// could only do harm: hide the one chip and the card no longer says what
// the list is, and the Community Mosaic no longer sits it with its kind.
// A chip is also the list's filter, so a hidden one took away the way in
// to places that are in the list all the same. What the list *is* is
// said by the order, which no setting has to keep true.
//
// Rejected with it: keeping the control only on lists of two kinds or
// more. That drops the one-kind harm and keeps a setting one list in
// ninety-four used.
//
// The columns stay in the database, unread and unwritten by this app:
// `kinds_hidden`, and `kinds_added` beside it (retired on 15 Oct with
// the threshold, when the only kind left to add was one no place
// carries). Builds in the field that have not taken this update still
// select both, and a dropped column is a failed query there: no lists at
// all, for the sake of tidiness. Until they are gone those builds also
// still honour the one hidden chip, so that list shows two chips on an
// old build and three on this one.

import { CATEGORIES, CATEGORY_ORDER, categoriesOf, type Categorisable } from './categories';

const rank = (k: string) => CATEGORY_ORDER.indexOf(k as (typeof CATEGORY_ORDER)[number]);

/**
 * The chips a list shows, and narrows by: every category its places
 * carry, most places first, the filter row's order breaking ties. Keys the table does not know are not counted — a
 * chip is a category's glyph and colour, and an unknown key has neither.
 */
export function derivedKinds(members: readonly Categorisable[]): string[] {
  const tally = new Map<string, number>();
  for (const p of members) {
    for (const k of new Set(categoriesOf(p))) {
      if (CATEGORIES[k]) tally.set(k, (tally.get(k) ?? 0) + 1);
    }
  }
  return [...tally]
    .sort(([a, n], [b, m]) => m - n || rank(a) - rank(b))
    .map(([k]) => k);
}

/**
 * The places carrying at least one of the chosen kinds, in the list's own
 * order; nothing chosen is the whole list (owner, 15 Oct 2026). Any, not
 * all: two chips widen the list, as a row of kinds does everywhere a
 * reader has met one. The one pair that reads as a narrowing — a café to
 * work in — is reached by Focus alone, whose places are cafés already.
 */
export function narrowTo<T extends Categorisable>(members: readonly T[], chosen: readonly string[]): T[] {
  if (!chosen.length) return [...members];
  return members.filter((p) => categoriesOf(p).some((k) => chosen.includes(k)));
}
