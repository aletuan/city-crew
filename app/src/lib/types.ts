// The shapes the catalog comes back in.
//
// Their own module because they have no dependencies and everything else
// does: `data.ts` reaches for Supabase at import time, which drags React
// Native in behind it. Anything that wants these types in a plain Node
// process — the tests, chiefly — can have them from here.
//
// `data.ts` re-exports all of this, so no call site needs to know.

export type PlacePhoto = {
  /** Row id, for pointing at a photo — a collection's chosen cover names
   *  one. Optional because rows hydrated from a launch cache written
   *  before the column joined the query arrive without it; a fresh fetch
   *  always carries it. */
  id?: string;
  photo_uri: string;
  is_cover: boolean;
  is_hidden: boolean;
  sort_order: number;
  attribution_name: string | null;
};

export type Place = {
  slug: string;
  name_en: string;
  name_vi: string;
  name_ja: string | null;
  /** Which city this is in. Long a filter and nothing else — a place only
   *  ever arrived through its own city's query, so it never had to say.
   *  Collections reach across cities now, so a place travelling inside one
   *  does. Optional because a legacy query path still omits it; read it
   *  through `touchesCity`. */
  city_id?: string | null;
  /** Legacy coarse axis, superseded by `categories`; still written by the
   *  import pipeline and used by the dashboard. */
  category: 'food' | 'out';
  /** Functional axis, many per place — see lib/categories. Optional because
   *  a database that predates the migration simply omits it; read it through
   *  categoriesOf(), never directly. */
  categories?: string[];
  is_featured: boolean;
  /** The two gates that decide whether anyone but the submitter can see
   *  this. Optional because a database that predates the submissions
   *  migration omits them; read through `isLive`, never directly. */
  is_published?: boolean;
  review_status?: string;
  /** Who suggested it, when it did not come from the desk. */
  submitted_by?: string | null;
  /** Google's identity for the row, on every import and every seed. The
   *  Maps links ride on it — a name plus this id resolves the exact
   *  business, where a name alone lets Google pick a same-named branch
   *  across town. Optional for the same reason its neighbours are: a
   *  stub or an old fixture without it must still typecheck, and the
   *  links fall back to coordinates when it is absent. */
  google_place_id?: string | null;
  /** How a place feels — see lib/vibes. */
  vibe_tags: string[];
  neighborhood_en: string | null;
  neighborhood_vi: string | null;
  neighborhood_ja: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  rating_count: number | null;
  price_display: string | null;
  price_vnd: number | null;
  duration_min: number | null;
  duration_max: number | null;
  desc_en: string | null;
  desc_vi: string | null;
  desc_ja: string | null;
  emoji: string | null;
  opening_hours: string[] | null;
  website: string | null;
  phone: string | null;
  place_photos: PlacePhoto[];
  /**
   * When the row was written. Optional, because most of the app never
   * reads it and the test fixtures should not have to invent a timestamp
   * to construct a place. The same caveat Collection's copy carries
   * applies here: on the seeded rows this is the instant the catalog was
   * loaded, not when anywhere opened — which is exactly why "recently
   * added" reads it and nothing ranks on it alone. See `lib/newest.ts`.
   */
  created_at?: string | null;
};

export type Collection = {
  slug: string;
  title_en: string;
  title_vi: string;
  title_ja: string | null;
  desc_en: string | null;
  desc_vi: string | null;
  desc_ja: string | null;
  curator_handle: string | null;
  /** The chosen cover photograph, when the owner (or the desk) picked
   *  one; null falls back to the first place's own cover. `id` optional
   *  for the same launch-cache reason as PlacePhoto.id. */
  cover: { id?: string; photo_uri: string } | null;
  collection_places: { sort_order: number; places: { slug: string } | null }[];
  /** Null on the editorial collections — those belong to the desk. Set to a
   *  user's id on the lists they made for themselves. */
  owner_id?: string | null;
  /** Whether everyone in the city can see it. Always true on the rows the
   *  public query returns, so it is only worth reading on your own — where
   *  it is the difference between a private list and a published one. */
  is_public?: boolean;
  /** Which city's catalog this belongs to. Meaningful for the editorial
   *  rows; on a user's own list it records where it was made and nothing
   *  more — a list of your own is not confined to one city. */
  city_id?: string | null;
  /**
   * The member places, carried by the row itself.
   *
   * Only the owner query fills this, and it is the whole reason a personal
   * list survives a change of city: `membersOf` otherwise resolves slugs
   * against the in-memory catalog, which holds one city at a time. Your
   * lists are yours; the city boundary is the catalog's problem.
   */
  members?: Place[];
  /**
   * The row's own id, which the shelf needs and the screens do not.
   *
   * Everything user-facing keys on `slug`; this is here because a like
   * points at `collections.id`, and a slug would have meant a second
   * lookup on every tap. It is not an invitation to key anything else on
   * it.
   */
  id?: string;
  /**
   * When the row was written — and on the seeded rows, when the column was
   * added, which is not the same thing and is why it cannot be the only
   * key the shelf sorts on. See `lib/likes.ts`.
   */
  created_at?: string | null;
  /** The desk's sequence. Null on anything a reader made. */
  sort_order?: number | null;
};
