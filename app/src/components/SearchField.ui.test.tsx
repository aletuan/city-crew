// @vitest-environment jsdom
//
// The one search box: what it shows, the Cancel inside it, what it is
// called — and the clear it no longer has.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';
import { act, fireEvent, render, screen } from '../uitest/render';
import { colors, PALETTES } from '../theme';
import SearchField from './SearchField';

describe('SearchField', () => {
  it('shows the magnifier, the words typed, and the placeholder when empty', () => {
    const onChange = vi.fn();
    render(<SearchField value="" onChangeText={onChange} placeholder="Find a place" />);
    expect(document.querySelector('[data-icon="search-outline"]')).toBeTruthy();
    const input = screen.getByTestId('search-input') as HTMLInputElement;
    expect(input.getAttribute('placeholder')).toBe('Find a place');
    fireEvent.change(input, { target: { value: 'pho' } });
    expect(onChange).toHaveBeenCalledWith('pho');
  });

  // Cancel is the one way out; there is no (x) to empty the words.
  it('has no clear, with words or without', () => {
    render(<SearchField value="pho" onChangeText={() => {}} placeholder="p" />);
    expect(screen.queryByLabelText('Clear')).toBeNull();
    expect(document.querySelector('[data-icon="close-circle"]')).toBeNull();
  });

  it('draws no Cancel unless the screen asks for one', () => {
    render(<SearchField value="" onChangeText={() => {}} placeholder="p" />);
    expect(screen.queryByTestId('search-cancel')).toBeNull();
    render(<SearchField value="" onChangeText={() => {}} placeholder="p" testID={{ input: 'b', cancel: 'b-cancel' }}
      cancel={{ shown: false, label: 'Cancel', onPress: () => {} }} />);
    expect(screen.queryByTestId('b-cancel')).toBeNull();
  });

  // Inside the box, as the box's own child: the frame keeps its width.
  // A cross in a 34pt circle (owner, 2 Nov 2026): the circle in the
  // theme's heavier glass, the cross in its accent, the word kept for
  // VoiceOver only.
  it('puts Cancel inside the box, a cross in the theme\u2019s glass and accent, and runs it on a tap', () => {
    const onPress = vi.fn();
    render(<SearchField value="hanoi" onChangeText={() => {}} placeholder="p"
      cancel={{ shown: true, label: 'Hủy', onPress }} />);
    const button = screen.getByTestId('search-cancel');
    expect(button.getAttribute('role')).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Hủy');
    const box = screen.getByTestId('search-input').parentElement!;
    expect(box.contains(button)).toBe(true);
    expect(button.textContent).toBe('');
    const face = getComputedStyle(button.firstElementChild as HTMLElement);
    expect(face.backgroundColor).toBe(String(colors.surfaceGlassStrong).replace(/,(?=\S)/g, ', '));
    expect([face.width, face.height, face.borderTopLeftRadius]).toEqual(['34px', '34px', '17px']);
    expect(getComputedStyle(box).paddingRight).toBe('4px');
    const cross = button.querySelector('[data-icon="close"]')!;
    expect(cross.getAttribute('data-color')).toBe(colors.accent);
    expect(cross.getAttribute('data-size')).toBe('18');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // The cross on its circle: the glass over the box's card over the page,
  // in every look. 3:1 is what a glyph owes; Coffee is the floor today, at
  // 3.68.
  it('keeps the cross at 3:1 or better on its circle, in every look', () => {
    const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const rgba = (h: string): number[] => h.startsWith('#')
      ? [...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), 1]
      : [.../\(([^)]+)\)/.exec(h)![1].split(',').map(Number), 1].slice(0, 4);
    const over = (top: number[], under: number[]) => under.slice(0, 3).map((c, i) => c * (1 - top[3]) + top[i] * top[3]);
    const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    let low = Infinity;
    for (const [name, p] of Object.entries(PALETTES)) {
      const card = over(rgba(p.surfaceCard), rgba(p.bg));
      const ground = over(rgba(p.surfaceGlassStrong), [...card, 1]);
      const [hi, lo] = [lum(rgba(p.accent)), lum(ground)].sort((x, y) => y - x);
      const k = (hi + 0.05) / (lo + 0.05);
      low = Math.min(low, k);
      expect([name, k >= 3]).toEqual([name, true]);
    }
    expect(low).toBeGreaterThan(3.6);
  });

  // The slide is configured before the render that moves things: on the
  // focus that opens, and on the tap that closes — and not on a focus
  // that changes nothing.
  it('slides Cancel in on the focus that opens, and out on the tap', () => {
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    const onFocus = vi.fn();
    const { rerender } = render(<SearchField value="" onChangeText={() => {}} placeholder="p" onFocus={onFocus}
      cancel={{ shown: false, label: 'Cancel', onPress: () => {} }} />);
    fireEvent.focus(screen.getByTestId('search-input'));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    rerender(<SearchField value="" onChangeText={() => {}} placeholder="p" onFocus={onFocus}
      cancel={{ shown: true, label: 'Cancel', onPress: () => {} }} />);
    fireEvent.focus(screen.getByTestId('search-input'));
    expect(spy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('search-cancel'));
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  // Reduce Motion on: Cancel simply appears and goes, without the slide.
  it('does not slide under Reduce Motion', async () => {
    const still = vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    render(<SearchField value="" onChangeText={() => {}} placeholder="p"
      cancel={{ shown: false, label: 'Cancel', onPress: () => {} }} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.focus(screen.getByTestId('search-input'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    still.mockRestore();
  });

  it('takes another id for a second box on the same screen', () => {
    render(<SearchField value="x" onChangeText={() => {}} placeholder="p" testID={{ input: 'visits-input', cancel: 'visits-cancel' }}
      cancel={{ shown: true, label: 'Cancel', onPress: () => {} }} />);
    expect(screen.getByTestId('visits-input')).toBeTruthy();
    expect(screen.getByTestId('visits-cancel')).toBeTruthy();
  });
});
