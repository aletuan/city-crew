// @vitest-environment jsdom
//
// Whether the keyboard is up: true from the moment it starts to rise,
// false from the moment it starts to fall, and no longer listening once
// whoever asked has gone.

import React from 'react';
import { Keyboard, Text } from 'react-native';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '../uitest/render';
import { useKeyboardUp } from './keyboard';

function Probe() {
  return <Text testID="up">{useKeyboardUp() ? 'up' : 'down'}</Text>;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('follows the keyboard up and down, and stops listening on leaving', () => {
  const heard: Record<string, () => void> = {};
  const removed: string[] = [];
  vi.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
    heard[event] = cb;
    return { remove: () => { removed.push(event); } };
  }) as never);
  const { unmount } = render(<Probe />);
  const up = () => screen.getByTestId('up').textContent;
  expect(up()).toBe('down');
  act(() => heard.keyboardWillShow());
  expect(up()).toBe('up');
  act(() => heard.keyboardWillHide());
  expect(up()).toBe('down');
  unmount();
  expect(removed.sort()).toEqual(['keyboardWillHide', 'keyboardWillShow']);
});
