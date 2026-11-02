// @vitest-environment jsdom
//
// Where the floating tab bar stands (owner, 2 Nov 2026): 60pt tall and
// 20pt off the screen's foot on a phone with a home indicator — Threads'
// and Instagram's shape, measured off the owner's screenshots — and the
// clearance every list pads by is the two together.

import React from 'react';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../uitest/render';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT, useTabBarClearance, useTabBarLift } from './layout';

const inset = vi.hoisted(() => ({ bottom: 34 }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: inset.bottom, left: 0, right: 0 }),
}));

function Probe() {
  return <Text testID="probe">{`${useTabBarLift()} ${useTabBarClearance(0)}`}</Text>;
}

describe('the tab bar’s place', () => {
  it('is 60 tall and 20 off the foot over a 34pt home indicator', () => {
    inset.bottom = 34;
    render(<Probe />);
    expect(TAB_BAR_HEIGHT).toBe(60);
    expect(screen.getByTestId('probe').textContent).toBe('20 80');
  });

  it('keeps its gap on a phone with no inset', () => {
    inset.bottom = 0;
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe(`${TAB_BAR_GAP} ${TAB_BAR_GAP + TAB_BAR_HEIGHT}`);
  });
});
