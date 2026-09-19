// @vitest-environment jsdom
//
// The appearance sheet — the sibling that keeps its glyphs and its
// "Done". Both are differences from the city and language sheets, both
// are deliberate, and both are pinned here so a future "make them all
// match" pass has to read the reasons before flattening them.
//
// Since Auto arrived the sheet also has to say two things at once: which
// row is ticked (the setting) and which ground is showing (the phone's
// answer, under Auto). The pair below — `pref` and `scheme` set apart —
// is what keeps a regression from collapsing them back into one.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

const setPref = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  scheme: 'light' as 'light' | 'dark',
  pref: 'light' as 'light' | 'dark' | 'system',
}));
vi.mock('../lib/theme', () => ({
  useScheme: () => ({ scheme: state.scheme, pref: state.pref, setPref }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { ThemeSwitcherModal } from './ThemeSwitcher';

beforeEach(() => {
  state.scheme = 'light';
  state.pref = 'light';
  setPref.mockClear();
});

describe('the two grounds, and the deferral', () => {
  it('offers all three, wearing their own marks', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('Automatic')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    // A moon and a sun are two different marks carrying meaning — this
    // sheet keeps its glyphs where the language rows lost theirs. The
    // phone is the third: a place, not a time of day.
    expect(document.querySelector('[data-icon="phone-portrait-outline"]')).toBeTruthy();
    expect(document.querySelector('[data-icon="moon-outline"]')).toBeTruthy();
    expect(document.querySelector('[data-icon="sunny-outline"]')).toBeTruthy();
  });

  it('ticks the setting, not the ground showing', () => {
    // The state that would break a naive implementation: Auto chosen,
    // dark showing. Exactly one tick, and it is not on the Dark row.
    state.pref = 'system';
    state.scheme = 'dark';
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(document.querySelectorAll('[data-icon="checkmark"]').length).toBe(1);
    const dark = screen.getByText('Dark').closest('[role="radio"]');
    expect(dark?.querySelector('[data-icon="checkmark"]')).toBeNull();
    const auto = screen.getByText('Automatic').closest('[role="radio"]');
    expect(auto?.querySelector('[data-icon="checkmark"]')).toBeTruthy();
  });

  // Without this line the sheet can tick Auto over a plainly dark screen
  // and nothing on it says which of the two won.
  it('says on the Auto row which ground the phone picked', () => {
    state.pref = 'system';
    state.scheme = 'dark';
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('Following the phone · Dark')).toBeTruthy();
  });

  it('reads the phone back the other way too', () => {
    state.pref = 'system';
    state.scheme = 'light';
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('Following the phone · Light')).toBeTruthy();
    // The note belongs to Auto alone: the other two rows are a single line.
    expect(screen.queryByText('Following the phone · Dark')).toBeNull();
  });

  // The behavioural difference, kept: choosing repaints the whole screen
  // behind the sheet, which is the one moment both readings can be seen
  // against each other — closing on the tap would hide the result of
  // the tap.
  it('repaints on choice but holds the sheet open', () => {
    const onClose = vi.fn();
    render(<ThemeSwitcherModal visible onClose={onClose} />);
    fireEvent.click(screen.getByText('Dark'));
    expect(setPref).toHaveBeenCalledWith('dark');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hands the phone back the window when Auto is tapped', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    fireEvent.click(screen.getByText('Automatic'));
    expect(setPref).toHaveBeenCalledWith('system');
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
