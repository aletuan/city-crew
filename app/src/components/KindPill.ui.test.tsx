// @vitest-environment jsdom
//
// The one pill a category is read in — the card's, the place page's and
// a list's. What is asserted is what a reader sees: the word, the dot's
// colour, the count, and that none of it is a control.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import { CATEGORIES } from '../lib/categories';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ t: (en: string) => en, lang: 'en' }),
}));

import { KindPill, KindPills } from './KindPill';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('KindPill', () => {
  it('is a dot in the category’s colour and its word, with no glyph', () => {
    render(<KindPill kind="nightlife" testID="p" />);
    const pill = screen.getByTestId('p');
    expect(pill.textContent).toBe('Nightlife');
    expect(getComputedStyle(pill.firstElementChild as HTMLElement).backgroundColor).toBe(rgb(CATEGORIES.nightlife.color));
    expect(pill.querySelector('[data-icon]')).toBeNull();
    expect(pill.getAttribute('role')).not.toBe('button');
  });

  it('counts what the caller left out, and says nothing of a count of none', () => {
    render(<KindPill kind="cafes" more={2} testID="p" />);
    expect(screen.getByTestId('p').textContent).toBe('Cafés+2');
    render(<KindPill kind="cafes" more={0} testID="q" />);
    expect(screen.getByTestId('q').textContent).toBe('Cafés');
  });

  it('gives a key the table has not learned its word and no dot', () => {
    render(<KindPill kind="street_food" testID="p" />);
    const pill = screen.getByTestId('p');
    expect(pill.textContent).toBe('Street food');
    expect(pill.children).toHaveLength(1);
  });
});

describe('KindPills', () => {
  it('draws one pill per kind, in the order given, each findable by its key', () => {
    render(<KindPills kinds={['eats', 'views']} testID="row" />);
    expect(screen.getByTestId('row').textContent).toBe('EatsViews');
    expect(screen.getByTestId('row-views').textContent).toBe('Views');
  });

  it('draws nothing at all for no kinds', () => {
    const { container } = render(<KindPills kinds={[]} testID="row" />);
    expect(screen.queryByTestId('row')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('needs no test id to draw', () => {
    const { container } = render(<KindPills kinds={['fun']} />);
    expect(container.textContent).toBe('Fun');
  });
});

// Given `onPick`, the pills are a filter: each a button that says whether
// it is chosen, and hands its kind back on a tap.
describe('KindPills as a filter', () => {
  it('makes each pill a button that says whether it is chosen', () => {
    const onPick = vi.fn();
    render(<KindPills kinds={['eats', 'views']} chosen={['views']} onPick={onPick} testID="row" />);
    const views = screen.getByTestId('row-views');
    expect(views.getAttribute('role')).toBe('button');
    expect(views.getAttribute('aria-label')).toBe('Views');
    expect(views.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('row-eats').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByTestId('row-eats'));
    expect(onPick).toHaveBeenCalledWith('eats');
  });

  it('chooses nothing unless told', () => {
    render(<KindPills kinds={['fun']} onPick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Fun' }).getAttribute('aria-selected')).toBe('false');
  });
});
