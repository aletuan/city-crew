// @vitest-environment jsdom
//
// The three shapes in `add.tsx` are drawn through the screens that use
// them, and every screen test looks at its own words rather than the
// shape's. What is pinned here is the one fact the shapes share with the
// rest of the app and nobody else asserts: the chevron that ends a row is
// 17pt in the tertiary ink, everywhere a row goes somewhere.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import { AddPill, AddSlot } from './add';
import { colors } from '../theme';

describe('AddSlot', () => {
  it('ends with the row-end chevron at the app\'s one size, and opens on a tap', () => {
    const onPress = vi.fn();
    render(<AddSlot title="New collection" subtitle="Group places for your next plan" onPress={onPress} />);
    const chevron = document.querySelector('[data-icon="chevron-forward"]')!;
    expect(chevron.getAttribute('data-size')).toBe('17');
    expect(chevron.getAttribute('data-color')).toBe(colors.textTertiary);
    fireEvent.click(screen.getByRole('button', { name: /New collection/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('AddPill', () => {
  it('keeps its word while busy and swaps the plus for a spinner', () => {
    const { rerender } = render(<AddPill label="Add" onPress={() => {}} />);
    expect(document.querySelector('[data-icon="add"]')).toBeTruthy();
    rerender(<AddPill label="Add" onPress={() => {}} busy />);
    expect(screen.getByText('Add')).toBeTruthy();
    expect(document.querySelector('[data-icon="add"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add' }).getAttribute('aria-busy')).toBe('true');
  });
});
