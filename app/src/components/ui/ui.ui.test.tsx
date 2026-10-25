// @vitest-environment jsdom
//
// The design system's own tests, for the two paths no screen's test
// happens to take. They were covered on average while `ui.tsx` was one
// file; split by concern (19 Oct 2026) each file is held on its own, and
// these are the paths that average was hiding.

import React from 'react';
import { Animated, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '../../uitest/render';

vi.mock('../../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { Screen, UnderlineChoice, useArrival } from './index';
import { bgHex } from '../../theme';

describe('useArrival', () => {
  // A reader who asked for less motion gets the arrived state, not the
  // absence of it: held still, the value starts and stays at 1.
  it('parks at the arrived state when held still', () => {
    let seen: Animated.Value | null = null;
    const timing = vi.spyOn(Animated, 'timing');
    function Probe() {
      seen = useArrival(300, 0, true);
      return null;
    }
    render(<Probe />);
    expect((seen as unknown as { __getValue: () => number }).__getValue()).toBe(1);
    expect(timing).not.toHaveBeenCalled();
    timing.mockRestore();
  });

  it('starts from nothing and runs when it may move', () => {
    let seen: Animated.Value | null = null;
    const timing = vi.spyOn(Animated, 'timing');
    function Probe() {
      seen = useArrival(300, 40, false);
      return null;
    }
    render(<Probe />);
    expect(timing).toHaveBeenCalledWith(seen, expect.objectContaining({ toValue: 1, duration: 300, delay: 40 }));
    timing.mockRestore();
  });
});

describe('Screen', () => {
  // A plain string becomes the small line above the title; an element is
  // hung as it is (Explore hangs the weather off the date).
  it('sets a string eyebrow in the eyebrow face, above the title', () => {
    render(<Screen title="Trip" eyebrow="INVITATION"><Text>body</Text></Screen>);
    const eyebrow = screen.getByText('INVITATION');
    const title = screen.getByText('Trip');
    expect(eyebrow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hangs an element eyebrow as it is', () => {
    render(<Screen title="Trip" eyebrow={<Text testID="own">own line</Text>}><Text>body</Text></Screen>);
    expect(screen.getByTestId('own').textContent).toBe('own line');
  });
});

// Explore's kinds, one at a time (owner, 24 Oct 2026): the word and the
// rule say which is chosen, the glyph keeps its own hue, and the far end
// fades into the page the row sits on.
describe('UnderlineChoice', () => {
  const items = [
    { key: 'cafes', label: 'Cafés', icon: 'cafe-outline' as const, iconColor: '#D2A679', testID: 'k-cafes' },
    { key: 'eats', label: 'Eats' },
  ];

  it('marks the chosen one, keeps every glyph its own colour, and hands back the key tapped', () => {
    const onPick = vi.fn();
    render(<UnderlineChoice items={items} chosen="cafes" onPick={onPick} testID="row" />);
    const cafes = screen.getByRole('button', { name: 'Cafés' });
    expect(cafes.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Eats' }).getAttribute('aria-selected')).toBe('false');
    // The hue is the category's, chosen or not; an item with no glyph has none.
    expect(cafes.querySelector('[data-icon]')!.getAttribute('data-color')).toBe('#D2A679');
    expect(screen.getByRole('button', { name: 'Eats' }).querySelector('[data-icon]')).toBeNull();
    // The word carries the choice.
    expect(getComputedStyle(within(cafes).getByText('Cafés')).color)
      .not.toBe(getComputedStyle(screen.getByText('Eats')).color);
    fireEvent.click(cafes);
    fireEvent.click(screen.getByRole('button', { name: 'Eats' }));
    expect(onPick.mock.calls).toEqual([['cafes'], ['eats']]);
    expect(screen.getByTestId('k-cafes')).toBe(cafes);
  });

  it('chooses nothing when given nothing', () => {
    render(<UnderlineChoice items={items} chosen={null} onPick={() => {}} testID="row" />);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-selected'))).toEqual(['false', 'false']);
  });

  // ── the cut and the fade (owner, 24 Oct 2026) ──
  //
  // jsdom lays nothing out, so the row is measured by hand: react-native-web
  // leaves each node's layout handler on it for a ResizeObserver to call.
  type Layout = { __reactLayoutHandler: (e: unknown) => void };
  const lay = (el: HTMLElement, width: number) => act(() => {
    (el as unknown as Layout).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width, height: 33 } } });
  });
  const kinds = ['a', 'b', 'c', 'd', 'e'].map((k) => ({ key: k, label: k.toUpperCase() }));
  const gapOf = () => getComputedStyle(screen.getByTestId('row-scroll').firstElementChild as HTMLElement).columnGap
    || getComputedStyle(screen.getByTestId('row-scroll').firstElementChild as HTMLElement).gap;
  const measureRow = (edge: number, width = 100) => {
    lay(screen.getByTestId('row-scroll'), edge);
    for (const b of screen.getAllByRole('button')) lay(b, width);
  };

  it('draws no fade, and keeps its own gap, until it has been measured', () => {
    render(<UnderlineChoice items={kinds} chosen={null} onPick={() => {}} testID="row" />);
    expect(screen.queryByTestId('row-fade')).toBeNull();
    expect(gapOf()).toBe('22px');
    // The row alone is not enough: every item has to be measured too.
    lay(screen.getByTestId('row-scroll'), 390);
    expect(screen.queryByTestId('row-fade')).toBeNull();
  });

  // Five items 100 wide from 22: at 22 the edge at 380 falls in the gap
  // after the third (22–122, 144–244, 266–366, 388–488) — the case the
  // owner's phone showed. The row takes another gap, and the edge cuts.
  it('moves its gap so the edge cuts an item, and fades while there is more', () => {
    render(<UnderlineChoice items={kinds} chosen={null} onPick={() => {}} testID="row" />);
    measureRow(380);
    expect(gapOf()).not.toBe('22px');
    const fade = screen.getByTestId('row-fade');
    const [from, to] = fade.getAttribute('colors')!.split(',');
    expect(Object.values(bgHex)).toContain(to);
    expect(from).toBe(`${to}00`);
  });

  it('takes the fade away once scrolled to the end', () => {
    render(<UnderlineChoice items={kinds} chosen={null} onPick={() => {}} testID="row" />);
    measureRow(390);
    expect(screen.getByTestId('row-fade')).toBeTruthy();
    const scroll = screen.getByTestId('row-scroll');
    scroll.scrollLeft = 1000;
    fireEvent.scroll(scroll);
    expect(screen.queryByTestId('row-fade')).toBeNull();
  });

  it('draws no fade, at its own gap, when every item fits', () => {
    render(<UnderlineChoice items={kinds.slice(0, 2)} chosen={null} onPick={() => {}} testID="row" />);
    measureRow(390, 60);
    expect(screen.queryByTestId('row-fade')).toBeNull();
    expect(gapOf()).toBe('22px');
  });

  // ── "All" (owner, 25 Oct 2026) ──
  it('puts "All" first, underlined while nothing is chosen, and hands back null for it', () => {
    const onPick = vi.fn();
    const { rerender } = render(<UnderlineChoice items={items} chosen={null} onPick={onPick} all="All" testID="row" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['All', 'Cafés', 'Eats']);
    expect(screen.getByTestId('row-all').getAttribute('aria-selected')).toBe('true');
    rerender(<UnderlineChoice items={items} chosen="eats" onPick={onPick} all="All" testID="row" />);
    expect(screen.getByTestId('row-all').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByTestId('row-all'));
    expect(onPick).toHaveBeenLastCalledWith(null);
  });

  // Search's cities carry the figures their chips did (owner, 25 Oct
  // 2026): after the word, in brackets — and "All" its own, once known.
  it('puts a figure after a word that has one, "All" included', () => {
    const { rerender } = render(<UnderlineChoice items={[{ key: 'hn', label: 'Hà Nội', count: 6 }, { key: 'sg', label: 'Sài Gòn' }]} chosen={null} onPick={() => {}} all="All" allCount={24} testID="row" />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['All (24)', 'Hà Nội (6)', 'Sài Gòn']);
    rerender(<UnderlineChoice items={[{ key: 'hn', label: 'Hà Nội', count: 0 }]} chosen={null} onPick={() => {}} all="All" testID="row" />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Hà Nội (0)']);
  });

  // Under a search box the row is tapped with the keyboard up, and a
  // ScrollView's default spends that tap on the keyboard. React Native Web
  // has no keyboard to show it, so the prop is read off the row itself.
  it('takes a tap with the keyboard up', () => {
    render(<UnderlineChoice items={kinds} chosen={null} onPick={() => {}} testID="row" />);
    const el = screen.getByTestId('row-scroll');
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
    type Fiber = { memoizedProps?: Record<string, unknown>; return?: Fiber };
    let f: Fiber | undefined = (el as unknown as Record<string, Fiber>)[key];
    while (f && !(f.memoizedProps && 'keyboardShouldPersistTaps' in f.memoizedProps)) f = f.return;
    expect(f?.memoizedProps?.keyboardShouldPersistTaps).toBe('handled');
  });

  // The › that stood on the fade came out (owner, 25 Oct 2026): it drew
  // over the item the edge cuts. Measured and scrolled, the row has none.
  it('draws no › on the fade, at its start or anywhere', () => {
    render(<UnderlineChoice items={kinds} chosen={null} onPick={() => {}} all="All" testID="row" />);
    measureRow(390);
    expect(screen.getByTestId('row-fade')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'A', 'B', 'C', 'D', 'E']);
    expect(document.querySelector('[data-icon="chevron-forward"]')).toBeNull();
  });

  // The cut is judged where the fade begins, not at the screen's edge: the
  // fade covers the last 28pt, so a cut under it is a cut half seen.
  // Six items 100 wide on a 390 row: against 390 the gap would be 14,
  // against 362 it is 28 — two different rows, so this tells them apart.
  it('cuts an item where the fade begins, not under it', () => {
    render(<UnderlineChoice items={kinds} chosen={null} onPick={() => {}} all="All" testID="row" />);
    measureRow(390);
    expect(gapOf()).toBe('28px');
  });

  it('draws a fade and an "All" with no names when the row has none', () => {
    const { container } = render(<UnderlineChoice items={kinds} chosen={null} onPick={() => {}} all="All" />);
    // No test names to reach it by: the scroll view is the row's first child.
    lay(container.firstElementChild!.firstElementChild as HTMLElement, 390);
    for (const b of screen.getAllByRole('button')) lay(b, 100);
    expect(container.querySelector('[data-stub="LinearGradient"]')!.getAttribute('data-testid')).toBeNull();
    expect(container.querySelector('[data-testid]')).toBeNull();
    expect(screen.getAllByRole('button')[0].textContent).toBe('All');
  });
});
