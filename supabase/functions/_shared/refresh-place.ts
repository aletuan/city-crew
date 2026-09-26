// Keeping what Google told us about a place no older than Google allows.
//
// ── why ──
//
// The import copies a place's rating, review count, price level, opening
// hours, website, phone and Google's one-line summary onto the row, and
// until this existed nothing ever asked again. Google Maps Platform's terms
// let an app keep a `place_id` indefinitely and the rest only for a while —
// commonly read as 30 days — and the first rows were imported on 6 August.
// It is also a quality problem before it is a legal one: opening hours and
// ratings are the two fields that go wrong soonest, and the planner leaves
// out a place it believes is closed. See C1 in `docs/tech-eval-app-store.md`
// and issue #708.
//
// So a job (`refresh-places`) asks Google again for each place, well inside
// that window, and this is what it does with the answer.
//
// ── what it may overwrite, and what it may not ──
//
// Google's own fields have no other author, so a refresh simply replaces
// them: `rating`, `rating_count`, `price_level`, `opening_hours`, and two it
// now keeps as well — `business_status`, so a place Google calls closed for
// good reaches the desk instead of a reader who turned up, and
// `google_summary`, Google's one-liner, kept fresh for the desk to reuse.
//
// Three fields the desk can also write by hand, and a refresh must never
// undo that work:
//
//   - `desc_en`. The editor names who wrote it (`reviewer_source`). Only
//     text marked `google` is Google's, so only that is followed; if Google
//     drops the summary, the copy goes too rather than lingering past its
//     date. A place with no description and no source takes Google's, which
//     is what the import does.
//   - `website`, `phone`. Nothing recorded whether a hand changed these, so
//     `google_website` / `google_phone` now remember what Google last said.
//     A value that still matches it, or is empty, follows Google; one that
//     does not was edited, and is left alone while the memory is updated.
//
// `price_vnd` is the desk's price, not Google's, and is never touched here;
// `price_level` is refreshed beside it for the desk to reuse.
//
// Pure except for the two things it is handed — a client and a fetch — so
// it is tested from the app's runner, the way `rehost.ts` is.

import { PRICE_LEVELS } from "./price-level.ts";

/**
 * The fields asked for. Every one of them is read below, and none is asked
 * for that is not: the Places API bills a request by the most expensive
 * field in its mask. `editorialSummary` is the one that sets the rate —
 * kept because the owner chose to reuse it (26 September 2026).
 */
export const REFRESH_MASK =
  "id,rating,userRatingCount,priceLevel,regularOpeningHours,websiteUri,"
  + "internationalPhoneNumber,nationalPhoneNumber,businessStatus,editorialSummary";

/** Recorded when Google no longer knows the `place_id`: the listing was
 *  removed, or its id changed. The desk decides which; the row's other
 *  fields are left as they were, not guessed at. */
export const NOT_FOUND = "NOT_FOUND";

/** The part of a Places API (New) answer this reads. */
export type Details = {
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  businessStatus?: string;
  editorialSummary?: { text?: string };
};

/** The part of the row a refresh has to see before it writes. */
export type Current = {
  website: string | null;
  phone: string | null;
  google_website: string | null;
  google_phone: string | null;
  desc_en: string | null;
  reviewer_source: string | null;
};

const empty = (s: string | null | undefined) => s == null || s.trim() === "";

/** Follow Google only while the value is still Google's, or there is none. */
function follow(current: string | null, lastGoogle: string | null, next: string | null) {
  return empty(current) || current === lastGoogle ? { change: true, value: next } : { change: false };
}

/** What a refresh writes, given Google's answer and the row as it stands. */
export function refreshPatch(d: Details, cur: Current, now: Date): Record<string, unknown> {
  const website = d.websiteUri ?? null;
  const phone = d.internationalPhoneNumber ?? d.nationalPhoneNumber ?? null;
  const summary = d.editorialSummary?.text?.trim() || null;

  const patch: Record<string, unknown> = {
    rating: d.rating ?? null,
    rating_count: d.userRatingCount ?? null,
    price_level: (d.priceLevel && PRICE_LEVELS[d.priceLevel]) || null,
    opening_hours: d.regularOpeningHours?.weekdayDescriptions ?? null,
    business_status: d.businessStatus ?? null,
    google_summary: summary,
    google_website: website,
    google_phone: phone,
    google_refreshed_at: now.toISOString(),
  };

  const w = follow(cur.website, cur.google_website, website);
  if (w.change) patch.website = w.value;
  const p = follow(cur.phone, cur.google_phone, phone);
  if (p.change) patch.phone = p.value;

  if (cur.reviewer_source === "google") {
    patch.desc_en = summary;
    if (!summary) patch.reviewer_source = null;
  } else if (cur.reviewer_source == null && empty(cur.desc_en) && summary) {
    patch.desc_en = summary;
    patch.reviewer_source = "google";
  }
  return patch;
}

export type RefreshRow = Current & { id: string; google_place_id: string };
export type Outcome = "refreshed" | "not_found";

/**
 * Ask Google about one place and write what it says.
 *
 * Throws on anything but a clean answer or a 404, with Google's or the
 * database's own words, and writes nothing — the row keeps its old stamp and
 * the next run tries it again. A 404 is an answer, not an error: it is
 * written down so the desk can see it.
 */
export async function refreshPlace(
  admin: any,
  apiKey: string,
  row: RefreshRow,
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<Outcome> {
  const res = await fetchImpl(`https://places.googleapis.com/v1/places/${row.google_place_id}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": REFRESH_MASK },
  });

  let patch: Record<string, unknown>;
  let outcome: Outcome;
  if (res.status === 404) {
    patch = { business_status: NOT_FOUND, google_refreshed_at: now.toISOString() };
    outcome = "not_found";
  } else if (!res.ok) {
    throw new Error(`Google ${res.status}: ${await res.text()}`);
  } else {
    patch = refreshPatch(await res.json() as Details, row, now);
    outcome = "refreshed";
  }

  const { error } = await admin.from("places").update(patch).eq("id", row.id);
  if (error) throw new Error(error.message);
  return outcome;
}
