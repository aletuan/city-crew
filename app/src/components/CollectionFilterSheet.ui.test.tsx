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

const open = (over: Partial<React.ComponentProps<typeof CollectionFilterSheet>> = {}) => {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <CollectionFilterSheet
      visible
      applied={{ city: null, kind: null }}
      cities={CITIES}
      kinds={KINDS}
      // One list for a city alone, so the label shows which draft it counts.
      countFor={(f: CollectionFilters) => (f.city && f.kind ? 0 : f.city || f.kind ? 1 : 4)}
      onClose={onClose}
      onApply={onApply}
      {...over}
    />,
  );
  return { onApply, onClose };
};
const apply = () => screen.getByTestId('collections-filter-apply');

describe('the Collections filter sheet', () => {
  it('asks for a city and a kind, each an underline row with "All" first, and counts what a draft leaves', () => {
    const { onApply } = open();
    expect(within(screen.getByTestId('collections-filter-cities')).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['All', 'Hà Nội', 'Sài Gòn']);
    expect(within(screen.getByTestId('collections-filter-kinds')).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['All', 'Cafés', 'Eats']);
    expect(apply().textContent).toContain('Show 4 collections');
    fireEvent.click(screen.getByRole('button', { name: 'Sài Gòn' }));
    expect(apply().textContent).toContain('Show 1 collection');
    expect(apply().textContent).not.toContain('collections');
    fireEvent.click(screen.getByRole('button', { name: 'Eats' }));
    // Nothing is applied until the button says so.
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith({ city: 'saigon', kind: 'eats' });
  });

  it('lets a choice go when it is tapped again, or by "All", and Reset lets go of both', () => {
    const { onApply } = open({ applied: { city: 'hanoi', kind: 'cafes' } });
    expect(screen.getByRole('button', { name: 'Hà Nội' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));
    expect(screen.getByTestId('collections-filter-cities-all').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));
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
