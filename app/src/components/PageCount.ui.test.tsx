// @vitest-environment jsdom
//
// Where every carousel is: "2 / 4" in one pill. Pinned: the page in hand
// counted from one, the total, nothing for a single page, the corner it
// sits in, and that it is not read aloud (each photograph names itself).

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../uitest/render';

import PageCount, { PAGE_COUNT_H } from './PageCount';

describe('PageCount', () => {
  it('says the page in hand, counted from one, and the total', () => {
    render(<PageCount count={4} page={1} testID="count" />);
    expect(screen.getByTestId('count').textContent).toBe('2 / 4');
  });

  it('follows the page', () => {
    const { rerender } = render(<PageCount count={3} page={0} testID="count" />);
    expect(screen.getByTestId('count').textContent).toBe('1 / 3');
    rerender(<PageCount count={3} page={2} testID="count" />);
    expect(screen.getByTestId('count').textContent).toBe('3 / 3');
  });

  // The dots stopped at a window of seven, past which they could not say
  // the total; a count says it at any length.
  it('says the whole total on a long day, with no window', () => {
    render(<PageCount count={12} page={11} testID="count" />);
    expect(screen.getByTestId('count').textContent).toBe('12 / 12');
    expect(document.querySelectorAll('[data-testid="count"] *').length).toBe(1);
  });

  it('draws nothing for a single page', () => {
    render(<PageCount count={1} page={0} testID="count" />);
    expect(screen.queryByTestId('count')).toBeNull();
  });

  it('sits in the bottom-right corner at the inset it is given, unread by VoiceOver', () => {
    render(<PageCount count={2} page={0} right={22} bottom={15} testID="count" />);
    const pill = screen.getByTestId('count') as HTMLElement;
    expect(pill.style.right).toBe('22px');
    expect(pill.style.bottom).toBe('15px');
    expect(pill.getAttribute('aria-hidden')).toBe('true');
  });

  it('insets 12pt by default, a card’s corner', () => {
    render(<PageCount count={2} page={0} testID="count" />);
    const pill = screen.getByTestId('count') as HTMLElement;
    expect(pill.style.right).toBe('12px');
    expect(pill.style.bottom).toBe('12px');
  });

  // One height for every count, so what is placed against it — the
  // hero's credit, the kinds on the cover — is placed against a number.
  it('stands at one height, the one the hero places things against', () => {
    render(<PageCount count={2} page={0} testID="count" />);
    expect(getComputedStyle(screen.getByTestId('count')).height).toBe(`${PAGE_COUNT_H}px`);
    expect(PAGE_COUNT_H).toBe(28);
  });
});
