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
import { colors, font, PALETTES, space, textTertiaryHex } from '../theme';
import { SECONDARY_CONTROL_H } from './ui';

// The app's scheme, which the tile's ring is picked by in JS: a `dyn`
// pair on a border follows the phone, not the app (see `bgHex`).
const theme = vi.hoisted(() => ({ scheme: 'light' as 'light' | 'dark' }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: theme.scheme }) }));

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

// A style as it was committed, for what jsdom cannot report: the gradient
// is a stub there, and react-native-web's atomic font classes do not
// resolve to the size they name.
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

// A plus and a word, the plus the owner's mockup chose (22 Oct 2026). The
// tile has since gained a little map (owner, 1 Nov 2026); the row has not.
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

  // The plus in a dashed 44pt ring, alone in the middle of the tile
  // (owner, 14 Nov 2026; it was a photo tile's anatomy from 2 Nov, the
  // word along the foot): no word drawn, no drawing, and no dashes on the
  // tile's own edge. The row keeps its dashes and its word. The count the
  // tile carried in its corner moved to the card on 13 Nov (owner).
  it('draws the tile as the ring alone in its middle, and keeps the word for whoever hears it', () => {
    const { rerender } = render(<AddCell label="Add place" size={110} onPress={() => {}} testID="cell" />);
    const face = () => screen.getByTestId('cell').firstElementChild as HTMLElement;
    expect(screen.getByTestId('cell').getAttribute('aria-label')).toBe('Add place');
    expect(document.querySelector('[data-icon="location-outline"]')).toBeNull();
    expect(document.querySelector('[data-stub="Svg"]')).toBeNull();
    expect(getComputedStyle(face()).borderTopStyle).not.toBe('dashed');
    // Nothing in the tile but the ring, centred both ways with nothing
    // lifting it off the middle: the word is said, not shown.
    expect(screen.queryByText('Add place')).toBeNull();
    expect(face().textContent).toBe('');
    expect(face().childElementCount).toBe(1);
    const tile = getComputedStyle(face());
    expect([tile.alignItems, tile.justifyContent]).toEqual(['center', 'center']);
    // The plus, in the accent, inside the button scale's 44pt ring: dashed,
    // unfilled, and in the tertiary ink for the app's own scheme.
    const plus = document.querySelector('[data-icon="add"]')!;
    expect(plus.getAttribute('data-color')).toBe(colors.accent);
    const ring = plus.parentElement as HTMLElement;
    expect([getComputedStyle(ring).width, getComputedStyle(ring).height])
      .toEqual([`${SECONDARY_CONTROL_H}px`, `${SECONDARY_CONTROL_H}px`]);
    expect(getComputedStyle(ring).borderTopStyle).toBe('dashed');
    expect(getComputedStyle(ring).borderTopWidth).toBe('1px');
    expect(getComputedStyle(ring).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(ring).marginTop).toBe('0px');
    const ink = (c: string) => { const d = document.createElement('div'); d.style.color = c; return d.style.color; };
    expect(ring.style.borderTopColor).toBe(ink(textTertiaryHex.light));
    rerender(<AddCell label="Add place" onPress={() => {}} testID="cell" />);
    expect(getComputedStyle(face()).borderTopStyle).toBe('dashed');
    expect(screen.getByTestId('cell').getAttribute('aria-label')).toBe('Add place');
    // The row shows its word: a row of one plus says nothing.
    expect(screen.getByText('Add place')).toBeTruthy();
    expect(document.querySelector('[data-icon="location-outline"]')).toBeNull();
  });

  // The ring is picked by the app's scheme, not the phone's: on a phone in
  // Dark under the app's Light, a `dyn` ring would draw the dark side's ink.
  it('rings the plus in the tertiary ink of the app\u2019s own scheme', () => {
    const ink = (c: string) => { const d = document.createElement('div'); d.style.color = c; return d.style.color; };
    const ring = () => (document.querySelector('[data-icon="add"]')!.parentElement as HTMLElement).style.borderTopColor;
    theme.scheme = 'dark';
    const { unmount } = render(<AddCell label="Add place" size={110} onPress={() => {}} />);
    expect(ring()).toBe(ink(textTertiaryHex.dark));
    unmount();
    theme.scheme = 'light';
    render(<AddCell label="Add place" size={110} onPress={() => {}} />);
    expect(ring()).toBe(ink(textTertiaryHex.light));
    // The standard look's own tertiary ink, the one the contrast below is
    // worked out for.
    expect(textTertiaryHex).toEqual({ light: PALETTES.paper.textTertiary, dark: PALETTES.charcoal.textTertiary });
    expect(textTertiaryHex.light).not.toBe(textTertiaryHex.dark);
  });

  // The ring is a control's outline and the plus a glyph: both owe 3:1 to
  // the tint over the page they sit on, in every look. The lowest today are
  // the ring on Chocolate (3.68) and the plus on Paper (4.14).
  it('keeps the ring and the plus at 3:1 or better on the tile, in every look', () => {
    const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    let low = Infinity;
    for (const [name, p] of Object.entries(PALETTES)) {
      const [, r, g, b, a] = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(p.accentSoft)!.map(Number);
      const ground = hex(p.bg).map((c, i) => c * (1 - a) + [r, g, b][i] * a);
      for (const ink of [p.textTertiary, p.accent]) {
        const k = ratio(hex(ink), ground);
        low = Math.min(low, k);
        expect([name, ink, k >= 3]).toEqual([name, ink, true]);
      }
    }
    expect(low).toBeGreaterThan(3.6);
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

  // One height and one of everything else: the button scale's 44, the
  // height of every control in a header or a dock (owner, 28 Oct 2026). A
  // padding-sized second height beside section headings went when every
  // caller had come to ask for the 44. The word and the plus never change
  // size: the 14pt word and 16pt plus of the old `compact` made the dock's
  // "Add" a different button from Gallery's.
  //
  // Read off the committed props — see `propsWhere`.
  const pill = () => StyleSheet.flatten(propsWhere((p) => 'colors' in p).style as StyleProp<ViewStyle>) ?? {};
  const word = () => StyleSheet.flatten(propsWhere((p) => p.children === 'Add' && 'style' in p).style as StyleProp<TextStyle>) ?? {};

  it('stands at the secondary 44, filled or quiet', () => {
    const { rerender } = render(<AddPill label="Add" onPress={() => {}} />);
    expect(pill().minHeight).toBe(SECONDARY_CONTROL_H);
    expect(SECONDARY_CONTROL_H).toBe(44);
    rerender(<AddPill label="Add" onPress={() => {}} quiet />);
    expect(bare().minHeight).toBe(44);
  });

  // The header's weight (owner, 26 Oct 2026), bare since 14 Nov 2026: no
  // ground and no gradient, the word and the plus in the accent.
  const bare = () => StyleSheet.flatten(propsWhere((p) => {
    const st = StyleSheet.flatten(p.style as StyleProp<ViewStyle>);
    return !!st && st.minHeight === 44 && st.paddingLeft === 12;
  }).style as StyleProp<ViewStyle>) ?? {};

  it('is bare, not glass and not the gradient, when quiet — at the same height and size', () => {
    const { rerender } = render(<AddPill label="Add" onPress={() => {}} />);
    expect(document.querySelector('[data-stub="LinearGradient"]')).toBeTruthy();
    expect(word().color).toBe(colors.accentInk);
    expect(document.querySelector('[data-icon="add"]')!.getAttribute('data-color')).toBe(colors.accentInk);
    rerender(<AddPill label="Add" onPress={() => {}} quiet />);
    expect(document.querySelector('[data-stub="LinearGradient"]')).toBeNull();
    expect(bare().minHeight).toBe(44);
    expect(bare().backgroundColor).toBeUndefined();
    expect(word().color).toBe(colors.accent);
    expect(word().fontSize).toBe(16);
    const plus = document.querySelector('[data-icon="add"]')!;
    expect(plus.getAttribute('data-color')).toBe(colors.accent);
    expect(plus.getAttribute('data-size')).toBe('18');
  });

  it('keeps the quiet pill quiet while busy, its spinner in the accent', () => {
    render(<AddPill label="Add" onPress={() => {}} quiet busy />);
    expect(document.querySelector('[data-stub="LinearGradient"]')).toBeNull();
    expect(screen.getByText('Add')).toBeTruthy();
    expect(propsWhere((p) => 'animating' in p || ('size' in p && p.size === 'small')).color).toBe(colors.accent);
  });

  // Lighter beside a title (owner, 3 Nov 2026): the quiet word in medium
  // and 12/16 of side padding; the filled pill in the docks keeps its
  // semibold and its 14/18.
  it('sets the quiet word in medium on narrower sides, and leaves the filled pill as it was', () => {
    const { rerender } = render(<AddPill label="Add" onPress={() => {}} />);
    expect(word().fontWeight).toBe(font.semibold);
    expect([pill().paddingLeft, pill().paddingRight]).toEqual([14, 18]);
    rerender(<AddPill label="Add" onPress={() => {}} quiet />);
    expect(word().fontWeight).toBe(font.medium);
    expect([bare().paddingLeft, bare().paddingRight, bare().minHeight]).toEqual([12, 16, 44]);
  });

  // With no ground, the box's right padding is given back past the margin
  // so the word's end meets the content's right edge, as the bare chevron
  // hangs at the other end. Only the quiet pill: a filled one's edge is
  // its own line.
  it('hangs the quiet pill by its right padding, and only the quiet one', () => {
    const { rerender } = render(<AddPill label="Add" onPress={() => {}} quiet />);
    const hung = () => propsWhere((p) => 'onPress' in p && 'accessibilityRole' in p);
    expect(StyleSheet.flatten(hung().style as StyleProp<ViewStyle>)?.marginRight).toBe(-16);
    rerender(<AddPill label="Add" onPress={() => {}} />);
    expect(StyleSheet.flatten(hung().style as StyleProp<ViewStyle>)?.marginRight).toBeUndefined();
  });

  // Every look's own page and accent — the pill has no colour of its own,
  // so it changes with the look chosen in Profile. Worked out on each
  // look's page, which is what it now stands on: the word owes 4.5:1 at
  // 16pt medium, and the plus is the same ink.
  it('keeps the quiet word and plus readable on the page, in every look', () => {
    const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const rgba = (h: string): number[] => h.startsWith('#')
      ? [...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), 1]
      : [.../\(([^)]+)\)/.exec(h)![1].split(',').map(Number), 1].slice(0, 4);
    const over = (top: number[], under: number[]) => under.slice(0, 3).map((c, i) => c * (1 - top[3]) + top[i] * top[3]);
    const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a: number[], b: number[]) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    for (const [name, p] of Object.entries(PALETTES)) {
      const ground = over([0, 0, 0, 0], rgba(p.bg));
      expect([name, 'word', ratio(rgba(p.accent), ground) >= 4.5]).toEqual([name, 'word', true]);
    }
    // And it draws those tokens, not a colour of its own.
    render(<AddPill label="Add" onPress={() => {}} quiet />);
    expect(bare().backgroundColor).toBeUndefined();
    expect(word().color).toBe(colors.accent);
  });

  it('draws the 16pt word and the 18pt plus', () => {
    render(<AddPill label="Add" onPress={() => {}} />);
    expect(word().fontSize).toBe(16);
    expect(document.querySelector('[data-icon="add"]')!.getAttribute('data-size')).toBe('18');
  });
});
