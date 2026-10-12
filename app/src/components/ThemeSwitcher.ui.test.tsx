// @vitest-environment jsdom
//
// The theme sheet — the sibling that keeps its glyphs and stays open on a
// choice. Both are differences from the city and language sheets, both
// are deliberate, and both are pinned here so a future "make them all
// match" pass has to read the reasons before flattening them. (It had a
// "Done" too, until 11 Oct 2026; see the sheet's header for why it went.)
//
// Since Auto arrived the sheet also has to say two things at once: which
// row is ticked (the setting) and which ground is showing (the phone's
// answer, under Auto). The pair below — `pref` and `scheme` set apart —
// is what keeps a regression from collapsing them back into one.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '../uitest/render';
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
const who = vi.hoisted(() => ({ userId: undefined as string | null | undefined }));
const saveTheme = vi.hoisted(() => vi.fn(async () => {}));
/** The themes the server names as popular, most worn first — none, until
 *  a test says. */
const named = vi.hoisted(() => ({ value: [] as string[] }));
const fetchPopularThemes = vi.hoisted(() => vi.fn(async () => named.value));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ userId: who.userId }) }));
vi.mock('../lib/data', () => ({ saveTheme, fetchPopularThemes }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEEN_LOOKS_KEY } from '../lib/lookLabels';
import { schemeIcon, schemeLabel, ThemeSwitcherModal } from './ThemeSwitcher';

beforeEach(async () => {
  state.scheme = 'light';
  state.pref = 'light';
  state.look = 'standard';
  state.looks = true;
  who.userId = undefined;
  named.value = [];
  saveTheme.mockClear();
  setPref.mockClear();
  fetchPopularThemes.mockClear();
  await AsyncStorage.removeItem(SEEN_LOOKS_KEY);
  vi.spyOn(Alert, 'alert').mockImplementation(() => {});
});

/** Let the sheet's two asks on opening answer: the names, and the memory
 *  read then written. Both are mocked promises, so a tick is enough. */
const settled = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

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
    expect(setPref).toHaveBeenCalledWith('dark', undefined, undefined);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hands the phone back the window when Auto is tapped', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    fireEvent.click(screen.getByText('Automatic'));
    expect(setPref).toHaveBeenCalledWith('system', undefined, undefined);
  });

  // No "Done": the dimmed screen above the sheet is the way out, and it
  // says so to VoiceOver.
  it('leaves through the screen above it, and carries no Done', () => {
    const onClose = vi.fn();
    render(<ThemeSwitcherModal visible onClose={onClose} />);
    expect(screen.queryByText('Done')).toBeNull();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing while it is closed', () => {
    render(<ThemeSwitcherModal visible={false} onClose={() => {}} />);
    expect(screen.queryByText('Dark')).toBeNull();
  });
});

