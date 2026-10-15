// Which categories a collection wears as chips.
//
// Worked out from the list's own places, then corrected by its owner —
// the shape the owner chose on 15 Oct 2026: chips come from the category
// vocabulary and nowhere else (no free words, nothing read out of the
// title, which owners already use for their own conventions), they are
// derived rather than typed, and the owner can take one off or put any
// of the nine on.
//
// ── what derives ──
//
// A category shows when it covers a third of the list or more, three at
// most. Measured on the 39 live collections that day: drawing every
// category a member carries put a "Nightlife" chip on a list of 72 cafés
// because nine of them also count as nightlife, and six categories on a
// 15-place Đà Lạt café list. At a third, both read as one chip, Cafés.
// The most any list kept at a third was four (three places in four
// categories), so three is the cap and it bites on small lists only.
//
// ── what is stored ──
//
// Only the owner's decisions (`kinds_hidden`, `kinds_added`), never the
// derived set — see `20261015090000_collection_kinds.sql` for why a list
// that is still growing must not have its chips frozen at a save.

import { CATEGORIES, CATEGORY_ORDER, categoriesOf, type Categorisable } from './categories';

/** A third of the list, the share a category needs to show on its own. */
export const KIND_SHARE = 1 / 3;
/** At most this many derived chips; the owner's own are on top. */
export const KIND_CAP = 3;

export type KindChoice = { hidden: readonly string[]; added: readonly string[] };

const rank = (k: string) => CATEGORY_ORDER.indexOf(k as (typeof CATEGORY_ORDER)[number]);

/**
 * The categories the places earn on their own: a third of the list or
 * more, most places first, the filter row's order breaking ties, three
 * at most. Keys the table does not know are not counted — a chip is a
 * category's glyph and colour, and an unknown key has neither.
 */
export function derivedKinds(members: readonly Categorisable[]): string[] {
  const tally = new Map<string, number>();
  for (const p of members) {
    for (const k of new Set(categoriesOf(p))) {
      if (CATEGORIES[k]) tally.set(k, (tally.get(k) ?? 0) + 1);
    }
  }
  return [...tally]
    .filter(([, n]) => n >= members.length * KIND_SHARE)
    .sort(([a, n], [b, m]) => m - n || rank(a) - rank(b))
    .slice(0, KIND_CAP)
    .map(([k]) => k);
}

/**
 * The chips a list shows: what the owner put on, in the filter row's
 * order, then what the places earn, less whatever the owner took off.
 *
 * The owner's first because they are the stronger statement — the places
 * say what the list holds, the owner says what it is for. The cap is the
 * derived set's, taken before the hidden ones leave: taking a chip off
 * should not pull a fourth one up into its place.
 */
export function collectionKinds(members: readonly Categorisable[], choice: Partial<KindChoice>): string[] {
  const hidden = new Set(choice.hidden ?? []);
  const added = [...new Set(choice.added ?? [])]
    .filter((k) => CATEGORIES[k] && !hidden.has(k))
    .sort((a, b) => rank(a) - rank(b));
  const earned = derivedKinds(members).filter((k) => !hidden.has(k) && !added.includes(k));
  return [...added, ...earned];
}

/**
 * The owner turns one chip on or off. The word is sticky either way: on
 * pins it whatever the places later say, off keeps it off however many
 * places of that kind arrive — and a key is never in both lists, which
 * the database also refuses (`collections_kinds_one_word`).
 */
export function chooseKind(choice: KindChoice, key: string, on: boolean): KindChoice {
  const hidden = choice.hidden.filter((k) => k !== key);
  const added = choice.added.filter((k) => k !== key);
  return on ? { hidden, added: [...added, key] } : { hidden: [...hidden, key], added };
}

/**
 * Every category the list's places carry, in the filter row's order —
 * what a reader can narrow the list by. Not the chips above: those are
 * what the list *is*, three at most; this is every way into it, the café
 * that is also a bar among seventy-two cafés included. Keys the table
 * has not learned are left out, since a filter chip is a glyph and a
 * colour and they have neither.
 */
export function kindsPresent(members: readonly Categorisable[]): string[] {
  const seen = new Set(members.flatMap((p) => categoriesOf(p)));
  return CATEGORY_ORDER.filter((k) => seen.has(k));
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
