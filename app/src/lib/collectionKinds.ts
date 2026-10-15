// Which categories a collection wears as chips — and narrows by.
//
// Worked out from the list's own places, then corrected by its owner:
// chips come from the category vocabulary and nowhere else (no free
// words, nothing read out of the title, which owners already use for
// their own conventions), they are derived rather than typed, and the
// owner can take one off (owner, 15 Oct 2026).
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
// ── what is stored ──
//
// Only the kinds the owner took off (`kinds_hidden`), never the derived
// set — see `20261015090000_collection_kinds.sql` for why a list that is
// still growing must not have its chips frozen at a save.
//
// Putting a kind on (`kinds_added`) went with the threshold: every kind a
// place carries already shows, so the only kind left to add is one no
// place carries — a chip that says something untrue of the list and
// filters it to nothing. The column stays, written empty.

import { CATEGORIES, CATEGORY_ORDER, categoriesOf, type Categorisable } from './categories';

export type KindChoice = { hidden: readonly string[] };

const rank = (k: string) => CATEGORY_ORDER.indexOf(k as (typeof CATEGORY_ORDER)[number]);

/**
 * Every category the places carry, most places first, the filter row's
 * order breaking ties. Keys the table does not know are not counted — a
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

/** The chips a list shows: what its places carry, less what the owner
 *  took off. */
export function collectionKinds(members: readonly Categorisable[], choice: Partial<KindChoice>): string[] {
  const hidden = new Set(choice.hidden ?? []);
  return derivedKinds(members).filter((k) => !hidden.has(k));
}

/**
 * The owner shows or hides one chip. Hidden sticks — however many more
 * places of that kind arrive, the owner said it is not what this list
 * is — and shown again is simply not hidden.
 */
export function chooseKind(choice: KindChoice, key: string, on: boolean): KindChoice {
  const hidden = choice.hidden.filter((k) => k !== key);
  return { hidden: on ? hidden : [...hidden, key] };
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
