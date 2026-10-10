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
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '../uitest/render';

const setPref = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  scheme: 'light' as 'light' | 'dark',
  pref: 'light' as 'light' | 'dark' | 'system' | 'coffee' | 'rose',
  look: 'standard' as 'standard' | 'coffee' | 'rose',
  looks: true,
}));
vi.mock('../lib/theme', () => ({
  useScheme: () => ({ scheme: state.scheme, pref: state.pref, setPref, look: state.look, looks: state.looks }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { schemeIcon, schemeLabel, ThemeSwitcherModal } from './ThemeSwitcher';

beforeEach(() => {
  state.scheme = 'light';
  state.pref = 'light';
  state.look = 'standard';
  state.looks = true;
  setPref.mockClear();
  vi.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('the two grounds, and the deferral', () => {
  it('offers the three grounds, wearing their own marks', () => {
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

describe('the two looks', () => {
  const alert = () => vi.mocked(Alert.alert);
  /** The button the confirmation offers, pressed. */
  const confirm = (label: string) => {
    const buttons = alert().mock.calls[0][2]!;
    buttons.find((b) => b.text === label)!.onPress?.();
  };

  it('offers Coffee and Rose after the grounds, with their own marks', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    // More than light and dark now, so the sheet is a theme, not an appearance.
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.queryByText('Appearance')).toBeNull();
    const rows = [...document.querySelectorAll('[role="radio"]')].map((r) => r.textContent);
    expect(rows.map((r) => r!.replace(/(Following|Restarts).*/, ''))).toEqual(['Automatic', 'Dark', 'Light', 'Coffee', 'Rose']);
    expect(document.querySelector('[data-icon="cafe-outline"]')).toBeTruthy();
    expect(document.querySelector('[data-icon="flower-outline"]')).toBeTruthy();
  });

  // A relaunch nobody was warned of reads as a crash.
  it('says on the row, before the tap, that it restarts the app', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    const note = (label: string) => screen.getByText(label).closest('[role="radio"]')!.textContent!.includes('Restarts the app');
    expect(note('Coffee')).toBe(true);
    expect(note('Rose')).toBe(true);
    expect(note('Dark')).toBe(false);
    expect(note('Light')).toBe(false);
  });

  it('asks before restarting, and does nothing on Cancel', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    fireEvent.click(screen.getByText('Coffee'));
    expect(alert()).toHaveBeenCalledTimes(1);
    expect(alert().mock.calls[0][0]).toBe('Restart to change the theme?');
    expect(setPref).not.toHaveBeenCalled();
    confirm('Cancel');
    expect(setPref).not.toHaveBeenCalled();
  });

  it('chooses the look once the restart is agreed to', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    fireEvent.click(screen.getByText('Rose'));
    confirm('Restart');
    expect(setPref).toHaveBeenCalledWith('rose');
  });

  // Inside a look, the standard rows are the ones that restart — and the
  // look being worn neither asks nor carries the note.
  it('asks on the way back out of a look, and not for the look being worn', () => {
    state.look = 'coffee';
    state.pref = 'coffee';
    state.scheme = 'dark';
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    const row = (label: string) => screen.getByText(label).closest('[role="radio"]')!;
    expect(row('Coffee').textContent).not.toContain('Restarts the app');
    expect(row('Light').textContent).toContain('Restarts the app');
    expect(row('Coffee').querySelector('[data-icon="checkmark"]')).toBeTruthy();
    fireEvent.click(screen.getByText('Coffee'));
    expect(alert()).not.toHaveBeenCalled();
    expect(setPref).toHaveBeenCalledWith('coffee');
    fireEvent.click(screen.getByText('Light'));
    expect(alert()).toHaveBeenCalledTimes(1);
  });

  it('offers neither where a look cannot be kept', () => {
    state.looks = false;
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.queryByText('Coffee')).toBeNull();
    expect(screen.queryByText('Rose')).toBeNull();
    expect(document.querySelectorAll('[role="radio"]').length).toBe(3);
  });

  it('names each setting in the three languages', () => {
    const vi_ = (_en: string, vi: string) => vi;
    expect(schemeLabel('coffee', vi_)).toBe('Nâu cafe');
    expect(schemeLabel('rose', vi_)).toBe('Hồng');
    expect(schemeLabel('dark', vi_)).toBe('Tối');
  });

  it('gives Profile a look’s own mark, and a ground’s for the rest', () => {
    expect(schemeIcon('coffee', 'dark')).toBe('cafe-outline');
    expect(schemeIcon('rose', 'light')).toBe('flower-outline');
    expect(schemeIcon('system', 'dark')).toBe('moon-outline');
    expect(schemeIcon('light', 'light')).toBe('sunny-outline');
  });
});
