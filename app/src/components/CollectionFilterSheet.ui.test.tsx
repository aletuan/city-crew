// @vitest-environment jsdom
//
// The Collections filter sheet on its own: which questions it asks, the
// draft it keeps until the button applies it, and the ways out. How the
// screen opens it and shows what it applied is CollectionsScreen's suite.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Keyboard, Platform } from 'react-native';
import { act, fireEvent, render, screen, within } from '../uitest/render';
import CollectionFilterSheet, { CITY_ROW_KEEP, CITY_ROW_MAX, type CollectionFilters } from './CollectionFilterSheet';

const CITIES = [{ key: 'hanoi', label: 'Hà Nội' }, { key: 'saigon', label: 'Sài Gòn' }];
const KINDS = [{ key: 'cafes', label: 'Cafés', icon: 'cafe-outline' as const }, { key: 'eats', label: 'Eats' }];

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

// ── many cities (owner, 25 Oct 2026) ──
//
// Ten cities, most-held first as the screen hands them over, each holding
// ten fewer lists than the one before; Huế holds no eats.
const MANY = [
  ['hanoi', 'Hà Nội'], ['hcmc', 'Sài Gòn', 'Ho Chi Minh City'], ['melbourne', 'Melbourne'], ['dalat', 'Đà Lạt'],
  ['danang', 'Đà Nẵng'], ['hoian', 'Hội An'], ['hue', 'Huế'], ['tokyo', 'Tokyo'], ['osaka', 'Osaka'], ['bangkok', 'Bangkok'],
].map(([key, label, alias]) => ({ key, label, names: [label, alias, key] }));
const manyCount = (f: CollectionFilters) => {
  if (f.city === 'hue' && f.kind === 'eats') return 0;
  const i = MANY.findIndex((c) => c.key === f.city);
  return (f.city ? 100 - i * 10 : 1000) - (f.kind ? 1 : 0);
};
const openMany = (over: Partial<React.ComponentProps<typeof CollectionFilterSheet>> = {}) =>
  open({ cities: MANY, countFor: manyCount, ...over });
const more = () => screen.getByTestId('collections-filter-cities-more');
const pickerRows = () => within(screen.getByTestId('collections-filter-city-list')).getAllByRole('button')
  .map((b) => b.textContent);

