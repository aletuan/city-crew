// @vitest-environment jsdom
//
// The three shapes in `add.tsx` are drawn through the screens that use
// them, and every screen test looks at its own words rather than the
// shape's. What is pinned here is the one fact the shapes share with the
// rest of the app and nobody else asserts: the chevron that ends a row is
// 17pt in the tertiary ink, everywhere a row goes somewhere.

import React from 'react';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import { AddCell, AddPill, AddSlot } from './add';
import { colors, space } from '../theme';

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

// A plus and a word, the plus the owner's mockup chose (22 Oct 2026):
// the bare one, not a picture with a plus, since what it adds is a place.
describe('AddCell', () => {
  it('is a tile the side it is given, and a row the list’s width without one', () => {
    const onPress = vi.fn();
    const { rerender } = render(<AddCell label="Add place" size={110} onPress={onPress} testID="cell" />);
    const box = () => screen.getByTestId('cell').firstElementChild as HTMLElement;
    expect([box().style.width, box().style.height]).toEqual(['110px', '110px']);
    expect(document.querySelector('[data-icon="add"]')!.getAttribute('data-size')).toBe('24');
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<AddCell label="Add place" onPress={onPress} testID="cell" />);
    expect(box().style.width).toBe('');
    expect(getComputedStyle(screen.getByTestId('cell')).marginLeft).toBe(`${space.page}px`);
    expect(document.querySelector('[data-icon="add"]')).toBeTruthy();
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

  // Two heights and one of everything else. `tall` is the 44 every
  // control in a header or the dock has; beside a section heading the
  // pill sizes to its content. The word and the plus never change size:
  // the 14pt word and 16pt plus of the old `compact` made the dock's
  // "Add" a different button from Gallery's.
  //
  // Read off the committed props: the gradient is a stub under jsdom, so
  // its style never reaches the DOM, and react-native-web's atomic font
  // classes do not resolve to the size they name there.
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
  const pill = () => StyleSheet.flatten(propsWhere((p) => 'colors' in p).style as StyleProp<ViewStyle>) ?? {};
  const word = () => StyleSheet.flatten(propsWhere((p) => p.children === 'Add' && 'style' in p).style as StyleProp<TextStyle>) ?? {};

  it('stands at 44 when tall and sizes to its content otherwise', () => {
    const { rerender } = render(<AddPill label="Add" onPress={() => {}} tall />);
    expect(pill().minHeight).toBe(44);
    rerender(<AddPill label="Add" onPress={() => {}} />);
    expect(pill().minHeight).toBeUndefined();
  });

  // The header's weight (owner, 26 Oct 2026): the round buttons' glass,
  // the body's ink, the plus in the accent — and no gradient at all.
  const glass = () => StyleSheet.flatten(propsWhere((p) => {
    const st = StyleSheet.flatten(p.style as StyleProp<ViewStyle>);
    return !!st && st.backgroundColor === colors.surfaceGlass;
  }).style as StyleProp<ViewStyle>) ?? {};

  it('is glass, not the gradient, when quiet — at the same height and size', () => {
    const { rerender } = render(<AddPill label="Add" onPress={() => {}} tall />);
    expect(document.querySelector('[data-stub="LinearGradient"]')).toBeTruthy();
    expect(word().color).toBe(colors.accentInk);
    expect(document.querySelector('[data-icon="add"]')!.getAttribute('data-color')).toBe(colors.accentInk);
    rerender(<AddPill label="Add" onPress={() => {}} tall quiet />);
    expect(document.querySelector('[data-stub="LinearGradient"]')).toBeNull();
    expect(glass().minHeight).toBe(44);
    expect(word().color).toBe(colors.text);
    expect(word().fontSize).toBe(16);
    const plus = document.querySelector('[data-icon="add"]')!;
    expect(plus.getAttribute('data-color')).toBe(colors.accent);
    expect(plus.getAttribute('data-size')).toBe('18');
  });

  it('keeps the quiet pill quiet while busy, its spinner in the accent', () => {
    render(<AddPill label="Add" onPress={() => {}} tall quiet busy />);
    expect(document.querySelector('[data-stub="LinearGradient"]')).toBeNull();
    expect(screen.getByText('Add')).toBeTruthy();
    expect(propsWhere((p) => 'animating' in p || ('size' in p && p.size === 'small')).color).toBe(colors.accent);
  });

  it('draws the same word and plus at either height', () => {
    const { rerender } = render(<AddPill label="Add" onPress={() => {}} tall />);
    expect(word().fontSize).toBe(16);
    expect(document.querySelector('[data-icon="add"]')!.getAttribute('data-size')).toBe('18');
    rerender(<AddPill label="Add" onPress={() => {}} />);
    expect(word().fontSize).toBe(16);
    expect(document.querySelector('[data-icon="add"]')!.getAttribute('data-size')).toBe('18');
  });
});
