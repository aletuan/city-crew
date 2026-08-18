// What "matching" means when somebody types into the search box.
//
// Pulled out of `SearchScreen` when search grew a second source of truth:
// the folding and the haystacks were screen-local, and screens are the one
// place this repo's gate cannot see. Everything here is pure and takes its
// inputs, so a Node process can prove that "banh mi" still finds "Bánh mì"
// and that a synonym the desk typed at midnight cannot break the box.
//
// ── one haystack, three languages, on purpose ──
//
// A place's haystack holds its English, Vietnamese *and* Japanese fields at
// once, and search never reads the reader's UI language. That is not an
// oversight to tidy up later — it is the behaviour. Somebody with the app
// in Vietnamese types "cinema" and "rooftop"; somebody with it in English
// types "pho" and "bun cha". Narrowing the haystack to the interface
// language would break both, and neither reader would ever learn why.
//
// The same rule governs the synonyms below: one flat list per concept,
// languages mixed, never three lists behind a language switch.

import { CATEGORIES, categoriesOf } from './categories';

/** Lowercase, diacritics stripped, đ folded — the shape we match on.
 *
 *  `đ` needs its own rule because it is a distinct letter rather than a
 *  d with a mark on it, so NFD leaves it alone and "da nang" would miss
 *  "Đà Nẵng". */
export function fold(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/** Category key → the words a reader might use for it. */
export type TermMap = Record<string, readonly string[]>;

/**
 * Terms short enough to match half the catalog are dropped.
 *
 * Matching is `includes`, so a two-letter synonym on a category is a
 * category that answers to almost any query. Three is the shortest word
 * that behaves: "bar", "spa", "pho" all work, "an" and "co" do not.
 * Japanese is exempt — 本屋 is a whole word in two characters, and the
 * scripts that write that way have no shorter-is-vaguer problem.
 */
const MIN_TERM = 3;
const CJK = /[぀-ヿ㐀-䶿一-鿿]/;

function usable(term: string): boolean {
  const t = term.trim();
  return t.length >= MIN_TERM || (t.length > 0 && CJK.test(t));
}

/**
 * The shipped synonyms, plus whatever the desk has added since.
 *
 * Union rather than replace, and that is the whole safety story: the
 * defaults live in the app and work with no network and no desk, and the
 * table can only ever *add*. An editor who empties a row, or a fetch that
 * comes back empty, costs nothing — search falls back to the day it
 * shipped rather than to nothing.
 *
 * Deduplicated on the folded form, so "Rạp phim" typed over an existing
 * "rap phim" does not double the haystack.
 */
export function mergeTerms(base: TermMap, extra: TermMap | null | undefined): TermMap {
  const out: Record<string, string[]> = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(extra ?? {})])) {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const term of [...(base[key] ?? []), ...(extra?.[key] ?? [])]) {
      const folded = fold(term).trim();
      if (!usable(folded) || seen.has(folded)) continue;
      seen.add(folded);
      list.push(folded);
    }
    out[key] = list;
  }
  return out;
}

/** The fields of a place a query is tested against. Structural rather than
 *  `Place` for the reason the rest of `lib` is: Node has to run it. */
export type Searchable = {
  name_en?: string | null; name_vi?: string | null; name_ja?: string | null;
  neighborhood_en?: string | null; neighborhood_vi?: string | null; neighborhood_ja?: string | null;
  desc_en?: string | null; desc_vi?: string | null; desc_ja?: string | null;
  address?: string | null;
  vibe_tags?: string[] | null;
  categories?: string[] | null;
  category?: string;
};

/**
 * Everything about a place a query may match, folded into one string.
 *
 * Category keys carry their labels in every language — so "bảo tàng" and
 * "heritage" reach the same places — and now their synonyms too. The
 * synonyms are why "cinema" finds a multiplex whose record does not
 * contain the word: the catalog knows it is `fun`, and `fun` answers to
 * "cinema".
 *
 * The honest limit of that: a synonym belongs to a *category*, so "cinema"
 * returns everything filed as fun, bowling alley included. At two `fun`
 * places that is invisible; at thirty it stops being true, and the fix
 * then is a synonym on the place rather than on its kind — or, better and
 * cheaper, a description, which is what two thirds of this catalog is
 * still missing.
 */
export function placeHaystack(p: Searchable, terms: TermMap = {}): string {
  const cats = categoriesOf(p);
  return fold([
    p.name_en, p.name_vi, p.name_ja,
    p.neighborhood_en, p.neighborhood_vi, p.neighborhood_ja,
    p.desc_en, p.desc_vi, p.desc_ja,
    (p.vibe_tags ?? []).join(' '),
    cats.flatMap((c) => {
      const cat = CATEGORIES[c];
      return cat ? [c, cat.en, cat.vi, cat.ja] : [c];
    }).join(' '),
    p.address,
  ].join(' '))
    // Appended already folded, so a term the desk typed with diacritics
    // still meets a query that arrives without them.
    + ' ' + cats.flatMap((c) => terms[c] ?? []).join(' ');
}

export type SearchableCollection = {
  title_en?: string | null; title_vi?: string | null; title_ja?: string | null;
  desc_en?: string | null; desc_vi?: string | null; desc_ja?: string | null;
  curator_handle?: string | null;
};

export function collectionHaystack(c: SearchableCollection): string {
  return fold([
    c.title_en, c.title_vi, c.title_ja,
    c.desc_en, c.desc_vi, c.desc_ja, c.curator_handle,
  ].join(' '));
}

/** The query, as the tokens every one of which must land somewhere.
 *
 *  Split on whitespace, which is the right rule for two of the three
 *  languages and a no-op for the third: Japanese arrives as a single token
 *  and matches as a substring, so a haystack holding 映画館 answers a query
 *  for 映画 — the reason a stored term should be the fuller word. */
export function queryTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Every word must appear somewhere — "cafe saigon" narrows, not widens. */
export function matches(haystack: string, terms: readonly string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}
