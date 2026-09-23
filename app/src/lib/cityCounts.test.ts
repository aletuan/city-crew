import { describe, expect, it } from 'vitest';
import { countsByCity, type Countable } from './cityCounts';

const row = (slug: string, city_id: string | null, over: Partial<Countable> = {}): Countable =>
  ({ slug, city_id, categories: [], vibe_tags: [], ...over } as Countable);

/** Monday to Sunday, one line each, in the shape `openState` reads. */
const week = (line: string) => Array.from({ length: 7 }, (_, i) =>
  `${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}: ${line}`);

// A Tuesday, mid-afternoon in the app's timezone.
const NOW = new Date('2026-09-15T08:00:00Z');
const NONE = () => false;
const ALL = 'all';
const plain = { category: ALL, allCategory: ALL, status: 'any' as const, savedOnly: false, isSaved: NONE, now: NOW, tz: () => 'Asia/Ho_Chi_Minh' };

describe('countsByCity', () => {
  it('counts each city under its own id', () => {
    expect(countsByCity([row('a', 'hanoi'), row('b', 'hanoi'), row('c', 'hcmc')], plain))
      .toEqual({ hanoi: 2, hcmc: 1 });
  });

  it('has nothing to say about a row with no city', () => {
    expect(countsByCity([row('a', null)], plain)).toEqual({});
  });

  // The whole reason this exists: every city's number is filtered the
  // same way, so the figures on the map can be compared with each other.
  it('narrows every city by the category, not only the one being read', () => {
    const rows = [
      row('a', 'hanoi', { categories: ['cafes'] }),
      row('b', 'hanoi', { categories: ['eats'] }),
      row('c', 'hcmc', { categories: ['cafes'] }),
      row('d', 'hcmc', { categories: ['eats'] }),
      row('e', 'hcmc', { categories: ['cafes', 'focus'] }),
    ];
    expect(countsByCity(rows, { ...plain, category: 'cafes' })).toEqual({ hanoi: 1, hcmc: 2 });
  });

  it('narrows every city by the opening hours', () => {
    const rows = [
      row('open-hanoi', 'hanoi', { opening_hours: week('12:00 AM – 11:59 PM') }),
      row('shut-hanoi', 'hanoi', { opening_hours: week('Closed') }),
      row('shut-hcmc', 'hcmc', { opening_hours: week('Closed') }),
    ];
    expect(countsByCity(rows, { ...plain, status: 'open' })).toEqual({ hanoi: 1 });
    expect(countsByCity(rows, { ...plain, status: 'closed' })).toEqual({ hanoi: 1, hcmc: 1 });
  });

  // The reader's saved places are their own, not this city's, so the
  // count for somewhere they have never been is still honest.
  it('narrows every city by what the reader saved', () => {
    const rows = [row('a', 'hanoi'), row('b', 'hcmc'), row('c', 'hcmc')];
    const saved = new Set(['a', 'c']);
    expect(countsByCity(rows, { ...plain, savedOnly: true, isSaved: (s) => saved.has(s) }))
      .toEqual({ hanoi: 1, hcmc: 1 });
  });

  // Absent, not zero: a marker with no number is silent, a marker with a
  // zero says something. The caller decides which to draw.
  it('leaves out a city where nothing survives', () => {
    const rows = [row('a', 'hanoi', { categories: ['cafes'] }), row('b', 'hcmc', { categories: ['eats'] })];
    const counts = countsByCity(rows, { ...plain, category: 'cafes' });
    expect(counts.hcmc).toBeUndefined();
    expect(counts).toEqual({ hanoi: 1 });
  });

  it('has nothing to say about nothing', () => {
    expect(countsByCity([], plain)).toEqual({});
  });
});
