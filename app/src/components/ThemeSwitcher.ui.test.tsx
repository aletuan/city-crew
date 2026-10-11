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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { Look, Pref } from '../lib/look';
import { PALETTES } from '../theme';

const setPref = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  scheme: 'light' as 'light' | 'dark',
  pref: 'light' as Pref,
  look: 'standard' as Look,
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

describe('the looks', () => {
  const alert = () => vi.mocked(Alert.alert);
  /** The button the confirmation offers, pressed. */
  const confirm = (label: string) => {
    const buttons = alert().mock.calls[0][2]!;
    buttons.find((b) => b.text === label)!.onPress?.();
  };
  /** The Modal's own word that it has gone — what iOS sends after the
   *  fade. Read off the committed tree: react-native-web sends it only at
   *  the end of a CSS animation, which jsdom never runs. */
  const dismissed = () => {
    type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
    const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
    const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
    const stack: Fiber[] = [host[key].stateNode.current];
    while (stack.length) {
      const f = stack.pop()!;
      const props = f.memoizedProps;
      if (props && typeof props.onDismiss === 'function' && 'onRequestClose' in props) {
        (props.onDismiss as () => void)();
        return;
      }
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    throw new Error('no Modal in the committed tree');
  };

  it('offers the six looks after the grounds, with their own marks', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    // More than light and dark now, so the sheet is a theme, not an appearance.
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.queryByText('Appearance')).toBeNull();
    const rows = [...document.querySelectorAll('[role="radio"]')].map((r) => r.textContent);
    expect(rows.map((r) => r!.replace(/(Following|Restarts).*/, ''))).toEqual(
      ['Automatic', 'Dark', 'Light', 'Coffee', 'Rose', 'Blush', 'Slate', 'Midnight', 'Navy'],
    );
    for (const icon of ['cafe-outline', 'flower-outline', 'heart-outline', 'cloud-outline', 'star-outline', 'boat-outline']) {
      expect(document.querySelector(`[data-icon="${icon}"]`), icon).toBeTruthy();
    }
  });

  // A name cannot tell "Xanh than" from "Xanh navy"; the card shows each
  // look in its own colours, whichever look is being worn.
  it('draws each look’s card in that look’s own page, pill and fill', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    const rgb = (h: string) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
    for (const look of ['coffee', 'rose', 'blush', 'slate', 'midnight', 'navy'] as const) {
      const sw = screen.getByTestId(`swatch-${look}`);
      const p = PALETTES[look];
      expect(getComputedStyle(sw).backgroundColor, look).toBe(rgb(p.bg));
      const fills = [...sw.querySelectorAll('div')].map((d) => getComputedStyle(d).backgroundColor);
      expect(fills, look).toContain(rgb(p.text));
      expect(fills, look).toContain(rgb(p.badgeSolid));
      expect(fills, look).toContain(rgb(p.accentFill));
    }
  });

  // A relaunch nobody was warned of reads as a crash. Said once, over the
  // looks, before any of them is tapped; and not on a ground's row while
  // the standard look is worn, where a ground repaints in place.
  it('says before the tap that a look restarts the app', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('Changing these restarts the app')).toBeTruthy();
    const note = (label: string) => screen.getByText(label).closest('[role="radio"]')!.textContent!.includes('Restarts the app');
    expect(note('Dark')).toBe(false);
    expect(note('Light')).toBe(false);
    // And a new look asks as the first two do.
    fireEvent.click(screen.getByText('Navy'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(setPref).not.toHaveBeenCalled();
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

  // Pressed on a phone with the sheet still up, the restart did nothing.
  // So the sheet closes first and the look is chosen once it has gone —
  // by the Modal's `onDismiss`, or by the backstop if that never comes.
  describe('once the restart is agreed to', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('closes the sheet first, and chooses the look only after it has gone', () => {
      const onClose = vi.fn();
      render(<ThemeSwitcherModal visible onClose={onClose} />);
      fireEvent.click(screen.getByText('Rose'));
      confirm('Restart');
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(setPref).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(449); });
      expect(setPref).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(setPref).toHaveBeenCalledTimes(1);
      expect(setPref).toHaveBeenCalledWith('rose');
    });

    it('chooses it when the sheet says it has gone, and only once', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      fireEvent.click(screen.getByText('Coffee'));
      confirm('Restart');
      act(() => { dismissed(); });
      expect(setPref).toHaveBeenCalledWith('coffee');
      act(() => { vi.advanceTimersByTime(500); });
      act(() => { dismissed(); });
      expect(setPref).toHaveBeenCalledTimes(1);
    });

    // A sheet closed by hand chooses nothing.
    it('chooses nothing when the sheet goes without a restart agreed', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      act(() => { dismissed(); });
      expect(setPref).not.toHaveBeenCalled();
    });

    // A relaunch takes this timer with it; one still running means the
    // restart did not happen, and the reader is told what will work.
    it('says how to finish the change if the app is still here after it', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      fireEvent.click(screen.getByText('Rose'));
      confirm('Restart');
      act(() => { vi.advanceTimersByTime(450 + 2999); });
      expect(alert()).toHaveBeenCalledTimes(1);
      act(() => { vi.advanceTimersByTime(1); });
      expect(alert()).toHaveBeenCalledTimes(2);
      expect(alert().mock.calls[1][0]).toBe('Close and reopen City Crew');
    });

    it('leaves nothing running once the sheet is gone from the tree', () => {
      const { unmount } = render(<ThemeSwitcherModal visible onClose={() => {}} />);
      fireEvent.click(screen.getByText('Rose'));
      confirm('Restart');
      unmount();
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(setPref).not.toHaveBeenCalled();
      expect(alert()).toHaveBeenCalledTimes(1);
    });
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
    expect(screen.queryByText('Navy')).toBeNull();
    expect(screen.queryByText('Changing these restarts the app')).toBeNull();
    expect(document.querySelectorAll('[role="radio"]').length).toBe(3);
  });

  it('names each setting in the three languages', () => {
    const vi_ = (_en: string, vi: string) => vi;
    expect(schemeLabel('coffee', vi_)).toBe('Nâu cafe');
    expect(schemeLabel('rose', vi_)).toBe('Hồng');
    expect(schemeLabel('blush', vi_)).toBe('Hồng phấn');
    expect(schemeLabel('slate', vi_)).toBe('Xanh xám');
    expect(schemeLabel('midnight', vi_)).toBe('Xanh than');
    expect(schemeLabel('navy', vi_)).toBe('Xanh navy');
    expect(schemeLabel('navy', (en) => en)).toBe('Navy');
    expect(schemeLabel('dark', vi_)).toBe('Tối');
  });

  it('gives Profile a look’s own mark, and a ground’s for the rest', () => {
    expect(schemeIcon('coffee', 'dark')).toBe('cafe-outline');
    expect(schemeIcon('rose', 'light')).toBe('flower-outline');
    expect(schemeIcon('midnight', 'dark')).toBe('star-outline');
    expect(schemeIcon('blush', 'light')).toBe('heart-outline');
    expect(schemeIcon('system', 'dark')).toBe('moon-outline');
    expect(schemeIcon('light', 'light')).toBe('sunny-outline');
  });
});
