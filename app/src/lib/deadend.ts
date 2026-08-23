// What to offer when a search comes back with nothing at all.
//
// A dead end used to be a report plus one door: the sentence saying so,
// and the row that goes and asks Google. Both are right and neither is
// enough, because the failed query usually *contains* a working one.
// Somebody who typed "Pizza 4P's Thảo Điền" has told the app two true
// things — a part of town it knows and a kind of place it knows — inside
// one string it happens not to know. Quoting those parts back as tappable
// chips turns the dead end into a fork.
//
// Pure and colocated-tested for the reason the rest of `lib` is: whether
// "Thảo Điền" is recognised inside "pizza 4p's thảo điền", and whether
// "quan 1" is wrongly recognised inside "quan 10", are exactly the kind
// of facts nobody notices going wrong by looking at a screen.
//
// ── every chip is a promise ──
//
// A chip is only offered when tapping it will return something: areas
// come from the catalog's own neighbourhoods and categories are checked
// against the places actually passed in, so the screen never teaches a
// second query that fails. This is `hintArea`'s rule, inherited — an
// example is a promise that typing it works.

import { CATEGORIES, categoriesOf, Categorisable } from './categories';
import { fold, TermMap } from './search';

/** A way out of a dead end, in the order the screen should offer them. */
export type EscapeRoute =
  | { kind: 'area'; en: string; vi: string; ja: string }
  | { kind: 'category'; key: string };

const WORD_CHAR = /[a-z0-9]/;
const CJK = /[぀-ヿ㐀-䶿一-鿿]/;

/**
 * Does the folded phrase appear in the folded query as whole words?
 *
 * Bounded on *both* sides, which is stricter than search's own
 * `matches()` needs to be: there the query is a prefix somebody is still
 * typing, here the phrase is a complete name being looked for inside a
 * complete query. "quan 1" half-inside "quan 10" is the case the right
 * edge exists for — without it every search mentioning Quận 10 would
 * grow a chip for Quận 1.
 *
 * CJK phrases are plain substrings, the same exemption search grants
 * that script everywhere: 渋谷 has no word edges inside 渋谷カフェ.
 */
export function phraseIn(query: string, phrase: string): boolean {
  if (!phrase) return false;
  if (CJK.test(phrase)) return query.includes(phrase);
  for (let i = query.indexOf(phrase); i !== -1; i = query.indexOf(phrase, i + 1)) {
    const before = i === 0 || !WORD_CHAR.test(query[i - 1]);
    const after = i + phrase.length === query.length || !WORD_CHAR.test(query[i + phrase.length]);
    if (before && after) return true;
  }
  return false;
}

/** The slice of a place this module reads. Structural, so Node can run it. */
export type DeadEndPlace = Categorisable & {
  neighborhood_en?: string | null;
  neighborhood_vi?: string | null;
  neighborhood_ja?: string | null;
};

/**
 * The ways out of a failed query, at most one of each kind.
 *
 * One area and one category, not every one that matches: the mockup this
 * implements offers a fork, and a row of five chips is a second search
 * results page wearing pills. When two areas both appear in the query the
 * longer folded name wins — "Thảo Điền Village" over "Thảo Điền" — because
 * the longer match used more of what the person actually typed.
 *
 * Categories are matched against their key, their three labels and the
 * merged synonym terms, in taxonomy order, first hit taken. The synonym
 * direction is reversed from search's: there the query must begin a term,
 * here the term must sit whole inside the query — "pizza" inside
 * "pizza 4p's thảo điền".
 */
export function escapeRoutes(
  query: string,
  places: readonly DeadEndPlace[],
  terms: TermMap,
): EscapeRoute[] {
  const q = fold(query);
  const out: EscapeRoute[] = [];

  let area: { folded: string; en: string; vi: string; ja: string } | null = null;
  const seen = new Set<string>();
  for (const p of places) {
    const en = p.neighborhood_en;
    if (!en) continue;
    const folded = fold(en);
    if (seen.has(folded)) continue;
    seen.add(folded);
    if (!phraseIn(q, folded)) continue;
    if (!area || folded.length > area.folded.length) {
      area = { folded, en, vi: p.neighborhood_vi ?? en, ja: p.neighborhood_ja ?? en };
    }
  }
  if (area) out.push({ kind: 'area', en: area.en, vi: area.vi, ja: area.ja });

  // Only categories the catalog can actually answer for — a chip for a
  // kind of place this city has none of would be the failing example the
  // header comment forbids.
  const present = new Set(places.flatMap((p) => categoriesOf(p)));
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (!present.has(key)) continue;
    const words = [key, cat.en, cat.vi, cat.ja, ...(terms[key] ?? [])];
    if (words.some((w) => phraseIn(q, fold(w)))) {
      out.push({ kind: 'category', key });
      break;
    }
  }
  return out;
}
