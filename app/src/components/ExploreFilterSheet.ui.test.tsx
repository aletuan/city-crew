// @vitest-environment jsdom
//
// The foot of the filter sheet: one track, the button inside it, and Reset
// arriving beside the button only while there is something to undo — with
// the slide the search box's Cancel uses, on the renders that move.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo, Dimensions, LayoutAnimation, StyleSheet } from 'react-native';
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
    nowMin={14 * 60 + 37}
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

describe('a sheet taller than the screen', () => {
  type Fiber = { return: Fiber | null; memoizedProps: Record<string, unknown> };
  /** The props React holds for the nearest component carrying this testID
   *  and this prop. */
  const propsOf = (testID: string, prop: string) => {
    const node = screen.getByTestId(testID);
    const key = Object.keys(node).find((k) => k.startsWith('__reactFiber'))!;
    let f = (node as unknown as Record<string, Fiber>)[key];
    while (f && !(f.memoizedProps.testID === testID && prop in f.memoizedProps)) f = f.return!;
    return f.memoizedProps;
  };
  /** Whether the pull to close is on this element: its responder asks to
   *  capture a move. */
  const pulls = (testID: string) => typeof screen.getByTestId(testID) === 'object'
    && typeof (propsOf(testID, 'testID') as Record<string, unknown>).onMoveShouldSetResponderCapture === 'function';
  const measure = (view: number, content: number) => act(() => {
    (propsOf('filter-questions', 'onLayout').onLayout as (e: unknown) => void)({ nativeEvent: { layout: { height: view } } });
    (propsOf('filter-questions', 'onContentSizeChange').onContentSizeChange as (w: number, h: number) => void)(350, content);
  });

  // Where the questions fit, nothing scrolls and the whole sheet pulls.
  it('does not scroll where its questions fit, and pulls from anywhere', () => {
    open();
    measure(560, 560);
    expect(propsOf('filter-questions', 'scrollEnabled').scrollEnabled).toBe(false);
    expect(pulls('filter-sheet')).toBe(true);
    expect(pulls('filter-sheet-top')).toBe(false);
  });

  // An iPhone SE with check-in on: the questions scroll, Apply stays put,
  // and the pull moves to the handle and title so the finger can scroll.
  it('scrolls its questions where they do not fit, and pulls from the top only', () => {
    open();
    measure(420, 560);
    expect(propsOf('filter-questions', 'scrollEnabled').scrollEnabled).toBe(true);
    expect(pulls('filter-sheet')).toBe(false);
    expect(pulls('filter-sheet-top')).toBe(true);
    expect(screen.getByTestId('filter-questions').contains(screen.getByTestId('filter-apply'))).toBe(false);
  });

  it('is never taller than the screen below the status bar', () => {
    open();
    // The insets are zero here; the window is whatever jsdom says it is.
    expect(StyleSheet.flatten(propsOf('filter-sheet', 'style').style as never))
      .toEqual(expect.objectContaining({ maxHeight: Dimensions.get('window').height - 24 }));
  });
});
