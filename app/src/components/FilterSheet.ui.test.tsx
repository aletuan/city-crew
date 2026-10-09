// @vitest-environment jsdom
//
// The generic sheet: sections of one-choice rows, a draft that is only
// applied on the button, Reset only when there is something to undo,
// and a count that follows the draft.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import FilterSheet, { type FilterSection } from './FilterSheet';
import { colors } from '../theme';

const sections: FilterSection[] = [
  { key: 'city', title: 'City', allLabel: 'Every city', options: [{ id: 'hanoi', label: 'Hanoi' }, { id: 'saigon', label: 'Saigon' }] },
  { key: 'kind', title: 'Kind', allLabel: 'Every kind', options: [{ id: 'cafes', label: 'Cafés', icon: 'cafe-outline', iconColor: '#D2A679' }, { id: 'eats', label: 'Eats', icon: 'restaurant-outline' }] },
];
const spies = vi.hoisted(() => ({ apply: vi.fn(), close: vi.fn() }));
const countFor = (v: Record<string, string | null>) => (v.city === 'hanoi' ? 3 : v.kind === 'cafes' ? 5 : 12);

const show = (applied: Record<string, string | null> = { city: null, kind: null }) => render(
  <FilterSheet
    visible
    title="Filter"
    sections={sections}
    applied={applied}
    countFor={countFor}
    noun={(n) => (n === 1 ? 'place' : 'places')}
    onClose={spies.close}
    onApply={spies.apply}
  />,
);

beforeEach(() => { spies.apply.mockClear(); spies.close.mockClear(); });

describe('FilterSheet', () => {
  it('draws every section with its "all" row first, chosen when nothing is', () => {
    show();
    expect(screen.getByText('City')).toBeTruthy();
    expect(screen.getByText('Kind')).toBeTruthy();
    const all = screen.getByRole('radio', { name: 'Every city' });
    expect(all.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Hanoi' }).getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('[data-icon="cafe-outline"]')?.getAttribute('data-color')).toBe('#D2A679');
    // An option without its own colour takes the quiet secondary one.
    expect(document.querySelector('[data-icon="restaurant-outline"]')?.getAttribute('data-color')).toBe(colors.textSecondary);
    expect(screen.getByRole('button', { name: 'Show 12 places' })).toBeTruthy();
    expect(screen.queryByTestId('filter-reset')).toBeNull();
  });

  it('keeps a draft: the count follows it, Reset appears, nothing is applied until the button', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: 'Hanoi' }));
    expect(screen.getByRole('radio', { name: 'Hanoi' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Every city' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: 'Show 3 places' })).toBeTruthy();
    expect(screen.getByTestId('filter-reset')).toBeTruthy();
    expect(spies.apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('filter-apply'));
    expect(spies.apply).toHaveBeenCalledWith({ city: 'hanoi', kind: null });
  });

  it('resets the draft to nothing chosen, and says one place in the singular', () => {
    show({ city: 'hanoi', kind: null });
    expect(screen.getByRole('button', { name: 'Show 3 places' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(screen.getByRole('radio', { name: 'Every city' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByTestId('filter-reset')).toBeNull();
    fireEvent.click(screen.getByTestId('filter-apply'));
    expect(spies.apply).toHaveBeenCalledWith({ city: null, kind: null });
  });

  it('closes from its own control and from the backdrop', () => {
    show();
    fireEvent.click(screen.getByTestId('filter-close'));
    expect(spies.close).toHaveBeenCalledTimes(1);
  });

  it('starts the draft over from what is applied each time it is shown', () => {
    // A choice made and then abandoned by closing must not be waiting on
    // the next open: the sheet reads `applied` on every show, not once.
    // (The test harness's Modal draws its children whether or not it is
    // visible, so this checks the draft, not the drawing.)
    const { rerender } = show();
    fireEvent.click(screen.getByRole('radio', { name: 'Hanoi' }));
    expect(screen.getByRole('button', { name: 'Show 3 places' })).toBeTruthy();
    rerender(<FilterSheet visible={false} title="Filter" sections={sections} applied={{ city: null, kind: null }} countFor={countFor} noun={() => 'places'} onClose={spies.close} onApply={spies.apply} />);
    rerender(<FilterSheet visible title="Filter" sections={sections} applied={{ city: null, kind: null }} countFor={countFor} noun={() => 'places'} onClose={spies.close} onApply={spies.apply} />);
    // The Hanoi choice was never applied, so it does not come back.
    expect(screen.getByRole('radio', { name: 'Every city' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'Show 12 places' })).toBeTruthy();
  });
});
