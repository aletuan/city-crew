// Shared Google Places import logic for fetch-place (single import) and
// scan-city (batch import): details fetch → unique slug → place row + photos.

import { classify } from "./classify.ts";

export const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Representative VND per Google price level, so every import speaks the
// same "150k₫" language as the curated seed data instead of "₫₫" glyphs.
// Rough by design — editors refine the number during review.
export const PRICE_LEVEL_VND: Record<number, number> = {
  1: 50000,
  2: 150000,
  3: 300000,
  4: 500000,
};

/**
 * A slug from Google's display name.
 *
 * ── NFKD, not NFD, and that is the whole of it ──
 *
 * NFD is *canonical* decomposition: it separates the marks off Vietnamese
 * letters, which is what this needs it for. It does not touch styled
 * characters, because a mathematical bold `𝐂` is not an `C` with
 * something added — it is its own codepoint that merely looks like one.
 *
 * Businesses name themselves in those. Google returns the styled name
 * verbatim and this function used to strip every character of it, hit the
 * `|| "place"` at the end, and write that as the row's key. One place in
 * the catalog is called `place` for exactly this reason: `𝐂𝐫𝐮𝐦𝐛𝐬
 * 𝐀𝐫𝐭𝐞𝐥𝐢𝐞𝐫`, which is Mathematical Bold throughout.
 *
 * That is worse than an ugly slug. The slug is the app's key everywhere —
 * deep links, `usePlaceBySlug`, collection membership, the planner's
 * tie-break — and the *next* unslugifiable import collides with it, at
 * which point the fallback below starts minting `place-hanoi` and
 * `place-12`.
 *
 * NFKD is *compatibility* decomposition, which is the one that maps those
 * back. Measured on real names:
 *
 *   𝐂𝐫𝐮𝐦𝐛𝐬 𝐀𝐫𝐭𝐞𝐥𝐢𝐞𝐫   place      →  crumbs-artelier
 *   ３Ｃ Roastery       roastery   →  3c-roastery      (fullwidth digits)
 *   ﬁnest Café         nest-cafe  →  finest-cafe      (ﬁ ligature)
 *   Đông Đô            dong-do    →  dong-do          (unchanged)
 *   Mai Hỷ tea         mai-hy-tea →  mai-hy-tea       (unchanged)
 *
 * Vietnamese is untouched: its diacritics are canonical, so both forms
 * decompose them identically. What NFKD adds is precisely the styled
 * layer, which is precisely what was being lost.
 *
 * The `Đ` line stays and has to: `Đ`/`đ` is a letter with a stroke rather
 * than a base plus a mark, so no normalisation form takes it apart.
 */
export const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "place";

// Curated scan queries, one per category. {en} / {vi} interpolate the city's
// name_en / name_vi — Vietnamese phrasing where it surfaces better local
// results. vibes ⊂ the global VIBES taxonomy; categories ⊂ the functional
// taxonomy enforced by the places_categories_known constraint. A query knows
// what it went looking for, so the import writes it down rather than leaving
// the classification to be guessed back out later.
export const SCAN_CATEGORIES = [
  { key: "cafes", label_en: "Cafés", label_vi: "Quán cà phê", category: "food", vibes: ["cafes"], categories: ["cafes"], q: "best specialty coffee shops in {en}" },
  { key: "street_food", label_en: "Street food", label_vi: "Ẩm thực đường phố", category: "food", vibes: ["food_tour"], categories: ["eats"], q: "quán ăn đường phố ngon {vi}" },
  { key: "local_restaurants", label_en: "Local restaurants", label_vi: "Nhà hàng địa phương", category: "food", vibes: ["food_tour"], categories: ["eats"], q: "nhà hàng món Việt ngon {vi}" },
  { key: "desserts", label_en: "Desserts", label_vi: "Tráng miệng", category: "food", vibes: ["food_tour", "chill"], categories: ["eats"], q: "chè và tráng miệng ngon {vi}" },
  { key: "rooftops", label_en: "Rooftops", label_vi: "Rooftop", category: "out", vibes: ["views", "nightlife"], categories: ["views", "nightlife"], q: "rooftop bars with a view in {en}" },
  { key: "landmarks", label_en: "Landmarks", label_vi: "Địa danh", category: "out", vibes: ["culture"], categories: ["heritage"], q: "famous landmarks in {en}" },
  { key: "museums", label_en: "Museums & heritage", label_vi: "Bảo tàng & di sản", category: "out", vibes: ["culture"], categories: ["heritage"], q: "museums and heritage sites in {en}" },
  { key: "parks", label_en: "Parks & lakes", label_vi: "Công viên & hồ", category: "out", vibes: ["outdoors", "chill"], categories: ["nature"], q: "parks and lakes in {en}" },
  { key: "markets", label_en: "Markets", label_vi: "Chợ", category: "out", vibes: ["shopping"], categories: ["markets"], q: "chợ địa phương nổi tiếng {vi}" },
  { key: "nightlife", label_en: "Nightlife", label_vi: "Về đêm", category: "out", vibes: ["nightlife"], categories: ["nightlife"], q: "best bars and live music in {en}" },
] as const;

