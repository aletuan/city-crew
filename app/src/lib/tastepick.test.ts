import { describe, expect, it } from 'vitest';
import { cleanTaste, tasteFull, tasteInOrder, TASTE_MAX, toggleTaste } from './tastepick';
import { CATEGORIES } from './categories';

const KNOWN = Object.keys(CATEGORIES);

describe('toggleTaste', () => {
  it('adds what is not there and removes what is', () => {
    expect(toggleTaste([], 'cafes')).toEqual(['cafes']);
    expect(toggleTaste(['cafes', 'eats'], 'cafes')).toEqual(['eats']);
  });

  it('keeps the order they were tapped in', () => {
    expect(toggleTaste(['eats', 'views'], 'cafes')).toEqual(['eats', 'views', 'cafes']);
  });

  // The ceiling, and the shape of hitting it. A picker that evicted the
  // oldest choice to make room would drop a decision the reader made
  // without saying so; refusing lets the screen explain itself.
  it('refuses a sixth rather than evicting the first', () => {
    const five = ['cafes', 'eats', 'views', 'heritage', 'nature'];
    expect(toggleTaste(five, 'markets')).toEqual(five);
    expect(five).toHaveLength(TASTE_MAX);
  });

  it('still lets a full list swap by removing first', () => {
    const five = ['cafes', 'eats', 'views', 'heritage', 'nature'];
    const four = toggleTaste(five, 'nature');
    expect(toggleTaste(four, 'markets')).toEqual(['cafes', 'eats', 'views', 'heritage', 'markets']);
  });

  it('never mutates what it was given', () => {
    const before = ['cafes'];
    toggleTaste(before, 'eats');
    expect(before).toEqual(['cafes']);
  });
});

describe('tasteFull', () => {
  it('is what the screen asks before the reader finds out by tapping', () => {
    expect(tasteFull(['cafes'])).toBe(false);
    expect(tasteFull(['cafes', 'eats', 'views', 'heritage', 'nature'])).toBe(true);
  });
});

describe('cleanTaste', () => {
  // These are the real rows in `preferences`-adjacent free text today,
  // typed by hand into a box that never validated anything: half of them
  // are category keys and half are words the app has no chip for.
  it('drops what the taxonomy has never heard of', () => {
    expect(cleanTaste(['cafes', 'classics', 'heritage', 'Nitendo'], KNOWN))
      .toEqual(['cafes', 'heritage']);
  });

  it('drops a repeat rather than counting it twice', () => {
    expect(cleanTaste(['cafes', 'cafes', 'eats'], KNOWN)).toEqual(['cafes', 'eats']);
  });

  // A row written before the ceiling existed can be longer than one
  // written after it, and nothing migrates.
  it('caps a row that predates the ceiling', () => {
    expect(cleanTaste(KNOWN, KNOWN)).toHaveLength(TASTE_MAX);
  });

  it('has nothing to say about nothing', () => {
    expect(cleanTaste([], KNOWN)).toEqual([]);
  });

  // The keys are read off `categories.ts` rather than listed here: a
  // category added there and forgotten here would be a chip the picker
  // draws and this quietly throws away.
  it('accepts every key the app can actually draw', () => {
    expect(cleanTaste(KNOWN.slice(0, TASTE_MAX), KNOWN)).toEqual(KNOWN.slice(0, TASTE_MAX));
  });
});

describe('tasteInOrder', () => {
  const known = ['cafes', 'eats', 'views', 'heritage', 'nature'];

  it('shows the interests in the picker’s order, whatever order they were pressed in', () => {
    expect(tasteInOrder(['nature', 'heritage', 'eats'], known)).toEqual(['eats', 'heritage', 'nature']);
    expect(tasteInOrder(['views', 'cafes'], known)).toEqual(['cafes', 'views']);
  });

  it('leaves a list already in that order as it is, and an empty one empty', () => {
    expect(tasteInOrder(['cafes', 'nature'], known)).toEqual(['cafes', 'nature']);
    expect(tasteInOrder([], known)).toEqual([]);
  });

  it('shows nothing the taxonomy does not have', () => {
    expect(tasteInOrder(['Nitendo', 'eats'], known)).toEqual(['eats']);
  });

  it('does not touch the list it was handed', () => {
    const pressed = ['nature', 'cafes'];
    tasteInOrder(pressed, known);
    expect(pressed).toEqual(['nature', 'cafes']);
  });
});
