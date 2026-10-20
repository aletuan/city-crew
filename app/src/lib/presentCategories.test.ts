import { describe, expect, it } from 'vitest';
import { presentCategories } from './categories';

// Its own file rather than inside `taxonomy.test.ts`, which holds the
// table itself; this holds one question asked of a catalog.
describe('presentCategories', () => {
  it('offers only what the catalog holds, in the filter row’s order', () => {
    // Arrives nightlife first and markets twice; leaves cafés before both.
    const places = [
      { categories: ['nightlife'] },
      { categories: ['cafes', 'markets'] },
      { categories: ['markets'] },
    ];
    expect(presentCategories(places)).toEqual(['cafes', 'markets', 'nightlife']);
  });

  // `categoriesOf`, so a row written before the column existed still counts.
  it('reads a place’s categories the way the cards do', () => {
    expect(presentCategories([{ categories: [], vibe_tags: ['culture'] }])).toEqual(['heritage']);
  });

  it('drops a key the row has no place for', () => {
    expect(presentCategories([{ categories: ['street_food', 'eats'] }])).toEqual(['eats']);
  });

  it('offers nothing for an empty catalog', () => {
    expect(presentCategories([])).toEqual([]);
  });
});
