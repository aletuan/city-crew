// @vitest-environment jsdom
//
// The chips that say what you want more of, drawn.
//
// The rules — the cap of five, the toggle, the cleaning — are
// `lib/tastepick` and are held at 100% there. What this file owns is
// what the picker does with them: which chips exist, which one is lit,
// what a tap hands back, and when the counter under the grid earns its
// place. Until now the two screens that ask this question stubbed the
// picker out or never reached the counter, so those lines ran for no
// test at all.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import { CATEGORIES } from '../lib/categories';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import TastePicker from './TastePicker';

const KEYS = Object.keys(CATEGORIES);
const nameOf = (key: string) => CATEGORIES[key as keyof typeof CATEGORIES].en;
const tile = (key: string) => screen.getByRole('button', { name: nameOf(key) });

describe('the chips', () => {
  it('offers every category the app has, in the taxonomy order, each with its glyph', () => {
    render(<TastePicker chosen={[]} onChange={() => {}} />);
    const tiles = screen.getAllByRole('button');
    expect(tiles.map((el) => el.textContent)).toEqual(KEYS.map(nameOf));
    // The glyph a place card and the Browse row wear for the same
    // concept, so a reader who has met the taxonomy once has met it here.
    expect(tile('cafes').querySelector('[data-icon]')?.getAttribute('data-icon'))
      .toBe(CATEGORIES.cafes.icon);
  });

  it('lights the chosen ones and no others', () => {
    render(<TastePicker chosen={['nature', 'eats']} onChange={() => {}} />);
    expect(tile('nature').getAttribute('aria-selected')).toBe('true');
    expect(tile('eats').getAttribute('aria-selected')).toBe('true');
    expect(tile('cafes').getAttribute('aria-selected')).toBe('false');
  });

  it('hands back the list with a tapped chip added, in tap order', () => {
    const onChange = vi.fn();
    render(<TastePicker chosen={['cafes']} onChange={onChange} />);
    fireEvent.click(tile('nature'));
    expect(onChange).toHaveBeenCalledWith(['cafes', 'nature']);
  });

  it('hands back the list without a chip tapped again', () => {
    const onChange = vi.fn();
    render(<TastePicker chosen={['cafes', 'nature']} onChange={onChange} />);
    fireEvent.click(tile('cafes'));
    expect(onChange).toHaveBeenCalledWith(['nature']);
  });

  it('refuses a sixth, and says so rather than dropping one', () => {
    const onChange = vi.fn();
    const five = KEYS.slice(0, 5);
    render(<TastePicker chosen={five} onChange={onChange} />);
    fireEvent.click(tile(KEYS[5]));
    // The same five back: the cap is the rule's, the picker only relays
    // it — and the sentence below the grid is where the reader learns why
    // the tap did nothing.
    expect(onChange).toHaveBeenCalledWith(five);
    expect(screen.getByText('That is the five. Tap one again to swap it.')).toBeTruthy();
  });
});

describe('the counter', () => {
  // "0/5" on an untouched screen reads as a quota to fill, which is the
  // opposite of what an optional question should say.
  it('is absent while the ceiling is out of sight', () => {
    render(<TastePicker chosen={KEYS.slice(0, 3)} onChange={() => {}} />);
    expect(screen.queryByText(/of 5\./)).toBeNull();
    expect(screen.queryByText(/That is the five/)).toBeNull();
  });

  it('appears when the next tap is the last one that will work', () => {
    render(<TastePicker chosen={KEYS.slice(0, 4)} onChange={() => {}} />);
    expect(screen.getByText('4 of 5.')).toBeTruthy();
  });

  it('changes its words once the five are in', () => {
    render(<TastePicker chosen={KEYS.slice(0, 5)} onChange={() => {}} />);
    expect(screen.queryByText('5 of 5.')).toBeNull();
    expect(screen.getByText('That is the five. Tap one again to swap it.')).toBeTruthy();
  });
});
