import { describe, expect, it } from 'vitest';
import {
  byCity, cityChips, countByCity, namesCities, picked, tapCity, totalFound,
} from './searchCities';

const at = (...ids: (string | null)[]) => ids.map((city_id) => ({ city_id }));

describe('countByCity', () => {
  it('counts the places found in each city, and skips a place that cannot say where it is', () => {
    expect([...countByCity(at('hanoi', 'hcmc', 'hanoi', null))]).toEqual([['hanoi', 2], ['hcmc', 1]]);
  });
});

describe('cityChips', () => {
  it('puts the reader’s city first, then the rest most first, ties by id', () => {
    const counts = countByCity(at('hcmc', 'hcmc', 'hanoi', 'danang', 'dalat', 'hcmc', 'danang'));
    expect(cityChips(counts, 'hanoi', 'all')).toEqual([
      { id: 'hanoi', count: 1 }, { id: 'hcmc', count: 3 }, { id: 'danang', count: 2 }, { id: 'dalat', count: 1 },
    ]);
  });

  // Nothing is chosen for the reader any more (24 Oct 2026), so a chip
  // for a home that found nothing would only offer an empty screen.
  it('leaves out the reader’s city when it found nothing and is not chosen', () => {
    expect(cityChips(countByCity(at('hcmc')), 'hanoi', 'all')).toEqual([{ id: 'hcmc', count: 1 }]);
  });

  it('keeps a chosen city’s chip when it found nothing, home first if chosen', () => {
    expect(cityChips(countByCity(at('hanoi')), 'hanoi', ['dalat'])).toEqual([{ id: 'hanoi', count: 1 }, { id: 'dalat', count: 0 }]);
    expect(cityChips(countByCity(at('hcmc')), 'hanoi', ['hanoi'])).toEqual([{ id: 'hanoi', count: 0 }, { id: 'hcmc', count: 1 }]);
    expect(cityChips(countByCity(at('hanoi')), 'hanoi', 'all')).toEqual([{ id: 'hanoi', count: 1 }]);
  });

  it('holds still between ties', () => {
    expect(cityChips(countByCity(at('vungtau', 'hue', 'dalat')), 'hanoi', 'all').map((c) => c.id))
      .toEqual(['dalat', 'hue', 'vungtau']);
  });
});

describe('byCity', () => {
  // Stable: within a city, the match's own ranking holds.
  it('puts the places in the order of their cities, each city’s as they came', () => {
    const found = [
      { slug: 'sg1', city_id: 'hcmc' }, { slug: 'dl', city_id: 'dalat' }, { slug: 'hn1', city_id: 'hanoi' },
      { slug: 'sg2', city_id: 'hcmc' }, { slug: 'hn2', city_id: 'hanoi' },
    ];
    expect(byCity(found, ['hanoi', 'hcmc', 'dalat']).map((p) => p.slug)).toEqual(['hn1', 'hn2', 'sg1', 'sg2', 'dl']);
  });

  it('puts a place whose city is not in the order, or not known, last', () => {
    const found = [{ slug: 'x', city_id: null }, { slug: 'hue', city_id: 'hue' }, { slug: 'hn', city_id: 'hanoi' }];
    expect(byCity(found, ['hanoi']).map((p) => p.slug)).toEqual(['hn', 'x', 'hue']);
  });

  it('leaves the list it was given alone', () => {
    const found = [{ city_id: 'hcmc' }, { city_id: 'hanoi' }];
    byCity(found, ['hanoi']);
    expect(found).toEqual([{ city_id: 'hcmc' }, { city_id: 'hanoi' }]);
  });
});

describe('totalFound', () => {
  it('is every city’s count together', () => {
    expect(totalFound(countByCity(at('hanoi', 'hcmc', 'hcmc')))).toBe(3);
    expect(totalFound(new Map())).toBe(0);
  });
});

describe('tapCity', () => {
  // One city at a time (owner, 24 Oct 2026): another city moves to it.
  it('moves to a city not chosen, alone', () => {
    expect(tapCity(['hanoi'], 'hcmc')).toEqual(['hcmc']);
  });

  // The chosen chip lets go, as every filter chip in the app does.
  it('goes back to All when the chosen city is tapped again', () => {
    expect(tapCity(['hanoi'], 'hanoi')).toBe('all');
  });

  it('makes a city tapped under All the only one', () => {
    expect(tapCity('all', 'dalat')).toEqual(['dalat']);
  });
});

describe('picked', () => {
  it('is every city under All, and the chosen ones otherwise', () => {
    expect(picked('all', 'dalat')).toBe(true);
    expect(picked(['hanoi'], 'hanoi')).toBe(true);
    expect(picked(['hanoi'], 'dalat')).toBe(false);
    expect(picked(['hanoi'], null)).toBe(false);
  });
});

describe('namesCities', () => {
  it('names a card’s city only under All, where more than one city can be on screen', () => {
    expect(namesCities(['hanoi'])).toBe(false);
    expect(namesCities('all')).toBe(true);
  });
});
