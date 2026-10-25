// @vitest-environment jsdom
//
// The Collections filter sheet on its own: which questions it asks, the
// draft it keeps until the button applies it, and the ways out. How the
// screen opens it and shows what it applied is CollectionsScreen's suite.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '../uitest/render';
import CollectionFilterSheet, { type CollectionFilters } from './CollectionFilterSheet';

const CITIES = [{ key: 'hanoi', label: 'Hà Nội' }, { key: 'saigon', label: 'Sài Gòn' }];
const KINDS = [{ key: 'cafes', label: 'Cafés', icon: 'cafe-outline' as const, iconColor: '#a66' }, { key: 'eats', label: 'Eats' }];

// Four lists, each the (city, kind) pairs of its places. Sài Gòn holds
// no eats, so that pair counts nothing — the case the dimming is for.
const LISTS = [
  [['hanoi', 'cafes']],
  [['hanoi', 'eats']],
  [['saigon', 'cafes']],
  [['hanoi', 'cafes'], ['hanoi', 'eats']],
];
const countFor = (f: CollectionFilters) =>
  LISTS.filter((l) => l.some(([c, k]) => (!f.city || c === f.city) && (!f.kind || k === f.kind))).length;

const open = (over: Partial<React.ComponentProps<typeof CollectionFilterSheet>> = {}) => {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <CollectionFilterSheet
      visible
      applied={{ city: null, kind: null }}
      cities={CITIES}
      kinds={KINDS}
      countFor={countFor}
      onClose={onClose}
      onApply={onApply}
      {...over}
    />,
  );
  return { onApply, onClose };
};
const apply = () => screen.getByTestId('collections-filter-apply');
// An answer by its word, whatever figure follows it.
const answer = (word: string) => screen.getByRole('button', { name: new RegExp(`^${word} ?(\\(\\d+\\))?$`) });
const words = (row: string) => within(screen.getByTestId(row)).getAllByRole('button').map((b) => b.textContent);

describe('the Collections filter sheet', () => {
  it('asks for a city and a kind, each an underline row with "All" first, and counts what a draft leaves', () => {
    const { onApply } = open();
    expect(words('collections-filter-cities')).toEqual(['All (4)', 'Hà Nội (3)', 'Sài Gòn (1)']);
    expect(words('collections-filter-kinds')).toEqual(['All (4)', 'Cafés (3)', 'Eats (2)']);
    expect(apply().textContent).toContain('Show 4 collections');
    fireEvent.click(answer('Hà Nội'));
    expect(apply().textContent).toContain('Show 3 collections');
    fireEvent.click(answer('Sài Gòn'));
    expect(apply().textContent).toContain('Show 1 collection');
    expect(apply().textContent).not.toContain('collections');
    fireEvent.click(answer('Cafés'));
    // Nothing is applied until the button says so.
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith({ city: 'saigon', kind: 'cafes' });
  });

  // Owner, 25 Oct 2026: each answer counted against the other question's
  // draft, and one that would leave nothing dimmed rather than dropped.
  it('counts each answer against the other question, and dims one that would leave nothing', () => {
    const { onApply } = open();
    fireEvent.click(answer('Sài Gòn'));
    // "All" counts the kinds in Sài Gòn; each kind, itself there.
    expect(words('collections-filter-kinds')).toEqual(['All (1)', 'Cafés (1)', 'Eats (0)']);
    // The cities' figures do not move: no kind is drafted.
    expect(words('collections-filter-cities')).toEqual(['All (4)', 'Hà Nội (3)', 'Sài Gòn (1)']);
    expect(answer('Eats').getAttribute('aria-disabled')).toBe('true');
    expect(answer('Cafés').getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(answer('Eats'));
    expect(answer('Eats').getAttribute('aria-selected')).toBe('false');
    // Still in the row, where it was, so nothing moves under the thumb.
    expect(words('collections-filter-kinds')[2]).toBe('Eats (0)');
    // Let go of the city, and it can be taken again.
    fireEvent.click(screen.getByTestId('collections-filter-cities-all'));
    expect(answer('Eats').getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(answer('Eats'));
    // Now the cities count the eats in each, "All" among them.
    expect(words('collections-filter-cities')).toEqual(['All (2)', 'Hà Nội (2)', 'Sài Gòn (0)']);
    expect(answer('Sài Gòn').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith({ city: null, kind: 'eats' });
  });

  it('never dims a chosen answer, even one that counts nothing', () => {
    open({ applied: { city: 'saigon', kind: 'eats' } });
    for (const word of ['Sài Gòn', 'Eats']) {
      expect(answer(word).getAttribute('aria-selected')).toBe('true');
      expect(answer(word).getAttribute('aria-disabled')).toBeNull();
    }
    expect(apply().textContent).toContain('Show 0 collections');
    // Tapped, it lets go, which is the way out of the empty pair.
    fireEvent.click(answer('Eats'));
    expect(apply().textContent).toContain('Show 1 collection');
  });

  it('lets a choice go when it is tapped again, or by "All", and Reset lets go of both', () => {
    const { onApply } = open({ applied: { city: 'hanoi', kind: 'cafes' } });
    expect(answer('Hà Nội').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(answer('Hà Nội'));
    expect(screen.getByTestId('collections-filter-cities-all').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(answer('Hà Nội'));
    fireEvent.click(screen.getByTestId('collections-filter-kinds-all'));
    fireEvent.click(apply());
    expect(onApply).toHaveBeenLastCalledWith({ city: 'hanoi', kind: null });
    fireEvent.click(screen.getByTestId('collections-filter-reset'));
    expect(screen.queryByTestId('collections-filter-reset')).toBeNull();
    fireEvent.click(apply());
    expect(onApply).toHaveBeenLastCalledWith({ city: null, kind: null });
  });

  it('asks nothing about a group with no choice in it', () => {
    open({ cities: [CITIES[0]] });
    expect(screen.queryByTestId('collections-filter-cities')).toBeNull();
    expect(screen.queryByText('City')).toBeNull();
    expect(screen.getByText('Kind of place')).toBeTruthy();
  });

  it('closes by its ✕ and by the backdrop, and applies nothing', () => {
    const { onApply, onClose } = open();
    fireEvent.click(screen.getByTestId('collections-filter-close'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onApply).not.toHaveBeenCalled();
  });
});
