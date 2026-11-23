// @vitest-environment jsdom
//
// Planning from a list, and the dock that offers it (F1 step 4, 23 Nov
// 2026). The screen's own tests drive most of this through the page;
// these two are the parts the page cannot reach: the screen's tests run
// with no tab bar to duck, and a list that has not loaded yet has no plan
// to hand the planner.

import React from 'react';
import { Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '../../uitest/render';
import type { Collection } from '../../lib/data';
import type { Place } from '../../lib/types';
import type { Nav } from '../../nav';

const spies = vi.hoisted(() => ({ goTo: vi.fn() }));
vi.mock('../../nav', async (orig) => ({ ...(await orig<Record<string, unknown>>()), goTo: spies.goTo }));
vi.mock('../../components/tabBarDuck', () => ({ useTabBarDucked: () => true }));
vi.mock('../../components/DockSlot', () => ({ useDockOffer: (on: boolean) => on }));

import { usePlanDock } from './usePlanDock';

const list = { slug: 'old-quarter' } as Collection;
const place = { slug: 'pho-10' } as Place;
const nav = {} as Nav;

function Probe({ col, duckScroll, onScrolled }: {
  col: Collection | null;
  duckScroll?: (e: unknown) => void;
  onScrolled: (e: unknown) => void;
}) {
  const { plan, onListScroll } = usePlanDock({
    col, members: [place], navigation: nav, duckScroll: duckScroll as never, onScrolled, lift: null,
  });
  return (
    <>
      <Text testID="plan" onPress={plan}>plan</Text>
      <Text
        testID="scroll"
        onPress={() => onListScroll({ nativeEvent: { contentOffset: { y: 10 } } } as never)}
      >
        scroll
      </Text>
    </>
  );
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('usePlanDock', () => {
  it('hands the planner nothing while the list has not loaded', () => {
    render(<Probe col={null} onScrolled={() => {}} />);
    fireEvent.click(screen.getByTestId('plan'));
    expect(spies.goTo).not.toHaveBeenCalled();
  });

  it('hands the planner the list it is on', () => {
    render(<Probe col={list} onScrolled={() => {}} />);
    fireEvent.click(screen.getByTestId('plan'));
    expect(spies.goTo).toHaveBeenCalledWith('Ideas', expect.objectContaining({
      screen: 'IdeasHome', params: expect.objectContaining({ from: 'old-quarter' }),
    }));
  });

  // One scroll, read three ways: the tab bar ducks, the drag follows,
  // and the dock learns whether the card has gone.
  it('passes the scroll to the tab bar and to the drag', () => {
    const duckScroll = vi.fn();
    const onScrolled = vi.fn();
    render(<Probe col={list} duckScroll={duckScroll} onScrolled={onScrolled} />);
    fireEvent.click(screen.getByTestId('scroll'));
    expect(duckScroll).toHaveBeenCalledTimes(1);
    expect(onScrolled).toHaveBeenCalledWith({ contentOffset: { y: 10 } });
  });
});
