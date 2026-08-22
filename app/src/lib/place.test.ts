// The pure catalog helpers. No React Native here, and none in what these
// import — that is the whole reason they were split out of `data.ts`.

import { describe, expect, it } from 'vitest';
import {
  coverOf, fmtCount, holds, isFree, membersOf, photosOf, priceLabel, slugify, touchesCity,
} from './place';
import type { Collection, Place, PlacePhoto } from './types';

const photo = (p: Partial<PlacePhoto>): PlacePhoto => ({
  photo_uri: 'a', is_cover: false, is_hidden: false, sort_order: 0, attribution_name: null, ...p,
});

const place = (p: Partial<Place> = {}): Place => ({
  slug: 'p', name_en: 'P', name_vi: 'P', name_ja: null, category: 'food',
  is_featured: false, vibe_tags: [], neighborhood_en: null, neighborhood_vi: null,
  neighborhood_ja: null, address: null, lat: null, lng: null, rating: null,
  rating_count: null, price_display: null, price_vnd: null, duration_min: null,
  duration_max: null, desc_en: null, desc_vi: null, desc_ja: null, emoji: null,
  opening_hours: null, website: null, phone: null, place_photos: [], ...p,
});

const collection = (c: Partial<Collection> = {}): Collection => ({
  slug: 'c', title_en: 'C', title_vi: 'C', title_ja: null, desc_en: null,
  desc_vi: null, desc_ja: null, curator_handle: null, cover: null,
  collection_places: [], ...c,
});

describe('photosOf', () => {
  it('puts the cover first, whatever its sort order', () => {
    const p = place({ place_photos: [
      photo({ photo_uri: 'b', sort_order: 1 }),
      photo({ photo_uri: 'cover', sort_order: 9, is_cover: true }),
      photo({ photo_uri: 'a', sort_order: 0 }),
    ] });
    expect(photosOf(p).map((x) => x.photo_uri)).toEqual(['cover', 'a', 'b']);
  });

  it('drops hidden photos', () => {
    const p = place({ place_photos: [
      photo({ photo_uri: 'shown' }),
      photo({ photo_uri: 'hidden', is_hidden: true }),
    ] });
    expect(photosOf(p).map((x) => x.photo_uri)).toEqual(['shown']);
  });

  it('leaves the original array alone', () => {
    const photos = [photo({ photo_uri: 'a', sort_order: 1 }), photo({ photo_uri: 'b', sort_order: 0 })];
    photosOf(place({ place_photos: photos }));
    expect(photos.map((x) => x.photo_uri)).toEqual(['a', 'b']);
  });

  it('has no cover when every photo is hidden', () => {
    expect(coverOf(place({ place_photos: [photo({ is_cover: true, is_hidden: true })] }))).toBeUndefined();
  });
});

describe('isFree', () => {
  it('is true only when the price is explicitly nothing', () => {
    expect(isFree(place({ price_vnd: 0 }))).toBe(true);
    expect(isFree(place({ price_display: '0₫' }))).toBe(true);
    expect(isFree(place({ price_display: '0đ' }))).toBe(true);
  });

  // The distinction the function exists for: nobody has said what this
  // costs, which is not the same as saying it costs nothing.
  it('is false when no price is known at all', () => {
    expect(isFree(place())).toBe(false);
  });

  it('is false for a real price', () => {
    expect(isFree(place({ price_vnd: 50000 }))).toBe(false);
  });
});

describe('priceLabel', () => {
  it('prefers the curated display string', () => {
    expect(priceLabel(place({ price_display: '~60k ₫', price_vnd: 999 }))).toBe('~60k ₫');
  });

  it('derives thousands from the number when there is no string', () => {
    expect(priceLabel(place({ price_vnd: 60000 }))).toBe('60k₫');
  });

  it('keeps a free place distinguishable from an unpriced one', () => {
    expect(priceLabel(place({ price_vnd: 0 }))).toBe('0k₫');
    expect(priceLabel(place())).toBeNull();
  });
});

describe('fmtCount', () => {
  it('leaves counts under a thousand alone', () => {
    expect(fmtCount(1)).toBe('1');
    expect(fmtCount(999)).toBe('999');
  });

  it('abbreviates thousands to one decimal', () => {
    expect(fmtCount(1000)).toBe('1k');
    expect(fmtCount(1800)).toBe('1.8k');
    expect(fmtCount(10100)).toBe('10.1k');
  });

  it('renders nothing at all for absent or zero counts', () => {
    expect(fmtCount(0)).toBe('');
    expect(fmtCount(null)).toBe('');
    expect(fmtCount(undefined)).toBe('');
  });
});

