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
import { type I18nDoc, allLocalized } from './localized';

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
    // Every dash is one dash. The catalog writes an en dash between a
    // name and its suffix (`docs/place-naming.md`), and no phone keyboard
    // offers one without a long press: a reader types "lertermer - ham
    // nghi" and must land on `Lertermer Coffee – Hàm Nghi`. Hyphen, non-
    // breaking hyphen, figure dash, en dash, em dash, horizontal bar.
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
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
  /** Every language past EN and VI — see `lib/localized`. */
  i18n?: I18nDoc | null;
  address?: string | null;
  vibe_tags?: string[] | null;
  categories?: string[] | null;
  category?: string;
  /** Google's figures, read only to break a tie in `rankHits`. */
  rating?: number | null;
  rating_count?: number | null;
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
  const built = fold(placeText(p));
  haystacks.set(p, built);
  return built;
}

/** What `placeHaystack` folds, as written. */
function placeText(p: Searchable): string {
  return [
    ...allLocalized(p, 'name'),
    ...allLocalized(p, 'neighborhood'),
    ...allLocalized(p, 'desc'),
    (p.vibe_tags ?? []).join(' '),
    categoryWords(p),
    p.address,
  ].join(' ');
}

/** `placeText`'s words as written, remembered as the haystack is. */
const writtenWords = new WeakMap<object, readonly string[]>();
function placeWords(p: Searchable): readonly string[] {
  const cached = writtenWords.get(p);
  if (cached !== undefined) return cached;
  const built = wordsAsWritten(placeText(p));
  writtenWords.set(p, built);
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
 * How well a place answers what was typed, highest first. Only ever asked
 * of a place `matches` already let through: this orders, it never filters.
 *
 * Until 20 Oct 2026 the hits came back in catalog order — slug, A to Z —
 * so a word anywhere counted as much as the name. "tan hien" put Hap Hap
 * Riverside Kitchen above Tán Hiên Đà Lạt: Hap Hap's description has a
 * house "giữa tán cây" and an oven "ngoài hiên", two words forty letters
 * apart, and "hap" sorts before "tan". The owner asked for the name first.
 *
 * Where the words landed, best first:
 *
 *   5  a name begins with the whole query       "tan hien" → Tán Hiên Đà Lạt
 *   4  a name holds the whole query, in order   "da lat"   → Tán Hiên Đà Lạt
 *   3  a name holds every word, any order       "hien tan"
 *   2  every word is in a name, the area, a category or a vibe
 *   1  only the description or the address had some of them
 *
 * Inside a tier, two smaller things: the whole query standing together
 * somewhere rather than spread across a paragraph (what tells Hap Hap's
 * "tán … hiên" apart from a description that says "tán hiên"), and, when
 * the reader typed marks, finding them as typed. Since 22 Oct 2026 a word
 * typed with marks only matches those marks or a word written bare
 * (`marksAgree`), so this bonus no longer tells "tán" from "tân" — "tân"
 * is not let through — but it still puts "Phở Thìn" above a "Pho Ngoc"
 * written without them.
 *
 * Neither crosses a tier: a description that happens to say the phrase
 * stays under a place named by it. The bonuses are 2 and 1 inside a step
 * of 4 for that reason.
 */
export function relevance(p: Searchable, query: string): number {
  const words = queryTerms(query);
  const phrase = words.join(' ');
  const names = allLocalized(p, 'name').map(fold);
  let tier = 1;
  if (names.some((n) => n.startsWith(phrase))) tier = 5;
  else if (names.some((n) => atWordStart(n, phrase))) tier = 4;
  else if (names.some((n) => matches(n, words))) tier = 3;
  else if (matches(factsHaystack(p), words)) tier = 2;
  const together = matches(placeHaystack(p), [phrase]) ? 2 : 0;
  return tier * 4 + together + (asTyped(p, query) ? 1 : 0);
}

/** Its names, its area, its kinds and its vibes — what the place *is*,
 *  without what is said about it. */
function factsHaystack(p: Searchable): string {
  return fold([
    ...allLocalized(p, 'name'),
    ...allLocalized(p, 'neighborhood'),
    (p.vibe_tags ?? []).join(' '),
    categoryWords(p),
  ].join(' '));
}

/** A place's categories as words: each key, and its label in every
 *  language. */
function categoryWords(p: Searchable): string {
  return categoriesOf(p).flatMap((c) => {
    const cat = CATEGORIES[c];
    return cat ? [c, cat.en, cat.vi, cat.ja, cat.zh, cat.hant] : [c];
  }).join(' ');
}

/** Lowercase and composed, marks kept: the reader's own spelling. */
const marked = (s: string) => s.normalize('NFC').toLowerCase();

/**
 * ── a word typed with marks means those marks (owner, 22 Oct 2026) ──
 *
 * Folding lets a reader with no Vietnamese keyboard type "pho" and reach
 * "Phở". It also made "phở" reach every "phố" (street), "phòng" (room)
 * and "phong" (style) in the catalog, since all of them fold to "pho":
 * 222 published places answered "phở" and 16 had it, 13 of the 222 in
 * Melbourne, which has no phở at all. Measured on the live catalog the
 * day the owner typed it.
 *
 * So a word typed with marks must find a word written with the same
 * marks, from its start — or a word written with none at all that folds
 * to it whole. The second half is for a place written without marks, as
 * Google often hands a name over: two of the 16 were "Pho 10 Ly Quoc Su"
 * and "Pho Ngoc" until the desk wrote them properly the same day, and the
 * next one must not drop out of "phở" while it waits for the same. Whole,
 * so "phong" and "photo", which carry no marks either, do not come back
 * in by that door.
 *
 * Compared decomposed, so a word half typed still begins the word it is
 * on its way to: Telex reaches "phở" through "phơ", and "phơ" does not
 * begin "phở" until both are taken apart into letter and marks.
 *
 * A word typed bare folds as it always has: whoever typed "pho" may mean
 * either, and the name tier ranks the "Phở" ones first.
 */
function hasMarks(w: string): boolean {
  return /[\u0300-\u036f]/.test(w.normalize('NFKD')) || /đ/i.test(w);
}

/** A text's words, lowercase and decomposed, marks kept. */
function wordsAsWritten(text: string): string[] {
  return text.normalize('NFD').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

/** The words of the query typed with marks, as `wordsAsWritten` has them. */
function markedTerms(query: string): string[] {
  return wordsAsWritten(query).filter(hasMarks);
}

/** Does every word typed with marks find itself among `words`? */
function marksAgree(words: readonly string[], typed: readonly string[]): boolean {
  return typed.every((w) => {
    const bare = fold(w);
    return words.some((t) => t.startsWith(w) || (fold(t) === bare && !hasMarks(t)));
  });
}

/** Did the reader type marks, and does the place carry every marked word
 *  exactly so? A query with no marks says nothing either way. */
function asTyped(p: Searchable, query: string): boolean {
  const typed = marked(query).split(/\s+/).filter(Boolean);
  const markedWords = typed.filter((w) => fold(w) !== w);
  if (!markedWords.length) return false;
  const text = marked([
    ...allLocalized(p, 'name'), ...allLocalized(p, 'neighborhood'), ...allLocalized(p, 'desc'), p.address,
  ].join(' '));
  return markedWords.every((w) => text.includes(w));
}

/**
 * The hits in the order a reader should meet them: `relevance` first,
 * then the better-rated, then the more-rated, then as they arrived — a
 * stable sort, so the catalog's own order (the reader's suggestions
 * first, then by slug) still settles a true tie.
 *
 * Rating only breaks ties, and never across a tier: a 5.0 from three
 * reviews is not a reason to put a description match over a name.
 */
export function rankHits<T extends Searchable>(hits: readonly T[], query: string): T[] {
  const scored = hits.map((p, i) => ({ p, i, r: relevance(p, query) }));
  scored.sort((a, b) =>
    b.r - a.r
    || (b.p.rating ?? -1) - (a.p.rating ?? -1)
    || (b.p.rating_count ?? -1) - (a.p.rating_count ?? -1)
    || a.i - b.i);
  return scored.map(({ p }) => p);
}

/**
 * The places a query finds, in two tiers.
 *
 * `hits` are places that say the words themselves, best first — see
 * `rankHits`. `related` are places
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
  const typed = markedTerms(query);
  const hits = rankHits(places.filter((p) =>
    matches(placeHaystack(p), words) && (!typed.length || marksAgree(placeWords(p), typed))), query);
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
  return fold(members.map((m) => allLocalized(m, 'name').join(' ')).join(' '));
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
  c: SearchableCollection, members: readonly Searchable[], terms: readonly string[], query = '',
): boolean {
  const bare = terms.map((t) => t.replace(/^@/, ''));
  if (!matches(`${collectionHaystack(c)} ${memberNames(members)}`, bare)) return false;
  // The places' rule for marks (`marksAgree`): "phở" is not answered by a
  // list whose blurb walks down a "phố".
  const typed = markedTerms(query);
  if (!typed.length) return true;
  const text = [
    c.title_en, c.title_vi, c.title_ja, c.desc_en, c.desc_vi, c.desc_ja, c.curator_handle,
    ...members.flatMap((m) => allLocalized(m, 'name')),
  ].join(' ');
  return marksAgree(wordsAsWritten(text), typed);
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
  return pairs.filter(({ c, members }) => collectionMatches(c, members, terms, query)).map(({ c }) => c);
}

/**
 * A member as the Collections screen sifts it: its names, and the two
 * facts a chip can ask about. `city_name` is the words a reader types
 * for the city — the screen passes the localized short name, so "da
 * nang" lands on a list of Da Nang places the way it lands on a visit.
 */
export type SiftMember = Searchable & {
  city_id?: string | null;
  city_name?: string | null;
};

export type CollectionSift = {
  query: string;
  /** A city id, or null for no narrowing. */
  city: string | null;
  /** A category key, or null for no narrowing. */
  kind: string | null;
};

/**
 * One listed collection and why it is listed — the figures the card
 * prints under its name when the shelf is narrowed.
 */
export type CollectionHit<C> = {
  c: C;
  /** Members that satisfy the chips, and the words when the words landed
   *  on members rather than on the list itself. */
  hits: number;
  total: number;
  /** The first member the words landed on, when the list's own words did
   *  not — "MONO Coffee Lab", the one thing a reader could not
   *  tell from the card. Null when the list was found by its own words
   *  or there were none. */
  place: SiftMember | null;
};

function memberHaystack(m: SiftMember): string {
  return fold(`${allLocalized(m, 'name').join(' ')} ${m.city_name ?? ''}`);
}

/**
 * The collections a query and two chips find, each with its reason.
 *
 * The question has two halves that the old `findCollections` folded
 * into one: whether the list is listed, and — new with the chips — how
 * much of it the reader's choice reaches. A chip is a question about
 * *places*: "Cafés" lists a collection for the cafés inside it, so a
 * list named "Cà phê" with no café in it is not listed under that chip,
 * and the count the card prints is of members, never of lists.
 *
 * The words keep their old rule for *whether* (every term lands
 * somewhere on the list's own words, its curator, or its members'
 * names and cities — `collectionMatches`, widened by the city), and
 * gain one for *why*: when none of
 * them landed on the list's own words, the members they landed on are
 * the hits, and the first is named. A word that landed on the title
 * reaches every member the chips leave, since the reader asked for the
 * list, not for a place in it.
 *
 * Order, when anything is asked: lists found by their own words first,
 * then by hits, most first; ties keep the order they arrived in, which
 * the caller ranked by likes. Nothing asked, nothing reordered.
 */
export function siftCollections<C extends SearchableCollection>(
  pairs: readonly { c: C; members: readonly SiftMember[] }[], sift: CollectionSift,
): CollectionHit<C>[] {
  const terms = queryTerms(sift.query);
  const bare = terms.map((t) => t.replace(/^@/, ''));
  const narrowed = !!(sift.city || sift.kind);
  const asked = narrowed || terms.length > 0;
  const chipPass = (m: SiftMember) =>
    (!sift.city || m.city_id === sift.city) && (!sift.kind || (m.categories ?? []).includes(sift.kind));
  const out: (CollectionHit<C> & { byTitle: boolean })[] = [];
  pairs.forEach(({ c, members }) => {
    // `collectionMatches`' rule with the members' cities in the haystack
    // too, so that "da nang" lands on a list of Da Nang places.
    const whole = `${collectionHaystack(c)} ${members.map(memberHaystack).join(' ')}`;
    if (terms.length && !matches(whole, bare)) return;
    const byTitle = terms.length > 0 && matches(collectionHaystack(c), bare);
    const onWords = (m: SiftMember) => {
      const hay = memberHaystack(m);
      return bare.some((term) => matches(hay, [term]));
    };
    const hit = members.filter((m) => chipPass(m) && (byTitle || !terms.length || onWords(m)));
    if (narrowed ? hit.length === 0 : !(byTitle || !terms.length || hit.length > 0)) return;
    out.push({
      c, hits: hit.length, total: members.length, byTitle,
      // Found through a place, there is always a first hit: the empty
      // case returned a line above.
      place: terms.length && !byTitle ? hit[0] : null,
    });
  });
  if (asked) {
    // Stable: equal keys keep their arrival order.
    out.sort((a, b) => Number(b.byTitle) - Number(a.byTitle) || b.hits - a.hits);
  }
  return out.map(({ byTitle: _, ...hit }) => hit);
}

/** Distinct values across every member, most frequent first — the chips
 *  a shelf can offer, so that no chip leads to an empty shelf. */
function byFrequency(values: readonly string[]): string[] {
  const count = new Map<string, number>();
  values.forEach((v) => count.set(v, (count.get(v) ?? 0) + 1));
  return [...count.keys()].sort((a, b) => count.get(b)! - count.get(a)!);
}
export function collectionCities(pairs: readonly { members: readonly SiftMember[] }[]): string[] {
  return byFrequency(pairs.flatMap(({ members }) => members.map((m) => m.city_id).filter((c): c is string => !!c)));
}
export function collectionKinds(pairs: readonly { members: readonly SiftMember[] }[]): string[] {
  return byFrequency(pairs.flatMap(({ members }) => members.flatMap((m) => m.categories ?? [])));
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
