// @vitest-environment jsdom
//
// The language sheet — the smallest of the three switchers, and the one
// whose rows are their own icons: each label is written in the script it
// names, so the rows carry no glyph at all.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

const setLang = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ lang: 'vi' as string }));
// The real LANGS stays: the rows under test are the rows the app ships.
vi.mock('../lib/i18n', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18n: () => ({ lang: state.lang, setLang, t: (en: string) => en }),
}));

import { LanguageSwitcherModal } from './LanguageSwitcher';

beforeEach(() => {
  state.lang = 'vi';
  setLang.mockClear();
});

describe('the list of languages', () => {
  it('names every language in its own script', () => {
    render(<LanguageSwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Tiếng Việt')).toBeTruthy();
    expect(screen.getByText('日本語')).toBeTruthy();
  });

  it('ticks the one in use', () => {
    render(<LanguageSwitcherModal visible onClose={() => {}} />);
    expect(document.querySelector('[data-icon="checkmark"]')).toBeTruthy();
  });

  // The pin on the restyle: three identical marks said nothing three
  // times, so the rows lost their glyph — the tick on the chosen row is
  // the only icon in the sheet.
  it('carries no glyph but the tick', () => {
    render(<LanguageSwitcherModal visible onClose={() => {}} />);
    expect(document.querySelectorAll('[data-icon]')).toHaveLength(1);
  });

  it('switches, then gets out of the way', () => {
    const onClose = vi.fn();
    render(<LanguageSwitcherModal visible onClose={onClose} />);
    fireEvent.click(screen.getByText('English'));
    expect(setLang).toHaveBeenCalledWith('en');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing while it is closed', () => {
    render(<LanguageSwitcherModal visible={false} onClose={() => {}} />);
    expect(screen.queryByText('English')).toBeNull();
  });
});
