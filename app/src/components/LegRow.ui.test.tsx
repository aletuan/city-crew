// @vitest-environment jsdom
//
// The journey between two stops, as every screen that draws an evening
// prints it: a 12pt glyph for how it is made, then "distance · ≈ time".
// Pinned: the glyph follows the mode, the line follows the language, and
// the spacing a screen passes in is the screen's — the row owns none.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../uitest/render';
import type { Lang } from '../lib/i18n';

const state = vi.hoisted(() => ({ lang: 'en' as Lang }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, setLang: () => {}, t: (en: string, vi: string, ja: string) => ({ en, vi, ja }[state.lang]) }),
}));

import LegRow from './LegRow';

const glyph = () => document.querySelector('[data-icon]')?.getAttribute('data-icon');

describe('LegRow', () => {
  it('walks: a walker and the figure', () => {
    render(<LegRow leg={{ km: 0.8, minutes: 13, mode: 'walk' }} />);
    expect(glyph()).toBe('walk-outline');
    expect(screen.getByText('800 m · ≈ 13 min')).toBeTruthy();
  });

  it('rides: a car, and the line in the reader’s language', () => {
    state.lang = 'vi';
    render(<LegRow leg={{ km: 6.2, minutes: 20, mode: 'ride' }} />);
    expect(glyph()).toBe('car-outline');
    expect(screen.getByText('6.2 km · ≈ 20 phút')).toBeTruthy();
    state.lang = 'en';
  });

  it('carries the test id and the style the screen gives it', () => {
    render(<LegRow leg={{ km: 0.8, minutes: 13, mode: 'walk' }} style={{ marginTop: 8 }} testID="leg" />);
    const row = screen.getByTestId('leg') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.style.marginTop).toBe('8px');
  });
});
