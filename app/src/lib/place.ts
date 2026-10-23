// Pure functions over the catalog shapes: ordering photos, reading a
// price, resolving a collection's members, turning a typed title into a
// slug.
//
// Split out of `data.ts` so they can be tested in a plain Node process.
// Nothing here imports anything but types, and it must stay that way —
// one runtime import of `./supabase` and the whole of React Native comes
// with it.

import type { Collection, Place, PlacePhoto } from './types';

/** Visible photos, cover first. */
export function photosOf(p: Place): PlacePhoto[] {
  return [...p.place_photos]
    .filter((ph) => !ph.is_hidden)
    .sort((a, b) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0) || a.sort_order - b.sort_order);
}

export function coverOf(p: Place): PlacePhoto | undefined {
  return photosOf(p)[0];
}

/**
 * The photograph a collection's card wears: the one its owner chose, else
 * its first place's own cover, else none.
 *
 * The first place and not the best-looking one, because the order of a
 * list is its owner's and the top of it is what they put first. Takes the
 * members already resolved rather than resolving them here — every caller
 * has them in hand, and `membersOf` builds an index of the whole catalog
 * each time it is called.
 */
export function coverUriOf(c: Pick<Collection, 'cover'>, members: readonly Place[]): string | undefined {
  return c.cover?.photo_uri ?? (members[0] ? coverOf(members[0])?.photo_uri : undefined);
}

/** Explicitly free (0₫) — distinct from a missing price. */
export function isFree(p: Place): boolean {
  if (p.price_vnd === 0) return true;
  const d = (p.price_display ?? '').trim();
  return d === '0₫' || d === '0đ' || d === '0';
}

/** Display label for a paid place, or null when no price is known. */
export function priceLabel(p: Place): string | null {
  if (p.price_display) return p.price_display;
  if (p.price_vnd != null) return `${Math.round(p.price_vnd / 1000)}k₫`;
  return null;
}

export function fmtCount(n: number | null | undefined): string {
  if (!n) return '';
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
}

/**
 * A slug from a title the user typed. Diacritics are stripped so "Cà phê
 * sáng" and "Ca phe sang" land on the same stem; a title with no latin
 * letters at all (Japanese, say) keeps only the suffix, which is enough —
 * the slug is a key, not a label.
 *
 * ── NFKD, not NFD ──
 *
 * NFD is *canonical* decomposition. It separates the marks off Vietnamese
 * letters, which is what this wants it for, and it leaves styled
 * characters alone — a mathematical bold `A` is not an `A` with something
 * added, it is its own codepoint that merely looks like one. So a title
 * typed in one of those fonts loses every character and falls out as the
 * bare `'list'` below.
 *
 * The place importer hit this for real and wrote a row whose key is
 * `place`; `_shared/import-place.ts` carries the measurements. A
 * collection is likelier to hit it than a place, not less: people name
 * their own lists with whatever their keyboard offers.
 *
 * NFKD is *compatibility* decomposition, which maps those back — and
 * leaves Vietnamese exactly where NFD left it, because its diacritics are
 * canonical either way. It also recovers fullwidth digits and ligatures,
 * both of which NFD silently dropped.
 */
export function slugify(title: string): string {
  const stem = title
    // Order matters, and it was wrong. Lowercasing first meant anything
    // NFKD handed back as a capital arrived after the only step that
    // could lower it, and the `[^a-z0-9]` sweep then threw it away — so
    // `𝐂𝐫𝐮𝐦𝐛𝐬` came out `rumbs`, missing exactly its first letter.
    // Normalise, strip, fold `đ`, and lowercase last.
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return stem || 'list';
}

/** Does this list already hold this place? Read from what is in memory —
 *  the collection rows carry their members. */
export function holds(c: Collection, placeSlug: string): boolean {
  return c.collection_places.some((cp) => cp.places?.slug === placeSlug);
}

/**
 * Where a place saved into this list goes: after the last one.
 *
 * Not the member count, which is what it used to be. After a removal the
 * count points at a position already taken — 0, 2 after dropping 1, and
 * the next save lands on 2 again — and two members sharing a position
 * come back in whatever order the database returns them. Rows whose place
 * has gone missing still hold a position, so they count here too.
 */
export function nextSortOrder(c: Collection): number {
  return c.collection_places.reduce((top, cp) => Math.max(top, cp.sort_order + 1), 0);
}

/**
 * A collection's places, in order.
 *
 * A list of the user's own arrives with its members attached and needs no
 * catalog — that is what lets it hold places from a city other than the
 * one on screen. The editorial rows carry slugs and resolve against the
 * catalog, which is scoped to the current city by design.
 */

/**
 * The city a list of your own is about: where most of its places are.
 *
 * Search opened from a list answers in this city (owner, 23 Oct 2026), so
 * a list of Huế cafés is offered Huế's places whichever city the app is
 * in. Most, not all — a list is allowed to stray, see `touchesCity` below.
 * A tie goes to `fallback`, the city on screen, when it is one of the
 * tied, and otherwise to whichever got there first in the list's order;
 * an empty list, or one without its members attached, has no city of its
 * own and takes `fallback`.
 */
export function cityOfList(c: Collection, fallback: string | null): string | null {
  const counts = new Map<string, number>();
  for (const p of c.members ?? []) if (p.city_id) counts.set(p.city_id, (counts.get(p.city_id) ?? 0) + 1);
  let best = fallback;
  let top = fallback ? counts.get(fallback) ?? 0 : 0;
  for (const [id, n] of counts) {
    if (n > top) { best = id; top = n; }
  }
  return best;
}

export function membersOf(c: Collection, places: Place[]): Place[] {
  if (c.members) return c.members;
  const bySlug = new Map(places.map((p) => [p.slug, p]));
  return [...c.collection_places]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cp) => (cp.places ? bySlug.get(cp.places.slug) : undefined))
    .filter((p): p is Place => !!p);
}

/**
 * Does this list belong on the shelf for the city on screen?
 *
 * The city decides whether a list appears — not what is inside it. A list
 * with two places in Hanoi and one in Saigon appears in both, whole in
 * both: one place is enough to earn the shelf, and nothing here filters
 * the members it was given. That is the difference between showing a
 * person a list they can use and showing them a third of one.
 *
 * No threshold, deliberately. "Mostly this city" sounds tidier and cannot
 * be explained to the person whose list has just vanished from the city
 * it was made in. If a shelf ever fills with lists that barely touch it,
 * the answer is to order them by how much they do — not to hide them.
 *
 * With no city chosen yet the only honest question left is whether the
 * list has anything at all, which is the test this replaced.
 */
export function touchesCity(members: Place[], cityId: string | null | undefined): boolean {
  if (!cityId) return members.length > 0;
  return members.some((p) => p.city_id === cityId);
}
