import { describe, expect, it } from 'vitest';
import { countByCategory, planGap, plansAvailable } from './gaps';

const p = (...categories: string[]) => ({ categories });

// The shape of the real catalog, which is the whole reason this file
// exists: Da Nang holds two places to eat, and two of the three cities
// hold no shopping places at all. Thinned to keep the fixtures readable,
// and one market kept in each so the scarce-but-present case has a
// fixture too; the ratios are the point, not the totals.
const HANOI = [
  ...Array.from({ length: 8 }, () => p('eats')),
  ...Array.from({ length: 5 }, () => p('cafes')),
  ...Array.from({ length: 3 }, () => p('heritage')),
  p('markets'),
];
const DANANG = [
  ...Array.from({ length: 4 }, () => p('nightlife')),
  p('eats'), p('eats'),
  p('markets'),
];

describe('countByCategory', () => {
  it('counts a place once per category it carries', () => {
    const counts = countByCategory([p('eats', 'views'), p('eats')]);
    expect(counts.get('eats')).toBe(2);
    expect(counts.get('views')).toBe(1);
  });

  it('reads the vibe fallback the way the rest of the app does', () => {
    // A row written before `categories` existed still counts, because
    // `categoriesOf` derives it — a count that disagreed with the filter
    // row would send the reader to an empty screen.
    const counts = countByCategory([{ vibe_tags: ['food_tour'] }]);
    expect(counts.get('eats')).toBe(1);
  });

  it('says nothing about a category with nothing in it', () => {
    expect(countByCategory(HANOI).get('nature')).toBeUndefined();
  });
});

describe('planGap', () => {
  it('names what the reader asked for and this city has not got', () => {
    expect(planGap(['nature', 'eats'], HANOI).empty).toEqual(['nature']);
  });

  it('keeps the reader’s own order rather than reordering their answers', () => {
    expect(planGap(['views', 'nature'], HANOI).empty).toEqual(['views', 'nature']);
  });

  it('is empty when everything asked for exists', () => {
    expect(planGap(['eats', 'cafes'], HANOI).empty).toEqual([]);
  });

  it('suggests the busiest category the reader did not already ask for', () => {
    expect(planGap(['nature'], HANOI).suggestion).toBe('eats');
  });

  it('never suggests the thing that just failed', () => {
    // Suggesting "cafés" to somebody whose café plan found nothing is
    // worse than saying nothing at all.
    const gap = planGap(['eats', 'cafes', 'heritage'], HANOI);
    expect(gap.suggestion).toBe('markets');
    expect(gap.empty).not.toContain(gap.suggestion);
  });

  it('says nothing rather than inventing when there is nothing left to offer', () => {
    expect(planGap(['eats'], [p('eats')]).suggestion).toBeNull();
    expect(planGap(['eats'], []).suggestion).toBeNull();
  });

  it('answers for the city it was given, not for the catalog', () => {
    // The failure this guards: naming a category Hanoi is full of to
    // somebody planning a day in Da Nang.
    expect(planGap(['cafes'], DANANG).empty).toEqual(['cafes']);
    expect(planGap(['cafes'], DANANG).suggestion).toBe('nightlife');
  });

  it('does not rewrite itself between two renders of the same catalog', () => {
    // Two categories with one place each: the tie has to break the same
    // way every time, or the sentence changes while it is being read.
    const tied = [p('nature'), p('markets')];
    expect(planGap([], tied).suggestion).toBe('markets');
    expect(planGap([], [...tied].reverse()).suggestion).toBe('markets');
  });
});

describe('plansAvailable', () => {
  it('offers three when the city is deep enough', () => {
    expect(plansAvailable(['eats', 'cafes'], HANOI)).toBe(3);
  });

  it('offers one when the city holds one such place', () => {
    // A category with one place in it cannot become three plans, and
    // three near-identical cards claim a choice that is not there.
    expect(plansAvailable(['markets'], HANOI)).toBe(1);
  });

  it('is limited by the scarcest thing asked for', () => {
    // Da Nang: plenty of nightlife, two places to eat. An evening that
    // wants dinner is capped by dinner.
    expect(plansAvailable(['nightlife', 'eats'], DANANG)).toBe(2);
  });

  it('refuses when nothing asked for exists here', () => {
    expect(plansAvailable(['nature'], HANOI)).toBe(0);
    expect(plansAvailable(['eats'], [])).toBe(0);
  });

  it('still plans when no category was asked for at all', () => {
    // `canPlan` requires a category, so this is defence rather than a
    // reachable state — but returning 0 here would turn a full catalog
    // into an empty screen.
    expect(plansAvailable([], HANOI)).toBe(3);
    expect(plansAvailable([], [p('eats')])).toBe(1);
  });
});
