// @vitest-environment jsdom
//
// The one search box: what it shows, what it clears, what it is called.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
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

  it('offers a clear only once there is something to clear, and clears to nothing', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchField value="" onChangeText={onChange} placeholder="p" />);
    expect(screen.queryByTestId('search-clear')).toBeNull();
    rerender(<SearchField value="pho" onChangeText={onChange} placeholder="p" />);
    fireEvent.click(screen.getByTestId('search-clear'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('takes another id for a second box on the same screen', () => {
    render(<SearchField value="x" onChangeText={() => {}} placeholder="p" testID={{ input: 'visits-input', clear: 'visits-clear' }} />);
    expect(screen.getByTestId('visits-input')).toBeTruthy();
    expect(screen.getByTestId('visits-clear')).toBeTruthy();
  });
});
