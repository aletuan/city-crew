// @vitest-environment jsdom
//
// The one search box: what it shows, the Cancel inside it, what it is
// called — and the clear it no longer has.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';
import { act, fireEvent, render, screen } from '../uitest/render';
import { colors } from '../theme';
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
  it('puts Cancel inside the box, in the theme’s glass and accent, and runs it on a tap', () => {
    const onPress = vi.fn();
    render(<SearchField value="hanoi" onChangeText={() => {}} placeholder="p"
      cancel={{ shown: true, label: 'Hủy', onPress }} />);
    const button = screen.getByTestId('search-cancel');
    expect(button.getAttribute('role')).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Hủy');
    const box = screen.getByTestId('search-input').parentElement!;
    expect(box.contains(button)).toBe(true);
    const pill = getComputedStyle(button.firstElementChild as HTMLElement);
    expect(pill.backgroundColor).toBe(String(colors.surfaceGlassStrong).replace(/,(?=\S)/g, ', '));
    const word = button.querySelector('div[dir="auto"]') as HTMLElement;
    expect(word.textContent).toBe('Hủy');
    const hex = String(colors.accent);
    const n = parseInt(hex.slice(1), 16);
    expect(getComputedStyle(word).color).toBe(hex.startsWith('#') ? `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})` : hex);
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
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
