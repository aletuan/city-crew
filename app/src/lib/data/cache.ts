// The catalog, remembered between launches.
//
// Same argument as `lib/citylist`, one round trip further down: after the
// city commits from its cache (~20 ms), the traces show the launch
// spending its remaining ~700 ms on the catalog fetch, behind skeletons.
// From the second launch on that wait buys almost nothing either — the
// places a reader saw yesterday are overwhelmingly the places they would
// see today, because the catalog is desk-curated and changes rarely.
//
// So the two heavy queries write their last answer down, and the next
// launch shows that answer immediately while the fetch refreshes it in
// the background — stale-while-revalidate, the pattern every feed app
// opens with. The mechanics live in `usePersistedFetch` (`fetch.ts`);
// this module is the pure half: the envelope a cached answer travels in,
// and whether a stored blob may be trusted.
//
// ── the envelope ──
//
// `{ v, at, data }`. `v` is the version stamp, and it carries a duty:
// bump `CACHE_VERSION` whenever the shape of what is cached changes —
// a column added to `PLACE_COLS` or `COLLECTION_COLS`, a rename, a
// nesting change — so every phone's old cache goes quietly invalid
// instead of feeding a renderer rows it no longer understands. That one
// constant is what lets `unpackCache` stay shallow: it checks the
// envelope and that `data` is a list, and trusts the rows, because any
// rows under the current version were written by code that shaped them.
//
// `at` is when the answer was fetched. It rides back out as `loadedAt`
// so the two-minute staleness rule (`lib/stale`) keeps working over
// hydrated data, and it bounds the cache's age here: a phone opening the
// app after a week away shows skeletons and waits for fresh data, rather
// than flashing a week-old catalog. A stamp from the future is refused
// outright — a clock that has been wrong once is not a clock to trust.

/**
 * The switch, same shape as `CACHE_CITY_LIST` and the flags before it.
 * Off, `usePersistedFetch` neither reads nor shows a cache and every
 * launch waits for the network exactly as before — but the cache is
 * still *written*, so flipping this back on needs no re-seeding launch.
 *
 * What it costs while on: for the first ~0.7 s of a launch the reader is
 * looking at the previous launch's catalog. A place the desk retired
 * yesterday appears for that beat and then vanishes with the refresh.
 * For a desk-curated catalog that is a small price; this constant is
 * where somebody who stops thinking so turns it off.
 */
export const CACHE_CATALOG = true;

/** Bump on any change to the shape of cached rows — see the note above. */
export const CACHE_VERSION = 1;

/** Older than this and a cache is not shown — see the note on `at`. */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * One key per question: what is cached is an *answer*, and the answer to
 * "which places" depends on the city and on who is asking (the queries
 * scope suggestions and own-list exclusion by `meId`). Baking both into
 * the key means a city switch or a sign-in is simply a different key —
 * a miss, never a wrong hit.
 */
export function cacheKey(kind: string, cityId: string, meId?: string | null): string {
  return `citycrew.cache.${kind}.${cityId}.${meId ?? 'anon'}`;
}

export function packCache(data: unknown, at: number): string {
  return JSON.stringify({ v: CACHE_VERSION, at, data });
}

/**
 * The stored blob, or null when there is nothing worth trusting: no
 * blob, a blob that does not parse, a foreign or outdated version, a
 * stamp too old or from the future, or a payload that is not a list —
 * both cached queries answer lists, and anything else is not ours.
 */
export function unpackCache<T>(
  raw: string | null,
  now: number,
  maxAgeMs: number = CACHE_MAX_AGE_MS,
): { data: T; at: number } | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const e = parsed as Record<string, unknown>;
  if (e.v !== CACHE_VERSION) return null;
  if (typeof e.at !== 'number' || e.at > now || now - e.at > maxAgeMs) return null;
  if (!Array.isArray(e.data)) return null;
  return { data: e.data as unknown as T, at: e.at };
}