describe('the Collections filter sheet, with many cities', () => {
  it('holds every city in the row up to eight', () => {
    open({ cities: MANY.slice(0, CITY_ROW_MAX), countFor: manyCount });
    expect(words('collections-filter-cities')).toHaveLength(1 + CITY_ROW_MAX);
    expect(screen.queryByTestId('collections-filter-cities-more')).toBeNull();
  });

  it('past eight keeps the five most held, and ends in "More" saying how many it hides', () => {
    expect(CITY_ROW_KEEP).toBe(5);
    openMany();
    expect(words('collections-filter-cities')).toEqual([
      'All (1000)', 'Hà Nội (100)', 'Sài Gòn (90)', 'Melbourne (80)', 'Đà Lạt (70)', 'Đà Nẵng (60)', 'More (+5)',
    ]);
  });

  it('stands a chosen city from past the cut first after "All", and hides one fewer', () => {
    openMany({ applied: { city: 'tokyo', kind: null } });
    expect(words('collections-filter-cities')).toEqual([
      'All (1000)', 'Tokyo (30)', 'Hà Nội (100)', 'Sài Gòn (90)', 'Melbourne (80)', 'Đà Lạt (70)', 'Đà Nẵng (60)', 'More (+4)',
    ]);
    expect(answer('Tokyo').getAttribute('aria-selected')).toBe('true');
  });

  it('opens a picker from "More": "All" and every city A to Z, each with its figure', () => {
    openMany();
    fireEvent.click(more());
    expect(screen.getByText('Choose a city')).toBeTruthy();
    // The questions and the button wait behind it.
    expect(screen.queryByTestId('collections-filter-apply')).toBeNull();
    expect(screen.queryByTestId('collections-filter-close')).toBeNull();
    expect(pickerRows()).toEqual([
      'All1000', 'Bangkok10', 'Đà Lạt70', 'Đà Nẵng60', 'Hà Nội100', 'Hội An50', 'Huế40', 'Melbourne80', 'Osaka20', 'Sài Gòn90', 'Tokyo30',
    ]);
    expect(screen.getByTestId('collections-filter-city-all').getAttribute('aria-selected')).toBe('true');
  });

  it('chooses a city from the picker and goes back to the questions with it drafted, not applied', () => {
    const { onApply } = openMany();
    fireEvent.click(more());
    fireEvent.change(screen.getByTestId('collections-filter-city-search'), { target: { value: 'osa' } });
    fireEvent.click(screen.getByTestId('collections-filter-city-osaka'));
    expect(screen.queryByTestId('collections-filter-city-list')).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
    expect(words('collections-filter-cities')[1]).toBe('Osaka (20)');
    expect(answer('Osaka').getAttribute('aria-selected')).toBe('true');
    // What was typed went with the picker.
    fireEvent.click(more());
    expect((screen.getByTestId('collections-filter-city-search') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByTestId('collections-filter-back'));
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith({ city: 'osaka', kind: null });
  });

  it('lets go of the city by the picker\'s "All"', () => {
    const { onApply } = openMany({ applied: { city: 'osaka', kind: null } });
    fireEvent.click(more());
    expect(screen.getByTestId('collections-filter-city-osaka').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('collections-filter-city-all'));
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith({ city: null, kind: null });
  });

  it('searches every name a city answers to, without its marks, and says when none does', () => {
    openMany();
    fireEvent.click(more());
    const field = screen.getByTestId('collections-filter-city-search');
    fireEvent.change(field, { target: { value: 'ho chi' } });
    // Searching, "All" is not a match for anything and stands aside.
    expect(pickerRows()).toEqual(['Sài Gòn90']);
    fireEvent.change(field, { target: { value: 'hue' } });
    expect(pickerRows()).toEqual(['Huế40']);
    fireEvent.change(field, { target: { value: 'zz' } });
    expect(screen.getByText('No city by that name')).toBeTruthy();
    fireEvent.change(field, { target: { value: '' } });
    expect(screen.queryByText('No city by that name')).toBeNull();
    expect(pickerRows()[0]).toBe('All1000');
  });

  it('dims a city that would leave nothing under the drafted kind, but never the chosen one', () => {
    openMany({ applied: { city: null, kind: 'eats' } });
    fireEvent.click(more());
    // "All" counts under the drafted kind too.
    expect(pickerRows()[0]).toBe('All999');
    const hue = screen.getByTestId('collections-filter-city-hue');
    expect(hue.textContent).toBe('Huế0');
    expect(hue.getAttribute('aria-disabled')).toBe('true');
    expect(getComputedStyle(hue.firstElementChild as HTMLElement).opacity).toBe('0.45');
    fireEvent.click(hue);
    // Still the picker: the tap was not taken.
    expect(screen.getByTestId('collections-filter-city-list')).toBeTruthy();
    expect(screen.getByTestId('collections-filter-city-osaka').getAttribute('aria-disabled')).toBeNull();
  });

  it('keeps a chosen city that counts nothing in reach', () => {
    openMany({ applied: { city: 'hue', kind: 'eats' } });
    fireEvent.click(more());
    const hue = screen.getByTestId('collections-filter-city-hue');
    expect(hue.getAttribute('aria-selected')).toBe('true');
    expect(hue.getAttribute('aria-disabled')).toBeNull();
  });

  it('goes back by its ‹ without choosing, and forgets what was typed', () => {
    const { onApply } = openMany();
    fireEvent.click(more());
    fireEvent.change(screen.getByTestId('collections-filter-city-search'), { target: { value: 'osa' } });
    fireEvent.click(screen.getByTestId('collections-filter-back'));
    expect(screen.getByTestId('collections-filter-apply')).toBeTruthy();
    fireEvent.click(more());
    expect((screen.getByTestId('collections-filter-city-search') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByTestId('collections-filter-back'));
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith({ city: null, kind: null });
  });

  it('opens on its questions again, whatever page it was closed on', () => {
    const props = {
      applied: { city: null, kind: null }, cities: MANY, kinds: KINDS, countFor: manyCount,
      onClose: () => {}, onApply: () => {},
    };
    const { rerender } = render(<CollectionFilterSheet visible {...props} />);
    fireEvent.click(more());
    fireEvent.change(screen.getByTestId('collections-filter-city-search'), { target: { value: 'osa' } });
    rerender(<CollectionFilterSheet visible={false} {...props} />);
    rerender(<CollectionFilterSheet visible {...props} />);
    expect(screen.getByTestId('collections-filter-apply')).toBeTruthy();
    fireEvent.click(more());
    expect((screen.getByTestId('collections-filter-city-search') as HTMLInputElement).value).toBe('');
  });

  // The city sheet's keyboard (`CitySwitcher`'s suite says why it is
  // played this way): iOS only, and the sheet stands on it.
  it('stands on the keyboard while the picker is typed into, and gives up the height it took', () => {
    const was = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const spy = vi.spyOn(Keyboard, 'addListener').mockReturnValue({ remove: () => {} } as never);
    try {
      openMany();
      fireEvent.click(more());
      const sheet = screen.getByTestId('collections-filter-sheet');
      expect(sheet.style.bottom).toBe('0px');
      const full = parseFloat(sheet.style.maxHeight);
      const on = (name: string) => spy.mock.calls.find((c) => c[0] === name)![1] as (e?: unknown) => void;
      act(() => on('keyboardWillShow')({ endCoordinates: { height: 336 } }));
      expect(sheet.style.bottom).toBe('336px');
      expect(parseFloat(sheet.style.maxHeight)).toBeCloseTo(full - 336 * 0.92, 1);
      act(() => on('keyboardWillHide')());
      expect(sheet.style.bottom).toBe('0px');
    } finally {
      spy.mockRestore();
      Object.defineProperty(Platform, 'OS', { value: was, configurable: true });
    }
  });
});
