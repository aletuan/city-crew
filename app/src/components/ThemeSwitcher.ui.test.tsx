// @vitest-environment jsdom
//
// The appearance sheet — the sibling that keeps its glyphs and its
// "Done". Both are differences from the city and language sheets, both
// are deliberate, and both are pinned here so a future "make them all
// match" pass has to read the reasons before flattening them.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

const setScheme = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ scheme: 'light' as 'light' | 'dark' }));
vi.mock('../lib/theme', () => ({
  useScheme: () => ({ scheme: state.scheme, setScheme }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { ThemeSwitcherModal } from './ThemeSwitcher';

beforeEach(() => {
  state.scheme = 'light';
  setScheme.mockClear();
});

describe('the two grounds', () => {
  it('offers both, wearing their own marks', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    // A moon and a sun are two different marks carrying meaning — this
    // sheet keeps its glyphs where the language rows lost theirs.
    expect(document.querySelector('[data-icon="moon-outline"]')).toBeTruthy();
    expect(document.querySelector('[data-icon="sunny-outline"]')).toBeTruthy();
  });

  it('ticks the current one', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(document.querySelector('[data-icon="checkmark"]')).toBeTruthy();
  });

  // The behavioural difference, kept: choosing repaints the whole screen
  // behind the sheet, which is the one moment both readings can be seen
  // against each other — closing on the tap would hide the result of
  // the tap.
  it('repaints on choice but holds the sheet open', () => {
    const onClose = vi.fn();
    render(<ThemeSwitcherModal visible onClose={onClose} />);
    fireEvent.click(screen.getByText('Dark'));
    expect(setScheme).toHaveBeenCalledWith('dark');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves through Done', () => {
    const onClose = vi.fn();
    render(<ThemeSwitcherModal visible onClose={onClose} />);
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing while it is closed', () => {
    render(<ThemeSwitcherModal visible={false} onClose={() => {}} />);
    expect(screen.queryByText('Dark')).toBeNull();
  });
});
