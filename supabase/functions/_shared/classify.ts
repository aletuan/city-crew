// What a place is, from what Google says it is.
//
// Until this existed, `importPlace` wrote `categories: []` and
// `vibe_tags: []` for everything that did not arrive through a curated
// scan — which is to say for every place a reader suggested and every one
// an editor imported by hand. A hundred and two of them have been filed by
// hand since. That is the work this removes.
//
// ── what this is not ──
//
// It is not a decision. Every import lands `is_published: false,
// review_status: 'pending'`, so the desk already opens each one; this fills
// the form in rather than replacing the person reading it. That distinction
// is load-bearing: an audit of the catalog found twenty categories wrong,
// including two bookshops filed under culture that belonged under markets,
// and a lookup table is no less capable of that mistake than a person is.
//
// ── silence is an answer ──
//
// A type this table does not know returns nothing, and `needs_classification`
// stays true so the desk still sees the row. Guessing would be worse than
// leaving it blank: a wrong category is invisible once it is filled in,
// while an empty one asks to be looked at.
//
// ── the one category deliberately absent ──
//
// `focus` — "work, study, laptop, wifi, quiet, ngồi lâu" — is never
// emitted. Google has no type that means "you can sit here for three hours
// with a laptop"; it is a judgement about a room, not a fact about a
// business. `library` was considered and rejected: a library is quiet, but
// this category exists for cafés you can work in, and the whole point of
// the table below is that it only says what it actually knows.

/** The functional axis, mirrored from `app/src/lib/categories.ts`. The two
 *  lists have to agree — see `classify.test.ts`, which asserts it. */
export const CATEGORY_KEYS = [
  'cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife', 'focus', 'fun',
] as const;

/** How a place feels, mirrored from `app/src/lib/vibes.ts`. */
export const VIBE_KEYS = [
  'cafes', 'food_tour', 'nightlife', 'views', 'culture', 'outdoors', 'chill', 'shopping',
  // Suitability — kid_friendly, romantic, quiet. Listed because the
  // mirror test walks this list against the app's, and never emitted for
  // the same reason `chill` never is: each is a judgement about a room,
  // which Google's types cannot make and the desk can. `VIBE_OF` below
  // deliberately maps no category to any of them.
  'kid_friendly', 'romantic', 'quiet',
] as const;

/**
 * Google place type → our category.
 *
 * Only types whose meaning is unambiguous. Google's list is much longer;
 * everything omitted is omitted on purpose, either because it says nothing
 * about how a visitor would use the place (`point_of_interest`,
 * `establishment`, `food`) or because it spans several of our categories at
 * once (`tourist_attraction` covers a pagoda, a viewpoint and a water park).
 *
 * Exported for one reason: a test walks every entry and asserts the value
 * is a real category key. A typo — `market` for `markets` — would otherwise
 * write a category nothing in the app can render, silently, on whichever
 * kind of place happened to hit that row.
 */
