// @vitest-environment jsdom
//
// Price as quiet information, and FREE as the one loud case.
//
// The rules — what counts as free, what label a price gets — are
// `lib/place` and are held at 100% there. What the pill adds is the
// breath before the currency, the "/ person" that the fact row wants
// and the `compact` form does not, and the two things it draws nothing
// for. `PlaceDetailScreen` is its only home, behind the `place_price`
// switch (off, see `lib/flags`), and that screen's tests reach only the
// two branches the switch lets through.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../uitest/render';
import type { Place } from '../lib/data';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import PricePill from './PricePill';

const place = (over: Partial<Place>): Place =>
  ({ slug: 'p', price_vnd: null, price_display: null, ...over } as unknown as Place);

describe('the price pill', () => {
  it('wears the accented pill for a place that is free', () => {
    render(<PricePill place={place({ price_vnd: 0 })} />);
    expect(screen.getByText('Free')).toBeTruthy();
  });

  it('says a paid price quietly, per person, with a breath before the currency', () => {
    render(<PricePill place={place({ price_display: '70k₫' })} />);
    // The tilde is honest work: most prices are inferred from a level.
    expect(screen.getByText('~70k ₫ / person')).toBeTruthy();
  });

  it('drops the "/ person" in its compact form', () => {
    render(<PricePill place={place({ price_display: '70k₫' })} compact />);
    expect(screen.getByText('~70k ₫')).toBeTruthy();
    expect(screen.queryByText(/person/)).toBeNull();
  });

  it('rounds a bare amount to thousands', () => {
    render(<PricePill place={place({ price_vnd: 65000 })} />);
    expect(screen.getByText('~65k ₫ / person')).toBeTruthy();
  });

  it('draws nothing for a place with no price known', () => {
    const { container } = render(<PricePill place={place({})} />);
    expect(container.textContent).toBe('');
  });
});
