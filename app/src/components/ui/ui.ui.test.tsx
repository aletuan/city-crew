// @vitest-environment jsdom
//
// The design system's own tests, for the two paths no screen's test
// happens to take. They were covered on average while `ui.tsx` was one
// file; split by concern (19 Oct 2026) each file is held on its own, and
// these are the paths that average was hiding.

import React from 'react';
import { Animated, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '../../uitest/render';

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

  it('chooses nothing when given nothing, and fades from the page’s colour to itself', () => {
    render(<UnderlineChoice items={items} chosen={null} onPick={() => {}} testID="row" />);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-selected'))).toEqual(['false', 'false']);
    const [from, to] = screen.getByTestId('row-fade').getAttribute('colors')!.split(',');
    expect(Object.values(bgHex)).toContain(to);
    expect(from).toBe(`${to}00`);
  });

  it('draws a fade with no name when the row has none', () => {
    const { container } = render(<UnderlineChoice items={items} chosen={null} onPick={() => {}} />);
    expect(container.querySelector('[data-stub="LinearGradient"]')!.getAttribute('data-testid')).toBeNull();
  });
});
