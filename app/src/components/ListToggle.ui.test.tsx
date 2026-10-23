// @vitest-environment jsdom
//
// The ⊕ / ✓ for one list. What is pinned: the glyph and the state a
// screen reader hears move together, the ticked disc is the save sheet's
// switched-on surface, the label names the list, and the photograph's
// size and glass are the bookmark's.

import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import ListToggle from './ListToggle';
import { colors, onPhoto } from '../theme';

const box = () => screen.getByRole('checkbox', { name: 'Add to Thảo Điền' });
const icon = () => box().querySelector('[data-icon]')!;

describe('ListToggle', () => {
  it('offers a ⊕ for a place not in the list, and says so', () => {
    const onPress = vi.fn();
    render(<ListToggle on={false} title="Thảo Điền" onPress={onPress} />);
    expect(box().getAttribute('aria-checked')).toBe('false');
    expect(icon().getAttribute('data-icon')).toBe('add');
    expect(icon().getAttribute('data-color')).toBe(String(colors.accent));
    fireEvent.click(box());
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('ticks a place in the list on the switched-on surface', () => {
    render(<ListToggle on title="Thảo Điền" onPress={() => {}} />);
    expect(box().getAttribute('aria-checked')).toBe('true');
    expect(icon().getAttribute('data-icon')).toBe('checkmark');
    expect(icon().getAttribute('data-color')).toBe(String(colors.accentInk));
    expect(disc().backgroundColor).toBe(colors.accentFill);
  });

  it('takes the bookmark’s disc on a photograph: 40pt, dark glass, a white ⊕', () => {
    render(<ListToggle on={false} title="Thảo Điền" onPress={() => {}} overPhoto />);
    expect(icon().getAttribute('data-color')).toBe(String(onPhoto.text));
    expect(icon().getAttribute('data-size')).toBe('22');
    expect([disc().width, disc().borderColor]).toEqual([40, onPhoto.line]);
  });

  it('is a row’s 34pt disc off one', () => {
    render(<ListToggle on={false} title="Thảo Điền" onPress={() => {}} />);
    expect(icon().getAttribute('data-size')).toBe('20');
    expect([disc().width, disc().backgroundColor]).toEqual([34, colors.surfaceGlass]);
  });
});

/** The disc's committed style — what `contentStyle` was handed. */
function disc(): ViewStyle {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && 'contentStyle' in p) return StyleSheet.flatten(p.contentStyle as StyleProp<ViewStyle>) ?? {};
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no disc');
}
