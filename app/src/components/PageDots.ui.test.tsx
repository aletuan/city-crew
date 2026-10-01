// @vitest-environment jsdom
//
// The page marks every carousel floats over its pictures. Pinned: one
// mark per page up to the window of seven, the one in hand drawn
// differently (a bar) and the rest alike, nothing at all for a single
// page, the corner it sits in, and that it is not read aloud.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../uitest/render';

import PageDots from './PageDots';

const marks = () => [...screen.getByTestId('dots').children].map((el) => (el as HTMLElement).className);

describe('PageDots', () => {
  it('draws one mark per page, the one in hand unlike the rest', () => {
    render(<PageDots count={3} page={1} testID="dots" />);
    const [a, b, c] = marks();
    expect(marks()).toHaveLength(3);
    expect(a).toBe(c);
    expect(b).not.toBe(a);
  });

  it('follows the page', () => {
    const { rerender } = render(<PageDots count={3} page={0} testID="dots" />);
    const first = marks();
    rerender(<PageDots count={3} page={2} testID="dots" />);
    const last = marks();
    expect(first[0]).toBe(last[2]);
    expect(first[2]).toBe(last[0]);
  });

  it('shows a window of seven for a long day, around the page in hand', () => {
    render(<PageDots count={12} page={11} testID="dots" />);
    const m = marks();
    expect(m).toHaveLength(7);
    // The last page is the last mark.
    expect(m[6]).not.toBe(m[0]);
    expect(m.slice(0, 6).every((c) => c === m[0])).toBe(true);
  });

  it('draws nothing for a single page', () => {
    render(<PageDots count={1} page={0} testID="dots" />);
    expect(screen.queryByTestId('dots')).toBeNull();
  });

  it('sits in the bottom-right corner at the inset it is given, unread by VoiceOver', () => {
    render(<PageDots count={2} page={0} right={22} bottom={15} testID="dots" />);
    const pill = screen.getByTestId('dots') as HTMLElement;
    expect(pill.style.right).toBe('22px');
    expect(pill.style.bottom).toBe('15px');
    expect(pill.getAttribute('aria-hidden')).toBe('true');
  });

  it('insets 12pt by default, a card’s corner', () => {
    render(<PageDots count={2} page={0} testID="dots" />);
    const pill = screen.getByTestId('dots') as HTMLElement;
    expect(pill.style.right).toBe('12px');
    expect(pill.style.bottom).toBe('12px');
  });
});
