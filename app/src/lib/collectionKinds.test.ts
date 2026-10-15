import { describe, expect, it } from 'vitest';
import { chooseKind, collectionKinds, derivedKinds, narrowTo } from './collectionKinds';

const p = (...categories: string[]) => ({ categories });
const many = (n: number, ...categories: string[]) => Array.from({ length: n }, () => p(...categories));

describe('derivedKinds', () => {
  // The live case that retired the threshold: 72 cafés, nine of which
  // also count as nightlife. Every kind shows, and the café chip leads.
  it('is every kind the places carry, most places first', () => {
    expect(derivedKinds([...many(63, 'cafes'), ...many(9, 'cafes', 'nightlife'), p('eats'), p('eats'), p('focus')]))
      .toEqual(['cafes', 'nightlife', 'eats', 'focus']);
  });

  // Level counts fall back to the filter row's order, so a tie reads the
  // way the chips on Explore do — not the way the rows came back.
  it('breaks a tie by the filter row’s order', () => {
    expect(derivedKinds([p('nightlife'), p('heritage'), p('cafes')])).toEqual(['cafes', 'heritage', 'nightlife']);
  });

  // The Đà Lạt list carries six; none is dropped.
  it('has no cap', () => {
    expect(derivedKinds([p('cafes', 'eats'), p('nature', 'views'), p('fun', 'nightlife')])).toHaveLength(6);
  });

  // A place is counted once per category, however its row repeats it.
  it('counts a place once per category', () => {
    expect(derivedKinds([p('eats', 'eats', 'eats'), p('cafes'), p('cafes')])).toEqual(['cafes', 'eats']);
  });

  it('ignores a key the table does not know', () => {
    expect(derivedKinds([p('street_food'), p('street_food'), p('eats')])).toEqual(['eats']);
  });

  // The legacy rows: no stored categories, a vibe that says one.
  it('reads a place’s categories the way every screen does', () => {
    expect(derivedKinds([{ vibe_tags: ['food_tour'] }])).toEqual(['eats']);
  });

  it('is empty for an empty list', () => {
    expect(derivedKinds([])).toEqual([]);
  });
});

describe('collectionKinds', () => {
  const list = [p('cafes'), p('cafes', 'nightlife')];

  it('is what the places carry when the owner has said nothing', () => {
    expect(collectionKinds(list, {})).toEqual(['cafes', 'nightlife']);
    expect(collectionKinds(list, { hidden: [] })).toEqual(['cafes', 'nightlife']);
  });

  it('takes off what the owner hid, and keeps the order of the rest', () => {
    expect(collectionKinds([...list, p('eats'), p('eats'), p('eats')], { hidden: ['cafes'] })).toEqual(['eats', 'nightlife']);
  });
});

describe('chooseKind', () => {
  it('hides a kind, once however often it is hidden', () => {
    expect(chooseKind({ hidden: ['eats'] }, 'cafes', false)).toEqual({ hidden: ['eats', 'cafes'] });
    expect(chooseKind({ hidden: ['cafes'] }, 'cafes', false)).toEqual({ hidden: ['cafes'] });
  });

  it('shows a kind again by not hiding it', () => {
    expect(chooseKind({ hidden: ['eats', 'cafes'] }, 'cafes', true)).toEqual({ hidden: ['eats'] });
    expect(chooseKind({ hidden: [] }, 'cafes', true)).toEqual({ hidden: [] });
  });
});

describe('narrowTo', () => {
  const a = { slug: 'a', categories: ['cafes'] };
  const b = { slug: 'b', categories: ['eats', 'nightlife'] };
  const c = { slug: 'c', categories: ['views'] };
  const all = [a, b, c];

  it('is the whole list, in its order, when nothing is chosen — and a copy of it', () => {
    const out = narrowTo(all, []);
    expect(out).toEqual(all);
    expect(out).not.toBe(all);
  });

  it('keeps the places carrying the one chosen kind', () => {
    expect(narrowTo(all, ['nightlife'])).toEqual([b]);
  });

  // Any, not all: two chips widen.
  it('keeps a place carrying any of several, in the list’s order', () => {
    expect(narrowTo(all, ['views', 'cafes'])).toEqual([a, c]);
  });

  it('is empty when no place carries what was chosen', () => {
    expect(narrowTo(all, ['fun'])).toEqual([]);
  });
});
