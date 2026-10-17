// @vitest-environment jsdom
//
// The foot of the filter sheet: one track, the button inside it, and Reset
// arriving beside the button only while there is something to undo — with
// the slide the search box's Cancel uses, on the renders that move.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { ExploreFilters } from '../lib/exploreFilters';
import { colors } from '../theme';
import ExploreFilterSheet from './ExploreFilterSheet';

const NONE: ExploreFilters = { sort: 'recommended', status: 'any', savedOnly: false, visitedOnly: false };

const open = (applied: ExploreFilters = NONE) => render(
  <ExploreFilterSheet
    visible
    applied={applied}
    signedIn
    visitedAvailable
    // Fewer places for any narrowing, so the label says which draft it counts.
    countFor={(f) => (f.status === 'open' ? 3 : f.savedOnly ? 2 : 10)}
    onClose={() => {}}
    onApply={async () => null}
    onNeedSignIn={() => {}}
  />,
);

/** The track: the element that holds the button. */
const track = () => screen.getByTestId('filter-apply').parentElement!.parentElement!;

afterEach(() => { vi.restoreAllMocks(); });

describe('the sheet’s foot', () => {
  it('is one glass track around the button, with no Reset on an untouched sheet', () => {
    open();
    expect(screen.queryByTestId('filter-reset')).toBeNull();
    expect(getComputedStyle(track()).backgroundColor)
      .toBe(String(colors.surfaceGlass).replace(/,(?=\S)/g, ', '));
    expect(screen.getByText('Show 10 places')).toBeTruthy();
  });

  it('brings Reset into the same track, with its mark, once a filter is chosen', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'Open now' }));
    const reset = screen.getByTestId('filter-reset');
    expect(track().contains(reset)).toBe(true);
    expect(reset.querySelector('[data-icon="refresh"]')).toBeTruthy();
    expect(reset.textContent).toBe('Reset');
    expect(screen.getByText('Show 3 places')).toBeTruthy();
  });

  it('puts every answer back and takes Reset away on a tap', () => {
    open({ ...NONE, status: 'open', savedOnly: true });
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(screen.queryByTestId('filter-reset')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Any time', checked: true })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Bookmarked only', checked: false })).toBeTruthy();
    expect(screen.getByText('Show 10 places')).toBeTruthy();
  });

  // Armed on the renders where Reset comes or goes, and on no other: a
  // second filter while Reset already stands moves nothing.
  it('slides on the tap that brings Reset and on the tap that takes it, not between', () => {
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'Open now' }));
    expect(spy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('radio', { name: 'Nearest' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Closed now' }));
    expect(spy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(spy).toHaveBeenCalledTimes(2);
    // Undoing the one answer by hand gives the room back the same way.
    fireEvent.click(screen.getByRole('radio', { name: 'Open now' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Any time' }));
    expect(spy).toHaveBeenCalledTimes(4);
    expect(screen.queryByTestId('filter-reset')).toBeNull();
  });

  it('does not slide under Reduce Motion', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    open();
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('radio', { name: 'Open now' }));
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(spy).not.toHaveBeenCalled();
  });
});