export const BY_TYPE: Record<string, string> = {
  // ── cafés ──
  cafe: 'cafes',
  coffee_shop: 'cafes',
  cat_cafe: 'cafes',
  dog_cafe: 'cafes',
  tea_house: 'cafes',
  bakery: 'cafes',
  dessert_shop: 'cafes',
  dessert_restaurant: 'cafes',
  ice_cream_shop: 'cafes',
  juice_shop: 'cafes',
  donut_shop: 'cafes',
  bagel_shop: 'cafes',
  confectionery: 'cafes',
  chocolate_shop: 'cafes',

  // ── eating ──
  // The cuisine-specific types all mean the same thing to us: somewhere you
  // sit down and eat. Listed rather than pattern-matched on `_restaurant`,
  // because that suffix would also swallow `dessert_restaurant` above, and
  // a dessert place belongs with the cafés on this shelf.
  restaurant: 'eats',
  fine_dining_restaurant: 'eats',
  vietnamese_restaurant: 'eats',
  japanese_restaurant: 'eats',
  sushi_restaurant: 'eats',
  ramen_restaurant: 'eats',
  korean_restaurant: 'eats',
  chinese_restaurant: 'eats',
  thai_restaurant: 'eats',
  indian_restaurant: 'eats',
  italian_restaurant: 'eats',
  french_restaurant: 'eats',
  mexican_restaurant: 'eats',
  american_restaurant: 'eats',
  asian_restaurant: 'eats',
  mediterranean_restaurant: 'eats',
  middle_eastern_restaurant: 'eats',
  seafood_restaurant: 'eats',
  steak_house: 'eats',
  barbecue_restaurant: 'eats',
  hamburger_restaurant: 'eats',
  pizza_restaurant: 'eats',
  sandwich_shop: 'eats',
  breakfast_restaurant: 'eats',
  brunch_restaurant: 'eats',
  buffet_restaurant: 'eats',
  vegan_restaurant: 'eats',
  vegetarian_restaurant: 'eats',
  fast_food_restaurant: 'eats',
  food_court: 'eats',
  deli: 'eats',
  diner: 'eats',

  // ── after dark ──
  bar: 'nightlife',
  pub: 'nightlife',
  wine_bar: 'nightlife',
  night_club: 'nightlife',
  bar_and_grill: 'nightlife',
  comedy_club: 'nightlife',

  // ── culture and heritage ──
  museum: 'heritage',
  art_gallery: 'heritage',
  historical_place: 'heritage',
  historical_landmark: 'heritage',
  cultural_landmark: 'heritage',
  monument: 'heritage',
  sculpture: 'heritage',
  performing_arts_theater: 'heritage',
  opera_house: 'heritage',
  concert_hall: 'heritage',
  church: 'heritage',
  hindu_temple: 'heritage',
  mosque: 'heritage',
  synagogue: 'heritage',
  planetarium: 'heritage',

  // ── outdoors ──
  park: 'nature',
  national_park: 'nature',
  state_park: 'nature',
  garden: 'nature',
  botanical_garden: 'nature',
  hiking_area: 'nature',
  picnic_ground: 'nature',
  dog_park: 'nature',
  wildlife_park: 'nature',
  wildlife_refuge: 'nature',
  zoo: 'nature',
  marina: 'nature',
  plaza: 'nature',

  // ── shopping ──
  // The category is keyed `markets` and labelled "Shopping"; both a wet
  // market and a mall live here.
  market: 'markets',
  shopping_mall: 'markets',
  department_store: 'markets',
  supermarket: 'markets',
  grocery_store: 'markets',
  asian_grocery_store: 'markets',
  book_store: 'markets',
  gift_shop: 'markets',
  clothing_store: 'markets',
  jewelry_store: 'markets',
  shoe_store: 'markets',
  home_goods_store: 'markets',
  furniture_store: 'markets',
  // `store` is deliberately absent, and it used to be here.
  //
  // It is not a kind of place, it is Google's parent bucket, and nearly
  // every business that sells anything across a counter carries it —
  // bakeries, cafés with a shelf of beans, restaurants with a shopfront.
  // A tiệm bánh comes back as `["bakery", "store", "food", …]`, so the
  // row four lines up got it right as a café and this one bolted
  // "Shopping" on underneath.
  //
  // Which is the rule this table already states at the top: types are
  // omitted when they say nothing about how a visitor would use the place
  // — `point_of_interest`, `establishment`, `food`. `store` is the same
  // class of word and slipped through anyway.
  //
  // Two places in the catalog wore the mistake: Crumbs Artelier and
  // Caffeinerush Châu Long, both cafés, both carrying `markets`. Its
  // absence costs a genuinely generic shop its pre-fill, and that is the
  // right trade: an empty category asks the desk a question, while a
  // wrong one is an answer nobody thinks to check.

  // ── a view ──
  observation_deck: 'views',

  // ── an outing ──
  movie_theater: 'fun',
  karaoke: 'fun',
  bowling_alley: 'fun',
  video_arcade: 'fun',
  amusement_park: 'fun',
  amusement_center: 'fun',
  water_park: 'fun',
  aquarium: 'fun',
  ferris_wheel: 'fun',
  roller_coaster: 'fun',
  casino: 'fun',
};

/**
 * Category → the vibe that always travels with it.
 *
 * One to one, and short by design. `chill` is not here and is not an
 * oversight: whether somewhere is restful is a judgement about a room, the
 * same kind `focus` asks for, and the curated scan only ever assigned it by
 * an editor's hand. `fun` and `focus` have no vibe that follows from them.
 */
const VIBE_OF: Record<string, string> = {
  cafes: 'cafes',
  eats: 'food_tour',
  nightlife: 'nightlife',
  views: 'views',
  heritage: 'culture',
  nature: 'outdoors',
  markets: 'shopping',
};

/**
 * At most this many categories. A place with several honest types — a
 * rooftop that is a bar and a restaurant — should say so, but a row wearing
 * five chips has stopped telling the reader anything. Measured against the
 * catalog, where the average is 1.23.
 */
export const MAX_CATEGORIES = 3;

export type Classification = { categories: string[]; vibes: string[] };

/** Nothing known. A shared constant so callers can compare against it. */
const NOTHING: Classification = { categories: [], vibes: [] };

/**
 * What Google's types say this place is.
 *
 * `primaryType` is considered first and, when it is recognised, always
 * survives the cap — it is Google's own answer to "what is this, mainly",
 * and a cap that could drop it would be reordering the one field with an
 * opinion. The rest follow in taxonomy order rather than in Google's, so
 * the same place classified twice comes back identical.
 */
export function classify(
  primaryType?: string | null,
  types?: readonly string[] | null,
): Classification {
  const found = new Set<string>();
  const primary = primaryType ? BY_TYPE[primaryType] : undefined;
  if (primary) found.add(primary);
  for (const t of types ?? []) {
    const c = BY_TYPE[t];
    if (c) found.add(c);
  }
  if (!found.size) return NOTHING;

  // Taxonomy order, with the primary type's answer pulled to the front so
  // the cap can never be what removes it.
  const ordered = CATEGORY_KEYS.filter((k) => found.has(k) && k !== primary);
  const categories = (primary ? [primary, ...ordered] : ordered).slice(0, MAX_CATEGORIES);

  const vibes: string[] = [];
  for (const c of categories) {
    const v = VIBE_OF[c];
    if (v && !vibes.includes(v)) vibes.push(v);
  }
  return { categories, vibes };
}