// The theme follows the account (12 Oct 2026): a signed-in reader's
// choice goes out with a copy for the account; a guest's does not.
describe('the account\u2019s copy', () => {
  it('hands the account\u2019s copy in with a ground', async () => {
    who.userId = 'me';
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    fireEvent.click(screen.getByText('Dark'));
    expect(setPref).toHaveBeenCalledTimes(1);
    const [id, back, remember] = setPref.mock.calls[0] as [string, unknown, (() => Promise<unknown>) | undefined];
    expect([id, back]).toEqual(['dark', undefined]);
    expect(saveTheme).not.toHaveBeenCalled();
    await remember!();
    expect(saveTheme).toHaveBeenCalledWith('me', 'dark');
  });

  it('hands it in with a look too, once the sheet has gone', async () => {
    vi.useFakeTimers();
    try {
      who.userId = 'me';
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      fireEvent.click(screen.getByText('Rose'));
      act(() => { vi.advanceTimersByTime(450); });
      const remember = setPref.mock.calls[0][2] as () => Promise<unknown>;
      await remember();
      expect(saveTheme).toHaveBeenCalledWith('me', 'rose');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hands in no copy for a guest', () => {
    who.userId = null;
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    fireEvent.click(screen.getByText('Dark'));
    expect(setPref).toHaveBeenCalledWith('dark', undefined, undefined);
  });
});

describe('the looks', () => {
  const alert = () => vi.mocked(Alert.alert);
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
      ['Automatic', 'Dark', 'Light', 'Coffee', 'Rose', 'Blush', 'Slate', 'Midnight', 'Navy', 'Chocolate', 'Cosmic', 'Teal', 'Honey', 'Royal', 'Plum', 'Violet', 'Wine'],
    );
    for (const icon of ['cafe-outline', 'flower-outline', 'heart-outline', 'cloud-outline', 'star-outline', 'boat-outline', 'ice-cream-outline', 'planet-outline', 'leaf-outline', 'flash-outline', 'diamond-outline', 'nutrition-outline', 'sparkles-outline', 'wine-outline']) {
      expect(document.querySelector(`[data-icon="${icon}"]`), icon).toBeTruthy();
    }
  });

  // A name cannot tell "Xanh than" from "Xanh navy"; the card shows each
  // look in its own colours, whichever look is being worn.
  it('draws each look’s card in that look’s own page, pill and fill', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    const rgb = (h: string) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
    for (const look of ['coffee', 'rose', 'blush', 'slate', 'midnight', 'navy', 'chocolate', 'cosmic', 'duck', 'honey', 'royal', 'plum', 'violet', 'wine'] as const) {
      const sw = screen.getByTestId(`swatch-${look}`);
      const p = PALETTES[look];
      expect(getComputedStyle(sw).backgroundColor, look).toBe(rgb(p.bg));
      const fills = [...sw.querySelectorAll('div')].map((d) => getComputedStyle(d).backgroundColor);
      expect(fills, look).toContain(rgb(p.text));
      expect(fills, look).toContain(rgb(p.badgeSolid));
      expect(fills, look).toContain(rgb(p.accentFill));
    }
  });

  // Eleven looks are six rows of the grid, so the grid is paged sideways,
  // four to a page, with a count on the heading rather than dots or
  // arrows — see the sheet's header. jsdom lays nothing out and
  // react-native-web's ScrollView has no momentum, so the strip's own
  // handler is called with what a swipe would report, as the carousel
  // tests do.
  describe('paged four to a page', () => {
    const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, any> => {
      type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
      const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
      const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
      const stack: Fiber[] = [host[key].stateNode.current];
      while (stack.length) {
        const f = stack.pop()!;
        const p = f.memoizedProps;
        if (p && typeof p === 'object' && pick(p)) return p;
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
      throw new Error('no matching element in the committed tree');
    };
    const strip = () => propsWhere((p) => !!p.horizontal && 'onMomentumScrollEnd' in p);
    const swipe = (x: number) => act(() => { strip().onMomentumScrollEnd({ nativeEvent: { contentOffset: { x } } }); });
    /** The strip's stride — a page and its gap, which is what it snaps by
     *  and reads the page off. The page's width is read off a page rather
     *  than assumed: the runner lays out at no width at all, and the
     *  strip floors it. */
    const pageW = () => StyleSheet.flatten(propsWhere((p) => p.testID === 'look-page-0').style).width as number;
    const stride = () => strip().snapToInterval as number;
    const radiosIn = (page: number) => screen.getByTestId(`look-page-${page}`).querySelectorAll('[role="radio"]').length;

    it('cuts the fourteen into pages of four, four, four and two, and counts them on the heading', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      expect(screen.queryByTestId('look-page-4')).toBeNull();
      expect([radiosIn(0), radiosIn(1), radiosIn(2), radiosIn(3)]).toEqual([4, 4, 4, 2]);
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 1/4');
      // No dots, no arrows: the count and the sliver are the indicator.
      expect(document.querySelector('[data-icon="chevron-forward"]')).toBeNull();
      expect(document.querySelector('[data-icon="chevron-back"]')).toBeNull();
    });

    // The next page shows its edge: a page is narrower than the strip by
    // the sliver, the strip snaps by a page and its gap rather than paging
    // by its own width, and the trailing padding is the sliver again so
    // the last page can reach the left edge too.
    it('leaves a sliver of the next page showing, and snaps by a page', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      const p = strip();
      expect(p.pagingEnabled).toBeFalsy();
      expect(p.snapToAlignment).toBe('start');
      expect(p.decelerationRate).toBe('fast');
      const gap = p.snapToInterval - pageW();
      expect(gap).toBeGreaterThan(0);
      const content = StyleSheet.flatten(p.contentContainerStyle) as { gap: number; paddingRight: number };
      expect(content.gap).toBe(gap);
      // Explore's sliver, to the point: see `PEEK`.
      expect(content.paddingRight).toBe(26);
    });

    it('reports the page a swipe landed on, rounded and clamped', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      swipe(stride() * 2);
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 3/4');
      swipe(stride() * 0.6);
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 2/4');
      swipe(stride() * 9);
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 4/4');
      swipe(-40);
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 1/4');
    });

    // The tick is the one thing a settings sheet owes on arrival, so the
    // strip opens where the worn look is, and the count says so.
    it('opens on the page of the look being worn', () => {
      state.pref = 'cosmic';
      state.look = 'cosmic';
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      expect(strip().contentOffset).toEqual({ x: stride(), y: 0 });
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 2/4');
      expect(screen.getByTestId('look-page-1').querySelector('[data-icon="checkmark"]')).toBeTruthy();

      cleanup();
      state.pref = 'royal';
      state.look = 'royal';
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      expect(strip().contentOffset).toEqual({ x: stride() * 2, y: 0 });
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 3/4');

      // And the first page from a ground, which is on no page.
      cleanup();
      state.pref = 'system';
      state.look = 'standard';
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      expect(strip().contentOffset).toEqual({ x: 0, y: 0 });
    });

    // Closed on page three and opened again: the count starts over from
    // the worn look's page, as the strip itself does on its remount.
    it('starts the count over each time it opens', () => {
      const { rerender } = render(<ThemeSwitcherModal visible onClose={() => {}} />);
      swipe(stride() * 2);
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 3/4');
      rerender(<ThemeSwitcherModal visible={false} onClose={() => {}} />);
      rerender(<ThemeSwitcherModal visible onClose={() => {}} />);
      expect(screen.getByTestId('look-pages').textContent).toBe('14 colours · 1/4');
    });
  });

  // The restart brings the reader back, so there is nothing to warn about
  // and nothing to ask — and nothing said, either: the grounds are single
  // lines, the looks a heading and their cards.
  it('says nothing about the restart, and asks nothing before the tap', () => {
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('Colours')).toBeTruthy();
    expect(screen.queryByText(/restart|moment/i)).toBeNull();
    const row = (label: string) => screen.getByText(label).closest('[role="radio"]')!.textContent;
    expect(row('Dark')).toBe('Dark');
    expect(row('Light')).toBe('Light');
    fireEvent.click(screen.getByText('Navy'));
    expect(alert()).not.toHaveBeenCalled();
  });

  // Pressed on a phone with the sheet still up, the restart did nothing.
  // So the sheet closes first and the look is chosen once it has gone —
  // by the Modal's `onDismiss`, or by the backstop if that never comes.
  describe('once a look is tapped', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('closes the sheet first, and chooses the look only after it has gone', () => {
      const onClose = vi.fn();
      render(<ThemeSwitcherModal visible onClose={onClose} />);
      fireEvent.click(screen.getByText('Rose'));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(setPref).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(449); });
      expect(setPref).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(setPref).toHaveBeenCalledTimes(1);
      expect(setPref).toHaveBeenCalledWith('rose', undefined, undefined);
    });

    // Where the reader is goes with the choice, asked of the screen at
    // that moment rather than when the sheet opened: the page may have
    // scrolled since.
    it('sends where the reader is along with the look', () => {
      const returnTo = vi.fn(() => ({ tab: 'Profile', sheet: 'theme' as const, y: 380 }));
      render(<ThemeSwitcherModal visible onClose={() => {}} returnTo={returnTo} />);
      fireEvent.click(screen.getByText('Navy'));
      expect(returnTo).not.toHaveBeenCalled();
      act(() => { dismissed(); });
      expect(returnTo).toHaveBeenCalledTimes(1);
      expect(setPref).toHaveBeenCalledWith('navy', { tab: 'Profile', sheet: 'theme', y: 380 }, undefined);
    });

    it('chooses it when the sheet says it has gone, and only once', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      fireEvent.click(screen.getByText('Coffee'));
      act(() => { dismissed(); });
      expect(setPref).toHaveBeenCalledWith('coffee', undefined, undefined);
      act(() => { vi.advanceTimersByTime(500); });
      act(() => { dismissed(); });
      expect(setPref).toHaveBeenCalledTimes(1);
    });

    // A sheet closed by hand chooses nothing.
    it('chooses nothing when the sheet goes without a look tapped', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      act(() => { dismissed(); });
      expect(setPref).not.toHaveBeenCalled();
    });

    // A relaunch takes this timer with it; one still running means the
    // restart did not happen, and the reader is told what will work.
    it('says how to finish the change if the app is still here after it', () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      fireEvent.click(screen.getByText('Rose'));
      act(() => { vi.advanceTimersByTime(450 + 2999); });
      expect(alert()).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(alert()).toHaveBeenCalledTimes(1);
      expect(alert().mock.calls[0][0]).toBe('Close and reopen City Crew');
    });

    it('leaves nothing running once the sheet is gone from the tree', () => {
      const { unmount } = render(<ThemeSwitcherModal visible onClose={() => {}} />);
      fireEvent.click(screen.getByText('Rose'));
      unmount();
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(setPref).not.toHaveBeenCalled();
      expect(alert()).not.toHaveBeenCalled();
    });
  });

  // Inside a look, the standard rows are the ones that restart — and the
  // look being worn neither asks nor carries the note.
  // The two words on a card (12 Oct 2026) — see the header of
  // `lib/lookLabels` for why words on a few cards and not an order.
  describe('the words on a card', () => {
    const ALL = ['coffee', 'rose', 'blush', 'slate', 'midnight', 'navy', 'chocolate', 'cosmic', 'duck', 'honey', 'royal', 'plum', 'violet', 'wine'];
    const said = (word: string) => [...document.querySelectorAll(`[data-testid$="-${word}"]`)]
      .map((el) => el.getAttribute('data-testid')!.replace(/^theme-/, '').replace(`-${word}`, ''));

    it('puts Popular on the first three looks the server named, and on no ground', async () => {
      // Dark is the most worn setting of all and is a ground, not a look:
      // the list is a setting and carries no word.
      named.value = ['dark', 'wine', 'coffee', 'cosmic', 'rose'];
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      expect(said('popular').sort()).toEqual(['coffee', 'cosmic', 'wine']);
      expect(screen.getAllByText('Popular').length).toBe(3);
      expect(screen.queryByTestId('theme-dark-popular')).toBeNull();
      expect(fetchPopularThemes).toHaveBeenCalledTimes(1);
    });

    // Nothing until a theme is worn by a fifth of those who chose — the
    // server's rule, and the sheet as it ships.
    it('says nothing when the server names nothing', async () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      expect(screen.queryByText('Popular')).toBeNull();
      expect(screen.queryByText('New')).toBeNull();
    });

    it('puts New on a look that was not on the sheet last time, and on none the first time', async () => {
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      // The first opening: everything would be new, so nothing is — and
      // what was shown is now remembered.
      expect(screen.queryByText('New')).toBeNull();
      expect(JSON.parse((await AsyncStorage.getItem(SEEN_LOOKS_KEY))!)).toEqual(ALL);
      cleanup();
      // The next opening, on a build that added two.
      await AsyncStorage.setItem(SEEN_LOOKS_KEY, JSON.stringify(ALL.filter((l) => l !== 'plum' && l !== 'wine')));
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      expect(said('new').sort()).toEqual(['plum', 'wine']);
      expect(screen.getAllByText('New').length).toBe(2);
      // For this opening only.
      expect(JSON.parse((await AsyncStorage.getItem(SEEN_LOOKS_KEY))!)).toEqual(ALL);
    });

    it('lets Popular win on a card that is both', async () => {
      await AsyncStorage.setItem(SEEN_LOOKS_KEY, JSON.stringify(ALL.filter((l) => l !== 'wine')));
      named.value = ['wine'];
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      expect(said('popular')).toEqual(['wine']);
      expect(said('new')).toEqual([]);
    });

    // A memory that cannot be read labels nothing, and the sheet is the
    // same sheet: a broken value must not put New on every card.
    it('labels nothing when the memory cannot be read', async () => {
      vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
      named.value = ['wine'];
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      expect(screen.queryByText('New')).toBeNull();
      expect(said('popular')).toEqual(['wine']);
    });

    it('asks again on each opening, and not while closed', async () => {
      const { rerender } = render(<ThemeSwitcherModal visible={false} onClose={() => {}} />);
      await settled();
      expect(fetchPopularThemes).not.toHaveBeenCalled();
      rerender(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      rerender(<ThemeSwitcherModal visible={false} onClose={() => {}} />);
      rerender(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      expect(fetchPopularThemes).toHaveBeenCalledTimes(2);
    });

    // The word is a pill in the tab bar's colours, hung over the swatch's
    // corner with the swatch's hairline — see the sheet's header for the
    // owner's reference and what was kept of it.
    it('hangs the word on the swatch as a pill, with a glyph for Popular and a dot for New', async () => {
      await AsyncStorage.setItem(SEEN_LOOKS_KEY, JSON.stringify(ALL.filter((l) => l !== 'plum')));
      named.value = ['wine'];
      render(<ThemeSwitcherModal visible onClose={() => {}} />);
      await settled();
      const word = screen.getByTestId('theme-wine-popular');
      expect(screen.getByTestId('theme-wine').contains(word)).toBe(true);
      expect(word.querySelector('[data-icon="people"]')).toBeTruthy();
      expect(word.querySelector('[data-icon="star"]')).toBeNull();
      const style = getComputedStyle(word);
      expect(style.position).toBe('absolute');
      // 10pt from the card's edge: past the curve of its corner, which is
      // what the owner's geometry proposal was for.
      expect(style.top).toBe('10px');
      expect(style.left).toBe('10px');
      expect(getComputedStyle(word.parentElement!).padding).toBe('12px');
      expect(style.borderTopColor).toBe('rgba(128, 128, 128, 0.35)');
      expect(style.boxShadow === '' || style.boxShadow === 'none').toBe(true);
      const fresh = screen.getByTestId('theme-plum-new');
      expect(fresh.querySelector('[data-icon]')).toBeNull();
      expect(screen.getByTestId('theme-plum-new-dot')).toBeTruthy();
    });
  });

  it('asks on the way back out of a look, and not for the look being worn', () => {
    state.look = 'coffee';
    state.pref = 'coffee';
    state.scheme = 'dark';
    const onClose = vi.fn();
    render(<ThemeSwitcherModal visible onClose={onClose} />);
    const row = (label: string) => screen.getByText(label).closest('[role="radio"]')!;
    // No note on the way out either: a ground from here is a restart that
    // brings the reader back, the same as a look.
    expect(row('Light').textContent).toBe('Light');
    expect(row('Coffee').querySelector('[data-icon="checkmark"]')).toBeTruthy();
    fireEvent.click(screen.getByText('Coffee'));
    expect(setPref).toHaveBeenCalledWith('coffee', undefined, undefined);
    expect(onClose).not.toHaveBeenCalled();
    // A ground, from inside a look, is a restart: the sheet goes, nothing asks.
    fireEvent.click(screen.getByText('Light'));
    expect(alert()).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers neither where a look cannot be kept', () => {
    state.looks = false;
    render(<ThemeSwitcherModal visible onClose={() => {}} />);
    expect(screen.queryByText('Coffee')).toBeNull();
    expect(screen.queryByText('Rose')).toBeNull();
    expect(screen.queryByText('Navy')).toBeNull();
    expect(screen.queryByText('Colours')).toBeNull();
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
    expect(schemeLabel('chocolate', vi_)).toBe('Sô-cô-la');
    expect(schemeLabel('cosmic', vi_)).toBe('Vũ trụ');
    expect(schemeLabel('duck', vi_)).toBe('Xanh cổ vịt');
    expect(schemeLabel('honey', vi_)).toBe('Mật ong');
    expect(schemeLabel('royal', vi_)).toBe('Hoàng gia');
    expect(schemeLabel('plum', vi_)).toBe('Mận');
    expect(schemeLabel('violet', vi_)).toBe('Tím');
    expect(schemeLabel('wine', vi_)).toBe('Rượu vang');
    expect(schemeLabel('navy', (en) => en)).toBe('Navy');
    expect(schemeLabel('dark', vi_)).toBe('Tối');
  });

  it('gives Profile a look’s own mark, and a ground’s for the rest', () => {
    expect(schemeIcon('coffee', 'dark')).toBe('cafe-outline');
    expect(schemeIcon('rose', 'light')).toBe('flower-outline');
    expect(schemeIcon('midnight', 'dark')).toBe('star-outline');
    expect(schemeIcon('blush', 'light')).toBe('heart-outline');
    expect(schemeIcon('cosmic', 'dark')).toBe('planet-outline');
    expect(schemeIcon('duck', 'light')).toBe('leaf-outline');
    expect(schemeIcon('royal', 'dark')).toBe('diamond-outline');
    expect(schemeIcon('wine', 'dark')).toBe('wine-outline');
    expect(schemeIcon('system', 'dark')).toBe('moon-outline');
    expect(schemeIcon('light', 'light')).toBe('sunny-outline');
  });
});
