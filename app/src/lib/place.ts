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
 */
export function slugify(title: string): string {
  const stem = title
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
 * A collection's places, in order.
 *
 * A list of the user's own arrives with its members attached and needs no
 * catalog — that is what lets it hold places from a city other than the
 * one on screen. The editorial rows carry slugs and resolve against the
 * catalog, which is scoped to the current city by design.
 */

export function membersOf(c: Collection, places: Place[]): Place[] {
  if (c.members) return c.members;
  const bySlug = new Map(places.map((p) => [p.slug, p]));
  return [...c.collection_places]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cp) => (cp.places ? bySlug.get(cp.places.slug) : undefined))
    .filter((p): p is Place => !!p);
}