export type ScanCategory = (typeof SCAN_CATEGORIES)[number];

export type CityRow = {
  id: string;
  name_en: string;
  name_vi: string;
  short_en: string;
  short_vi: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
};

/** Look up an active city; throws a caller-facing error for unknown ids. */
export async function resolveCity(admin: any, cityId: string): Promise<CityRow> {
  const { data, error } = await admin
    .from("cities").select("*").eq("id", cityId).eq("is_active", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`unknown city: ${cityId}`);
  return data as CityRow;
}

export const cityBias = (city: CityRow) => ({
  circle: {
    center: { latitude: city.center_lat, longitude: city.center_lng },
    radius: city.radius_km * 1000,
  },
});

type ImportArgs = {
  admin: any;
  gapi: (url: string, init?: RequestInit) => Promise<any>;
  apiKey: string;
  placeId: string;
  category: "food" | "out";
  cityId: string;
  vibeTags?: string[];
  categories?: string[];
  maxPhotos?: number;
  /** The account that suggested this place, when it did not come from the
   *  desk. Stamped here rather than accepted from a request body, for the
   *  reason `stamp_curator` exists: a caller-supplied identity is the
   *  caller's choice, not a fact. */
  submittedBy?: string | null;
  /** Which door this came in through. Required, and deliberately not
   *  derived from `submittedBy` — that would collapse 'scan' and 'desk'
   *  back into the one bucket this column exists to split, which is the
   *  state the backfill had to reconstruct from photo counts. Each caller
   *  knows what it is; none of them has to work it out. */
  channel: "scan" | "desk" | "mobile";
  /** The account that performed this import, whatever the channel — an
   *  editor at the desk as much as a visitor on the phone. Distinct from
   *  `submittedBy`, which stays the narrower "a visitor suggested this"
   *  and carries the daily cap and the contributor read policy with it.
   *  Null when no account did it, which is a script under the service
   *  role. */
  addedBy?: string | null;
};

// District/ward-level address component — the human "what part of town is
// this in" answer, as opposed to the full street address. Google's exact
// type for it drifts by region and address depth (more so since Vietnam's
// 2025 ward mergers), so this checks candidates in priority order and uses
// the first that's present rather than betting on one.
const NEIGHBORHOOD_TYPES = [
  "administrative_area_level_2",
  "sublocality_level_1",
  "sublocality",
  "administrative_area_level_3",
];
function neighborhoodOf(components: { longText?: string; types?: string[] }[] | undefined): string | null {
  for (const type of NEIGHBORHOOD_TYPES) {
    const match = components?.find((c) => c.types?.includes(type));
    if (match?.longText) return match.longText;
  }
  return null;
}

/**
 * Import one Google place as a pending, unpublished row with photos.
 * Slug collisions: base → `${base}-${cityId}` → numeric suffix.
 * Assumes the caller already checked google_place_id for duplicates.
 */