describe('slugify', () => {
  it('strips Vietnamese diacritics so accented and plain titles agree', () => {
    expect(slugify('Cà phê sáng')).toBe('ca-phe-sang');
    expect(slugify('Ca phe sang')).toBe('ca-phe-sang');
  });

  // đ is a distinct letter, not a d with a mark, so no normalisation form
  // takes it apart — neither NFD nor NFKD. The explicit replace stays.
  it('handles đ, which decomposition alone would leave behind', () => {
    expect(slugify('Đà Nẵng')).toBe('da-nang');
  });

  // ── the styled-name bug ──
  //
  // This shipped in production. The place importer shares this rule and
  // wrote a row whose key is literally `place`, because the café is named
  // in Mathematical Bold and NFD — canonical decomposition — does not
  // touch a codepoint that merely *looks* like a letter. Every character
  // was stripped and the fallback fired.
  //
  // A slug is the app's key: deep links, membership, the planner's
  // tie-break. Two unslugifiable names in a row is a collision.
  it('reads a name written in styled characters', () => {
    expect(slugify('\u{1D402}\u{1D42B}\u{1D42E}\u{1D426}\u{1D41B}\u{1D42C}')).toBe('crumbs');
  });

  it('keeps fullwidth digits a NFD pass would have thrown away', () => {
    expect(slugify('\uFF13\uFF23 Roastery')).toBe('3c-roastery');
  });

  it('keeps a ligature whole rather than losing half of it', () => {
    expect(slugify('\uFB01nest Caf\u00E9')).toBe('finest-cafe');
  });

  // The half that must not change. Vietnamese diacritics are canonical, so
  // both forms take them apart identically — the switch to NFKD buys the
  // styled layer and costs nothing here.
  it('leaves Vietnamese exactly where it was', () => {
    expect(slugify('Mai Hỷ tea & dining')).toBe('mai-hy-tea-dining');
    expect(slugify('Caffeinerush Châu Long')).toBe('caffeinerush-chau-long');
    expect(slugify('Đông Đô')).toBe('dong-do');
  });

  it('collapses punctuation and trims the edges', () => {
    expect(slugify('  Weekend — coffee!!  ')).toBe('weekend-coffee');
  });

  it('falls back rather than returning an empty key', () => {
    expect(slugify('週末のコーヒー')).toBe('list');
    expect(slugify('!!!')).toBe('list');
  });

  it('caps the stem so a long title cannot run away with the key', () => {
    expect(slugify('a'.repeat(80))).toHaveLength(40);
  });
});

describe('holds', () => {
  const c = collection({ collection_places: [{ sort_order: 0, places: { slug: 'x' } }] });

  it('finds a member', () => expect(holds(c, 'x')).toBe(true));
  it('does not invent one', () => expect(holds(c, 'y')).toBe(false));
  it('survives a row whose place went missing', () => {
    expect(holds(collection({ collection_places: [{ sort_order: 0, places: null }] }), 'x')).toBe(false);
  });
});

describe('membersOf', () => {
  const hanoiPlace = place({ slug: 'h' });

  // RLS can hide the place behind a join row, so the row survives and its
  // `places` does not. Dropping it beats rendering a hole in the list.
  it('skips a join row whose place is not there', () => {
    const c = collection({ collection_places: [
      { sort_order: 1, places: null },
      { sort_order: 2, places: { slug: 'h' } },
    ] });
    expect(membersOf(c, [hanoiPlace])).toEqual([hanoiPlace]);
  });

  it('resolves slugs against the catalog, in sort order', () => {
    const c = collection({ collection_places: [
      { sort_order: 2, places: { slug: 'b' } },
      { sort_order: 1, places: { slug: 'a' } },
    ] });
    const catalog = [place({ slug: 'a' }), place({ slug: 'b' })];
    expect(membersOf(c, catalog).map((p) => p.slug)).toEqual(['a', 'b']);
  });

  it('drops members the catalog does not have', () => {
    const c = collection({ collection_places: [{ sort_order: 0, places: { slug: 'gone' } }] });
    expect(membersOf(c, [])).toEqual([]);
  });

  // The reason a personal list keeps working after a change of city: it
  // carries its own places and never consults the catalog.
  it('prefers embedded members over the catalog', () => {
    const c = collection({ members: [hanoiPlace], collection_places: [] });
    expect(membersOf(c, [])).toEqual([hanoiPlace]);
  });

  it('trusts an embedded empty list rather than falling through to slugs', () => {
    const c = collection({
      members: [],
      collection_places: [{ sort_order: 0, places: { slug: 'a' } }],
    });
    expect(membersOf(c, [place({ slug: 'a' })])).toEqual([]);
  });
});

describe('touchesCity', () => {
  const hanoi = place({ slug: 'h', city_id: 'hanoi' });
  const saigon = place({ slug: 's', city_id: 'hcmc' });

  it('shows a list in the city its places are in', () => {
    expect(touchesCity([hanoi], 'hanoi')).toBe(true);
  });

  it('hides one whose places are all somewhere else', () => {
    expect(touchesCity([saigon], 'hanoi')).toBe(false);
  });

  // The whole point. Before this, a list stamped Hanoi with a place in
  // Saigon was invisible in Saigon and one member short in Hanoi.
  it('shows a list in every city it reaches', () => {
    const mixed = [hanoi, saigon];
    expect(touchesCity(mixed, 'hanoi')).toBe(true);
    expect(touchesCity(mixed, 'hcmc')).toBe(true);
  });

  // One place is enough — no proportion, no majority. A member is a
  // reason to appear, and the alternative is a list disappearing from a
  // city it demonstrably has something in.
  it('needs one member, not a share of them', () => {
    expect(touchesCity([hanoi, hanoi, hanoi, saigon], 'hcmc')).toBe(true);
  });

  it('hides an empty list from every city', () => {
    expect(touchesCity([], 'hanoi')).toBe(false);
    expect(touchesCity([], null)).toBe(false);
  });

  // During city bootstrap. Answering "no" here would empty the shelf for
  // a frame; answering the older question keeps it exactly as it was.
  it('falls back to "has anything at all" before a city is chosen', () => {
    expect(touchesCity([saigon], undefined)).toBe(true);
  });

  // A row fetched by a build that did not ask for `city_id` matches
  // nothing rather than everything. Silent absence beats silent
  // wrongness, and PLACE_COLS asks for the column precisely so this case
  // stays theoretical.
  it('does not match a member with no city on it', () => {
    expect(touchesCity([place({ slug: 'x' })], 'hanoi')).toBe(false);
  });
});
