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
 * Everything the place itself says, folded into one string.
 *
 * Its names, its area, its description, its vibes, its address, and the
 * keys and labels of its categories in every language — so "bảo tàng" and
 * "heritage" reach the same places. Every word here is a fact about *this*
 * place, which is what makes a hit exact.
 *
 * Synonyms are deliberately not in here; see `synonymHaystack`.
 */
export function placeHaystack(p: Searchable): string {
  return fold([
    p.name_en, p.name_vi, p.name_ja,
    p.neighborhood_en, p.neighborhood_vi, p.neighborhood_ja,
    p.desc_en, p.desc_vi, p.desc_ja,
    (p.vibe_tags ?? []).join(' '),
    categoriesOf(p).flatMap((c) => {
      const cat = CATEGORIES[c];
      return cat ? [c, cat.en, cat.vi, cat.ja] : [c];
    }).join(' '),
    p.address,
  ].join(' '));
}

/**
 * The words this place's *kind* is known by — and only those.
 *
 * Kept apart from the haystack above, and that separation is the whole
 * design. A synonym belongs to a category, not to a place: `fun` answers
 * to "cinema", "bowling" and "karaoke" alike, so folding them in beside a
 * place's own words makes a multiplex an answer to "bowling" and — far
 * worse on a category with twenty-six places in it — makes every temple an
 * answer to "museum".
 *
 * That was measured, not feared: the first cut of this feature did exactly
 * that, and it made search worse everywhere the catalog is well filled
 * while fixing it in the one corner that was empty.
 *
 * So these words are a second pass, not a wider first one. See `findPlaces`.
 *
 * Already folded on the way in via `mergeTerms`, so a term the desk typed
 * with diacritics still meets a query that arrives without them.
 */
export function synonymHaystack(p: Searchable, terms: TermMap): string {
  return categoriesOf(p).flatMap((c) => terms[c] ?? []).join(' ');
}

/**
 * The places a query finds, in two tiers.
 *
 * `hits` are places that say the words themselves. `related` are places
 * whose *kind* answers to them — and they are returned **only when there
 * are no hits at all**, because a synonym is a guess about what somebody
 * meant and a guess must never dilute an answer.
 *
 * Search "museum" and you get the museums, not the twenty-six heritage
 * places one of whose synonyms is "museum". Search "cinema" — a word no
 * record in this catalog contains — and you get the multiplexes, because
 * nothing exact existed to protect.
 *
 * The caller must label the second tier as the guess it is; a related
 * place presented as a match is a wrong answer, which is worse than none.
 */
export function findPlaces<T extends Searchable>(
  places: readonly T[], query: readonly string[], terms: TermMap,
): { hits: T[]; related: T[] } {
  if (!query.length) return { hits: [], related: [] };
  const hits = places.filter((p) => matches(placeHaystack(p), query));
  if (hits.length) return { hits, related: [] };
  return { hits, related: places.filter((p) => matches(synonymHaystack(p, terms), query)) };
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
