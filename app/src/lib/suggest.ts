// Suggesting a place: the one write the client cannot perform itself.
//
// Everywhere else the app writes straight to Postgres and RLS is the
// guard. Not here — the row is built from Google, behind a key that must
// not ship in a bundle, so the work happens in the `fetch-place` Edge
// Function and this is only the call.
//
// Which is also why nothing in this file decides anything. The status, the
// submitter and the daily cap are all set server-side; sending any of them
// from here would be the `curator_handle` mistake again.

import { supabase } from './supabase';

/** A Google result, before it is anything of ours. */
export type Candidate = {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  rating_count: number | null;
};

/**
 * What we already know about a candidate, which is not always the same as
 * what exists.
 *
 * `none` means "not visible to you", and that is deliberately not the same
 * claim as "not in the database". Somebody else's unreviewed suggestion is
 * hidden by RLS, so it reads as `none` here and the server answers
 * `already_known` when you try. The screen is honest about the first and
 * the function is honest about the second; between them nobody is told
 * about a stranger's pending suggestion.
 */
export type Known =
  | { state: 'none' }
  | { state: 'live'; slug: string }
  | { state: 'mine' };

export type SuggestOutcome =
  | { ok: true; slug: string; photos: number }
  | { ok: false; reason: 'already_live'; slug: string }
  | { ok: false; reason: 'already_known' }
  | { ok: false; reason: 'daily_limit'; limit: number }
  | { ok: false; reason: 'error'; message: string };

type Fn = { error?: { message?: string } | null; data?: unknown };

/**
 * The function's answer, turned into something a screen can render.
 *
 * supabase-js flattens a non-2xx into `error` and throws the body away, so
 * a 409 arrives as "Edge Function returned a non-2xx status code" with the
 * reason inside a `context` the types do not admit to. Reading it back out
 * is unpleasant and the alternative is worse: every refusal would look
 * identical, and "already on cityCrew" would read as "something went
 * wrong".
 */
export async function readOutcome(res: Fn): Promise<SuggestOutcome> {
  if (!res.error) {
    const d = (res.data ?? {}) as { slug?: string; photos?: number };
    return d.slug
      ? { ok: true, slug: d.slug, photos: d.photos ?? 0 }
      : { ok: false, reason: 'error', message: 'no slug returned' };
  }
  const body = await bodyOf(res.error);
  if (body?.error === 'daily_limit') {
    return { ok: false, reason: 'daily_limit', limit: Number(body.limit) || 0 };
  }
  if (body?.error === 'already_known') {
    return body.live && body.slug
      ? { ok: false, reason: 'already_live', slug: String(body.slug) }
      : { ok: false, reason: 'already_known' };
  }
  return { ok: false, reason: 'error', message: body?.error ?? res.error.message ?? 'failed' };
}

type Body = { error?: string; live?: boolean; slug?: string; limit?: number };

async function bodyOf(err: unknown): Promise<Body | null> {
  const ctx = (err as { context?: unknown })?.context;
  if (!ctx) return null;
  // A `Response` on the versions that hand one back, an already-parsed
  // object on the ones that do not. Both shapes have been seen.
  try {
    if (typeof (ctx as Response).json === 'function') return await (ctx as Response).json();
  } catch { /* body already consumed, or not JSON */ }
  const body = (ctx as { body?: unknown }).body;
  if (body && typeof body === 'object') return body as Body;
  return null;
}

export async function searchPlaces(query: string, cityId: string): Promise<Candidate[]> {
  const { data, error } = await supabase.functions.invoke('fetch-place', {
    body: { action: 'search', query, city: cityId },
  });
  if (error) throw new Error(error.message);
  return ((data as { candidates?: Candidate[] })?.candidates ?? []);
}

export async function suggestPlace(placeId: string, cityId: string): Promise<SuggestOutcome> {
  // No `category`. The function defaults it, and asking a visitor to
  // classify a café into the desk's taxonomy is asking them to guess at
  // something an editor is going to set properly anyway.
  const res = await supabase.functions.invoke('fetch-place', {
    body: { action: 'suggest', place_id: placeId, city: cityId },
  });
  return readOutcome(res as Fn);
}

/**
 * Which of these Google ids we can already see, keyed by id.
 *
 * One query rather than one per row, and `google_place_id` is unique so
 * the answer is exact — no fuzzy name matching, no "is this the same
 * café". RLS decides what comes back, which is the whole point: live
 * places, plus your own submissions, and nothing of anybody else's.
 */
export async function knownByPlaceId(
  ids: string[],
  meId: string | null | undefined,
): Promise<Record<string, Known>> {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('places')
    .select('google_place_id, slug, is_published, review_status, submitted_by')
    .in('google_place_id', ids);
  // A failed lookup must not take the search results down with it. Every
  // row simply looks new, and the function still refuses a duplicate.
  if (error) return {};
  const out: Record<string, Known> = {};
  for (const r of (data ?? []) as {
    google_place_id: string; slug: string;
    is_published: boolean; review_status: string; submitted_by: string | null;
  }[]) {
    if (!r.google_place_id) continue;
    out[r.google_place_id] = r.is_published && r.review_status === 'approved'
      ? { state: 'live', slug: r.slug }
      : { state: 'mine' };
  }
  return out;
}
