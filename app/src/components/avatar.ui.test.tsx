// @vitest-environment jsdom
//
// The face circle every person row borrows.
//
// Two things the crew list needed of it, pinned here rather than in each
// screen that draws one: the picture is asked for from memory as well as
// disk, the cache `CrewProvider` prefetches into, and the blank disc
// stands behind it while it is on its way.

import React from 'react';
import { StyleSheet } from 'react-native';
import { expect, it } from 'vitest';
import { render } from '../uitest/render';
import { colors } from '../theme';
import { Avatar } from './ui';

it('reads the picture from memory, over the blank disc', () => {
  const { container } = render(<Avatar url="https://cdn/f1.jpg?v=1" size={44} />);
  const img = container.querySelector('img')!;
  expect(img.getAttribute('src')).toBe('https://cdn/f1.jpg?v=1');
  expect(img.getAttribute('cachepolicy')).toBe('memory-disk');
  // The mock's `img` cannot carry a style array, so read the prop the
  // circle handed it, the way the native view receives it.
  const key = Object.keys(img).find((k) => k.startsWith('__reactProps'))!;
  const style = StyleSheet.flatten((img as unknown as Record<string, { style: never }>)[key].style);
  expect(style).toMatchObject({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceGlass });
});

// The bundled animals (`lib/avatars`) by name, and a name this build does
// not know as the blank disc rather than an address to fetch.
it('draws a preset animal from the app, and an unknown one as the blank disc', () => {
  const { container, unmount } = render(<Avatar url="preset:kookaburra" size={44} />);
  expect(container.querySelector('img')!.getAttribute('src')).toMatch(/assets\/avatars\/kookaburra\.jpg$/);
  unmount();
  const other = render(<Avatar url="preset:dingo" size={44} />);
  expect(other.container.querySelector('img')).toBeNull();
  expect(other.container.querySelector('[data-icon="person-outline"]')).toBeTruthy();
});
