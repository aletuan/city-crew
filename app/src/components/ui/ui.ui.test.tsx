// @vitest-environment jsdom
//
// The design system's own tests, for the two paths no screen's test
// happens to take. They were covered on average while `ui.tsx` was one
// file; split by concern (19 Oct 2026) each file is held on its own, and
// these are the paths that average was hiding.

import React from 'react';
import { Animated, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../uitest/render';

vi.mock('../../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { Screen, useArrival } from './index';

describe('useArrival', () => {
  // A reader who asked for less motion gets the arrived state, not the
  // absence of it: held still, the value starts and stays at 1.
  it('parks at the arrived state when held still', () => {
    let seen: Animated.Value | null = null;
    const timing = vi.spyOn(Animated, 'timing');
    function Probe() {
      seen = useArrival(300, 0, true);
      return null;
    }
    render(<Probe />);
    expect((seen as unknown as { __getValue: () => number }).__getValue()).toBe(1);
    expect(timing).not.toHaveBeenCalled();
    timing.mockRestore();
  });

  it('starts from nothing and runs when it may move', () => {
    let seen: Animated.Value | null = null;
    const timing = vi.spyOn(Animated, 'timing');
    function Probe() {
      seen = useArrival(300, 40, false);
      return null;
    }
    render(<Probe />);
    expect(timing).toHaveBeenCalledWith(seen, expect.objectContaining({ toValue: 1, duration: 300, delay: 40 }));
    timing.mockRestore();
  });
});

describe('Screen', () => {
  // A plain string becomes the small line above the title; an element is
  // hung as it is (Explore hangs the weather off the date).
  it('sets a string eyebrow in the eyebrow face, above the title', () => {
    render(<Screen title="Trip" eyebrow="INVITATION"><Text>body</Text></Screen>);
    const eyebrow = screen.getByText('INVITATION');
    const title = screen.getByText('Trip');
    expect(eyebrow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hangs an element eyebrow as it is', () => {
    render(<Screen title="Trip" eyebrow={<Text testID="own">own line</Text>}><Text>body</Text></Screen>);
    expect(screen.getByTestId('own').textContent).toBe('own line');
  });
});
