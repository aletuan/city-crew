// @vitest-environment jsdom
// The rendering path itself, before anything of the app's is asked to use
// it. If this fails the other UI tests are failing about the harness.

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from './render';

describe('the react-native-web rendering path', () => {
  it('renders a native tree into the document', () => {
    render(<View><Text>Quán cà phê</Text></View>);
    expect(screen.getByText('Quán cà phê')).toBeTruthy();
  });

  it('delivers a press to its handler', () => {
    const onPress = vi.fn();
    render(<Pressable onPress={onPress}><Text>Save</Text></Pressable>);
    fireEvent.click(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledOnce();
  });
});
