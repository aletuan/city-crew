// The cards a reader can swipe through once a pin is open on Explore's map.
//
// A deck is cut when a pin is tapped and then held still while the reader
// swipes: places from what the map shows (so every chip and toggle already
// applies), nearest the tapped one first, the tapped one at index 0.
//
// ── the two numbers, measured ──
//
// On the live catalogue (1,580 places) the distance to a place's 20th
// nearest neighbour has a median of 0.72 km, a 90th percentile of 3.03 km
// and a maximum of 120 km. So 20 is "the neighbourhood" in most of the
// city, and the radius is what keeps the long tail honest: a lone place at
// the edge of a city would otherwise swipe to somewhere 120 km off.
// Building a deck costs 0.47 ms for 1,580 places and 1.5 ms for 15,000 on
// a desktop CPU (not measured on a phone).
//
// Rejected: a deck of everything shown, sorted by distance. A swipe is
// "the next one near here"; the 400th card is not.

import { distanceKm } from './geo';

/** Most cards in a deck. */
export const DECK_MAX = 20;
/** Furthest a card may be from the tapped place. */
export const DECK_RADIUS_KM = 3;

type Located = { slug: string; lat: number | null; lng: number | null };

/**
 * Slugs of the deck around `anchor`, nearest first, the anchor at index 0.
 * Places without coordinates are left out (they have no pin to select);
 * an anchor not among `shown` or without coordinates gives an empty deck.
 */
export function buildDeck(shown: readonly Located[], anchorSlug: string): string[] {
  const anchor = shown.find((p) => p.slug === anchorSlug);
  if (!anchor || anchor.lat == null || anchor.lng == null) return [];
  const { lat, lng } = anchor;
  const near: { slug: string; km: number }[] = [];
  for (const p of shown) {
    if (p.slug === anchorSlug || p.lat == null || p.lng == null) continue;
    const km = distanceKm(lat, lng, p.lat, p.lng);
    if (km <= DECK_RADIUS_KM) near.push({ slug: p.slug, km });
  }
  near.sort((a, b) => a.km - b.km);
  return [anchorSlug, ...near.slice(0, DECK_MAX - 1).map((n) => n.slug)];
}
