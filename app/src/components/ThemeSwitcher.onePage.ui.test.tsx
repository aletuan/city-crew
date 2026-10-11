// @vitest-environment jsdom
//
// The theme sheet with only two looks to offer — which no build has, and
// which is the one way to see the strip's count stay away. `PageCount`'s
// rule, kept here: nothing for a single page, since there is nowhere to
// swipe to. Its own file because the mock is module-wide: the main suite
// needs all eleven to test the pages.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../uitest/render';

vi.mock('../lib/look', async (orig) => ({
  ...(await orig<typeof import('../lib/look')>()),
  PINNED: { coffee: 'dark', rose: 'light' },
}));
vi.mock('../lib/theme', () => ({
  useScheme: () => ({ scheme: 'light', pref: 'light', setPref: () => {}, look: 'standard', looks: true }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { ThemeSwitcherModal } from './ThemeSwitcher';

describe('the looks, when they fit one page', () => {
  it('offers the page and no count', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.getByTestId('look-page-0').querySelectorAll('[role="radio"]').length).toBe(2);
    expect(screen.queryByTestId('look-page-1')).toBeNull();
    expect(screen.queryByTestId('look-pages')).toBeNull();
  });
});
