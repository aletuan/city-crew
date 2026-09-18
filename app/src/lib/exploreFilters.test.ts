import { describe, expect, it } from 'vitest';
import type { Place } from './data';
import { filterExplorePlaces, type ExploreFilters } from './exploreFilters';

const hours = (value: string) =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((day) => `${day}: ${value}`);
const place = (slug: string, over: Partial<Place> = {}): Place => ({
  slug,
  name_en: slug,
  name_vi: slug,
  name_ja: null,
  category: 'out',
  categories: ['cafes'],
  is_featured: false,
  vibe_tags: [],
  neighborhood_en: null,
  neighborhood_vi: null,
  neighborhood_ja: null,
  address: null,
  lat: null,
  lng: null,
  rating: null,
  rating_count: null,
  price_display: null,
  price_vnd: null,
  duration_min: null,
  duration_max: null,
  desc_en: null,
  desc_vi: null,
  desc_ja: null,
  emoji: null,
  opening_hours: null,
  website: null,
  phone: null,
  place_photos: [],
  ...over,
});

const defaults: ExploreFilters = { sort: 'recommended', status: 'any', savedOnly: false };
const run = (places: Place[], over: Partial<Parameters<typeof filterExplorePlaces>[1]> = {}) =>
  filterExplorePlaces(places, {
    ...defaults,
    category: 'all',
    allCategory: 'all',
    origin: null,
    isSaved: () => false,
    now: new Date('2026-08-12T03:00:00Z'),
    ...over,
  });

describe('Explore filters', () => {
  it('preserves the recommendation order by default and filters categories', () => {
    const places = [place('first'), place('second', { categories: ['heritage'] })];
    expect(run(places).map((p) => p.slug)).toEqual(['first', 'second']);
    expect(run(places, { category: 'heritage' }).map((p) => p.slug)).toEqual(['second']);
  });

  it('separates known open and closed places without pretending unknown hours are closed', () => {
    const places = [
      place('open', { opening_hours: hours('Open 24 hours') }),
      place('closed', { opening_hours: hours('Closed') }),
      place('unknown'),
    ];
    expect(run(places, { status: 'open' }).map((p) => p.slug)).toEqual(['open']);
    expect(run(places, { status: 'closed' }).map((p) => p.slug)).toEqual(['closed']);
  });

  it('sorts ratings high to low and leaves unrated places last', () => {
    const places = [place('low', { rating: 4.1 }), place('none'), place('high', { rating: 4.9 })];
    expect(run(places, { sort: 'rating' }).map((p) => p.slug)).toEqual(['high', 'low', 'none']);
  });

  it('sorts distance near to far and leaves places without coordinates last', () => {
    const places = [
      place('far', { lat: 21.1, lng: 105.9 }),
      place('unknown'),
      place('near', { lat: 21.029, lng: 105.854 }),
    ];
    expect(run(places, { sort: 'distance', origin: { lat: 21.0285, lng: 105.8542 } }).map((p) => p.slug))
      .toEqual(['near', 'far', 'unknown']);
  });

  it('keeps only saved places when requested', () => {
    const places = [place('saved'), place('other')];
    expect(run(places, { savedOnly: true, isSaved: (slug) => slug === 'saved' }).map((p) => p.slug))
      .toEqual(['saved']);
  });
});
