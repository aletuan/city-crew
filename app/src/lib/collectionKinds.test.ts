import { describe, expect, it } from 'vitest';
import { chooseKind, collectionKinds, derivedKinds, KIND_CAP, kindsPresent, narrowTo } from './collectionKinds';

const p = (...categories: string[]) => ({ categories });
const many = (n: number, ...categories: string[]) => Array.from({ length: n }, () => p(...categories));

describe('derivedKinds', () => {
  // The live case that set the threshold: 72 cafés, nine of which also
  // count as nightlife. Every category drawn would have said Nightlife.
  it('keeps a category under a third of the list off', () => {
    expect(derivedKinds([...many(63, 'cafes'), ...many(9, 'cafes', 'nightlife')])).toEqual(['cafes']);
  });

  // Exactly a third is enough; a hair under is not.
  it('shows a category at exactly a third, and not just under', () => {
    expect(derivedKinds([p('eats'), p('cafes'), p('cafes')])).toEqual(['cafes', 'eats']);
    expect(derivedKinds([p('eats'), p('cafes'), p('cafes'), p('cafes')])).toEqual(['cafes']);
  });

  it('puts the category most places carry first', () => {
    expect(derivedKinds([p('views', 'nightlife'), p('nightlife'), p('nightlife', 'views'), p('nightlife')]))
      .toEqual(['nightlife', 'views']);
  });

  // Level counts fall back to the filter row's order, so a tie reads the
  // way the chips on Explore do — not the way the rows came back.
  it('breaks a tie by the filter row’s order', () => {
    expect(derivedKinds([p('heritage'), p('cafes')])).toEqual(['cafes', 'heritage']);
  });

  // Three places in four categories, the most any live list kept.
  it('stops at the cap', () => {
    expect(KIND_CAP).toBe(3);
    expect(derivedKinds([p('nightlife', 'heritage'), p('eats'), p('cafes')]))
      .toEqual(['cafes', 'eats', 'heritage']);
  });

  // A place is counted once per category, however its row repeats it.
  it('counts a place once per category', () => {
    expect(derivedKinds([p('eats', 'eats'), p('cafes'), p('cafes'), p('cafes'), p('cafes')])).toEqual(['cafes']);
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
  const cafes = many(3, 'cafes');

  it('is what the places earn when the owner has said nothing', () => {
    expect(collectionKinds(cafes, {})).toEqual(['cafes']);
    expect(collectionKinds(cafes, { hidden: [], added: [] })).toEqual(['cafes']);
  });

  it('takes off what the owner hid', () => {
    expect(collectionKinds(cafes, { hidden: ['cafes'] })).toEqual([]);
  });

  // Any of the nine, earned or not — the owner's ruling.
  it('puts on what the owner added, first and in the filter row’s order', () => {
    expect(collectionKinds(cafes, { added: ['nature', 'eats'] })).toEqual(['eats', 'nature', 'cafes']);
  });

  it('draws an added chip once, even where the places earn it too', () => {
    expect(collectionKinds(cafes, { added: ['cafes', 'cafes'] })).toEqual(['cafes']);
  });

  // The cap is taken before the hidden leave: hiding one of three does
  // not pull a fourth up.
  it('does not promote a fourth category when one of the three is hidden', () => {
    const four = [p('nightlife', 'heritage'), p('eats'), p('cafes')];
    expect(collectionKinds(four, { hidden: ['eats'] })).toEqual(['cafes', 'heritage']);
  });

  // The database refuses a key in both lists; a row that somehow had one
  // reads as hidden, the safer of the two words.
  it('lets hidden win over added', () => {
    expect(collectionKinds(cafes, { hidden: ['eats'], added: ['eats'] })).toEqual(['cafes']);
  });

  it('drops an added key the table does not know', () => {
    expect(collectionKinds([], { added: ['rooftop'] })).toEqual([]);
  });
});

describe('chooseKind', () => {
  it('turns a chip on by adding it and clearing any hide', () => {
    expect(chooseKind({ hidden: ['eats', 'cafes'], added: [] }, 'cafes', true)).toEqual({ hidden: ['eats'], added: ['cafes'] });
  });

  it('turns a chip off by hiding it and clearing any add', () => {
    expect(chooseKind({ hidden: [], added: ['nature', 'views'] }, 'nature', false)).toEqual({ hidden: ['nature'], added: ['views'] });
  });

  // On twice is still one word, not two copies of it.
  it('never holds a key twice or in both lists', () => {
    const once = chooseKind({ hidden: [], added: ['cafes'] }, 'cafes', true);
    expect(once).toEqual({ hidden: [], added: ['cafes'] });
    const off = chooseKind(once, 'cafes', false);
    expect(off).toEqual({ hidden: ['cafes'], added: [] });
  });
});

describe('kindsPresent', () => {
  it('is every category any place carries, in the filter row’s order', () => {
    expect(kindsPresent([p('nightlife'), ...many(70, 'cafes'), p('cafes', 'focus')]))
      .toEqual(['cafes', 'focus', 'nightlife']);
  });

  it('leaves out a key the table does not know', () => {
    expect(kindsPresent([p('street_food'), p('eats')])).toEqual(['eats']);
  });

  it('reads legacy rows the way every screen does', () => {
    expect(kindsPresent([{ vibe_tags: ['food_tour'] }])).toEqual(['eats']);
  });
});

describe('narrowTo', () => {
  const a = { slug: 'a', categories: ['cafes'] };
  const b = { slug: 'b', categories: ['eats', 'nightlife'] };
  const c = { slug: 'c', categories: ['views'] };
  const list = [a, b, c];

  it('is the whole list, in its order, when nothing is chosen — and a copy of it', () => {
    const all = narrowTo(list, []);
    expect(all).toEqual(list);
    expect(all).not.toBe(list);
  });

  it('keeps the places carrying the one chosen kind', () => {
    expect(narrowTo(list, ['nightlife'])).toEqual([b]);
  });

  // Any, not all: two chips widen.
  it('keeps a place carrying any of several, in the list’s order', () => {
    expect(narrowTo(list, ['views', 'cafes'])).toEqual([a, c]);
  });

  it('is empty when no place carries what was chosen', () => {
    expect(narrowTo(list, ['fun'])).toEqual([]);
  });
});
