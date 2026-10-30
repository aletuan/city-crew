// @vitest-environment jsdom
//
// The design system's own tests, for the two paths no screen's test
// happens to take. They were covered on average while `ui.tsx` was one
// file; split by concern (19 Oct 2026) each file is held on its own, and
// these are the paths that average was hiding.

import React from 'react';
import { Animated, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '../../uitest/render';

vi.mock('../../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { CHIP_H, CHIP_SLOP, Chip, SECONDARY_CONTROL_H, Screen, UnderlineChoice, useArrival } from './index';
import { bgHex, colors } from '../../theme';

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
// rule say which is chosen, the glyph wears the word's ink, and the far
// end fades into the page the row sits on.
describe('UnderlineChoice', () => {
  const items = [
    { key: 'cafes', label: 'Cafés', icon: 'cafe-outline' as const, testID: 'k-cafes' },
    { key: 'eats', label: 'Eats' },
  ];

  it('marks the chosen one, inks every glyph as its word, and hands back the key tapped', () => {
    const onPick = vi.fn();
    render(<UnderlineChoice items={items} chosen="cafes" onPick={onPick} testID="row" />);
    const cafes = screen.getByRole('button', { name: 'Cafés' });
    expect(cafes.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Eats' }).getAttribute('aria-selected')).toBe('false');
    // The accent on the chosen one, the secondary ink on the rest (owner,
    // 30 Oct 2026); an item with no glyph has none.
    expect(cafes.querySelector('[data-icon]')!.getAttribute('data-color')).toBe(String(colors.accent));
    expect(screen.getByRole('button', { name: 'Eats' }).querySelector('[data-icon]')).toBeNull();
    // The word carries the choice.
    expect(getComputedStyle(within(cafes).getByText('Cafés')).color)
      .not.toBe(getComputedStyle(screen.getByText('Eats')).color);
    fireEvent.click(cafes);
    fireEvent.click(screen.getByRole('button', { name: 'Eats' }));
    expect(onPick.mock.calls).toEqual([['cafes'], ['eats']]);
    expect(screen.getByTestId('k-cafes')).toBe(cafes);
    // Not chosen, the same glyph is the word's secondary ink.
    cleanup();
    render(<UnderlineChoice items={items} chosen={null} onPick={onPick} />);
    expect(screen.getByTestId('k-cafes').querySelector('[data-icon]')!.getAttribute('data-color'))
      .toBe(String(colors.textSecondary));
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

  // On a sheet, the fade ends in the sheet's ground rather than the page's.
  it('fades into the ground it is given', () => {
    render(<UnderlineChoice items={kinds} chosen={null} onPick={() => {}} ground="#123456" testID="row" />);
    measureRow(380);
    expect(screen.getByTestId('row-fade').getAttribute('colors')).toBe('#12345600,#123456');
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

  // An answer that would leave nothing (owner, 25 Oct 2026): dimmed in
  // place and not taken — but never the chosen one, which is the way back.
  it('dims an item that is off, takes no tap on it, and never dims the chosen one', () => {
    const onPick = vi.fn();
    const off = [{ key: 'a', label: 'A', off: true }, { key: 'b', label: 'B', off: true }, { key: 'c', label: 'C' }];
    render(<UnderlineChoice items={off} chosen="b" onPick={onPick} testID="row" />);
    const [a, b, c] = screen.getAllByRole('button');
    expect([a, b, c].map((el) => el.getAttribute('aria-disabled'))).toEqual(['true', null, null]);
    const opacity = (el: HTMLElement) => getComputedStyle(el.firstElementChild as HTMLElement).opacity;
    expect(opacity(a)).toBe('0.45');
    expect([opacity(b), opacity(c)]).not.toContain('0.45');
    fireEvent.click(a);
    fireEvent.click(b);
    expect(onPick.mock.calls).toEqual([['b']]);
  });

  // The size a Text was given, read off its props: the browser resolves
  // react-native-web's font classes to its own default in jsdom.
  const sizeOf = (el: HTMLElement) => {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
    type Fiber = { memoizedProps?: { style?: unknown }; return?: Fiber };
    let f: Fiber | undefined = (el as unknown as Record<string, Fiber>)[key];
    while (f && !f.memoizedProps?.style) f = f.return;
    return (StyleSheet.flatten(f!.memoizedProps!.style as StyleProp<TextStyle>) ?? {}).fontSize;
  };

  // A row that launches rather than filters (owner, 25 Oct 2026): the
  // glyph over the word, larger, each item at least a target wide, and the
  // row's own spacing — the inline row's stays as it was.
  it('stacks the glyph over the word when asked, larger, at least a target wide', () => {
    const { unmount } = render(<UnderlineChoice items={items} chosen={null} onPick={() => {}} stacked testID="row" />);
    const cafes = screen.getByRole('button', { name: 'Cafés' });
    const box = cafes.firstElementChild as HTMLElement;
    expect(getComputedStyle(box).flexDirection).toBe('column');
    expect(getComputedStyle(box).minWidth).toBe('56px');
    expect(cafes.querySelector('[data-icon]')!.getAttribute('data-size')).toBe('22');
    expect(sizeOf(within(cafes).getByText('Cafés'))).toBe(13);
    expect(gapOf()).toBe('16px');
    // Afresh rather than re-rendered: the node keeps its first fiber.
    unmount();
    render(<UnderlineChoice items={items} chosen={null} onPick={() => {}} testID="row" />);
    const inline = screen.getByRole('button', { name: 'Cafés' });
    expect(getComputedStyle(inline.firstElementChild as HTMLElement).flexDirection).toBe('row');
    expect(inline.querySelector('[data-icon]')!.getAttribute('data-size')).toBe('16');
    expect(sizeOf(within(inline).getByText('Cafés'))).toBe(15);
    expect(gapOf()).toBe('22px');
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

// The button scale (owner, 28 Oct 2026): a chip draws at `CHIP_H` and, when
// it does something, reaches Apple's 44pt target with the slop rather than
// by drawing itself 44 tall, as it used to.
describe('Chip', () => {
  /** The props React committed for the first host element `pick` accepts. */
  const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, unknown> => {
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
  const face = () => StyleSheet.flatten(propsWhere((p) => 'contentStyle' in p).contentStyle as StyleProp<TextStyle>) ?? {};
  const slop = () => propsWhere((p) => 'contentStyle' in p).hitSlop;

  it('draws 32 tall and makes up the 44pt target above and below', () => {
    render(<Chip label="Hoàn Kiếm" onPress={() => {}} />);
    expect(face().minHeight).toBe(CHIP_H);
    expect(CHIP_H).toBe(32);
    expect(slop()).toEqual(CHIP_SLOP);
    expect(CHIP_H + CHIP_SLOP.top + CHIP_SLOP.bottom).toBe(SECONDARY_CONTROL_H);
  });

  it('is the same 32 when it only shows something, and takes no slop', () => {
    render(<Chip label="Cà phê" />);
    expect(face().minHeight).toBe(CHIP_H);
    expect(slop()).toBeUndefined();
  });
});
