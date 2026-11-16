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

/**
 * The longest blob written to the phone, in characters.
 *
 * Android reads a stored value back through a 2 MB cursor window, and a
 * blob past it is not read slowly but not at all — `Row too big to fit
 * into CursorWindow`, which `usePersistedFetch` marks as `unreadable`.
 * The search index stays off the phone for exactly that reason
 * (`searchIndex.tsx`). This is the same rule for the rest, before the
 * write rather than after it.
 *
 * Characters, because the length is free and bytes are not. Measured on
 * 30 Oct 2026, the cached catalog ran 1.135 (Saigon) and 1.154 (Hanoi)
 * UTF-8 bytes a character — Vietnamese diacritics — so 1.5 million is
 * about 1.73 MB, inside the window with room for a denser city. The
 * largest blob that day was Saigon's places at 753,130: half of this.
 */
export const CACHE_MAX_CHARS = 1_500_000;

/** Whether a packed blob is small enough to store — see `CACHE_MAX_CHARS`. */
export function fitsCache(blob: string): boolean {
  return blob.length <= CACHE_MAX_CHARS;
}

// ── an answer longer than one row ──
//
// `CACHE_MAX_CHARS` is a bound on a row, and until 16 Nov 2026 it was a
// bound on an answer too: a blob past it was not written and the last
// one was removed, so the next launch waited for the network. That was
// written when the largest blob was half the bound.
//
// The public shelf grew through it. It arrives as every public list with
// its places embedded (`fetchCollections`); measured on the live project
// that day, 62 lists holding 744 places came to about 1.56 million
// characters, where a week earlier — eleven lists fewer — they had come
// to about 1.3. So the shelf stopped being remembered: Explore opened on
// the places it had kept and two grey cards where "From the community"
// should be, for the seconds a megabyte and a half takes to come down,
// which is how the owner met it.
//
// So a long answer is written as several rows, each inside the bound,
// under one head that says how many and how long. Nothing about a row
// changes — each is as readable on Android as it ever was — and nothing
// about the answer does: the parts are the blob, cut.
//
// It does not make the answer smaller. The download is the same
// megabyte and a half on every launch, behind the remembered copy now
// rather than in front of the reader, and it grows with every list
// published. Narrowing what a list carries of its places is the fix for
// that, and is its own change (`fetchCollections` names it).

/** The most rows one answer is cut into. Six is nine million characters:
 *  past that the parse alone is a launch's worth of the JS thread, and
 *  an answer that long is told to the traces rather than stored. */
export const CACHE_MAX_PARTS = 6;

/** The row a part is kept in: the answer's key, and which part. Under
 *  the same `citycrew.cache.<kind>` head, so `cacheKind` still reads it. */
export function partKey(key: string, i: number): string {
  return `${key}.part${i}`;
}

/**
 * A packed blob as the rows it is written in: itself when it fits one,
 * its parts when it does not, and null when it is too long to keep.
 *
 * A cut never falls inside a surrogate pair. The catalog carries emoji,
 * and half of one written to a row comes back as a replacement mark —
 * a blob that no longer parses, on the launch it was kept for.
 */
export function splitCache(blob: string, size: number = CACHE_MAX_CHARS): string[] | null {
  if (blob.length <= size) return [blob];
  const parts: string[] = [];
  for (let at = 0; at < blob.length;) {
    let end = Math.min(at + size, blob.length);
    const last = blob.charCodeAt(end - 1);
    if (end < blob.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    parts.push(blob.slice(at, end));
    at = end;
  }
  return parts.length <= CACHE_MAX_PARTS ? parts : null;
}

/** The head of an answer kept in parts: how many, and how long they are
 *  together — what a read checks before it trusts them. No `at`, so a
 *  build that predates parts reads it as no cache (`unpackCache`). */
export function packParts(parts: number, chars: number): string {
  return JSON.stringify({ v: CACHE_VERSION, parts, chars });
}

/** A stored value read as such a head, or null when it is anything else
 *  — an answer in one row, nothing, or a head from another version. */
export function partsOf(raw: string | null): { parts: number; chars: number } | null {
  // A head is short; an answer is not worth parsing twice to find out.
  if (!raw || raw.length > 100) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const e = parsed as Record<string, unknown>;
  if (e.v !== CACHE_VERSION || typeof e.parts !== 'number' || typeof e.chars !== 'number') return null;
  if (!Number.isInteger(e.parts) || e.parts < 2 || e.parts > CACHE_MAX_PARTS) return null;
  return { parts: e.parts, chars: e.chars };
}

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

/** The `kind` a `cacheKey` was built from, or `other` for a key this
 *  module did not make — the name a cache's trace marks go under. */
export function cacheKind(key: string): string {
  const [app, area, kind] = key.split('.');
  return app === 'citycrew' && area === 'cache' && kind ? kind : 'other';
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
