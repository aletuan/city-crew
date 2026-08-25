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
 *  d with a mark on it, so decomposition leaves it alone and "da nang"
 *  would miss "Đà Nẵng".
 *
 *  ── NFKD, not NFD ──
 *
 *  NFD is canonical decomposition and does not touch styled characters: a
 *  mathematical bold `𝐜` is not a `c` with something added, it is its own
 *  codepoint that looks like one. Businesses name themselves in those and
 *  Google hands the name over verbatim, so the catalog holds a café
 *  called `𝐂𝐫𝐮𝐦𝐛𝐬 𝐀𝐫𝐭𝐞𝐥𝐢𝐞𝐫` — and typing "crumbs" found nothing, because
 *  the folded haystack still held the styled letters while the folded
 *  needle held plain ones.
 *
 *  NFKD is the compatibility form that maps them back, and it leaves
 *  Vietnamese exactly where NFD left it. Fixing it here rather than
 *  rewriting the stored name is the smaller change and the more honest
 *  one: the name on the sign really is styled, and search is what has to
 *  see past it. */
export function fold(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFKD')
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
 * Built once per place, then remembered.
 *
 * A haystack costs a dozen string joins and a Unicode normalisation, and
 * the search box asked for one hundred and fifty-five of them on every
 * keystroke — the same hundred and fifty-five, because a place's own words
 * do not change while somebody types. Six letters of "ca phe" rebuilt the
 * whole catalog six times over, on the thread the keyboard draws on.
 *
 * Keyed on the object, so it is correct without a version to invalidate:
 * the catalog hands out new place objects on every fetch, and a new object
 * simply misses. Weak, so a refetch's worth of old strings is collected
 * rather than held.
 *
 * The one way to be wrong is to mutate a place in place. Nothing does —
 * `useFetch` replaces the array — and this comment is here so that stays
 * true.
 */
const haystacks = new WeakMap<object, string>();

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
  const cached = haystacks.get(p);
  if (cached !== undefined) return cached;
  const built = fold([
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
  haystacks.set(p, built);
  return built;
}

/**
 * Does this place's *kind* answer to what was typed?
 *
 * Kept apart from the haystack above, and that separation is the whole
 * design. A synonym belongs to a category, not to a place: `fun` answers
 * to "cinema", "bowling" and "karaoke" alike, so folding them in beside a
 * place's own words makes a multiplex an answer to "bowling" and — far
 * worse on a category with twenty-six places in it — makes every temple an
 * answer to "museum". That was measured, not feared: the first cut of this
 * feature did exactly that.
 *
 * ── whole phrase, not tokens ──
 *
 * The query is compared *entire* against each term, where the exact tier
 * splits it into words. That difference was also measured. Tokenised, the
 * Vietnamese term "quán ăn" breaks into "quan" and "an", and both are
 * substrings of the café list's "quán cà phê" — so a search for somewhere
 * to eat came back with cafés. Short fragments of multi-word terms match
 * almost anything; the phrase they came from does not.
 *
 * ── from the start of a word, not from anywhere ──
 *
 * The query has to begin a term or begin one of its words. Matching a
 * substring anywhere was tried and is too loose across languages: "đền"
 * folds to "den", which sits inside "garden", so a search for a temple
 * came back with a lake. Prefixes are also what a search box means — it is
 * how the answer narrows as somebody types, and "cine" still reaches
 * "cinema".
 *
 * Only that direction. "movies" does not reach "movie", and the fix for
 * that is the desk adding the word it watched somebody type, which is what
 * the dashboard page is for.
 *
 * Word-splitting on spaces suits the two languages that use them and is a
 * no-op for the third: 映画館 has no spaces, and the whole-term prefix
 * check answers 映画 anyway.
 */
export function kindAnswersTo(p: Searchable, query: string, terms: TermMap): boolean {
  const q = query.trim();
  if (!q) return false;
  const answers = (t: string) => t.startsWith(q) || t.split(' ').some((w) => w.startsWith(q));
  return categoriesOf(p).some((c) => (terms[c] ?? []).some(answers));
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
 *
 * Takes the raw box rather than tokens, because the two tiers read it
 * differently: words for the exact pass, the whole phrase for the guess.
 * See `kindAnswersTo`.
 */
export function findPlaces<T extends Searchable>(
  places: readonly T[], query: string, terms: TermMap,
): { hits: T[]; related: T[] } {
  const words = queryTerms(query);
  if (!words.length) return { hits: [], related: [] };
  const hits = places.filter((p) => matches(placeHaystack(p), words));
  if (hits.length) return { hits, related: [] };
  const phrase = fold(query).trim();
  return { hits, related: places.filter((p) => kindAnswersTo(p, phrase, terms)) };
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

/**
 * The names of what a collection holds — and only the names.
 *
 * A member's full haystack would be too loose by exactly the measured
 * synonym mistake above: every member carries its description and its
 * category words, so "quiet" would answer with any list holding one
 * calm café, and a query for a *place* would light up lists for words
 * no curator chose. The question this answers is "which lists have this
 * place", and a place is asked for by name.
 */
function memberNames(members: readonly Searchable[]): string {
  return fold(members.map((m) => [m.name_en, m.name_vi, m.name_ja].join(' ')).join(' '));
}

/**
 * Does a query land on this collection — its own words, its curator, or
 * the names of the places in it?
 *
 * The leading `@` is stripped from each term because handles are typed
 * both ways — "@minh" from somebody quoting a byline, "minh" from
 * somebody remembering it — and the stored handle is bare.
 *
 * No haystack cache here, deliberately: the catalog holds a few dozen
 * collections against a few hundred places, and the pair objects are
 * rebuilt per render anyway, so a WeakMap would miss every time.
 */
export function collectionMatches(
  c: SearchableCollection, members: readonly Searchable[], terms: readonly string[],
): boolean {
  const bare = terms.map((t) => t.replace(/^@/, ''));
  return matches(`${collectionHaystack(c)} ${memberNames(members)}`, bare);
}

/**
 * The collections a query finds, in the order they arrived — the caller
 * ranked them (by likes, on every shelf) and a filter has no opinion.
 *
 * An empty or blank query is no filter at all: the whole list comes
 * back, which is what a search box with nothing in it means.
 */
export function findCollections<C extends SearchableCollection>(
  pairs: readonly { c: C; members: readonly Searchable[] }[], query: string,
): C[] {
  const terms = queryTerms(query);
  if (!terms.length) return pairs.map(({ c }) => c);
  return pairs.filter(({ c, members }) => collectionMatches(c, members, terms)).map(({ c }) => c);
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

/** A letter or digit after folding — the stuff words are made of. Anything
 *  else is an edge a word can start after: the space in "van bao", the
 *  hyphen in "deep sii - van bao", the underscore in "kid_friendly". */
const WORD_CHAR = /[a-z0-9]/;

/**
 * Does the term begin a word of the haystack?
 *
 * Anywhere-inside was the shipped rule, and it had the same hole across
 * languages that `kindAnswersTo` documents having fixed for synonyms:
 * "đền" folds to "den", which sits inside "garden", so a search for a
 * temple answered with anything leafy enough to mention one. The exact
 * tier kept the loose rule longer only because nobody had measured it
 * there too.
 *
 * A word start is also where typing begins, so nothing a person actually
 * does gets slower: "caf" still reaches "café", "hok" still reaches
 * "Sushi Hokkaido". What stops matching is the middle of a word — and the
 * middle of a word is not a thing anybody types on purpose.
 *
 * The scan keeps going past a mid-word hit rather than judging only the
 * first: "garden of den tran" really does contain a word starting "den",
 * three characters after a hit that does not.
 */
function atWordStart(haystack: string, term: string): boolean {
  for (let i = haystack.indexOf(term); i !== -1; i = haystack.indexOf(term, i + 1)) {
    if (i === 0 || !WORD_CHAR.test(haystack[i - 1])) return true;
  }
  return false;
}

/** Every word must appear somewhere — "cafe saigon" narrows, not widens.
 *
 *  Each word must begin a word of the haystack, except a CJK term, which
 *  stays a plain substring: 映画館 has no word edges for 映画 to start at,
 *  and the scripts that write without spaces are the same ones `usable`
 *  already exempts from the length rule. */
export function matches(haystack: string, terms: readonly string[]): boolean {
  return terms.every((term) => (CJK.test(term) ? haystack.includes(term) : atWordStart(haystack, term)));
}