export async function importPlace(
  {
    admin, gapi, apiKey, placeId, category, cityId,
    vibeTags = [], categories, maxPhotos = 6, submittedBy = null, channel, addedBy = null,
  }: ImportArgs,
): Promise<{ slug: string; photos: number }> {
  const d = await gapi(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,addressComponents,location,rating,userRatingCount,"
        + "priceLevel,regularOpeningHours,websiteUri,internationalPhoneNumber,"
        // `types` and `primaryType` are what `classify` reads. Two words in
        // a string, and until they were here the import had nothing to say
        // what a place *was* — every suggestion arrived with empty
        // categories for somebody to fill in by hand.
        + "nationalPhoneNumber,photos,editorialSummary,types,primaryType",
    },
  });

  // Read once, used twice below. Empty when Google's types say nothing we
  // recognise, which leaves the row for the desk exactly as before.
  const auto = classify(d.primaryType, d.types);

  const name = d.displayName?.text ?? "Unnamed place";
  let slug = slugify(name);
  const { data: taken } = await admin
    .from("places").select("slug").like("slug", `${slug}%`);
  const exists = (s: string) => taken?.some((r: any) => r.slug === s);
  if (exists(slug)) {
    const withCity = `${slug}-${cityId}`;
    slug = exists(withCity) ? `${slug}-${(taken?.length ?? 0) + 1}` : withCity;
  }

  const priceLevel = PRICE_LEVELS[d.priceLevel as string] ?? null;
  const { data: placeRow, error: insErr } = await admin
    .from("places")
    .insert({
      slug,
      google_place_id: d.id,
      submitted_by: submittedBy,
      channel,
      added_by: addedBy,
      name_en: name,
      name_vi: name,
      category,
      // What the caller said, and only if it said nothing, what Google's
      // types say — see `classify`.
      //
      // The caller wins because the only caller that supplies these is the
      // curated scan, where the categories come from the query that found
      // the place: an editor searched for rooftop bars, so a rooftop bar is
      // what it is. That is a stronger claim than a type list, and it must
      // not be second-guessed.
      //
      // What is left may still be empty — `classify` says nothing about a
      // type it does not know, on purpose. The dashboard then flags the row
      // for an editor exactly as it did before, which is the behaviour this
      // replaces for recognised types and preserves for the rest.
      categories: categories ?? auto.categories,
      // Google's own answer to "what is this, mainly", kept verbatim.
      // `classify` distils it into our taxonomy above; this keeps the
      // original so a future change of taxonomy can re-distil without
      // re-buying the details call. Nothing reads it yet, on purpose.
      primary_type: d.primaryType ?? null,
      city_id: cityId,
      is_featured: false,
      // Same rule, and the empty array has to be read as "said nothing"
      // rather than "said none" — it is the parameter's default, so a
      // caller that never mentions vibes is indistinguishable from one that
      // means no vibes. The scan is the only caller that mentions them.
      vibe_tags: vibeTags.length ? vibeTags : auto.vibes,
      // Google's editorial one-liner where it exists (EN only) — the
      // Vietnamese description stays editorial work in the dashboard.
      desc_en: d.editorialSummary?.text ?? null,
      // Same value in both languages, like name_en/name_vi above — a
      // starting point the editor refines, not a translation.
      neighborhood_en: neighborhoodOf(d.addressComponents),
      neighborhood_vi: neighborhoodOf(d.addressComponents),
      address: d.formattedAddress ?? null,
      lat: d.location?.latitude ?? null,
      lng: d.location?.longitude ?? null,
      rating: d.rating ?? null,
      rating_count: d.userRatingCount ?? null,
      price_level: priceLevel,
      price_vnd: priceLevel ? PRICE_LEVEL_VND[priceLevel] : null,
      price_display: priceLevel ? `${PRICE_LEVEL_VND[priceLevel] / 1000}k₫` : null,
      opening_hours: d.regularOpeningHours?.weekdayDescriptions ?? null,
      website: d.websiteUri ?? null,
      phone: d.internationalPhoneNumber ?? d.nationalPhoneNumber ?? null,
      saved_count: 0,
      emoji: "📍",
      is_published: false,
      review_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single();
  if (insErr) throw new Error(insErr.message);

  // Photo lookups are best-effort; a failed photo never fails the import.
  const photos = (d.photos ?? []).slice(0, maxPhotos);
  const rows = [];
  for (const [i, ph] of photos.entries()) {
    try {
      const media = await gapi(
        `https://places.googleapis.com/v1/${ph.name}/media`
        + `?maxWidthPx=1600&skipHttpRedirect=true&key=${apiKey}`,
      );
      const attr = ph.authorAttributions?.[0];
      rows.push({
        place_id: placeRow.id,
        photo_ref: ph.name,
        photo_uri: media.photoUri,
        source: "google",
        attribution_name: attr?.displayName ?? null,
        attribution_uri: attr?.uri ?? null,
        sort_order: i,
        is_cover: i === 0,
        is_hidden: false,
      });
    } catch (_) { /* skip failed photo */ }
  }
  if (rows.length) {
    const { error: phErr } = await admin.from("place_photos").insert(rows);
    if (phErr) throw new Error(phErr.message);
  }

  return { slug, photos: rows.length };
}
